use crate::models::*;
use crate::parser;
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};

/// Sanitize a name for use as a filesystem path component
fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

/// Generate a unique zip entry path, appending _2, _3, etc. on collision
fn deduplicate_path(
    used: &mut HashSet<String>,
    dir: &str,
    base_name: &str,
    extension: &str,
) -> String {
    let candidate = format!("{}/{}.{}", dir, base_name, extension);
    if used.insert(candidate.clone()) {
        return candidate;
    }
    let mut counter = 2u32;
    loop {
        let candidate = format!("{}/{}_{}.{}", dir, base_name, counter, extension);
        if used.insert(candidate.clone()) {
            return candidate;
        }
        counter += 1;
    }
}

/// Create an organized zip grouped by workspace
pub fn export_organized_zip(
    analysis_json: &str,
    export_path: &str,
    output_path: &str,
) -> Result<String, String> {
    let analysis: AnalysisResult =
        serde_json::from_str(analysis_json).map_err(|e| format!("Failed to parse analysis JSON: {}", e))?;

    // Parse the original export to get raw collection/environment data
    let export_data = parser::parse_export_zip(export_path)?;

    // Build lookup maps for raw JSON data from the zip
    let file = std::fs::File::open(export_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;

    // Find root prefix
    let mut root_prefix = String::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| format!("Zip error: {}", e))?;
        let name = entry.name().to_string();
        if name.ends_with("/archive.json") {
            root_prefix = name.replace("archive.json", "");
            break;
        }
    }

    // Read all collection and environment files into memory
    let mut col_data: std::collections::HashMap<String, Vec<u8>> = std::collections::HashMap::new();
    let mut env_data: std::collections::HashMap<String, Vec<u8>> = std::collections::HashMap::new();

    for col in &export_data.collections {
        let path = format!("{}collection/{}.json", root_prefix, col.uid);
        if let Ok(mut entry) = archive.by_name(&path) {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                col_data.insert(col.uid.clone(), buf);
            }
        }
    }

    for env in &export_data.environments {
        let path = format!("{}environment/{}.json", root_prefix, env.id);
        if let Ok(mut entry) = archive.by_name(&path) {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                env_data.insert(env.id.clone(), buf);
            }
        }
    }

    // Create output zip
    let out_file =
        std::fs::File::create(output_path).map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip_writer = zip::ZipWriter::new(out_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut used_paths: HashSet<String> = HashSet::new();

    for ws in &analysis.workspaces {
        let ws_dir = sanitize_name(&ws.workspace_name);

        for col_summary in &ws.collections {
            if let Some(data) = col_data.get(&col_summary.uid) {
                let base_name = sanitize_name(&col_summary.name);
                let path = deduplicate_path(
                    &mut used_paths,
                    &format!("{}/collections", ws_dir),
                    &base_name,
                    "postman_collection.json",
                );
                zip_writer
                    .start_file(&path, options)
                    .map_err(|e| format!("Zip write error: {}", e))?;
                zip_writer
                    .write_all(data)
                    .map_err(|e| format!("Write error: {}", e))?;
            }
        }

        for env_summary in &ws.environments {
            if let Some(data) = env_data.get(&env_summary.id) {
                let base_name = sanitize_name(&env_summary.name);
                let path = deduplicate_path(
                    &mut used_paths,
                    &format!("{}/environments", ws_dir),
                    &base_name,
                    "postman_environment.json",
                );
                zip_writer
                    .start_file(&path, options)
                    .map_err(|e| format!("Zip write error: {}", e))?;
                zip_writer
                    .write_all(data)
                    .map_err(|e| format!("Write error: {}", e))?;
            }
        }
    }

    zip_writer
        .finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(output_path.to_string())
}

/// Export analysis result as formatted JSON
pub fn export_report_json(analysis_json: &str, output_path: &str) -> Result<String, String> {
    // Validate that it's valid JSON first
    let value: serde_json::Value =
        serde_json::from_str(analysis_json).map_err(|e| format!("Invalid JSON: {}", e))?;

    let formatted =
        serde_json::to_string_pretty(&value).map_err(|e| format!("JSON formatting error: {}", e))?;

    std::fs::write(output_path, &formatted).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(output_path.to_string())
}

/// Export analysis result as CSV
pub fn export_report_csv(analysis_json: &str, output_path: &str) -> Result<String, String> {
    let analysis: AnalysisResult =
        serde_json::from_str(analysis_json).map_err(|e| format!("Failed to parse analysis JSON: {}", e))?;

    let mut wtr = csv::Writer::from_path(output_path).map_err(|e| format!("Failed to create CSV: {}", e))?;

    // Write header
    wtr.write_record(&[
        "workspace_name",
        "workspace_type",
        "workspace_id",
        "collections",
        "requests",
        "folders",
        "exact_duplicates",
        "possible_duplicates",
        "environments_count",
        "name_duplicate_collections",
        "content_duplicate_collections",
    ])
    .map_err(|e| format!("CSV write error: {}", e))?;

    for ws in &analysis.workspaces {
        wtr.write_record(&[
            &ws.workspace_name,
            &ws.workspace_type,
            &ws.workspace_id,
            &ws.collection_count.to_string(),
            &ws.request_count.to_string(),
            &ws.folder_count.to_string(),
            &ws.duplicate_requests.exact_count.to_string(),
            &ws.duplicate_requests.possible_count.to_string(),
            &ws.environment_count.to_string(),
            &ws.duplicate_collections.name_duplicates.len().to_string(),
            &ws.duplicate_collections.content_duplicates.len().to_string(),
        ])
        .map_err(|e| format!("CSV write error: {}", e))?;
    }

    wtr.flush().map_err(|e| format!("CSV flush error: {}", e))?;

    Ok(output_path.to_string())
}

/// Create an organized zip from API-cached data (no source zip needed)
pub fn export_organized_zip_from_api(
    analysis_json: &str,
    col_data: &HashMap<String, Vec<u8>>,
    env_data: &HashMap<String, Vec<u8>>,
    output_path: &str,
) -> Result<String, String> {
    let analysis: AnalysisResult =
        serde_json::from_str(analysis_json).map_err(|e| format!("Failed to parse analysis JSON: {}", e))?;

    let out_file =
        std::fs::File::create(output_path).map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip_writer = zip::ZipWriter::new(out_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut used_paths: HashSet<String> = HashSet::new();

    for ws in &analysis.workspaces {
        let ws_dir = sanitize_name(&ws.workspace_name);

        for col_summary in &ws.collections {
            if let Some(data) = col_data.get(&col_summary.uid) {
                let base_name = sanitize_name(&col_summary.name);
                let path = deduplicate_path(
                    &mut used_paths,
                    &format!("{}/collections", ws_dir),
                    &base_name,
                    "postman_collection.json",
                );
                zip_writer
                    .start_file(&path, options)
                    .map_err(|e| format!("Zip write error: {}", e))?;
                zip_writer
                    .write_all(data)
                    .map_err(|e| format!("Write error: {}", e))?;
            }
        }

        for env_summary in &ws.environments {
            if let Some(data) = env_data.get(&env_summary.id) {
                let base_name = sanitize_name(&env_summary.name);
                let path = deduplicate_path(
                    &mut used_paths,
                    &format!("{}/environments", ws_dir),
                    &base_name,
                    "postman_environment.json",
                );
                zip_writer
                    .start_file(&path, options)
                    .map_err(|e| format!("Zip write error: {}", e))?;
                zip_writer
                    .write_all(data)
                    .map_err(|e| format!("Write error: {}", e))?;
            }
        }
    }

    zip_writer
        .finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(output_path.to_string())
}

/// Read raw collection/environment JSON blobs out of a source Postman export zip.
/// Used by the Bruno data-dump exporter to mirror the source-of-truth bytes.
fn read_export_zip_bytes(
    export_path: &str,
) -> Result<(HashMap<String, Vec<u8>>, HashMap<String, Vec<u8>>), String> {
    let export_data = parser::parse_export_zip(export_path)?;

    let file =
        std::fs::File::open(export_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;

    let mut root_prefix = String::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| format!("Zip error: {}", e))?;
        let name = entry.name().to_string();
        if name.ends_with("/archive.json") {
            root_prefix = name.replace("archive.json", "");
            break;
        }
    }

    let mut col_data: HashMap<String, Vec<u8>> = HashMap::new();
    let mut env_data: HashMap<String, Vec<u8>> = HashMap::new();

    for col in &export_data.collections {
        let path = format!("{}collection/{}.json", root_prefix, col.uid);
        if let Ok(mut entry) = archive.by_name(&path) {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                col_data.insert(col.uid.clone(), buf);
            }
        }
    }

    for env in &export_data.environments {
        let path = format!("{}environment/{}.json", root_prefix, env.id);
        if let Ok(mut entry) = archive.by_name(&path) {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                env_data.insert(env.id.clone(), buf);
            }
        }
    }

    Ok((col_data, env_data))
}

/// Create a Postman data-dump-shaped zip readable by Bruno 3.5.0+ Bulk Import.
/// Layout (flat under root, matching Postman's real data-dump shape):
///   archive.json
///   collection/<uuid>.json
///   environment/<uuid>.json
pub fn export_bruno_zip_from_api(
    analysis_json: &str,
    col_data: &HashMap<String, Vec<u8>>,
    env_data: &HashMap<String, Vec<u8>>,
    output_path: &str,
) -> Result<String, String> {
    let analysis: AnalysisResult = serde_json::from_str(analysis_json)
        .map_err(|e| format!("Failed to parse analysis JSON: {}", e))?;

    // Deduplicate UUIDs across workspaces (first-seen wins), preserving order.
    // Only ids present in the raw-data maps make it into the manifest so we never
    // reference a missing payload.
    let mut col_ids: Vec<String> = Vec::new();
    let mut col_seen: HashSet<String> = HashSet::new();
    let mut env_ids: Vec<String> = Vec::new();
    let mut env_seen: HashSet<String> = HashSet::new();

    for ws in &analysis.workspaces {
        for c in &ws.collections {
            if col_data.contains_key(&c.uid) && col_seen.insert(c.uid.clone()) {
                col_ids.push(c.uid.clone());
            }
        }
        for e in &ws.environments {
            if env_data.contains_key(&e.id) && env_seen.insert(e.id.clone()) {
                env_ids.push(e.id.clone());
            }
        }
    }

    let mut collection_map = serde_json::Map::new();
    for id in &col_ids {
        collection_map.insert(id.clone(), serde_json::Value::Bool(true));
    }
    let mut environment_map = serde_json::Map::new();
    for id in &env_ids {
        environment_map.insert(id.clone(), serde_json::Value::Bool(true));
    }
    let manifest = serde_json::json!({
        "collection": serde_json::Value::Object(collection_map),
        "environment": serde_json::Value::Object(environment_map),
    });
    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize archive.json: {}", e))?;

    let out_file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip_writer = zip::ZipWriter::new(out_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip_writer
        .start_file("archive.json", options)
        .map_err(|e| format!("Zip write error: {}", e))?;
    zip_writer
        .write_all(&manifest_bytes)
        .map_err(|e| format!("Write error: {}", e))?;

    for uid in &col_ids {
        if let Some(data) = col_data.get(uid) {
            let path = format!("collection/{}.json", uid);
            zip_writer
                .start_file(&path, options)
                .map_err(|e| format!("Zip write error: {}", e))?;
            zip_writer
                .write_all(data)
                .map_err(|e| format!("Write error: {}", e))?;
        }
    }
    for id in &env_ids {
        if let Some(data) = env_data.get(id) {
            let path = format!("environment/{}.json", id);
            zip_writer
                .start_file(&path, options)
                .map_err(|e| format!("Zip write error: {}", e))?;
            zip_writer
                .write_all(data)
                .map_err(|e| format!("Write error: {}", e))?;
        }
    }

    zip_writer
        .finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(output_path.to_string())
}

/// File-source variant: extract raw JSON from the source zip, then delegate to the
/// API-map-consuming exporter for the actual archive layout.
pub fn export_bruno_zip(
    analysis_json: &str,
    export_path: &str,
    output_path: &str,
) -> Result<String, String> {
    let (col_data, env_data) = read_export_zip_bytes(export_path)?;
    export_bruno_zip_from_api(analysis_json, &col_data, &env_data, output_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_workspace(
        id: &str,
        name: &str,
        collections: Vec<CollectionSummary>,
        environments: Vec<EnvironmentSummary>,
    ) -> WorkspaceAnalysis {
        WorkspaceAnalysis {
            workspace_id: id.to_string(),
            workspace_name: name.to_string(),
            workspace_type: "team".to_string(),
            created_at: None,
            updated_at: None,
            created_by: None,
            description: None,
            members: Vec::new(),
            collection_count: collections.len(),
            request_count: 0,
            folder_count: 0,
            environment_count: environments.len(),
            duplicate_requests: DuplicateInfo {
                exact_count: 0,
                exact_groups: Vec::new(),
                possible_count: 0,
                possible_groups: Vec::new(),
            },
            duplicate_collections: DuplicateCollectionInfo {
                name_duplicates: Vec::new(),
                content_duplicates: Vec::new(),
            },
            collections,
            environments,
        }
    }

    fn col_summary(uid: &str, name: &str) -> CollectionSummary {
        CollectionSummary {
            name: name.to_string(),
            uid: uid.to_string(),
            request_count: 0,
            folder_count: 0,
            created_at: None,
            updated_at: None,
        }
    }

    fn env_summary(id: &str, name: &str) -> EnvironmentSummary {
        EnvironmentSummary {
            id: id.to_string(),
            name: name.to_string(),
            variable_count: 0,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn test_export_bruno_zip_from_api_shape_and_dedup() {
        // Two workspaces; col-uid-1 appears in BOTH, so dedup must collapse it.
        let col1 = col_summary("col-uid-1", "Collection One");
        let col2 = col_summary("col-uid-2", "Collection Two");
        let env1 = env_summary("env-id-1", "Env One");

        let ws_a = make_workspace(
            "ws-a",
            "Workspace A",
            vec![col1.clone(), col2.clone()],
            vec![env1.clone()],
        );
        let ws_b = make_workspace("ws-b", "Workspace B", vec![col1.clone()], Vec::new());

        let analysis = AnalysisResult {
            generated_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![ws_a, ws_b],
        };
        let analysis_json = serde_json::to_string(&analysis).unwrap();

        let mut col_data: HashMap<String, Vec<u8>> = HashMap::new();
        col_data.insert(
            "col-uid-1".to_string(),
            br#"{"info":{"name":"C1","_postman_id":"col-uid-1"}}"#.to_vec(),
        );
        col_data.insert(
            "col-uid-2".to_string(),
            br#"{"info":{"name":"C2","_postman_id":"col-uid-2"}}"#.to_vec(),
        );
        let mut env_data: HashMap<String, Vec<u8>> = HashMap::new();
        env_data.insert(
            "env-id-1".to_string(),
            br#"{"id":"env-id-1","name":"E1","values":[]}"#.to_vec(),
        );

        let out_path = std::env::temp_dir().join(format!(
            "bruno_zip_test_{}_{}.zip",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let out_path_str = out_path.to_string_lossy().to_string();

        let result =
            export_bruno_zip_from_api(&analysis_json, &col_data, &env_data, &out_path_str);
        assert!(result.is_ok(), "export failed: {:?}", result);

        // Read the produced zip back and inspect it.
        let file = std::fs::File::open(&out_path).expect("open output zip");
        let mut zip = zip::ZipArchive::new(file).expect("parse output zip");

        let mut entry_names: Vec<String> = (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string())
            .collect();
        entry_names.sort();

        let expected: Vec<String> = {
            let mut v = vec![
                "archive.json".to_string(),
                "collection/col-uid-1.json".to_string(),
                "collection/col-uid-2.json".to_string(),
                "environment/env-id-1.json".to_string(),
            ];
            v.sort();
            v
        };
        assert_eq!(entry_names, expected, "unexpected zip entry set");

        // archive.json parses and matches the filenames 1:1.
        let mut manifest_str = String::new();
        {
            let mut entry = zip.by_name("archive.json").expect("archive.json missing");
            entry.read_to_string(&mut manifest_str).unwrap();
        }
        let manifest: serde_json::Value =
            serde_json::from_str(&manifest_str).expect("archive.json parses");

        let col_map = manifest.get("collection").and_then(|v| v.as_object()).unwrap();
        let env_map = manifest.get("environment").and_then(|v| v.as_object()).unwrap();
        assert_eq!(col_map.len(), 2, "expected 2 dedup'd collections");
        assert_eq!(env_map.len(), 1, "expected 1 environment");
        assert!(col_map.get("col-uid-1").and_then(|v| v.as_bool()) == Some(true));
        assert!(col_map.get("col-uid-2").and_then(|v| v.as_bool()) == Some(true));
        assert!(env_map.get("env-id-1").and_then(|v| v.as_bool()) == Some(true));

        // 1:1 mapping: every archive.json key has exactly one matching file entry.
        for key in col_map.keys() {
            let expected_path = format!("collection/{}.json", key);
            let matches: Vec<_> = entry_names.iter().filter(|n| *n == &expected_path).collect();
            assert_eq!(matches.len(), 1, "collection {} not 1:1", key);
        }
        for key in env_map.keys() {
            let expected_path = format!("environment/{}.json", key);
            let matches: Vec<_> = entry_names.iter().filter(|n| *n == &expected_path).collect();
            assert_eq!(matches.len(), 1, "environment {} not 1:1", key);
        }

        // And no orphan file entries beyond archive.json.
        for name in &entry_names {
            if name == "archive.json" {
                continue;
            }
            let id = std::path::Path::new(name)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            let in_col = col_map.contains_key(id);
            let in_env = env_map.contains_key(id);
            assert!(in_col || in_env, "orphan entry {} not in archive.json", name);
        }

        let _ = std::fs::remove_file(&out_path);
    }
}
