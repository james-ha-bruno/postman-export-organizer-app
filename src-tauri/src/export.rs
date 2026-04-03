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

