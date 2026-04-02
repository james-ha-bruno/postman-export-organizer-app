import { useState, useMemo } from "react";
import type {
  AnalysisResult,
  WorkspaceAnalysis,
  SortField,
  SortDirection,
  WorkspaceTypeFilter,
  DuplicateFilter,
} from "../types";
import SummaryBar from "./SummaryBar";
import SearchFilter from "./SearchFilter";
import WorkspaceCard from "./WorkspaceCard";
import ExportPanel from "./ExportPanel";

interface ExplorerProps {
  analysis: AnalysisResult;
  exportPath: string;
  onBack: () => void;
}

function hasDuplicates(w: WorkspaceAnalysis): boolean {
  return (
    w.duplicate_requests.exact_count > 0 ||
    w.duplicate_requests.possible_count > 0 ||
    w.duplicate_collections.name_duplicates.length > 0 ||
    w.duplicate_collections.content_duplicates.length > 0
  );
}

export default function Explorer({ analysis, exportPath, onBack }: ExplorerProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WorkspaceTypeFilter>("all");
  const [duplicateFilter, setDuplicateFilter] = useState<DuplicateFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filtered = useMemo(() => {
    let result = analysis.workspaces;

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
  }, [analysis.workspaces, search, typeFilter, duplicateFilter, sortField, sortDirection]);

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
          sortField={sortField} onSortFieldChange={setSortField}
          sortDirection={sortDirection} onSortDirectionChange={setSortDirection}
        />

        {/* Results count */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filtered.length === analysis.workspaces.length
            ? `${filtered.length} workspaces`
            : `${filtered.length} of ${analysis.workspaces.length} workspaces`}
        </p>

        {/* Workspace cards */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-white py-12 text-center shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">No workspaces match your filters</p>
            </div>
          ) : (
            filtered.map((w) => <WorkspaceCard key={w.workspace_id} workspace={w} exportPath={exportPath} analysis={analysis} />)
          )}
        </div>

        {/* Export panel */}
        <ExportPanel analysis={analysis} exportPath={exportPath} />
      </div>
    </div>
  );
}

