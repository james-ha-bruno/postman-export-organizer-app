import type { WorkspaceAnalysis } from "../types";

export const UNKNOWN_OWNER_KEY = "__unknown__";
export const UNKNOWN_OWNER_LABEL = "Unknown";

/**
 * Resolve a workspace owner display name. Prefers the first member with the
 * "admin" role, falling back to `created_by`. Returns null when nothing is
 * available.
 */
export function getOwner(w: WorkspaceAnalysis): string | null {
  const admin = w.members.find((m) => m.roles.includes("admin"));
  if (admin?.name) return admin.name;
  if (w.created_by) return w.created_by;
  return null;
}

/**
 * Stable filter key for a workspace owner (display name or unknown sentinel).
 */
export function getOwnerKey(w: WorkspaceAnalysis): string {
  return getOwner(w) ?? UNKNOWN_OWNER_KEY;
}

/**
 * Lowercase, non-alphanumeric → "-", collapse repeats, trim leading/trailing
 * separators. Used for filenames.
 */
export function slugifyOwner(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

