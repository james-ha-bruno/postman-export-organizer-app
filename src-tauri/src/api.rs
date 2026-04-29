use crate::models::*;
use std::collections::HashMap;

const POSTMAN_API_BASE: &str = "https://api.getpostman.com";

fn build_client(api_key: &str) -> Result<reqwest::Client, String> {
    use reqwest::header::{HeaderMap, HeaderValue};
    let mut headers = HeaderMap::new();
    headers.insert(
        "X-Api-Key",
        HeaderValue::from_str(api_key).map_err(|e| format!("Invalid API key format: {}", e))?,
    );
    reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

/// Validate API key by calling GET /me
pub async fn validate_api_key(api_key: &str) -> Result<UserInfo, String> {
    let client = build_client(api_key)?;
    let resp = client
        .get(format!("{}/me", POSTMAN_API_BASE))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("API returned {}: {}", status, body));
    }

    let me_resp: PostmanMeResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(me_resp.user)
}

/// Fetch all workspaces
pub async fn fetch_workspaces(api_key: &str) -> Result<Vec<PostmanWorkspace>, String> {
    let client = build_client(api_key)?;
    let resp = client
        .get(format!("{}/workspaces", POSTMAN_API_BASE))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch workspaces: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Workspaces API returned {}: {}", status, body));
    }

    let ws_resp: PostmanWorkspacesResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse workspaces: {}", e))?;

    Ok(ws_resp.workspaces)
}

/// Fetch workspace details (including collection and environment refs)
pub async fn fetch_workspace_detail(
    api_key: &str,
    workspace_id: &str,
) -> Result<PostmanWorkspaceDetailInner, String> {
    let client = build_client(api_key)?;
    let resp = client
        .get(format!("{}/workspaces/{}", POSTMAN_API_BASE, workspace_id))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch workspace {}: {}", workspace_id, e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Workspace detail API returned {}: {}",
            status, body
        ));
    }

    let detail: PostmanWorkspaceDetail = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse workspace detail: {}", e))?;

    Ok(detail.workspace)
}

/// Fetch a single collection's full JSON (for API-only mode)
pub async fn fetch_collection_json(
    api_key: &str,
    collection_id: &str,
) -> Result<Vec<u8>, String> {
    let client = build_client(api_key)?;
    let resp = client
        .get(format!("{}/collections/{}", POSTMAN_API_BASE, collection_id))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch collection {}: {}", collection_id, e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Collection API returned {}: {}",
            status, body
        ));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse collection response: {}", e))?;

    // The API returns { "collection": { ... } }, we want just the inner collection object
    let collection = body
        .get("collection")
        .ok_or_else(|| "Missing 'collection' field in API response".to_string())?;

    serde_json::to_vec_pretty(collection)
        .map_err(|e| format!("Failed to serialize collection: {}", e))
}

/// Fetch a single environment's full JSON (for API-only mode)
pub async fn fetch_environment_json(
    api_key: &str,
    environment_id: &str,
) -> Result<Vec<u8>, String> {
    let client = build_client(api_key)?;
    let resp = client
        .get(format!(
            "{}/environments/{}",
            POSTMAN_API_BASE, environment_id
        ))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch environment {}: {}", environment_id, e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Environment API returned {}: {}",
            status, body
        ));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse environment response: {}", e))?;

    // The API returns { "environment": { ... } }, we want just the inner environment object
    let environment = body
        .get("environment")
        .ok_or_else(|| "Missing 'environment' field in API response".to_string())?;

    serde_json::to_vec_pretty(environment)
        .map_err(|e| format!("Failed to serialize environment: {}", e))
}

/// Fetch the collection listing from GET /collections and return a map of
/// collection UID -> CollectionListItem (for createdAt/updatedAt metadata).
/// Returns an empty map if the endpoint fails — non-fatal, matching `fetch_team_users`.
pub async fn fetch_collections_list(api_key: &str) -> HashMap<String, CollectionListItem> {
    let client = match build_client(api_key) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };

    let resp = match client
        .get(format!("{}/collections", POSTMAN_API_BASE))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Warning: Failed to fetch collections list: {}", e);
            return HashMap::new();
        }
    };

    if !resp.status().is_success() {
        eprintln!(
            "Warning: Collections list API returned {}",
            resp.status()
        );
        return HashMap::new();
    }

    let list_resp: PostmanCollectionsListResponse = match resp.json().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Warning: Failed to parse collections list: {}", e);
            return HashMap::new();
        }
    };

    let mut map = HashMap::new();
    for item in list_resp.collections {
        if let Some(uid) = item.uid.clone() {
            map.insert(uid, item);
        }
    }
    map
}

/// Fetch the environment listing from GET /environments and return a map of
/// environment ID -> EnvironmentListItem (for createdAt/updatedAt metadata).
/// The map is also populated with `uid` keys when the listing carries both
/// fields so callers can look up by either identifier.
/// Returns an empty map if the endpoint fails — non-fatal, matching `fetch_team_users`.
pub async fn fetch_environments_list(api_key: &str) -> HashMap<String, EnvironmentListItem> {
    let client = match build_client(api_key) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };

    let resp = match client
        .get(format!("{}/environments", POSTMAN_API_BASE))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Warning: Failed to fetch environments list: {}", e);
            return HashMap::new();
        }
    };

    if !resp.status().is_success() {
        eprintln!(
            "Warning: Environments list API returned {}",
            resp.status()
        );
        return HashMap::new();
    }

    let list_resp: PostmanEnvironmentsListResponse = match resp.json().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Warning: Failed to parse environments list: {}", e);
            return HashMap::new();
        }
    };

    let mut map = HashMap::new();
    for item in list_resp.environments {
        if let Some(id) = item.id.clone() {
            map.insert(id, item.clone());
        }
        if let Some(uid) = item.uid.clone() {
            map.entry(uid).or_insert(item);
        }
    }
    map
}

/// Fetch team users from GET /users and return a map of user ID -> display name.
/// Returns an empty map if the endpoint fails (e.g. 403 due to plan limitations).
pub async fn fetch_team_users(api_key: &str) -> HashMap<String, String> {
    let client = match build_client(api_key) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };

    let resp = match client
        .get(format!("{}/users", POSTMAN_API_BASE))
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return HashMap::new(),
    };

    if !resp.status().is_success() {
        return HashMap::new();
    }

    let users_resp: PostmanUsersResponse = match resp.json().await {
        Ok(r) => r,
        Err(_) => return HashMap::new(),
    };

    let mut map = HashMap::new();
    for user in &users_resp.data {
        if let Some(id) = user.id {
            let id_str = id.to_string();
            // Try multiple name fields in priority order
            let display_name = user
                .name
                .clone()
                .filter(|s| !s.is_empty())
                .or_else(|| {
                    match (&user.first_name, &user.last_name) {
                        (Some(f), Some(l)) if !f.is_empty() || !l.is_empty() => {
                            Some(format!("{} {}", f, l).trim().to_string())
                        }
                        (Some(f), None) if !f.is_empty() => Some(f.clone()),
                        (None, Some(l)) if !l.is_empty() => Some(l.clone()),
                        _ => None,
                    }
                })
                .or_else(|| user.username.clone().filter(|s| !s.is_empty()))
                .or_else(|| user.email.clone().filter(|s| !s.is_empty()));

            if let Some(name) = display_name {
                map.insert(id_str, name);
            }
        }
    }
    map
}
