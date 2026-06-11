use crate::error::{AppError, Result};

/// Resolve the internal service token.
/// Tries environment variable INSIGHT_INTERNAL_SERVICE_TOKEN first.
/// For the desktop app, SSH kubectl fallback is too complex,
/// so the user must provide the token via config or env var.
pub async fn resolve_internal_token(provided_token: Option<&str>) -> Result<String> {
    // If user provided a token in the config, use it
    if let Some(token) = provided_token {
        if !token.is_empty() {
            return Ok(token.to_string());
        }
    }

    // Try env var
    if let Ok(token) = std::env::var("INSIGHT_INTERNAL_SERVICE_TOKEN") {
        if !token.is_empty() {
            return Ok(token);
        }
    }

    // For desktop app, we don't attempt SSH kubectl
    // Return an error instructing the user
    Err(AppError::Internal(
        "未找到内部服务 Token。请设置环境变量 INSIGHT_INTERNAL_SERVICE_TOKEN 或在配置中提供 token。".to_string(),
    ))
}
