use crate::analysis;
use crate::api;
use crate::export;
use crate::models::*;
use crate::parser;
use std::sync::Mutex;

#[tauri::command]
pub fn parse_export(path: String) -> Result<ExportData, String> {
    parser::parse_export_zip(&path)
}

#[tauri::command]
pub async fn validate_api_key(key: String) -> Result<UserInfo, String> {
    api::validate_api_key(&key).await
}

#[tauri::command]
pub async fn analyze_export(
    key: String,
    export_path: String,
    workspace_filter: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<AnalysisResult, String> {
    analysis::analyze_export(&key, &export_path, workspace_filter, &app_handle).await
}

#[tauri::command]
pub async fn analyze_from_api(
    key: String,
    workspace_filter: Option<String>,
    api_cache: tauri::State<'_, Mutex<ApiDataCache>>,
    app_handle: tauri::AppHandle,
) -> Result<AnalysisResult, String> {
    analysis::analyze_from_api(&key, workspace_filter, &api_cache, &app_handle).await
}

#[tauri::command]
pub fn export_organized_zip(
    analysis_json: String,
    export_path: String,
    output_path: String,
) -> Result<String, String> {
    export::export_organized_zip(&analysis_json, &export_path, &output_path)
}

#[tauri::command]
pub fn export_organized_zip_from_api(
    analysis_json: String,
    output_path: String,
    api_cache: tauri::State<'_, Mutex<ApiDataCache>>,
) -> Result<String, String> {
    let cache = api_cache
        .lock()
        .map_err(|e| format!("Failed to lock API cache: {}", e))?;
    export::export_organized_zip_from_api(
        &analysis_json,
        &cache.collections,
        &cache.environments,
        &output_path,
    )
}

#[tauri::command]
pub fn export_report_json(analysis_json: String, output_path: String) -> Result<String, String> {
    export::export_report_json(&analysis_json, &output_path)
}

#[tauri::command]
pub fn export_report_csv(analysis_json: String, output_path: String) -> Result<String, String> {
    export::export_report_csv(&analysis_json, &output_path)
}

