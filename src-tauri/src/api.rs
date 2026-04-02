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
