pub mod api;
pub mod auth;
pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod services;
pub mod state;

use tauri::Manager;
use crate::auth::commands::{login, logout, validate_session};
use crate::commands::{
    add_to_favorites, cancel_task, create_analysis, delete_task, export_companies_csv,
    export_html_file,
    get_analysis, get_app_version, get_charts_data, get_company_detail, get_default_config,
    get_favorites, get_filtered_companies, get_recent_analyses, get_task, list_tasks,
    remove_from_favorites,
};
use crate::db::pool::init_pool;
use crate::state::AppState;
use models::config::{PLATFORM_TOKEN_URL, XILA_BASE_URL};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize database and state within the Tokio runtime
            tauri::async_runtime::block_on(async move {
                let pool = init_pool(&app_handle)
                    .await
                    .expect("Failed to initialize database");

                let jwt_secret = std::env::var("JWT_SECRET")
                    .unwrap_or_else(|_| "procuremap-jwt-secret-key-2024".to_string());

                let platform_token_url = std::env::var("PLATFORM_TOKEN_URL")
                    .unwrap_or_else(|_| PLATFORM_TOKEN_URL.to_string());

                let xila_base_url = std::env::var("XILA_BASE_URL")
                    .unwrap_or_else(|_| XILA_BASE_URL.to_string());

                let state = AppState::new(pool, jwt_secret, platform_token_url, xila_base_url);

                app_handle.manage(state);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            login,
            logout,
            validate_session,
            // Tasks
            create_analysis,
            get_task,
            list_tasks,
            cancel_task,
            delete_task,
            get_recent_analyses,
            add_to_favorites,
            remove_from_favorites,
            get_favorites,
            // Analysis
            get_analysis,
            get_company_detail,
            get_filtered_companies,
            export_companies_csv,
            export_html_file,
            get_charts_data,
            // System
            get_app_version,
            get_default_config,
        ])
        .run(tauri::generate_context!())
        .expect("error running ProcureMap");
}
