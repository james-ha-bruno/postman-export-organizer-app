import type { SortField, SortDirection, WorkspaceTypeFilter, DuplicateFilter, OwnerFilter } from "../types";

export interface OwnerOption {
  value: string;
  label: string;
}

interface SearchFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: WorkspaceTypeFilter;
  onTypeFilterChange: (value: WorkspaceTypeFilter) => void;
  duplicateFilter: DuplicateFilter;
  onDuplicateFilterChange: (value: DuplicateFilter) => void;
  ownerFilter: OwnerFilter;
  onOwnerFilterChange: (value: OwnerFilter) => void;
  ownerOptions: OwnerOption[];
  sortField: SortField;
  onSortFieldChange: (value: SortField) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
}

export default function SearchFilter({
  search, onSearchChange,
  typeFilter, onTypeFilterChange,
  duplicateFilter, onDuplicateFilterChange,
  ownerFilter, onOwnerFilterChange, ownerOptions,
  sortField, onSortFieldChange,
  sortDirection, onSortDirectionChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="search" aria-label="Filter workspaces">
      {/* Search */}
      <div className="relative flex-1" style={{ minWidth: "200px" }}>
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search workspaces..."
          aria-label="Search workspaces by name"
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm
            text-gray-900 placeholder-gray-400 transition-colors
            focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
      </div>

      {/* Type Filter */}
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value as WorkspaceTypeFilter)}
        aria-label="Filter by workspace type"
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700
          focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
          dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      >
        <option value="all">All types</option>
        <option value="personal">Personal</option>
        <option value="team">Team</option>
        <option value="private">Private</option>
        <option value="public">Public</option>
        <option value="partner">Partner</option>
      </select>

      {/* Duplicate Filter */}
      <select
        value={duplicateFilter}
        onChange={(e) => onDuplicateFilterChange(e.target.value as DuplicateFilter)}
        aria-label="Filter by duplicate status"
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700
          focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
          dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      >
        <option value="all">All duplicates</option>
        <option value="has_duplicates">Has duplicates</option>
        <option value="no_duplicates">No duplicates</option>
      </select>

      {/* Owner Filter */}
      <select
        value={ownerFilter}
        onChange={(e) => onOwnerFilterChange(e.target.value)}
        aria-label="Filter by workspace owner"
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 max-w-[180px] truncate
          focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
          dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      >
        <option value="all">All owners</option>
        {ownerOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Sort */}
      <div className="flex items-center gap-1">
        <select
          value={sortField}
          onChange={(e) => onSortFieldChange(e.target.value as SortField)}
          aria-label="Sort field"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700
            focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="name">Name</option>
          <option value="collections">Collections</option>
          <option value="requests">Requests</option>
          <option value="updated">Last Updated</option>
        </select>
        <button
          type="button"
          onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}
          aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-500 transition-colors
            hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <svg className={`h-4 w-4 transition-transform ${sortDirection === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

