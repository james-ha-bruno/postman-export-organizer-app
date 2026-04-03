import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { AnalysisResult, SourceMode } from "../types";

interface ExportPanelProps {
  analysis: AnalysisResult;
  exportPath: string;
  sourceMode: SourceMode;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

type ExportType = "zip" | "json" | "csv";

export default function ExportPanel({ analysis, exportPath, sourceMode }: ExportPanelProps) {
  const [loading, setLoading] = useState<ExportType | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };

  const analysisJson = JSON.stringify(analysis);

  const handleExport = async (type: ExportType) => {
    try {
      setLoading(type);

      const defaults: Record<ExportType, { name: string; ext: string }> = {
        zip: { name: "organized_export.zip", ext: "zip" },
        json: { name: "report.json", ext: "json" },
        csv: { name: "summary.csv", ext: "csv" },
      };

      const { name, ext } = defaults[type];
      const outputPath = await save({
        defaultPath: name,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
      if (!outputPath) {
        setLoading(null);
        return;
      }

      let result: string;
      switch (type) {
        case "zip":
          if (sourceMode === "api") {
            result = await invoke<string>("export_organized_zip_from_api", { analysisJson, outputPath });
          } else {
            result = await invoke<string>("export_organized_zip", { analysisJson, exportPath, outputPath });
          }
          break;
        case "json":
          result = await invoke<string>("export_report_json", { analysisJson, outputPath });
          break;
        case "csv":
          result = await invoke<string>("export_report_csv", { analysisJson, outputPath });
          break;
      }
      showToast({ type: "success", message: `Exported to ${result}` });
    } catch (err) {
      showToast({ type: "error", message: String(err) });
    } finally {
      setLoading(null);
    }
  };

  const buttons: { type: ExportType; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      type: "zip",
      label: "Export Organized ZIP",
      desc: "Collections & environments grouped by workspace",
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>,
    },
    {
      type: "json",
      label: "Export JSON Report",
      desc: "Full analysis data as JSON",
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>,
    },
    {
      type: "csv",
      label: "Export CSV Summary",
      desc: "Workspace summary as spreadsheet",
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 12c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125M12 15.375c0-.621-.504-1.125-1.125-1.125" /></svg>,
    },
  ];

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Export</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {buttons.map((btn) => (
          <button
            key={btn.type}
            type="button"
            onClick={() => handleExport(btn.type)}
            disabled={loading !== null}
            className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors
              hover:bg-gray-50 active:bg-gray-100
              disabled:cursor-not-allowed disabled:opacity-50
              dark:border-gray-600 dark:hover:bg-gray-700/50 dark:active:bg-gray-700
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <div className="flex-shrink-0 text-accent-500">
              {loading === btn.type ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              ) : btn.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{btn.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{btn.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`mt-3 animate-fade-in rounded-lg px-4 py-2 text-sm
            ${toast.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

