import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ExportData, UserInfo, AnalysisResult, SourceMode } from "../types";

interface ApiProgress {
  phase: string;
  message: string;
  current: number;
  total: number;
}

interface SetupScreenProps {
  onAnalysisComplete: (result: AnalysisResult, exportPath: string, sourceMode: SourceMode) => void;
}

type ValidationState = "idle" | "loading" | "success" | "error";

export default function SetupScreen({ onAnalysisComplete }: SetupScreenProps) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("zip");

  const [exportPath, setExportPath] = useState<string | null>(null);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseLoading, setParseLoading] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyState, setKeyState] = useState<ValidationState>("idle");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ApiProgress | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Clean up event listener on unmount
  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleFilePick = useCallback(async () => {
    try {
      const path = await open({
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        multiple: false,
      });
      if (path) {
        await loadExport(path as string);
      }
    } catch (err) {
      setParseError(String(err));
    }
  }, []);

  const loadExport = async (path: string) => {
    setParseLoading(true);
    setParseError(null);
    setExportData(null);
    try {
      const data = await invoke<ExportData>("parse_export", { path });
      setExportPath(path);
      setExportData(data);
    } catch (err) {
      setParseError(String(err));
      setExportPath(null);
    } finally {
      setParseLoading(false);
    }
  };

  const handleValidateKey = async () => {
    if (!apiKey.trim()) return;
    setKeyState("loading");
    setKeyError(null);
    try {
      const info = await invoke<UserInfo>("validate_api_key", { key: apiKey });
      setUserInfo(info);
      setKeyState("success");
    } catch (err) {
      setKeyError(String(err));
      setKeyState("error");
    }
  };

  const ensureKeyValidated = async (): Promise<boolean> => {
    if (keyState === "success") return true;
    if (!apiKey.trim()) return false;
    setKeyState("loading");
    setKeyError(null);
    try {
      const info = await invoke<UserInfo>("validate_api_key", { key: apiKey });
      setUserInfo(info);
      setKeyState("success");
      return true;
    } catch (err) {
      setKeyError(String(err));
      setKeyState("error");
      return false;
    }
  };

  const handleAnalyze = async () => {
    if (!(await ensureKeyValidated())) return;

    if (sourceMode === "zip") {
      if (!exportPath) return;
      setAnalyzing(true);
      setAnalyzeError(null);
      try {
        const result = await invoke<AnalysisResult>("analyze_export", {
          key: apiKey,
          exportPath,
        });
        onAnalysisComplete(result, exportPath, "zip");
      } catch (err) {
        setAnalyzeError(String(err));
      } finally {
        setAnalyzing(false);
      }
    } else {
      // API-only mode
      setAnalyzeError(null);
      setProgress(null);

      // Listen for progress events BEFORE starting analysis
      unlistenRef.current?.();
      unlistenRef.current = await listen<ApiProgress>("api-progress", (event) => {
        setProgress(event.payload);
      });

      setAnalyzing(true);

      try {
        const result = await invoke<AnalysisResult>("analyze_from_api", {
          key: apiKey,
        });
        onAnalysisComplete(result, "", "api");
      } catch (err) {
        setAnalyzeError(String(err));
      } finally {
        unlistenRef.current?.();
        unlistenRef.current = null;
        setAnalyzing(false);
        setProgress(null);
      }
    }
  };

  const canAnalyze = sourceMode === "api"
    ? !!apiKey.trim() && !analyzing
    : !!exportData && !!apiKey.trim() && !analyzing;

  const helperText = !canAnalyze && !analyzing
    ? !apiKey.trim()
      ? "Enter your Postman API key to continue"
      : sourceMode === "zip" && !exportData
        ? "Select an export file to continue"
        : null
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Postman Export Organizer
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Analyze and organize your Postman data
          </p>
        </div>

        {/* Source Mode Toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setSourceMode("zip")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${sourceMode === "zip"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
          >
            ZIP Export
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("api")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${sourceMode === "api"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
          >
            Postman API
          </button>
        </div>

        {/* File Upload Section (ZIP mode only) */}
        {sourceMode === "zip" && (
        <section aria-label="Export file selection">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Export File
            </label>
            <button
              type="button"
              onClick={() => openUrl("https://learning.postman.com/docs/getting-started/importing-and-exporting/exporting-data/")}
              className="text-xs text-accent-500 hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300 transition-colors"
            >
              How do I export my data? ↗
            </button>
          </div>
          <button
            type="button"
            onClick={handleFilePick}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }}
            disabled={parseLoading}
            className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors
              ${isDragOver
                ? "border-accent-400 bg-accent-50 dark:bg-accent-900/20"
                : "border-gray-300 hover:border-accent-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-accent-500 dark:hover:bg-gray-800/50"
              }
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
              disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {parseLoading ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="h-8 w-8 animate-spin text-accent-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">Loading export...</span>
              </div>
            ) : exportData ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {exportData.collections.length} collections, {exportData.environments.length} environments
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-full">
                  {exportPath}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Click to select your Postman export (.zip)
                </span>
              </div>
            )}
          </button>
          {parseError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{parseError}</p>
          )}
        </section>
        )}

        {/* API mode description */}
        {sourceMode === "api" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Fetch collections and environments directly from the Postman API — no export file needed.
              Just enter your API key below to get started.
            </p>
          </div>
        )}

        {/* API Key Section */}
        <section aria-label="API key validation">
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Postman API Key
            </label>
            <button
              type="button"
              onClick={() => openUrl("https://learning.postman.com/docs/developer/postman-api/authentication/")}
              className="text-xs text-accent-500 hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300 transition-colors"
            >
              How do I get an API key? ↗
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyState("idle"); setKeyError(null); }}
                placeholder="PMAK-..."
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm
                  text-gray-900 placeholder-gray-400 transition-colors
                  focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
                  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleValidateKey}
              disabled={!apiKey.trim() || keyState === "loading"}
              className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors
                hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50
                dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              {keyState === "loading" ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              ) : "Validate"}
            </button>
          </div>
          {/* Key validation status */}
          {keyState === "success" && userInfo && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400 animate-fade-in" role="status">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span>Authenticated as <strong>{userInfo.fullName || userInfo.username || userInfo.email}</strong></span>
            </div>
          )}
          {keyState === "error" && keyError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 animate-fade-in" role="alert">
              {keyError}
            </p>
          )}
        </section>

        {/* Analyze Button */}
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="w-full rounded-xl bg-accent-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all
            hover:bg-accent-600 hover:shadow-md active:bg-accent-700
            disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {analyzing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              Analyzing…
            </span>
          ) : sourceMode === "api" ? "Fetch & Analyze" : "Analyze Export"}
        </button>

        {/* Progress bar for API mode */}
        {analyzing && progress && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="truncate mr-2">{progress.message}</span>
              {progress.total > 0 && (
                <span className="flex-shrink-0 tabular-nums">
                  {progress.current}/{progress.total}
                </span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-accent-500 transition-all duration-300 ease-out"
                style={{
                  width: progress.total > 0
                    ? `${Math.min(100, (progress.current / progress.total) * 100)}%`
                    : "100%",
                  ...(progress.total === 0 ? { animation: "pulse 1.5s ease-in-out infinite" } : {}),
                }}
              />
            </div>
            {progress.total > 0 && (
              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                Postman API: 300 requests/min limit
              </p>
            )}
          </div>
        )}

        {analyzeError && (
          <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">{analyzeError}</p>
        )}
        {helperText && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">{helperText}</p>
        )}

        {/* GitHub link */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => openUrl("https://github.com/james-ha-bruno/postman-export-organizer-app")}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </button>
        </div>
      </div>
    </div>
  );
}

