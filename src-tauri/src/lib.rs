mod analysis;
mod api;
mod commands;
mod export;
mod models;
mod parser;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::parse_export,
            commands::validate_api_key,
            commands::analyze_export,
            commands::export_organized_zip,
            commands::export_report_json,
            commands::export_report_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
