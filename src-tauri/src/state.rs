use dashmap::DashMap;
use reqwest::Client;
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

/// Global application state shared by all Tauri commands.
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub http_client: Client,
    pub jwt_secret: String,
    pub platform_token_url: String,
    pub xila_base_url: String,
    pub cancel_tokens: Arc<DashMap<String, CancellationToken>>,
}

impl AppState {
    pub fn new(
        pool: SqlitePool,
        jwt_secret: String,
        platform_token_url: String,
        xila_base_url: String,
    ) -> Self {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            pool,
            http_client,
            jwt_secret,
            platform_token_url,
            xila_base_url,
            cancel_tokens: Arc::new(DashMap::new()),
        }
    }
}
