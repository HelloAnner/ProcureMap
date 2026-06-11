use crate::error::Result;
use crate::models::config::RunConfig;
use crate::services::search_query_builder;
use tauri::AppHandle;

/// Get the app version from Cargo.toml.
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Get the default run configuration.
#[tauri::command]
pub fn get_default_config() -> Result<RunConfig> {
    Ok(RunConfig {
        origin_name: "芜湖永康".to_string(),
        material_label: "铝".to_string(),
        keywords: search_query_builder::default_keywords(),
        areas: search_query_builder::default_areas(),
        radius_km: 300,
        max_details: 320,
        enrich_limit: 20,
        pages: 2,
        search_limit: 100,
        output_dir: String::new(),
        lat: None,
        lng: None,
        industry_name3: "有色金属压延加工".to_string(),
        internal_token: String::new(),
        pause: 0.05,
        timeout: 12.0,
    })
}
