use crate::auth::jwt::{create_token, validate_token};
use crate::error::{AppError, Result};
use crate::models::auth::{AuthResponse, UserSession};
use crate::state::AppState;
use tauri::State;

/// Hardcoded credentials for desktop app authentication.
const VALID_USERNAME: &str = "admin";
const DEFAULT_PASSWORD: &str = "procuremap2024";

fn get_password() -> String {
    std::env::var("PROCUREMAP_PASSWORD").unwrap_or_else(|_| DEFAULT_PASSWORD.to_string())
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<AuthResponse> {
    let expected_password = get_password();

    if username != VALID_USERNAME || password != expected_password {
        return Err(AppError::AuthError("用户名或密码错误".to_string()));
    }

    let token = create_token(&username, &state.jwt_secret)?;

    let user = UserSession {
        user_id: "admin-001".to_string(),
        username,
        role: "admin".to_string(),
        authenticated: true,
    };

    Ok(AuthResponse { token, user })
}

#[tauri::command]
pub async fn logout(_state: State<'_, AppState>, token: String) -> Result<()> {
    // In a stateless JWT setup, logout is handled client-side by discarding the token.
    // The backend just validates the token format.
    if token.is_empty() {
        return Err(AppError::AuthError("Token 不能为空".to_string()));
    }
    Ok(())
}

#[tauri::command]
pub async fn validate_session(
    state: State<'_, AppState>,
    token: String,
) -> Result<UserSession> {
    let claims = validate_token(&token, &state.jwt_secret)?;

    Ok(UserSession {
        user_id: claims.sub.clone(),
        username: claims.sub,
        role: "admin".to_string(),
        authenticated: true,
    })
}
