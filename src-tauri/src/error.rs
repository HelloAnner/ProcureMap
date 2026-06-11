use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("认证失败: {0}")]
    AuthError(String),

    #[error("配置错误: {0}")]
    ConfigError(String),

    #[error("数据库错误: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("HTTP 请求错误: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("API 错误 (code {code}): {message}")]
    ApiError { code: i32, message: String },

    #[error("Token 解析失败: {0}")]
    TokenError(String),

    #[error("任务未找到: {0}")]
    TaskNotFound(String),

    #[error("任务已在运行: {0}")]
    TaskAlreadyRunning(String),

    #[error("公司未找到: {0}")]
    CompanyNotFound(String),

    #[error("JSON 错误: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("地理位置解析失败: {0}")]
    GeoError(String),

    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),

    #[error("已取消")]
    Cancelled,

    #[error("{0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
