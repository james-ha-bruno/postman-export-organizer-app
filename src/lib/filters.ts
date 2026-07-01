import type {
  AdvancedFilters,
  AgeFilter,
  AnalysisResult,
  CollectionSummary,
  EnvironmentSummary,
  WorkspaceAnalysis,
} from "../types";

/**
 * Approximate one month as 30 days. Cheap, deterministic and good enough for
 * "updated within the last N months" filtering against ISO timestamps.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

/**
 * Returns true if `timestamp` satisfies the age filter.
 *
 * - `kind: "any"` always passes (including null timestamps).
 * - `kind: "months"` requires `timestamp` to be within the last N months.
 * - `kind: "before"` requires `timestamp >= chosen date` (i.e. updated on or
 *   after the chosen day; "before" refers to the cutoff being "no earlier
 *   than" the picked date).
 *
 * For tighter-than-"any" filters, a null/invalid timestamp fails — only items
 * with a known recent date pass.
 */
export function isWithinAge(timestamp: string | null, age: AgeFilter): boolean {
  if (age.kind === "any") return true;
  if (!timestamp) return false;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return false;

  switch (age.kind) {
    case "months": {
      const cutoff = Date.now() - age.months * MS_PER_MONTH;
      return t >= cutoff;
    }
    case "before": {
      const cutoff = Date.parse(age.date);
      if (Number.isNaN(cutoff)) return true; // invalid user input → don't drop
      return t >= cutoff;
    }
  }
}

/** True when the filter is anything other than "Any time". */
function isAgeActive(age: AgeFilter): boolean {
  return age.kind !== "any";
}

export function countActiveFilters(filters: AdvancedFilters): number {
  let n = 0;
  if (isAgeActive(filters.workspaceUpdatedWithin)) n++;
  if (isAgeActive(filters.collectionUpdatedWithin)) n++;
  if (isAgeActive(filters.environmentUpdatedWithin)) n++;
  if (filters.hideEmptyCollections) n++;
  if (filters.hideEmptyEnvironments) n++;
  if (filters.hideEmptyWorkspaces) n++;
  return n;
}

function filterCollections(
  collections: CollectionSummary[],
  filters: AdvancedFilters,
): CollectionSummary[] {
  return collections.filter((c) => {
    if (!isWithinAge(c.updated_at, filters.collectionUpdatedWithin)) return false;
    if (filters.hideEmptyCollections && c.request_count === 0) return false;
    return true;
  });
}

function filterEnvironments(
  environments: EnvironmentSummary[],
  filters: AdvancedFilters,
): EnvironmentSummary[] {
  return environments.filter((e) => {
    if (!isWithinAge(e.updated_at, filters.environmentUpdatedWithin)) return false;
    if (filters.hideEmptyEnvironments && e.variable_count === 0) return false;
    return true;
  });
}

function narrowWorkspace(
  w: WorkspaceAnalysis,
  filters: AdvancedFilters,
): WorkspaceAnalysis {
  const collections = filterCollections(w.collections, filters);
  const environments = filterEnvironments(w.environments, filters);

  // Recalculate counts from the survivors so the UI and exports agree.
  let request_count = 0;
  let folder_count = 0;
  for (const c of collections) {
    request_count += c.request_count;
    folder_count += c.folder_count;
  }

  return {
    ...w,
    collections,
    environments,
    collection_count: collections.length,
    environment_count: environments.length,
    request_count,
    folder_count,
  };
}

/**
 * Returns a *new* `AnalysisResult` with each workspace's collections and
 * environments narrowed by the advanced filters. Workspaces are dropped when:
 *   - the workspace itself fails the workspace-age filter, or
 *   - `hideEmptyWorkspaces` is on and no collections/environments survive
 *     (applied after the per-collection / per-environment filters so cascading
 *     empties drop out automatically).
 *
 * Pure: does not mutate the input.
 */
export function applyAdvancedFilters(
  analysis: AnalysisResult,
  filters: AdvancedFilters,
): AnalysisResult {
  const workspaces: WorkspaceAnalysis[] = [];
  for (const w of analysis.workspaces) {
    if (!isWithinAge(w.updated_at, filters.workspaceUpdatedWithin)) continue;
    const narrowed = narrowWorkspace(w, filters);
    if (
      filters.hideEmptyWorkspaces &&
      narrowed.collections.length === 0 &&
      narrowed.environments.length === 0
    ) {
      continue;
    }
    workspaces.push(narrowed);
  }

  return {
    generated_at: analysis.generated_at,
    workspaces,
  };
}

