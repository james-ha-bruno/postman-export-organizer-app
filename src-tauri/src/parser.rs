use crate::models::*;
use regex::Regex;
use std::collections::BTreeMap;
use std::io::Read;

/// Normalize a URL: lowercase scheme+host, sort query params, keep {{var}} patterns.
pub fn normalize_url(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Parse URL - handle URLs without scheme
    let with_scheme = if !trimmed.contains("://") && !trimmed.starts_with("{{") {
        format!("http://{}", trimmed)
    } else {
        trimmed.to_string()
    };

    // Try to parse with url crate
    if let Ok(parsed) = url::Url::parse(&with_scheme) {
        let scheme = parsed.scheme().to_lowercase();
        let host = parsed.host_str().unwrap_or("").to_lowercase();
        let port = parsed.port().map(|p| format!(":{}", p)).unwrap_or_default();
        let path = parsed.path();

        // Sort query params
        let mut params: BTreeMap<String, String> = BTreeMap::new();
        for (k, v) in parsed.query_pairs() {
            params.insert(k.to_string(), v.to_string());
        }

        let query = if params.is_empty() {
            String::new()
        } else {
            let pairs: Vec<String> = params.iter().map(|(k, v)| {
                if v.is_empty() { k.clone() } else { format!("{}={}", k, v) }
            }).collect();
            format!("?{}", pairs.join("&"))
        };

        format!("{}://{}{}{}{}", scheme, host, port, path, query)
    } else {
        // For URLs with template variables that can't be parsed, do basic normalization
        trimmed.to_string()
    }
}

/// Extract {{variable}} patterns from a string
pub fn extract_vars(text: &str) -> Vec<String> {
    let re = Regex::new(r"\{\{([^}]+)\}\}").unwrap();
    let mut vars: Vec<String> = re
        .captures_iter(text)
        .map(|c| c[1].to_string())
        .collect();
    vars.sort();
    vars.dedup();
    vars
}

/// Extract raw URL from Postman's URL field (can be string or object)
pub fn extract_url_raw(url_value: &serde_json::Value) -> String {
    match url_value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Object(obj) => {
            obj.get("raw")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        }
        _ => String::new(),
    }
}

/// Recursively walk Postman collection items, extracting requests and folder names
pub fn walk_items(
    items: &[serde_json::Value],
    folder_path: &str,
    collection_name: &str,
    collection_uid: &str,
    requests: &mut Vec<RequestData>,
    folders: &mut Vec<String>,
) {
    for item in items {
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed");

        if let Some(sub_items) = item.get("item").and_then(|v| v.as_array()) {
            // This is a folder
            let current_folder = if folder_path.is_empty() {
                name.to_string()
            } else {
                format!("{}/{}", folder_path, name)
            };
            folders.push(current_folder.clone());
            walk_items(sub_items, &current_folder, collection_name, collection_uid, requests, folders);
        } else if let Some(request) = item.get("request") {
            // This is a request
            let method = request
                .get("method")
                .and_then(|v| v.as_str())
                .unwrap_or("GET")
                .to_uppercase();

            let url_raw = if let Some(url_val) = request.get("url") {
                extract_url_raw(url_val)
            } else {
                String::new()
            };

            let url_normalized = normalize_url(&url_raw);
            let vars_used = extract_vars(&url_raw);

            requests.push(RequestData {
                name: name.to_string(),
                method,
                url_raw,
                url_normalized,
                folder: folder_path.to_string(),
                collection_name: collection_name.to_string(),
                collection_uid: collection_uid.to_string(),
                vars_used,
            });
        }
    }
}

/// Parse a Postman collection JSON
pub fn parse_collection(data: &[u8]) -> Result<CollectionData, String> {
    let json: serde_json::Value =
        serde_json::from_slice(data).map_err(|e| format!("Failed to parse collection JSON: {}", e))?;

    let info = json.get("info").ok_or("Missing 'info' field in collection")?;
    let name = info.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed").to_string();
    let uid = info
        .get("_postman_id")
        .or_else(|| info.get("uid"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let items = json.get("item").and_then(|v| v.as_array());
    let mut requests = Vec::new();
    let mut folders = Vec::new();

    if let Some(items) = items {
        walk_items(items, "", &name, &uid, &mut requests, &mut folders);
    }

    let request_count = requests.len();
    let folder_count = folders.len();

    Ok(CollectionData {
        name,
        uid,
        requests,
        folders,
        request_count,
        folder_count,
    })
}

/// Parse a Postman environment JSON
pub fn parse_environment(data: &[u8]) -> Result<EnvironmentData, String> {
    let json: serde_json::Value =
        serde_json::from_slice(data).map_err(|e| format!("Failed to parse environment JSON: {}", e))?;

    let id = json.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let name = json.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed").to_string();

    let values = if let Some(vals) = json.get("values").and_then(|v| v.as_array()) {
        vals.iter()
            .filter_map(|v| {
                Some(EnvVariable {
                    key: v.get("key").and_then(|k| k.as_str()).unwrap_or("").to_string(),
                    value: v.get("value").and_then(|k| k.as_str()).unwrap_or("").to_string(),
                    var_type: v.get("type").and_then(|k| k.as_str()).unwrap_or("default").to_string(),
                    enabled: v.get("enabled").and_then(|k| k.as_bool()).unwrap_or(true),
                })
            })
            .collect()
    } else {
        Vec::new()
    };

    Ok(EnvironmentData { id, name, values })
}

/// Parse a Postman Data Export zip file
pub fn parse_export_zip(path: &str) -> Result<ExportData, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;

    // Find the root directory (UUID prefix)
    let mut root_prefix = String::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| format!("Zip error: {}", e))?;
        let name = entry.name().to_string();
        if name.ends_with("/archive.json") {
            root_prefix = name.replace("archive.json", "");
            break;
        }
    }

    // Parse archive.json to get manifest
    let archive_path = format!("{}archive.json", root_prefix);
    let manifest: ArchiveManifest = {
        let mut entry = archive.by_name(&archive_path).map_err(|e| format!("archive.json not found: {}", e))?;
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| format!("Read error: {}", e))?;
        serde_json::from_slice(&buf).map_err(|e| format!("Failed to parse archive.json: {}", e))?
    };

    // Parse collections
    let mut collections = Vec::new();
    for uuid in manifest.collection.keys() {
        let col_path = format!("{}collection/{}.json", root_prefix, uuid);
        match archive.by_name(&col_path) {
            Ok(mut entry) => {
                let mut buf = Vec::new();
                if entry.read_to_end(&mut buf).is_ok() {
                    match parse_collection(&buf) {
                        Ok(col) => collections.push(col),
                        Err(e) => eprintln!("Warning: Failed to parse collection {}: {}", uuid, e),
                    }
                }
            }
            Err(_) => eprintln!("Warning: Collection file not found: {}", col_path),
        }
    }

    // Parse environments
    let mut environments = Vec::new();
    for uuid in manifest.environment.keys() {
        let env_path = format!("{}environment/{}.json", root_prefix, uuid);
        match archive.by_name(&env_path) {
            Ok(mut entry) => {
                let mut buf = Vec::new();
                if entry.read_to_end(&mut buf).is_ok() {
                    match parse_environment(&buf) {
                        Ok(env) => environments.push(env),
                        Err(e) => eprintln!("Warning: Failed to parse environment {}: {}", uuid, e),
                    }
                }
            }
            Err(_) => eprintln!("Warning: Environment file not found: {}", env_path),
        }
    }

    collections.sort_by(|a, b| a.name.cmp(&b.name));
    environments.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(ExportData {
        collections,
        environments,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_url_basic() {
        assert_eq!(
            normalize_url("https://api.example.com/users"),
            "https://api.example.com/users"
        );
    }

    #[test]
    fn test_normalize_url_sorts_query_params() {
        assert_eq!(
            normalize_url("https://api.example.com/users?b=2&a=1"),
            "https://api.example.com/users?a=1&b=2"
        );
    }

    #[test]
    fn test_normalize_url_lowercase_host() {
        assert_eq!(
            normalize_url("https://API.Example.COM/Path"),
            "https://api.example.com/Path"
        );
    }

    #[test]
    fn test_normalize_url_no_scheme() {
        let result = normalize_url("api.example.com/test");
        assert_eq!(result, "http://api.example.com/test");
    }

    #[test]
    fn test_normalize_url_empty() {
        assert_eq!(normalize_url(""), "");
    }

    #[test]
    fn test_extract_vars() {
        let vars = extract_vars("https://{{base_url}}/api/{{version}}/users");
        assert_eq!(vars, vec!["base_url", "version"]);
    }

    #[test]
    fn test_extract_vars_none() {
        let vars = extract_vars("https://api.example.com/users");
        assert!(vars.is_empty());
    }

    #[test]
    fn test_extract_url_raw_string() {
        let val = serde_json::json!("https://example.com");
        assert_eq!(extract_url_raw(&val), "https://example.com");
    }

    #[test]
    fn test_extract_url_raw_object() {
        let val = serde_json::json!({"raw": "https://example.com/api", "host": ["example", "com"]});
        assert_eq!(extract_url_raw(&val), "https://example.com/api");
    }

    #[test]
    fn test_parse_collection_basic() {
        let json = r#"{
            "info": {
                "_postman_id": "test-123",
                "name": "Test Collection",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": [
                {
                    "name": "Get Users",
                    "request": {
                        "method": "GET",
                        "url": "https://api.example.com/users"
                    }
                }
            ]
        }"#;

        let col = parse_collection(json.as_bytes()).unwrap();
        assert_eq!(col.name, "Test Collection");
        assert_eq!(col.uid, "test-123");
        assert_eq!(col.request_count, 1);
        assert_eq!(col.requests[0].method, "GET");
    }

    #[test]
    fn test_parse_collection_with_folders() {
        let json = r#"{
            "info": { "_postman_id": "test-456", "name": "With Folders" },
            "item": [
                {
                    "name": "Auth",
                    "item": [
                        {
                            "name": "Login",
                            "request": { "method": "POST", "url": "https://api.example.com/login" }
                        }
                    ]
                }
            ]
        }"#;

        let col = parse_collection(json.as_bytes()).unwrap();
        assert_eq!(col.folder_count, 1);
        assert_eq!(col.folders[0], "Auth");
        assert_eq!(col.requests[0].folder, "Auth");
    }

    #[test]
    fn test_parse_environment() {
        let json = r#"{
            "id": "env-123",
            "name": "Production",
            "values": [
                { "key": "base_url", "value": "https://api.example.com", "type": "default", "enabled": true },
                { "key": "api_key", "value": "secret", "type": "secret", "enabled": true }
            ]
        }"#;

        let env = parse_environment(json.as_bytes()).unwrap();
        assert_eq!(env.name, "Production");
        assert_eq!(env.id, "env-123");
        assert_eq!(env.values.len(), 2);
    }
}
