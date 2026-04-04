import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { AnalysisResult, MemberInfo, SourceMode, WorkspaceAnalysis } from "../types";
import DuplicateDetails from "./DuplicateDetails";

interface WorkspaceCardProps {
  workspace: WorkspaceAnalysis;
  exportPath: string;
  sourceMode: SourceMode;
  analysis: AnalysisResult;
}

function hasDuplicates(w: WorkspaceAnalysis): boolean {
  return (
    w.duplicate_requests.exact_count > 0 ||
    w.duplicate_requests.possible_count > 0 ||
    w.duplicate_collections.name_duplicates.length > 0 ||
    w.duplicate_collections.content_duplicates.length > 0
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getOwner(w: WorkspaceAnalysis): string | null {
  const admin = w.members.find((m) => m.roles.includes("admin"));
  if (admin?.name) return admin.name;
  if (w.created_by) return w.created_by;
  return null;
}

const roleBadgeColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  editor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  viewer: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const typeBadgeColors: Record<string, string> = {
  personal: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  team: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  private: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  public: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  partner: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};

interface Toast {
  type: "success" | "error";
  message: string;
}

export default function WorkspaceCard({ workspace: w, exportPath, sourceMode, analysis }: WorkspaceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"collections" | "environments" | "duplicates" | "members">("collections");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const dupes = hasDuplicates(w);
  const badgeColor = typeBadgeColors[w.workspace_type] || typeBadgeColors.private;

  const handleExportWorkspace = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setExporting(true);
      const safeName = w.workspace_name.replace(/[^a-zA-Z0-9_-]/g, "_");
      const outputPath = await save({
        defaultPath: `${safeName}_export.zip`,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!outputPath) {
        setExporting(false);
        return;
      }
      const singleWorkspaceAnalysis: AnalysisResult = {
        generated_at: analysis.generated_at,
        workspaces: [w],
      };
      const analysisJson = JSON.stringify(singleWorkspaceAnalysis);
      let result: string;
      if (sourceMode === "api") {
        result = await invoke<string>("export_organized_zip_from_api", {
          analysisJson,
          outputPath,
        });
      } else {
        result = await invoke<string>("export_organized_zip", {
          analysisJson,
          exportPath,
          outputPath,
        });
      }
      setToast({ type: "success", message: `Exported to ${result}` });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast({ type: "error", message: String(err) });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <article
      className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md dark:bg-gray-800 dark:ring-gray-700"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-4 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 rounded-xl"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {w.workspace_name}
            </h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
              {w.workspace_type}
            </span>
            {dupes && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                Duplicates
              </span>
            )}
          </div>
          {/* Owner / Members summary */}
          {(getOwner(w) || w.members.length > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              {getOwner(w) && (
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Owner: {getOwner(w)}
                </span>
              )}
              {w.members.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  👤 {w.members.length} member{w.members.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>Created {formatDate(w.created_at)}</span>
            <span>Updated {formatDate(w.updated_at)}</span>
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex flex-shrink-0 items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
          <span title="Collections" className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            {w.collection_count}
          </span>
          <span title="Requests" className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            {w.request_count}
          </span>
          <span title="Environments" className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {w.environment_count}
          </span>
          <span title="Folders" className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            {w.folder_count}
          </span>
          {/* Chevron */}
          <svg className={`ml-1 h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="animate-fade-in border-t border-gray-100 dark:border-gray-700">
          {/* Tabs + Export button */}
          <div className="flex items-center border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-1" role="tablist">
              {(["collections", "environments", "duplicates", "members"] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors
                    focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-500
                    ${activeTab === tab
                      ? "border-b-2 border-accent-500 text-accent-600 dark:text-accent-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  {tab}
                  {tab === "duplicates" && dupes && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportWorkspace}
              disabled={exporting}
              title="Export this workspace as ZIP"
              className="mr-2 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors
                hover:bg-gray-100 hover:text-gray-700
                disabled:cursor-not-allowed disabled:opacity-50
                dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              {exporting ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              )}
              Export
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-4 scrollbar-thin" role="tabpanel">
            {activeTab === "collections" && <CollectionsList collections={w.collections} />}
            {activeTab === "environments" && <EnvironmentsList environments={w.environments} />}
            {activeTab === "duplicates" && <DuplicateDetails requests={w.duplicate_requests} collections={w.duplicate_collections} />}
            {activeTab === "members" && <MembersList members={w.members} createdBy={w.created_by} />}
          </div>
          {/* Toast */}
          {toast && (
            <div
              role="status"
              className={`mx-4 mb-3 animate-fade-in rounded-lg px-4 py-2 text-sm
                ${toast.type === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                }`}
            >
              {toast.message}
            </div>
          )}
        </div>
      )}
    </article>
  );
}



function CollectionsList({ collections }: { collections: WorkspaceAnalysis["collections"] }) {
  if (collections.length === 0) {
    return <p className="py-2 text-sm text-gray-500 dark:text-gray-400 italic">No collections</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <th className="pb-2 font-medium">Name</th>
          <th className="pb-2 font-medium text-right">Requests</th>
          <th className="pb-2 pr-4 font-medium text-right">Folders</th>
          <th className="pb-2 pl-2 font-medium hidden sm:table-cell">UID</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
        {collections.map((c) => (
          <tr key={c.uid} className="text-gray-700 dark:text-gray-300">
            <td className="py-1.5 font-medium truncate max-w-[200px]">{c.name}</td>
            <td className="py-1.5 text-right tabular-nums">{c.request_count}</td>
            <td className="py-1.5 pr-4 text-right tabular-nums">{c.folder_count}</td>
            <td className="py-1.5 pl-2 hidden sm:table-cell font-mono text-xs text-gray-400 truncate max-w-[120px]">{c.uid}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EnvironmentsList({ environments }: { environments: WorkspaceAnalysis["environments"] }) {
  if (environments.length === 0) {
    return <p className="py-2 text-sm text-gray-500 dark:text-gray-400 italic">No environments</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <th className="pb-2 font-medium">Name</th>
          <th className="pb-2 font-medium text-right">Variables</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
        {environments.map((e) => (
          <tr key={e.id} className="text-gray-700 dark:text-gray-300">
            <td className="py-1.5 font-medium">{e.name}</td>
            <td className="py-1.5 text-right tabular-nums">{e.variable_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MembersList({ members, createdBy }: { members: MemberInfo[]; createdBy?: string }) {
  if (members.length === 0) {
    return <p className="py-2 text-sm text-gray-500 dark:text-gray-400 italic">{createdBy ? `Owner: ${createdBy}` : "No member information available"}</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <th className="pb-2 font-medium">Name</th>
          <th className="pb-2 font-medium">Roles</th>
          <th className="pb-2 font-medium hidden sm:table-cell">ID</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
        {members.map((m, idx) => (
          <tr key={m.id ?? idx} className="text-gray-700 dark:text-gray-300">
            <td className="py-1.5 font-medium truncate max-w-[200px]">
              {m.name || (m.id ? `User ${m.id}` : "Unknown")}
            </td>
            <td className="py-1.5">
              <div className="flex flex-wrap gap-1">
                {m.roles.map((role) => (
                  <span
                    key={role}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColors[role] || roleBadgeColors.viewer}`}
                  >
                    {role}
                  </span>
                ))}
                {m.roles.length === 0 && <span className="text-xs text-gray-400">—</span>}
              </div>
            </td>
            <td className="py-1.5 hidden sm:table-cell font-mono text-xs text-gray-400 truncate max-w-[120px]">
              {m.id ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}