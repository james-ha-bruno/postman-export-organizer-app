import { useState } from "react";
import type { AdvancedFilters, AgeFilter } from "../types";
import { DEFAULT_ADVANCED_FILTERS } from "../types";
import { countActiveFilters } from "../lib/filters";

interface AdvancedFiltersPanelProps {
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
}

type AgeSelectValue = "any" | "3" | "6" | "12" | "24" | "custom";

function ageToSelect(age: AgeFilter): AgeSelectValue {
  switch (age.kind) {
    case "any": return "any";
    case "months": return String(age.months) as AgeSelectValue;
    case "before": return "custom";
  }
}

function selectToAge(value: AgeSelectValue, prev: AgeFilter): AgeFilter {
  if (value === "any") return { kind: "any" };
  if (value === "custom") {
    const date = prev.kind === "before" ? prev.date : new Date().toISOString().slice(0, 10);
    return { kind: "before", date };
  }
  const months = Number(value) as 3 | 6 | 12 | 24;
  return { kind: "months", months };
}

const SELECT_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 " +
  "focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 " +
  "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";

const DATE_INPUT_CLASS =
  "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 " +
  "focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 " +
  "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";

interface AgeRowProps {
  label: string;
  age: AgeFilter;
  onChange: (next: AgeFilter) => void;
  ariaLabel: string;
}

function AgeRow({ label, age, onChange, ariaLabel }: AgeRowProps) {
  const selectValue = ageToSelect(age);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="min-w-[180px] text-sm text-gray-700 dark:text-gray-300">{label}</label>
      <select
        value={selectValue}
        onChange={(e) => onChange(selectToAge(e.target.value as AgeSelectValue, age))}
        aria-label={ariaLabel}
        className={SELECT_CLASS}
      >
        <option value="any">Any time</option>
        <option value="3">Last 3 months</option>
        <option value="6">Last 6 months</option>
        <option value="12">Last 12 months</option>
        <option value="24">Last 24 months</option>
        <option value="custom">Custom date…</option>
      </select>
      {age.kind === "before" && (
        <input
          type="date"
          value={age.date}
          onChange={(e) => onChange({ kind: "before", date: e.target.value })}
          aria-label={`${ariaLabel} — custom date`}
          className={DATE_INPUT_CLASS}
        />
      )}
    </div>
  );
}

export default function AdvancedFiltersPanel({ filters, onChange }: AdvancedFiltersPanelProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const set = <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-200
          focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-500 rounded-lg"
      >
        <span className="flex items-center gap-2">
          Advanced filters
          {activeCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
              {activeCount} active
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
          <AgeRow
            label="Workspace updated within"
            age={filters.workspaceUpdatedWithin}
            onChange={(v) => set("workspaceUpdatedWithin", v)}
            ariaLabel="Filter workspaces by last updated"
          />
          <AgeRow
            label="Collection updated within"
            age={filters.collectionUpdatedWithin}
            onChange={(v) => set("collectionUpdatedWithin", v)}
            ariaLabel="Filter collections by last updated"
          />
          <AgeRow
            label="Environment updated within"
            age={filters.environmentUpdatedWithin}
            onChange={(v) => set("environmentUpdatedWithin", v)}
            ariaLabel="Filter environments by last updated"
          />
          <fieldset className="space-y-1.5 pt-1">
            <legend className="text-sm text-gray-700 dark:text-gray-300">Hide empty content</legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={filters.hideEmptyCollections} onChange={(e) => set("hideEmptyCollections", e.target.checked)} className="rounded border-gray-300 text-accent-500 focus:ring-accent-500 dark:border-gray-600 dark:bg-gray-700" />
              Hide collections with 0 requests
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={filters.hideEmptyEnvironments} onChange={(e) => set("hideEmptyEnvironments", e.target.checked)} className="rounded border-gray-300 text-accent-500 focus:ring-accent-500 dark:border-gray-600 dark:bg-gray-700" />
              Hide environments with 0 variables
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={filters.hideEmptyWorkspaces} onChange={(e) => set("hideEmptyWorkspaces", e.target.checked)} className="rounded border-gray-300 text-accent-500 focus:ring-accent-500 dark:border-gray-600 dark:bg-gray-700" />
              Hide workspaces with no collections and no environments
            </label>
          </fieldset>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_ADVANCED_FILTERS)}
              disabled={activeCount === 0}
              className="text-xs font-medium text-accent-600 hover:text-accent-700 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-accent-400 dark:hover:text-accent-300 dark:disabled:text-gray-600
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 rounded"
            >
              Reset advanced filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

