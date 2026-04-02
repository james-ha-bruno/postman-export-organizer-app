use crate::analysis;
use crate::api;
use crate::export;
use crate::models::*;
use crate::parser;

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
) -> Result<AnalysisResult, String> {
    analysis::analyze_export(&key, &export_path, workspace_filter).await
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
pub fn export_report_json(analysis_json: String, output_path: String) -> Result<String, String> {
    export::export_report_json(&analysis_json, &output_path)
}

#[tauri::command]
pub fn export_report_csv(analysis_json: String, output_path: String) -> Result<String, String> {
    export::export_report_csv(&analysis_json, &output_path)
}

