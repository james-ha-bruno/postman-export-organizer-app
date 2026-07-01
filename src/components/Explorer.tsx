import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type {
  AdvancedFilters,
  AnalysisResult,
  WorkspaceAnalysis,
  SortField,
  SortDirection,
  WorkspaceTypeFilter,
  DuplicateFilter,
  OwnerFilter,
  SourceMode,
} from "../types";
import { DEFAULT_ADVANCED_FILTERS } from "../types";
import { getOwnerKey, slugifyOwner, UNKNOWN_OWNER_KEY, UNKNOWN_OWNER_LABEL } from "../lib/owner";
import { applyAdvancedFilters } from "../lib/filters";
import SummaryBar from "./SummaryBar";
import SearchFilter, { type OwnerOption } from "./SearchFilter";
import AdvancedFiltersPanel from "./AdvancedFilters";
import WorkspaceCard from "./WorkspaceCard";
import ExportPanel from "./ExportPanel";

interface ExplorerProps {
  analysis: AnalysisResult;
  exportPath: string;
  sourceMode: SourceMode;
  onBack: () => void;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

function hasDuplicates(w: WorkspaceAnalysis): boolean {
  return (
    w.duplicate_requests.exact_count > 0 ||
    w.duplicate_requests.possible_count > 0 ||
    w.duplicate_collections.name_duplicates.length > 0 ||
    w.duplicate_collections.content_duplicates.length > 0
  );
}

export default function Explorer({ analysis, exportPath, sourceMode, onBack }: ExplorerProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WorkspaceTypeFilter>("all");
  const [duplicateFilter, setDuplicateFilter] = useState<DuplicateFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [exportingOwnerZip, setExportingOwnerZip] = useState(false);
  const [exportingOwnerBrunoZip, setExportingOwnerBrunoZip] = useState(false);
  const [ownerToast, setOwnerToast] = useState<Toast | null>(null);

  // Single source of truth: advanced filters narrow the analysis once and
  // every consumer (visible list, ExportPanel, per-owner ZIP) sees the same view.
  const baseFilteredAnalysis = useMemo(
    () => applyAdvancedFilters(analysis, advancedFilters),
    [analysis, advancedFilters],
  );

  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const named = new Set<string>();
    let hasUnknown = false;
    for (const w of baseFilteredAnalysis.workspaces) {
      const key = getOwnerKey(w);
      if (key === UNKNOWN_OWNER_KEY) {
        hasUnknown = true;
      } else {
        named.add(key);
      }
    }
    const sorted = Array.from(named).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const opts: OwnerOption[] = sorted.map((name) => ({ value: name, label: name }));
    if (hasUnknown) opts.push({ value: UNKNOWN_OWNER_KEY, label: UNKNOWN_OWNER_LABEL });
    return opts;
  }, [baseFilteredAnalysis.workspaces]);

  const filtered = useMemo(() => {
    let result = baseFilteredAnalysis.workspaces;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((w) => w.workspace_name.toLowerCase().includes(q));
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((w) => w.workspace_type === typeFilter);
    }

    // Duplicate filter
    if (duplicateFilter === "has_duplicates") {
      result = result.filter(hasDuplicates);
    } else if (duplicateFilter === "no_duplicates") {
      result = result.filter((w) => !hasDuplicates(w));
    }

    // Owner filter
    if (ownerFilter !== "all") {
      result = result.filter((w) => getOwnerKey(w) === ownerFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.workspace_name.localeCompare(b.workspace_name);
          break;
        case "collections":
          cmp = a.collection_count - b.collection_count;
          break;
        case "requests":
          cmp = a.request_count - b.request_count;
          break;
        case "updated":
          cmp = (a.updated_at || "").localeCompare(b.updated_at || "");
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [baseFilteredAnalysis.workspaces, search, typeFilter, duplicateFilter, ownerFilter, sortField, sortDirection]);

  // Workspaces matching only the owner filter — used to build the per-owner ZIP
  // (independent of search/type/duplicate filters so behaviour stays predictable).
  // Sourced from the advanced-filtered analysis so the per-owner ZIP respects
  // the same filters the user sees.
  const ownerScopedWorkspaces = useMemo(() => {
    if (ownerFilter === "all") return [];
    return baseFilteredAnalysis.workspaces.filter((w) => getOwnerKey(w) === ownerFilter);
  }, [baseFilteredAnalysis.workspaces, ownerFilter]);

  const ownerLabel = ownerFilter === "all"
    ? ""
    : ownerFilter === UNKNOWN_OWNER_KEY
      ? UNKNOWN_OWNER_LABEL
      : ownerFilter;

  const showToast = (t: Toast) => {
    setOwnerToast(t);
    setTimeout(() => setOwnerToast(null), 4000);
  };

  const handleExportOwnerZip = async () => {
    if (ownerFilter === "all" || ownerScopedWorkspaces.length === 0) return;
    try {
      setExportingOwnerZip(true);
      const slug = slugifyOwner(ownerLabel) || "owner";
      const outputPath = await save({
        defaultPath: `postman-export-${slug}.zip`,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!outputPath) {
        setExportingOwnerZip(false);
        return;
      }
      const filteredAnalysis: AnalysisResult = {
        generated_at: baseFilteredAnalysis.generated_at,
        workspaces: ownerScopedWorkspaces,
      };
      const analysisJson = JSON.stringify(filteredAnalysis);
      let result: string;
      if (sourceMode === "api") {
        result = await invoke<string>("export_organized_zip_from_api", { analysisJson, outputPath });
      } else {
        result = await invoke<string>("export_organized_zip", { analysisJson, exportPath, outputPath });
      }
      showToast({ type: "success", message: `Exported to ${result}` });
    } catch (err) {
      showToast({ type: "error", message: String(err) });
    } finally {
      setExportingOwnerZip(false);
    }
  };

  const handleExportOwnerBrunoZip = async () => {
    if (ownerFilter === "all" || ownerScopedWorkspaces.length === 0) return;
    try {
      setExportingOwnerBrunoZip(true);
      const slug = slugifyOwner(ownerLabel) || "owner";
      const outputPath = await save({
        defaultPath: `postman-export-bruno-${slug}.zip`,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!outputPath) {
        setExportingOwnerBrunoZip(false);
        return;
      }
      const filteredAnalysis: AnalysisResult = {
        generated_at: baseFilteredAnalysis.generated_at,
        workspaces: ownerScopedWorkspaces,
      };
      const analysisJson = JSON.stringify(filteredAnalysis);
      let result: string;
      if (sourceMode === "api") {
        result = await invoke<string>("export_bruno_zip_from_api", { analysisJson, outputPath });
      } else {
        result = await invoke<string>("export_bruno_zip", { analysisJson, exportPath, outputPath });
      }
      showToast({ type: "success", message: `Exported to ${result}` });
    } catch (err) {
      showToast({ type: "error", message: String(err) });
    } finally {
      setExportingOwnerBrunoZip(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors
              hover:bg-gray-100 hover:text-gray-900
              dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Setup
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Analyzed {new Date(analysis.generated_at).toLocaleString()}
          </p>
        </div>

        {/* Summary */}
        <SummaryBar analysis={analysis} />

        {/* Filters */}
        <SearchFilter
          search={search} onSearchChange={setSearch}
          typeFilter={typeFilter} onTypeFilterChange={setTypeFilter}
          duplicateFilter={duplicateFilter} onDuplicateFilterChange={setDuplicateFilter}
          ownerFilter={ownerFilter} onOwnerFilterChange={setOwnerFilter} ownerOptions={ownerOptions}
          sortField={sortField} onSortFieldChange={setSortField}
          sortDirection={sortDirection} onSortDirectionChange={setSortDirection}
        />

        {/* Advanced filters */}
        <AdvancedFiltersPanel filters={advancedFilters} onChange={setAdvancedFilters} />

        {/* Results count + per-owner ZIP */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length === analysis.workspaces.length
              ? `${filtered.length} workspaces`
              : `${filtered.length} of ${analysis.workspaces.length} workspaces`}
          </p>
          {ownerFilter !== "all" && ownerScopedWorkspaces.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportOwnerZip}
                disabled={exportingOwnerZip || exportingOwnerBrunoZip}
                title={`Download an organized ZIP containing only ${ownerLabel}'s workspaces`}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors
                  hover:bg-gray-50
                  disabled:cursor-not-allowed disabled:opacity-50
                  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                {exportingOwnerZip ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                )}
                Download ZIP for {ownerLabel}
              </button>
              <button
                type="button"
                onClick={handleExportOwnerBrunoZip}
                disabled={exportingOwnerZip || exportingOwnerBrunoZip}
                title={`Download a Bruno-compatible bulk-import ZIP containing only ${ownerLabel}'s workspaces`}
                aria-label={`Bruno ZIP for ${ownerLabel}`}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors
                  hover:bg-gray-50
                  disabled:cursor-not-allowed disabled:opacity-50
                  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                {exportingOwnerBrunoZip ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v3m18 0v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8m18 0H3m6 4h6" /></svg>
                )}
                Bruno ZIP for {ownerLabel}
              </button>
            </div>
          )}
        </div>

        {/* Owner export toast */}
        {ownerToast && (
          <div
            role="status"
            className={`animate-fade-in rounded-lg px-4 py-2 text-sm
              ${ownerToast.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              }`}
          >
            {ownerToast.message}
          </div>
        )}

        {/* Workspace cards */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-white py-12 text-center shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">No workspaces match your filters</p>
            </div>
          ) : (
            filtered.map((w) => <WorkspaceCard key={w.workspace_id} workspace={w} exportPath={exportPath} sourceMode={sourceMode} analysis={baseFilteredAnalysis} />)
          )}
        </div>

        {/* Export panel */}
        <ExportPanel analysis={baseFilteredAnalysis} exportPath={exportPath} sourceMode={sourceMode} />
      </div>
    </div>
  );
}

