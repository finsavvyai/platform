use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("HTTP client error: {0}")]
    HttpClient(#[from] reqwest::Error),

    #[error("Vector store error: {0}")]
    VectorStore(String),

    #[error("Cache error: {0}")]
    Cache(String),

    #[error("Embedding generation error: {0}")]
    EmbeddingGeneration(String),

    #[error("Search error: {0}")]
    Search(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Insufficient quota")]
    InsufficientQuota,

    #[error("Index not found")]
    IndexNotFound,

    #[error("Document not found")]
    DocumentNotFound,

    #[error("Provider not available")]
    ProviderNotAvailable,

    #[error("Authentication failed")]
    AuthenticationFailed,

    #[error("Authorization failed")]
    AuthorizationFailed,

    #[error("Service temporarily unavailable")]
    ServiceUnavailable,

    #[error("Internal server error: {0}")]
    Internal(String),
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Database(ref e) => {
                tracing::error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal database error")
            }
            AppError::Redis(ref e) => {
                tracing::error!("Redis error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Cache service unavailable",
                )
            }
            AppError::VectorStore(ref msg) => {
                tracing::error!("Vector store error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Vector store error")
            }
            AppError::Cache(ref msg) => {
                tracing::error!("Cache error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Cache error")
            }
            AppError::EmbeddingGeneration(ref msg) => {
                tracing::error!("Embedding generation error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Embedding generation failed",
                )
            }
            AppError::Search(ref msg) => {
                tracing::error!("Search error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Search service error")
            }
            AppError::Validation(ref msg) => {
                tracing::warn!("Validation error: {}", msg);
                (StatusCode::BAD_REQUEST, msg.as_str())
            }
            AppError::RateLimitExceeded => (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded"),
            AppError::InsufficientQuota => (StatusCode::PAYMENT_REQUIRED, "Insufficient quota"),
            AppError::IndexNotFound => (StatusCode::NOT_FOUND, "Index not found"),
            AppError::DocumentNotFound => (StatusCode::NOT_FOUND, "Document not found"),
            AppError::ProviderNotAvailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Embedding provider not available",
            ),
            AppError::AuthenticationFailed => (StatusCode::UNAUTHORIZED, "Authentication failed"),
            AppError::AuthorizationFailed => (StatusCode::FORBIDDEN, "Authorization failed"),
            AppError::ServiceUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Service temporarily unavailable",
            ),
            AppError::Configuration(ref msg) => {
                tracing::error!("Configuration error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Configuration error")
            }
            AppError::HttpClient(ref e) => {
                tracing::error!("HTTP client error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "External service error")
            }
            AppError::Serialization(ref e) => {
                tracing::error!("Serialization error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Data serialization error",
                )
            }
            AppError::Internal(ref msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
        };

        let body = Json(json!({
            "error": {
                "code": status.as_u16(),
                "message": error_message,
                "details": self.to_string()
            }
        }));

        (status, body).into_response()
    }
}

// Result type alias for convenience
pub type Result<T> = std::result::Result<T, AppError>;

// Error conversion traits
impl From<String> for AppError {
    fn from(msg: String) -> Self {
        AppError::Internal(msg)
    }
}

impl From<&str> for AppError {
    fn from(msg: &str) -> Self {
        AppError::Internal(msg.to_string())
    }
}

// HTTP error response builder
pub struct ErrorResponse {
    status: StatusCode,
    message: String,
    details: Option<String>,
}

impl ErrorResponse {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }

    pub fn build(self) -> AppError {
        match self.status {
            StatusCode::BAD_REQUEST => AppError::Validation(self.message),
            StatusCode::TOO_MANY_REQUESTS => AppError::RateLimitExceeded,
            StatusCode::PAYMENT_REQUIRED => AppError::InsufficientQuota,
            StatusCode::NOT_FOUND => {
                if self.message.contains("index") {
                    AppError::IndexNotFound
                } else {
                    AppError::DocumentNotFound
                }
            }
            StatusCode::UNAUTHORIZED => AppError::AuthenticationFailed,
            StatusCode::FORBIDDEN => AppError::AuthorizationFailed,
            StatusCode::SERVICE_UNAVAILABLE => AppError::ServiceUnavailable,
            _ => AppError::Internal(self.details.unwrap_or(self.message)),
        }
    }
}

// Helper functions for common error cases
pub fn validation_error(message: impl Into<String>) -> AppError {
    AppError::Validation(message.into())
}

pub fn database_error(message: impl Into<String>) -> AppError {
    AppError::VectorStore(message.into())
}

pub fn embedding_error(message: impl Into<String>) -> AppError {
    AppError::EmbeddingGeneration(message.into())
}

pub fn search_error(message: impl Into<String>) -> AppError {
    AppError::Search(message.into())
}

pub fn config_error(message: impl Into<String>) -> AppError {
    AppError::Configuration(message.into())
}

pub fn internal_error(message: impl Into<String>) -> AppError {
    AppError::Internal(message.into())
}
