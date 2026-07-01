use crate::api;
use crate::models::*;
use crate::parser;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

/// Parse members from the Postman API response, handling both array and object formats.
/// Uses the user_map (from GET /users) to resolve numeric IDs to display names.
fn parse_members(members_value: &Option<Value>, user_map: &HashMap<String, String>) -> Vec<MemberInfo> {
    let val = match members_value {
        Some(v) => v,
        None => return Vec::new(),
    };

    let mut result = Vec::new();

    match val {
        Value::Array(arr) => {
            for item in arr {
                if let Some(info) = parse_single_member(item, user_map) {
                    result.push(info);
                }
            }
        }
        Value::Object(map) => {
            for (_key, item) in map {
                if let Some(info) = parse_single_member(item, user_map) {
                    result.push(info);
                }
            }
        }
        _ => {}
    }

    result
}

fn parse_single_member(val: &Value, user_map: &HashMap<String, String>) -> Option<MemberInfo> {
    let obj = val.as_object()?;

    let id = obj
        .get("id")
        .or_else(|| obj.get("accountId"))
        .and_then(|v| v.as_u64());

    // Try multiple name fields from the member object itself
    let display_name = obj.get("displayName").and_then(|v| v.as_str()).map(String::from);
    let name_field = obj.get("name").and_then(|v| v.as_str()).map(String::from);
    let username = obj.get("username").and_then(|v| v.as_str()).map(String::from);

    // Try firstName + lastName
    let first_name = obj.get("firstName").and_then(|v| v.as_str());
    let last_name = obj.get("lastName").and_then(|v| v.as_str());
    let full_name = match (first_name, last_name) {
        (Some(f), Some(l)) if !f.is_empty() || !l.is_empty() => {
            Some(format!("{} {}", f, l).trim().to_string())
        }
        (Some(f), None) if !f.is_empty() => Some(f.to_string()),
        (None, Some(l)) if !l.is_empty() => Some(l.to_string()),
        _ => None,
    };

    // Email as last-resort from the member object
    let email = obj.get("email").and_then(|v| v.as_str()).map(String::from);

    // Priority: displayName > name > firstName+lastName > username > user_map lookup > email
    let name = display_name
        .filter(|s| !s.is_empty())
        .or(name_field.filter(|s| !s.is_empty()))
        .or(full_name)
        .or(username.filter(|s| !s.is_empty()))
        .or_else(|| {
            // Look up in user_map by ID
            id.and_then(|id_val| user_map.get(&id_val.to_string()).cloned())
        })
        .or(email.filter(|s| !s.is_empty()));

    let roles = obj
        .get("roles")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|r| r.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Some(MemberInfo { id, name, roles })
}

/// Detect duplicate requests within a set of requests
pub fn detect_duplicate_requests(requests: &[RequestData]) -> DuplicateInfo {
    // Exact duplicates: same method + normalized URL
    let mut exact_map: HashMap<String, Vec<&RequestData>> = HashMap::new();
    for req in requests {
        let key = format!("{} {}", req.method, req.url_normalized);
        exact_map.entry(key).or_default().push(req);
    }

    let exact_groups: Vec<DuplicateGroup> = exact_map
        .into_iter()
        .filter(|(_, v)| v.len() > 1)
        .map(|(key, reqs)| DuplicateGroup {
            key: key.clone(),
            count: reqs.len(),
            requests: reqs
                .iter()
                .map(|r| DuplicateRequestRef {
                    name: r.name.clone(),
                    method: r.method.clone(),
                    url: r.url_raw.clone(),
                    collection_name: r.collection_name.clone(),
                    folder: r.folder.clone(),
                })
                .collect(),
        })
        .collect();

    // Possible duplicates: same normalized URL, different methods
    let mut url_map: HashMap<String, Vec<&RequestData>> = HashMap::new();
    for req in requests {
        url_map.entry(req.url_normalized.clone()).or_default().push(req);
    }

    let possible_groups: Vec<DuplicateGroup> = url_map
        .into_iter()
        .filter(|(_, v)| {
            let methods: std::collections::HashSet<&str> =
                v.iter().map(|r| r.method.as_str()).collect();
            methods.len() > 1
        })
        .map(|(url, reqs)| DuplicateGroup {
            key: url.clone(),
            count: reqs.len(),
            requests: reqs
                .iter()
                .map(|r| DuplicateRequestRef {
                    name: r.name.clone(),
                    method: r.method.clone(),
                    url: r.url_raw.clone(),
                    collection_name: r.collection_name.clone(),
                    folder: r.folder.clone(),
                })
                .collect(),
        })
        .collect();

    let exact_count = exact_groups.iter().map(|g| g.count).sum();
    let possible_count = possible_groups.iter().map(|g| g.count).sum();

    DuplicateInfo {
        exact_count,
        exact_groups,
        possible_count,
        possible_groups,
    }
}

/// Detect duplicate collections by name and content
pub fn detect_duplicate_collections(collections: &[CollectionData]) -> DuplicateCollectionInfo {
    // Name duplicates
    let mut name_map: HashMap<String, Vec<&CollectionData>> = HashMap::new();
    for col in collections {
        name_map.entry(col.name.clone()).or_default().push(col);
    }

    let name_duplicates: Vec<NameDuplicateGroup> = name_map
        .into_iter()
        .filter(|(_, v)| v.len() > 1)
        .map(|(name, cols)| NameDuplicateGroup {
            name,
            count: cols.len(),
            collection_uids: cols.iter().map(|c| c.uid.clone()).collect(),
        })
        .collect();

    // Content duplicates: same set of method+URL signatures
    let mut sig_map: HashMap<String, Vec<&CollectionData>> = HashMap::new();
    for col in collections {
        let mut sigs: Vec<String> = col
            .requests
            .iter()
            .map(|r| format!("{} {}", r.method, r.url_normalized))
            .collect();
        sigs.sort();
        let signature = sigs.join("|");
        if !signature.is_empty() {
            sig_map.entry(signature).or_default().push(col);
        }
    }

    let content_duplicates: Vec<ContentDuplicateGroup> = sig_map
        .into_iter()
        .filter(|(_, v)| v.len() > 1)
        .map(|(sig, cols)| ContentDuplicateGroup {
            signature: sig,
            count: cols.len(),
            collection_names: cols.iter().map(|c| c.name.clone()).collect(),
            collection_uids: cols.iter().map(|c| c.uid.clone()).collect(),
        })
        .collect();

    DuplicateCollectionInfo {
        name_duplicates,
        content_duplicates,
    }
}

/// Build a workspace analysis from collections and environments assigned to it.
/// `collections_meta` is an optional lookup of collection UID -> listing item
/// (from `GET /collections`) used to populate `created_at` / `updated_at` on
/// each `CollectionSummary`. Falls back to whatever the parsed `CollectionData`
/// carries when the UID isn't in the map.
/// `environments_meta` does the same for environments via `GET /environments`,
/// keyed by environment id (and uid as alternate). Falls back to parsed
/// `EnvironmentData.created_at` / `updated_at` when missing.
fn build_workspace_analysis(
    ws_id: &str,
    ws_name: &str,
    ws_type: &str,
    created_at: Option<String>,
    updated_at: Option<String>,
    created_by: Option<String>,
    description: Option<String>,
    members: Vec<MemberInfo>,
    collections: Vec<CollectionData>,
    environments: Vec<EnvironmentData>,
    collections_meta: Option<&HashMap<String, CollectionListItem>>,
    environments_meta: Option<&HashMap<String, EnvironmentListItem>>,
) -> WorkspaceAnalysis {
    let all_requests: Vec<RequestData> =
        collections.iter().flat_map(|c| c.requests.clone()).collect();

    let request_count = all_requests.len();
    let folder_count: usize = collections.iter().map(|c| c.folder_count).sum();
    let collection_count = collections.len();
    let environment_count = environments.len();

    let duplicate_requests = detect_duplicate_requests(&all_requests);
    let duplicate_collections = detect_duplicate_collections(&collections);

    let col_summaries: Vec<CollectionSummary> = collections
        .iter()
        .map(|c| {
            // Prefer API listing values when available; fall back to parser.
            let meta = collections_meta.and_then(|m| m.get(&c.uid));
            let created_at = meta
                .and_then(|m| m.created_at.clone())
                .or_else(|| c.created_at.clone());
            let updated_at = meta
                .and_then(|m| m.updated_at.clone())
                .or_else(|| c.updated_at.clone());
            CollectionSummary {
                name: c.name.clone(),
                uid: c.uid.clone(),
                request_count: c.request_count,
                folder_count: c.folder_count,
                created_at,
                updated_at,
            }
        })
        .collect();

    let env_summaries: Vec<EnvironmentSummary> = environments
        .iter()
        .map(|e| {
            // Prefer API listing values when available; fall back to parser.
            let meta = environments_meta.and_then(|m| m.get(&e.id));
            let created_at = meta
                .and_then(|m| m.created_at.clone())
                .or_else(|| e.created_at.clone());
            let updated_at = meta
                .and_then(|m| m.updated_at.clone())
                .or_else(|| e.updated_at.clone());
            EnvironmentSummary {
                id: e.id.clone(),
                name: e.name.clone(),
                variable_count: e.values.len(),
                created_at,
                updated_at,
            }
        })
        .collect();

    WorkspaceAnalysis {
        workspace_id: ws_id.to_string(),
        workspace_name: ws_name.to_string(),
        workspace_type: ws_type.to_string(),
        created_at,
        updated_at,
        created_by,
        description,
        members,
        collection_count,
        request_count,
        folder_count,
        environment_count,
        duplicate_requests,
        duplicate_collections,
        collections: col_summaries,
        environments: env_summaries,
    }
}

/// Main analysis: merge export data with Postman API workspace data
pub async fn analyze_export(
    api_key: &str,
    export_path: &str,
    workspace_filter: Option<String>,
    app_handle: &tauri::AppHandle,
) -> Result<AnalysisResult, String> {
    use tauri::Emitter;

    let emit = |phase: &str, message: &str, current: usize, total: usize| {
        let _ = app_handle.emit(
            "api-progress",
            ApiProgress {
                phase: phase.to_string(),
                message: message.to_string(),
                current,
                total,
            },
        );
    };

    // Phase 1: Parse the export ZIP
    emit("parsing", "Parsing export ZIP file…", 0, 0);
    let export_data = parser::parse_export_zip(export_path)?;
    let item_count = export_data.collections.len() + export_data.environments.len();
    emit(
        "parsing",
        &format!("Parsed {} collections, {} environments", export_data.collections.len(), export_data.environments.len()),
        item_count,
        item_count,
    );

    // Phase 2: Fetch workspaces from API
    emit("workspaces", "Fetching workspaces from API…", 0, 0);
    let api_workspaces = api::fetch_workspaces(api_key).await?;

    // Fetch team users for ID-to-name resolution (returns empty map on failure)
    emit("workspaces", "Fetching team users…", 0, 0);
    let user_map = api::fetch_team_users(api_key).await;

    // Fetch the collection listing once for createdAt/updatedAt metadata
    // (lenient — empty map on failure).
    emit("workspaces", "Fetching collections list…", 0, 0);
    let collections_meta = api::fetch_collections_list(api_key).await;

    // Fetch the environment listing once for createdAt/updatedAt metadata
    // (lenient — empty map on failure).
    emit("workspaces", "Fetching environments list…", 0, 0);
    let environments_meta = api::fetch_environments_list(api_key).await;

    // Build a map of collection UID -> CollectionData
    let mut col_by_uid: HashMap<String, CollectionData> = HashMap::new();
    for col in &export_data.collections {
        col_by_uid.insert(col.uid.clone(), col.clone());
    }

    // Build a map of environment ID -> EnvironmentData
    let mut env_by_id: HashMap<String, EnvironmentData> = HashMap::new();
    for env in &export_data.environments {
        env_by_id.insert(env.id.clone(), env.clone());
    }

    let mut workspace_analyses = Vec::new();
    let mut matched_col_uids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut matched_env_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Filter workspaces
    let filtered_workspaces: Vec<_> = api_workspaces
        .iter()
        .filter(|ws| {
            if let Some(ref filter) = workspace_filter {
                ws.name.to_lowercase().contains(&filter.to_lowercase())
            } else {
                true
            }
        })
        .collect();
    let ws_total = filtered_workspaces.len();

    // Phase 3: Fetch details for each workspace
    emit("details", &format!("Mapping {} workspaces…", ws_total), 0, ws_total);
    for (i, ws) in filtered_workspaces.iter().enumerate() {
        emit(
            "details",
            &format!("Workspace {}/{}: {}…", i + 1, ws_total, ws.name),
            i + 1,
            ws_total,
        );

        let detail = match api::fetch_workspace_detail(api_key, &ws.id).await {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Warning: Failed to fetch workspace {}: {}", ws.id, e);
                continue;
            }
        };

        // Match collections from export to this workspace
        let mut ws_collections = Vec::new();
        if let Some(ref col_refs) = detail.collections {
            for col_ref in col_refs {
                let col_id = col_ref.id.as_deref().or(col_ref.uid.as_deref()).unwrap_or("");
                // Try matching by uid directly, or by uid prefix
                if let Some(col) = col_by_uid.get(col_id) {
                    ws_collections.push(col.clone());
                    matched_col_uids.insert(col_id.to_string());
                } else if let Some(uid) = &col_ref.uid {
                    // UID format may be "userId-collectionId", try matching just the collection ID part
                    let parts: Vec<&str> = uid.split('-').collect();
                    if parts.len() > 1 {
                        let short_id = parts[1..].join("-");
                        if let Some(col) = col_by_uid.get(&short_id) {
                            ws_collections.push(col.clone());
                            matched_col_uids.insert(short_id);
                        }
                    }
                }
            }
        }

        // Match environments
        let mut ws_environments = Vec::new();
        if let Some(ref env_refs) = detail.environments {
            for env_ref in env_refs {
                let env_id = env_ref.id.as_deref().or(env_ref.uid.as_deref()).unwrap_or("");
                if let Some(env) = env_by_id.get(env_id) {
                    ws_environments.push(env.clone());
                    matched_env_ids.insert(env_id.to_string());
                } else if let Some(uid) = &env_ref.uid {
                    let parts: Vec<&str> = uid.split('-').collect();
                    if parts.len() > 1 {
                        let short_id = parts[1..].join("-");
                        if let Some(env) = env_by_id.get(&short_id) {
                            ws_environments.push(env.clone());
                            matched_env_ids.insert(short_id);
                        }
                    }
                }
            }
        }

        if !ws_collections.is_empty() || !ws_environments.is_empty() {
            let members = parse_members(&detail.members, &user_map);

            // Resolve created_by: if it's a numeric ID, look up the name
            let created_by = detail.created_by.clone().map(|cb| {
                if cb.chars().all(|c| c.is_ascii_digit()) {
                    user_map.get(&cb).cloned().unwrap_or(cb)
                } else {
                    cb
                }
            });

            workspace_analyses.push(build_workspace_analysis(
                &ws.id,
                &ws.name,
                &detail.workspace_type,
                detail.created_at.clone(),
                detail.updated_at.clone(),
                created_by,
                detail.description.clone(),
                members,
                ws_collections,
                ws_environments,
                Some(&collections_meta),
                Some(&environments_meta),
            ));
        }
    }

    // Unmatched collections/environments go to "Unassigned"
    let unmatched_cols: Vec<CollectionData> = export_data
        .collections
        .into_iter()
        .filter(|c| !matched_col_uids.contains(&c.uid))
        .collect();

    let unmatched_envs: Vec<EnvironmentData> = export_data
        .environments
        .into_iter()
        .filter(|e| !matched_env_ids.contains(&e.id))
        .collect();

    if !unmatched_cols.is_empty() || !unmatched_envs.is_empty() {
        workspace_analyses.push(build_workspace_analysis(
            "unassigned",
            "Unassigned",
            "unassigned",
            None,
            None,
            None,
            None,
            Vec::new(),
            unmatched_cols,
            unmatched_envs,
            Some(&collections_meta),
            Some(&environments_meta),
        ));
    }

    emit("done", "Analysis complete", ws_total, ws_total);

    // Sort workspaces: unassigned last
    workspace_analyses.sort_by(|a, b| {
        if a.workspace_id == "unassigned" {
            std::cmp::Ordering::Greater
        } else if b.workspace_id == "unassigned" {
            std::cmp::Ordering::Less
        } else {
            a.workspace_name.cmp(&b.workspace_name)
        }
    });

    Ok(AnalysisResult {
        generated_at: chrono::Utc::now().to_rfc3339(),
        workspaces: workspace_analyses,
    })
}

/// API-only analysis: fetch collections and environments directly from the Postman API.
/// Stores the raw collection/environment JSON data in `api_cache` for later export.
/// Emits `api-progress` events via the Tauri app handle so the frontend can show progress.
pub async fn analyze_from_api(
    api_key: &str,
    workspace_filter: Option<String>,
    api_cache: &Mutex<ApiDataCache>,
    app_handle: &tauri::AppHandle,
) -> Result<AnalysisResult, String> {
    use tauri::Emitter;

    let emit = |phase: &str, message: &str, current: usize, total: usize| {
        let _ = app_handle.emit(
            "api-progress",
            ApiProgress {
                phase: phase.to_string(),
                message: message.to_string(),
                current,
                total,
            },
        );
    };

    // Phase 1: Fetch workspace list
    emit("workspaces", "Fetching workspaces…", 0, 0);
    let api_workspaces = api::fetch_workspaces(api_key).await?;

    // Fetch team users for ID-to-name resolution
    emit("workspaces", "Fetching team users…", 0, 0);
    let user_map = api::fetch_team_users(api_key).await;

    // Fetch the collection listing once for createdAt/updatedAt metadata
    // (lenient — empty map on failure).
    emit("workspaces", "Fetching collections list…", 0, 0);
    let collections_meta = api::fetch_collections_list(api_key).await;

    // Fetch the environment listing once for createdAt/updatedAt metadata
    // (lenient — empty map on failure).
    emit("workspaces", "Fetching environments list…", 0, 0);
    let environments_meta = api::fetch_environments_list(api_key).await;

    // Filter workspaces to know the total count
    let filtered_workspaces: Vec<_> = api_workspaces
        .iter()
        .filter(|ws| {
            if let Some(ref filter) = workspace_filter {
                ws.name.to_lowercase().contains(&filter.to_lowercase())
            } else {
                true
            }
        })
        .collect();
    let ws_total = filtered_workspaces.len();

    let mut workspace_analyses = Vec::new();
    let mut cached_collections: HashMap<String, Vec<u8>> = HashMap::new();
    let mut cached_environments: HashMap<String, Vec<u8>> = HashMap::new();
    let mut items_fetched: usize = 0;

    // Phase 2: For each workspace, count total items first for progress
    // We do a two-pass: first get all workspace details to know total items
    emit("details", &format!("Loading details for {} workspaces…", ws_total), 0, ws_total);
    let mut ws_details = Vec::new();
    for (i, ws) in filtered_workspaces.iter().enumerate() {
        emit(
            "details",
            &format!("Workspace {}/{}: {}…", i + 1, ws_total, ws.name),
            i + 1,
            ws_total,
        );
        match api::fetch_workspace_detail(api_key, &ws.id).await {
            Ok(d) => ws_details.push((ws, d)),
            Err(e) => {
                eprintln!("Warning: Failed to fetch workspace {}: {}", ws.id, e);
            }
        }
    }

    // Count total items (collections + environments) across all workspaces
    let total_items: usize = ws_details.iter().map(|(_, d)| {
        d.collections.as_ref().map_or(0, |c| c.len())
            + d.environments.as_ref().map_or(0, |e| e.len())
    }).sum();

    emit("items", &format!("Fetching {} collections & environments…", total_items), 0, total_items);

    // Phase 3: Fetch all collections and environments
    for (ws, detail) in &ws_details {
        let mut ws_collections = Vec::new();
        if let Some(ref col_refs) = detail.collections {
            for col_ref in col_refs {
                let col_uid = col_ref
                    .uid
                    .as_deref()
                    .or(col_ref.id.as_deref())
                    .unwrap_or("");
                if col_uid.is_empty() {
                    items_fetched += 1;
                    continue;
                }

                items_fetched += 1;
                let col_name = col_ref.name.as_deref().unwrap_or(col_uid);
                emit(
                    "items",
                    &format!("Collection: {} ({}/{})", col_name, items_fetched, total_items),
                    items_fetched,
                    total_items,
                );

                match api::fetch_collection_json(api_key, col_uid).await {
                    Ok(raw_json) => {
                        match parser::parse_collection(&raw_json) {
                            Ok(col_data) => {
                                cached_collections.insert(col_data.uid.clone(), raw_json);
                                ws_collections.push(col_data);
                            }
                            Err(e) => {
                                eprintln!("Warning: Failed to parse collection {}: {}", col_uid, e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to fetch collection {}: {}", col_uid, e);
                    }
                }
            }
        }

        let mut ws_environments = Vec::new();
        if let Some(ref env_refs) = detail.environments {
            for env_ref in env_refs {
                let env_uid = env_ref
                    .uid
                    .as_deref()
                    .or(env_ref.id.as_deref())
                    .unwrap_or("");
                if env_uid.is_empty() {
                    items_fetched += 1;
                    continue;
                }

                items_fetched += 1;
                let env_name = env_ref.name.as_deref().unwrap_or(env_uid);
                emit(
                    "items",
                    &format!("Environment: {} ({}/{})", env_name, items_fetched, total_items),
                    items_fetched,
                    total_items,
                );

                match api::fetch_environment_json(api_key, env_uid).await {
                    Ok(raw_json) => {
                        match parser::parse_environment(&raw_json) {
                            Ok(env_data) => {
                                cached_environments.insert(env_data.id.clone(), raw_json);
                                ws_environments.push(env_data);
                            }
                            Err(e) => {
                                eprintln!(
                                    "Warning: Failed to parse environment {}: {}",
                                    env_uid, e
                                );
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to fetch environment {}: {}", env_uid, e);
                    }
                }
            }
        }

        if !ws_collections.is_empty() || !ws_environments.is_empty() {
            let members = parse_members(&detail.members, &user_map);

            let created_by = detail.created_by.clone().map(|cb| {
                if cb.chars().all(|c| c.is_ascii_digit()) {
                    user_map.get(&cb).cloned().unwrap_or(cb)
                } else {
                    cb
                }
            });

            workspace_analyses.push(build_workspace_analysis(
                &ws.id,
                &ws.name,
                &detail.workspace_type,
                detail.created_at.clone(),
                detail.updated_at.clone(),
                created_by,
                detail.description.clone(),
                members,
                ws_collections,
                ws_environments,
                Some(&collections_meta),
                Some(&environments_meta),
            ));
        }
    }

    // Store fetched data in the cache (lock only briefly, no awaits)
    {
        let mut cache = api_cache
            .lock()
            .map_err(|e| format!("Failed to lock API cache: {}", e))?;
        cache.collections = cached_collections;
        cache.environments = cached_environments;
    }

    emit("done", "Analysis complete", total_items, total_items);

    // Sort workspaces: unassigned last
    workspace_analyses.sort_by(|a, b| {
        if a.workspace_id == "unassigned" {
            std::cmp::Ordering::Greater
        } else if b.workspace_id == "unassigned" {
            std::cmp::Ordering::Less
        } else {
            a.workspace_name.cmp(&b.workspace_name)
        }
    });

    Ok(AnalysisResult {
        generated_at: chrono::Utc::now().to_rfc3339(),
        workspaces: workspace_analyses,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_request(method: &str, url: &str, name: &str, collection: &str) -> RequestData {
        RequestData {
            name: name.to_string(),
            method: method.to_string(),
            url_raw: url.to_string(),
            url_normalized: parser::normalize_url(url),
            folder: String::new(),
            collection_name: collection.to_string(),
            collection_uid: "test-uid".to_string(),
            vars_used: Vec::new(),
        }
    }

    #[test]
    fn test_detect_exact_duplicates() {
        let requests = vec![
            make_request("GET", "https://api.example.com/users", "Get Users 1", "Col A"),
            make_request("GET", "https://api.example.com/users", "Get Users 2", "Col B"),
            make_request("POST", "https://api.example.com/users", "Create User", "Col A"),
        ];

        let dupes = detect_duplicate_requests(&requests);
        assert_eq!(dupes.exact_groups.len(), 1);
        assert_eq!(dupes.exact_groups[0].count, 2);
    }

    #[test]
    fn test_detect_possible_duplicates() {
        let requests = vec![
            make_request("GET", "https://api.example.com/users", "Get Users", "Col A"),
            make_request("POST", "https://api.example.com/users", "Create User", "Col A"),
            make_request("DELETE", "https://api.example.com/other", "Delete Other", "Col A"),
        ];

        let dupes = detect_duplicate_requests(&requests);
        assert_eq!(dupes.possible_groups.len(), 1);
        assert_eq!(dupes.possible_groups[0].count, 2);
    }

    #[test]
    fn test_detect_name_duplicate_collections() {
        let collections = vec![
            CollectionData {
                name: "My API".to_string(),
                uid: "uid-1".to_string(),
                requests: Vec::new(),
                folders: Vec::new(),
                request_count: 0,
                folder_count: 0,
                created_at: None,
                updated_at: None,
            },
            CollectionData {
                name: "My API".to_string(),
                uid: "uid-2".to_string(),
                requests: Vec::new(),
                folders: Vec::new(),
                request_count: 0,
                folder_count: 0,
                created_at: None,
                updated_at: None,
            },
        ];

        let dupes = detect_duplicate_collections(&collections);
        assert_eq!(dupes.name_duplicates.len(), 1);
        assert_eq!(dupes.name_duplicates[0].count, 2);
    }
}
