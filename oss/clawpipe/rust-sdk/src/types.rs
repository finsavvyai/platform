//! Shared types for the ClawPipe Rust SDK.

use serde::{Deserialize, Serialize};

/// Configuration for the ClawPipe client.
#[derive(Debug, Clone)]
pub struct ClawPipeConfig {
    pub api_key: String,
    pub project_id: String,
    pub gateway_url: Option<String>,
    pub cache_ttl_ms: Option<u64>,
    pub enable_booster: Option<bool>,
    pub enable_packer: Option<bool>,
    pub enable_cache: Option<bool>,
    pub budget_cap_usd: Option<f64>,
}

/// Options for a single prompt call.
#[derive(Debug, Clone, Default, Serialize)]
pub struct PromptOptions {
    pub system: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f64>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub task_type: Option<String>,
}

/// Metadata about how the pipeline processed a request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineMeta {
    pub boosted: bool,
    pub cached: bool,
    pub packed: bool,
    pub context_savings: String,
    pub route: String,
    pub model: String,
    pub latency_ms: u64,
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub estimated_cost_usd: f64,
}

/// Result of a pipeline prompt call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineResult {
    pub text: String,
    pub meta: PipelineMeta,
}

/// Response from the ClawPipe gateway API.
#[derive(Debug, Clone, Deserialize)]
pub struct GatewayResponse {
    pub text: String,
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub latency_ms: u64,
}

/// Routing decision from the smart router.
#[derive(Debug, Clone)]
pub struct RouteDecision {
    pub provider: String,
    pub model: String,
    pub score: f64,
    pub reason: String,
}

/// Telemetry snapshot for reporting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub total_requests: u64,
    pub total_tokens_in: u64,
    pub total_tokens_out: u64,
    pub total_cost_usd: f64,
    pub total_saved_by_cache: u64,
    pub total_saved_by_booster: u64,
    pub avg_latency_ms: u64,
    pub cache_hit_rate: String,
}

/// Errors that can occur in the ClawPipe pipeline.
#[derive(Debug)]
pub enum ClawPipeError {
    BoosterFailed(String),
    GatewayError { status: u16, body: String },
    HttpError(reqwest::Error),
    BudgetExceeded,
    ModelNotPermitted(String),
}

impl std::fmt::Display for ClawPipeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BoosterFailed(msg) => write!(f, "Booster error: {msg}"),
            Self::GatewayError { status, body } => {
                write!(f, "Gateway error {status}: {body}")
            }
            Self::HttpError(e) => write!(f, "HTTP error: {e}"),
            Self::BudgetExceeded => write!(f, "Budget cap exceeded"),
            Self::ModelNotPermitted(m) => write!(f, "Model not permitted: {m}"),
        }
    }
}

impl std::error::Error for ClawPipeError {}

impl From<reqwest::Error> for ClawPipeError {
    fn from(e: reqwest::Error) -> Self {
        Self::HttpError(e)
    }
}

impl PipelineMeta {
    pub fn default_meta() -> Self {
        Self {
            boosted: false,
            cached: false,
            packed: false,
            context_savings: "0%".to_string(),
            route: String::new(),
            model: String::new(),
            latency_ms: 0,
            tokens_in: 0,
            tokens_out: 0,
            estimated_cost_usd: 0.0,
        }
    }
}
