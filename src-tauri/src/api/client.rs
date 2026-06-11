use crate::error::{AppError, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Replicates the Python XilaClient class exactly.
pub struct XilaClient {
    pub pause: f64,
    pub timeout: f64,
    pub token: Mutex<Option<String>>,
    pub last_call: Mutex<Instant>,
    pub internal_token: Mutex<Option<String>>,
    pub calls: AtomicI32,
    pub failures: Mutex<HashMap<String, i32>>,
    pub http_client: reqwest::Client,
    pub platform_token_url: String,
    pub xila_base_url: String,
}

impl XilaClient {
    pub fn new(
        pause: f64,
        timeout: f64,
        platform_token_url: String,
        xila_base_url: String,
    ) -> Self {
        Self {
            pause,
            timeout,
            token: Mutex::new(None),
            last_call: Mutex::new(Instant::now()),
            internal_token: Mutex::new(None),
            calls: AtomicI32::new(0),
            failures: Mutex::new(HashMap::new()),
            http_client: reqwest::Client::builder()
                .timeout(Duration::from_secs_f64(timeout))
                .build()
                .expect("Failed to create HTTP client"),
            platform_token_url,
            xila_base_url,
        }
    }

    pub fn with_defaults(platform_token_url: String, xila_base_url: String) -> Self {
        Self::new(0.16, 14.0, platform_token_url, xila_base_url)
    }

    /// Resolve Xila token from the platform endpoint.
    pub async fn resolve_token(&self, force: bool) -> Result<String> {
        let token_val = {
            let internal_str = self.internal_token.lock().unwrap().clone();
            internal_str
        };

        let body = if force {
            serde_json::json!({"tenantId": "GLOBAL_DEFAULT", "forceRefresh": true})
        } else {
            serde_json::json!({"tenantId": "GLOBAL_DEFAULT"})
        };

        let request = self
            .http_client
            .post(&self.platform_token_url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", token_val.unwrap_or_default()))
            .json(&body);

        let response = match request.send().await {
            Ok(resp) => resp,
            Err(e) => {
                self.record_failure("/api/v1/internal/xila-token/resolve");
                if force {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    return Box::pin(self.resolve_token(false)).await;
                }
                let current = self.token.lock().unwrap().clone();
                if let Some(tok) = current {
                    return Ok(tok);
                }
                return Err(AppError::HttpError(e));
            }
        };

        match response.json::<Value>().await {
            Ok(payload) => {
                let tok = payload["token"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                if tok.is_empty() {
                    self.record_failure("/api/v1/internal/xila-token/resolve");
                    let current = self.token.lock().unwrap().clone();
                    if let Some(t) = current {
                        return Ok(t);
                    }
                    return Err(AppError::Internal("Token 响应中缺少 token 字段".to_string()));
                }
                *self.token.lock().unwrap() = Some(tok.clone());
                Ok(tok)
            }
            Err(e) => {
                self.record_failure("/api/v1/internal/xila-token/resolve");
                let current = self.token.lock().unwrap().clone();
                if let Some(t) = current {
                    return Ok(t);
                }
                Err(AppError::HttpError(e))
            }
        }
    }

    /// Set the internal service token (from env var or user config).
    pub fn set_internal_token(&self, tok: String) {
        *self.internal_token.lock().unwrap() = Some(tok);
    }

    /// POST to a Xila API path with rate limiting, token injection, and auto-retry.
    pub async fn post(&self, path: &str, params: Value) -> Result<Value> {
        self.post_inner(path, params, true).await
    }

    async fn post_inner(&self, path: &str, params: Value, retry: bool) -> Result<Value> {
        // Ensure token exists
        {
            let needs_token = {
                let tok = self.token.lock().unwrap();
                tok.is_none()
            };
            if needs_token {
                self.resolve_token(false).await?;
            }
        }

        // Rate limiting: sleep for pause minus elapsed time since last call
        {
            let wait_needed = {
                let mut last = self.last_call.lock().unwrap();
                let elapsed = last.elapsed();
                if elapsed < Duration::from_secs_f64(self.pause) {
                    let wait = Duration::from_secs_f64(self.pause) - elapsed;
                    *last = Instant::now();
                    Some(wait)
                } else {
                    *last = Instant::now();
                    None
                }
            }; // MutexGuard dropped here
            if let Some(wait) = wait_needed {
                tokio::time::sleep(wait).await;
            }
        }

        // Inject token into body
        let mut body = params.clone();
        if let Value::Object(ref mut map) = body {
            let tok = self.token.lock().unwrap().clone().unwrap_or_default();
            map.insert("TOKEN".to_string(), Value::String(tok));
        }

        let url = format!(
            "{}/{}",
            self.xila_base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );

        self.calls.fetch_add(1, Ordering::SeqCst);

        let request = self
            .http_client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body);

        match request.send().await {
            Ok(resp) => {
                let payload: Value = resp.json().await.map_err(AppError::HttpError)?;

                // Handle 403 with force token refresh
                if let Some(code) = payload["code"].as_i64() {
                    if code == 403 && retry {
                        let _ = self.resolve_token(true).await;
                        tokio::time::sleep(Duration::from_millis(500)).await;
                        return Box::pin(self.post_inner(path, params, false)).await;
                    }
                    if code != 0 {
                        self.record_failure(path);
                    }
                }

                Ok(payload)
            }
            Err(e) => {
                self.record_failure(path);
                if retry {
                    let _ = self.resolve_token(true).await;
                    tokio::time::sleep(Duration::from_millis(800)).await;
                    return Box::pin(self.post_inner(path, params, false)).await;
                }
                Ok(serde_json::json!({"code": -1, "msg": e.to_string(), "data": {}}))
            }
        }
    }

    pub fn get_calls(&self) -> i32 {
        self.calls.load(Ordering::SeqCst)
    }

    pub fn get_failures(&self) -> HashMap<String, i32> {
        self.failures.lock().unwrap().clone()
    }

    fn record_failure(&self, path: &str) {
        let mut failures = self.failures.lock().unwrap();
        *failures.entry(path.to_string()).or_insert(0) += 1;
    }
}
