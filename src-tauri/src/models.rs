use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// === Export Data (from zip parsing) ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub collections: Vec<CollectionData>,
    pub environments: Vec<EnvironmentData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionData {
    pub name: String,
    pub uid: String,
    pub requests: Vec<RequestData>,
    pub folders: Vec<String>,
    pub request_count: usize,
    pub folder_count: usize,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestData {
    pub name: String,
    pub method: String,
    pub url_raw: String,
    pub url_normalized: String,
    pub folder: String,
    pub collection_name: String,
    pub collection_uid: String,
    pub vars_used: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentData {
    pub id: String,
    pub name: String,
    pub values: Vec<EnvVariable>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariable {
    pub key: String,
    pub value: String,
    #[serde(rename = "type")]
    pub var_type: String,
    pub enabled: bool,
}

// === Archive manifest ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveManifest {
    #[serde(default)]
    pub collection: HashMap<String, bool>,
    #[serde(default)]
    pub environment: HashMap<String, bool>,
}

// === Postman API types ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: Option<u64>,
    pub username: Option<String>,
    pub email: Option<String>,
    #[serde(rename = "fullName")]
    pub full_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanMeResponse {
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanWorkspace {
    pub id: String,
    pub name: String,
    #[serde(rename = "type", default)]
    pub workspace_type: String,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanWorkspacesResponse {
    pub workspaces: Vec<PostmanWorkspace>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanWorkspaceDetail {
    pub workspace: PostmanWorkspaceDetailInner,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanWorkspaceDetailInner {
    pub id: String,
    pub name: String,
    #[serde(rename = "type", default)]
    pub workspace_type: String,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: Option<String>,
    #[serde(rename = "createdBy", default)]
    pub created_by: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub visibility: Option<String>,
    #[serde(default)]
    pub members: Option<Value>,
    #[serde(default)]
    pub collections: Option<Vec<PostmanCollectionRef>>,
    #[serde(default)]
    pub environments: Option<Vec<PostmanEnvironmentRef>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanCollectionRef {
    pub id: Option<String>,
    pub uid: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanEnvironmentRef {
    pub id: Option<String>,
    pub uid: Option<String>,
    pub name: Option<String>,
}

// === Postman Collections list (GET /collections) ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanCollectionsListResponse {
    #[serde(default)]
    pub collections: Vec<CollectionListItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionListItem {
    #[serde(default)]
    pub uid: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: Option<String>,
}

// === Postman Environments list (GET /environments) ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanEnvironmentsListResponse {
    #[serde(default)]
    pub environments: Vec<EnvironmentListItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentListItem {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub uid: Option<String>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: Option<String>,
}

// === Postman Users API (GET /users) ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanUsersResponse {
    #[serde(default)]
    pub data: Vec<PostmanUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanUser {
    #[serde(default)]
    pub id: Option<u64>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(rename = "firstName", default)]
    pub first_name: Option<String>,
    #[serde(rename = "lastName", default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
}

// === Progress Event (for API-only mode) ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProgress {
    pub phase: String,
    pub message: String,
    pub current: usize,
    pub total: usize,
}

// === API Data Cache (for API-only mode) ===

/// Stores raw collection/environment JSON data fetched from the Postman API,
/// so it can be used during export without re-fetching.
#[derive(Debug, Default)]
pub struct ApiDataCache {
    /// Map of collection UID -> raw JSON bytes
    pub collections: HashMap<String, Vec<u8>>,
    /// Map of environment ID -> raw JSON bytes
    pub environments: HashMap<String, Vec<u8>>,
}

// === Analysis Result ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub generated_at: String,
    pub workspaces: Vec<WorkspaceAnalysis>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceAnalysis {
    pub workspace_id: String,
    pub workspace_name: String,
    pub workspace_type: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub created_by: Option<String>,
    pub description: Option<String>,
    pub members: Vec<MemberInfo>,
    pub collection_count: usize,
    pub request_count: usize,
    pub folder_count: usize,
    pub environment_count: usize,
    pub duplicate_requests: DuplicateInfo,
    pub duplicate_collections: DuplicateCollectionInfo,
    pub collections: Vec<CollectionSummary>,
    pub environments: Vec<EnvironmentSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberInfo {
    pub id: Option<u64>,
    pub name: Option<String>,
    pub roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateInfo {
    pub exact_count: usize,
    pub exact_groups: Vec<DuplicateGroup>,
    pub possible_count: usize,
    pub possible_groups: Vec<DuplicateGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub key: String,
    pub count: usize,
    pub requests: Vec<DuplicateRequestRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateRequestRef {
    pub name: String,
    pub method: String,
    pub url: String,
    pub collection_name: String,
    pub folder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateCollectionInfo {
    pub name_duplicates: Vec<NameDuplicateGroup>,
    pub content_duplicates: Vec<ContentDuplicateGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NameDuplicateGroup {
    pub name: String,
    pub count: usize,
    pub collection_uids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentDuplicateGroup {
    pub signature: String,
    pub count: usize,
    pub collection_names: Vec<String>,
    pub collection_uids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSummary {
    pub name: String,
    pub uid: String,
    pub request_count: usize,
    pub folder_count: usize,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentSummary {
    pub id: String,
    pub name: String,
    pub variable_count: usize,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

