import { useCallback, useEffect, useRef, useState } from "react";

interface DownloadZipMenuProps {
  onOrganized: () => Promise<void> | void;
  onBruno: () => Promise<void> | void;
  label: string;
  disabled?: boolean;
  triggerClassName?: string;
  menuAlign?: "left" | "right";
  title?: string;
}

export default function DownloadZipMenu({
  onOrganized,
  onBruno,
  label,
  disabled = false,
  triggerClassName = "",
  menuAlign = "right",
  title,
}: DownloadZipMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const closeMenu = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setFocusIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && focusIndex >= 0) {
      itemsRef.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const isDisabled = disabled || busy;

  const openWithKeyboard = (initialIndex: number) => {
    if (isDisabled) return;
    setOpen(true);
    setFocusIndex(initialIndex);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) closeMenu(true);
      else openWithKeyboard(0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      openWithKeyboard(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openWithKeyboard(1);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      closeMenu(true);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") {
      closeMenu(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => (i + 1) % 2);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => (i - 1 + 2) % 2);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIndex(1);
    }
  };

  const runAction = async (fn: () => Promise<void> | void) => {
    closeMenu(false);
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerClick = () => {
    if (isDisabled) return;
    setOpen((o) => !o);
    setFocusIndex(-1);
  };

  const tooltipTitle = title ?? label;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={tooltipTitle}
        className={triggerClassName}
      >
        {busy ? (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        )}
        <span>{label}</span>
        <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Download ZIP format"
          onKeyDown={handleMenuKeyDown}
          className={`absolute top-full z-20 mt-1 w-72 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700 ${menuAlign === "right" ? "right-0" : "left-0"}`}
        >
          <button
            ref={(el) => { itemsRef.current[0] = el; }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={busy}
            onClick={() => runAction(onOrganized)}
            className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700/60 dark:focus:bg-gray-700/60"
          >
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <span className="min-w-0">
              <span className="block font-medium text-gray-900 dark:text-white">Organized folders</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Browsable folders with readable names — for archival &amp; review</span>
            </span>
          </button>
          <div className="border-t border-gray-100 dark:border-gray-700" />
          <button
            ref={(el) => { itemsRef.current[1] = el; }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={busy}
            onClick={() => runAction(onBruno)}
            className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700/60 dark:focus:bg-gray-700/60"
          >
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>
            <span className="min-w-0">
              <span className="block font-medium text-gray-900 dark:text-white">Bruno Bulk Import</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Drag into Bruno 3.5+ to import collections &amp; environments</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

