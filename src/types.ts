// === Export Data (from zip parsing) ===

export interface ExportData {
  collections: CollectionData[];
  environments: EnvironmentData[];
}

export interface CollectionData {
  name: string;
  uid: string;
  requests: RequestData[];
  folders: string[];
  request_count: number;
  folder_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RequestData {
  name: string;
  method: string;
  url_raw: string;
  url_normalized: string;
  folder: string;
  collection_name: string;
  collection_uid: string;
  vars_used: string[];
}

export interface EnvironmentData {
  id: string;
  name: string;
  values: EnvVariable[];
}

export interface EnvVariable {
  key: string;
  value: string;
  type: string;
  enabled: boolean;
}

// === API types ===

export interface UserInfo {
  id: number | null;
  username: string | null;
  email: string | null;
  fullName: string | null;
}

// === Analysis Result ===

export interface AnalysisResult {
  generated_at: string;
  workspaces: WorkspaceAnalysis[];
}

export interface MemberInfo {
  id?: number;
  name?: string;
  roles: string[];
}

export interface WorkspaceAnalysis {
  workspace_id: string;
  workspace_name: string;
  workspace_type: string;
  created_at: string | null;
  updated_at: string | null;
  created_by?: string;
  description?: string;
  members: MemberInfo[];
  collection_count: number;
  request_count: number;
  folder_count: number;
  environment_count: number;
  duplicate_requests: DuplicateInfo;
  duplicate_collections: DuplicateCollectionInfo;
  collections: CollectionSummary[];
  environments: EnvironmentSummary[];
}

export interface DuplicateInfo {
  exact_count: number;
  exact_groups: DuplicateGroup[];
  possible_count: number;
  possible_groups: DuplicateGroup[];
}

export interface DuplicateGroup {
  key: string;
  count: number;
  requests: DuplicateRequestRef[];
}

export interface DuplicateRequestRef {
  name: string;
  method: string;
  url: string;
  collection_name: string;
  folder: string;
}

export interface DuplicateCollectionInfo {
  name_duplicates: NameDuplicateGroup[];
  content_duplicates: ContentDuplicateGroup[];
}

export interface NameDuplicateGroup {
  name: string;
  count: number;
  collection_uids: string[];
}

export interface ContentDuplicateGroup {
  signature: string;
  count: number;
  collection_names: string[];
  collection_uids: string[];
}

export interface CollectionSummary {
  name: string;
  uid: string;
  request_count: number;
  folder_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  variable_count: number;
  created_at: string | null;
  updated_at: string | null;
}

// === App State ===

export type AppView = "setup" | "explorer";
export type SourceMode = "zip" | "api";

export type SortField = "name" | "collections" | "requests" | "updated";
export type SortDirection = "asc" | "desc";
export type WorkspaceTypeFilter = "all" | "personal" | "team" | "private" | "public" | "partner";
export type DuplicateFilter = "all" | "has_duplicates" | "no_duplicates";
// Owner filter is "all", the unknown sentinel from `lib/owner`, or an owner display name.
export type OwnerFilter = string;

