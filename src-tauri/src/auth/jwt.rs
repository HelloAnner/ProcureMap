use crate::error::{AppError, Result};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

/// Create a JWT token for the given user ID.
pub fn create_token(user_id: &str, secret: &str) -> Result<String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .as_secs() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp: now + 86400 * 7, // 7 days
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::TokenError(e.to_string()))
}

/// Decode and validate a JWT token.
pub fn validate_token(token: &str, secret: &str) -> Result<Claims> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| AppError::TokenError(format!("Token 无效或已过期: {}", e)))?;

    Ok(token_data.claims)
}
