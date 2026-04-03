import { useState, useEffect, useCallback } from "react";
import type { AnalysisResult, AppView, SourceMode } from "./types";
import SetupScreen from "./components/SetupScreen";
import Explorer from "./components/Explorer";

function App() {
  const [view, setView] = useState<AppView>("setup");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [exportPath, setExportPath] = useState<string>("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("zip");
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleAnalysisComplete = useCallback((result: AnalysisResult, path: string, mode: SourceMode) => {
    setAnalysis(result);
    setExportPath(path);
    setSourceMode(mode);
    setView("explorer");
  }, []);

  const handleBack = useCallback(() => {
    setView("setup");
  }, []);

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Dark mode toggle */}
      <button
        type="button"
        onClick={() => setDark(!dark)}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="fixed right-4 top-4 z-50 rounded-lg bg-white p-2 shadow-sm ring-1 ring-gray-200
          transition-colors hover:bg-gray-50
          dark:bg-gray-800 dark:ring-gray-700 dark:hover:bg-gray-700
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        {dark ? (
          <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      {view === "setup" && (
        <SetupScreen onAnalysisComplete={handleAnalysisComplete} />
      )}
      {view === "explorer" && analysis && (
        <Explorer analysis={analysis} exportPath={exportPath} sourceMode={sourceMode} onBack={handleBack} />
      )}
    </div>
  );
}

export default App;

