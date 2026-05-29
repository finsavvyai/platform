use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub vectorize: VectorizeConfig,
    pub embedding: EmbeddingConfig,
    pub cache: CacheConfig,
    pub monitoring: MonitoringConfig,
    pub search: SearchConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub request_timeout_ms: u64,
    pub max_request_size_mb: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connection_timeout_ms: u64,
    pub idle_timeout_ms: u64,
    pub max_lifetime_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorizeConfig {
    pub enabled: bool,
    pub api_token: String,
    pub account_id: String,
    pub default_dimensions: usize,
    pub distance_metric: String,
    pub index_type: String,
    pub sharding_config: ShardingConfig,
    pub fallback_to_pgvector: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShardingConfig {
    pub shards: u32,
    pub replicas: u32,
    pub routing_strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    pub default_provider: String,
    pub providers: std::collections::HashMap<String, ProviderConfig>,
    pub batch_size: usize,
    pub max_retries: u32,
    pub timeout_ms: u64,
    pub cache_ttl_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: String,
    pub model: String,
    pub dimensions: usize,
    pub max_tokens: usize,
    pub cost_per_1k_tokens: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub redis_url: String,
    pub max_connections: u32,
    pub default_ttl_seconds: u64,
    pub search_cache_ttl_seconds: u64,
    pub embedding_cache_ttl_seconds: u64,
    pub max_memory_mb: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub prometheus_port: u16,
    pub jaeger_endpoint: Option<String>,
    pub metrics_enabled: bool,
    pub tracing_enabled: bool,
    pub log_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    pub default_limit: usize,
    pub max_limit: usize,
    pub hybrid_weights: HybridWeights,
    pub reranking_enabled: bool,
    pub reranker_model: Option<String>,
    pub ab_testing_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridWeights {
    pub semantic: f32,
    pub keyword: f32,
    pub recency: f32,
    pub relevance: f32,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            server: ServerConfig {
                port: env::var("SERVER_PORT")
                    .unwrap_or_else(|_| "8080".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid SERVER_PORT"))?,
                host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                request_timeout_ms: env::var("REQUEST_TIMEOUT_MS")
                    .unwrap_or_else(|_| "30000".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid REQUEST_TIMEOUT_MS"))?,
                max_request_size_mb: env::var("MAX_REQUEST_SIZE_MB")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid MAX_REQUEST_SIZE_MB"))?,
            },
            database: DatabaseConfig {
                url: env::var("DATABASE_URL").map_err(|_| anyhow!("DATABASE_URL is required"))?,
                max_connections: env::var("DB_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "20".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid DB_MAX_CONNECTIONS"))?,
                min_connections: env::var("DB_MIN_CONNECTIONS")
                    .unwrap_or_else(|_| "5".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid DB_MIN_CONNECTIONS"))?,
                connection_timeout_ms: env::var("DB_CONNECTION_TIMEOUT_MS")
                    .unwrap_or_else(|_| "30000".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid DB_CONNECTION_TIMEOUT_MS"))?,
                idle_timeout_ms: env::var("DB_IDLE_TIMEOUT_MS")
                    .unwrap_or_else(|_| "600000".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid DB_IDLE_TIMEOUT_MS"))?,
                max_lifetime_ms: env::var("DB_MAX_LIFETIME_MS")
                    .unwrap_or_else(|_| "3600000".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid DB_MAX_LIFETIME_MS"))?,
            },
            vectorize: VectorizeConfig {
                enabled: env::var("VECTORIZE_ENABLED")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid VECTORIZE_ENABLED"))?,
                api_token: env::var("CLOUDFLARE_API_TOKEN").map_err(|_| {
                    anyhow!("CLOUDFLARE_API_TOKEN is required when Vectorize is enabled")
                })?,
                account_id: env::var("CLOUDFLARE_ACCOUNT_ID").map_err(|_| {
                    anyhow!("CLOUDFLARE_ACCOUNT_ID is required when Vectorize is enabled")
                })?,
                default_dimensions: env::var("VECTORIZE_DEFAULT_DIMENSIONS")
                    .unwrap_or_else(|_| "1536".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid VECTORIZE_DEFAULT_DIMENSIONS"))?,
                distance_metric: env::var("VECTORIZE_DISTANCE_METRIC")
                    .unwrap_or_else(|_| "cosine".to_string()),
                index_type: env::var("VECTORIZE_INDEX_TYPE").unwrap_or_else(|_| "hnsw".to_string()),
                sharding_config: ShardingConfig {
                    shards: env::var("VECTORIZE_SHARDS")
                        .unwrap_or_else(|_| "3".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid VECTORIZE_SHARDS"))?,
                    replicas: env::var("VECTORIZE_REPLICAS")
                        .unwrap_or_else(|_| "2".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid VECTORIZE_REPLICAS"))?,
                    routing_strategy: env::var("VECTORIZE_ROUTING_STRATEGY")
                        .unwrap_or_else(|_| "round_robin".to_string()),
                },
                fallback_to_pgvector: env::var("VECTORIZE_FALLBACK_TO_PGVECTOR")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid VECTORIZE_FALLBACK_TO_PGVECTOR"))?,
            },
            embedding: EmbeddingConfig {
                default_provider: env::var("EMBEDDING_DEFAULT_PROVIDER")
                    .unwrap_or_else(|_| "openai".to_string()),
                providers: Self::parse_providers()?,
                batch_size: env::var("EMBEDDING_BATCH_SIZE")
                    .unwrap_or_else(|_| "100".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid EMBEDDING_BATCH_SIZE"))?,
                max_retries: env::var("EMBEDDING_MAX_RETRIES")
                    .unwrap_or_else(|_| "3".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid EMBEDDING_MAX_RETRIES"))?,
                timeout_ms: env::var("EMBEDDING_TIMEOUT_MS")
                    .unwrap_or_else(|_| "30000".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid EMBEDDING_TIMEOUT_MS"))?,
                cache_ttl_seconds: env::var("EMBEDDING_CACHE_TTL_SECONDS")
                    .unwrap_or_else(|_| "86400".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid EMBEDDING_CACHE_TTL_SECONDS"))?,
            },
            cache: CacheConfig {
                redis_url: env::var("REDIS_URL").map_err(|_| anyhow!("REDIS_URL is required"))?,
                max_connections: env::var("REDIS_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid REDIS_MAX_CONNECTIONS"))?,
                default_ttl_seconds: env::var("CACHE_DEFAULT_TTL_SECONDS")
                    .unwrap_or_else(|_| "3600".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid CACHE_DEFAULT_TTL_SECONDS"))?,
                search_cache_ttl_seconds: env::var("CACHE_SEARCH_TTL_SECONDS")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid CACHE_SEARCH_TTL_SECONDS"))?,
                embedding_cache_ttl_seconds: env::var("CACHE_EMBEDDING_TTL_SECONDS")
                    .unwrap_or_else(|_| "86400".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid CACHE_EMBEDDING_TTL_SECONDS"))?,
                max_memory_mb: env::var("CACHE_MAX_MEMORY_MB")
                    .unwrap_or_else(|_| "1024".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid CACHE_MAX_MEMORY_MB"))?,
            },
            monitoring: MonitoringConfig {
                prometheus_port: env::var("PROMETHEUS_PORT")
                    .unwrap_or_else(|_| "9090".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid PROMETHEUS_PORT"))?,
                jaeger_endpoint: env::var("JAEGER_ENDPOINT").ok(),
                metrics_enabled: env::var("METRICS_ENABLED")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid METRICS_ENABLED"))?,
                tracing_enabled: env::var("TRACING_ENABLED")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid TRACING_ENABLED"))?,
                log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            },
            search: SearchConfig {
                default_limit: env::var("SEARCH_DEFAULT_LIMIT")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid SEARCH_DEFAULT_LIMIT"))?,
                max_limit: env::var("SEARCH_MAX_LIMIT")
                    .unwrap_or_else(|_| "100".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid SEARCH_MAX_LIMIT"))?,
                hybrid_weights: HybridWeights {
                    semantic: env::var("SEARCH_WEIGHT_SEMANTIC")
                        .unwrap_or_else(|_| "0.7".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid SEARCH_WEIGHT_SEMANTIC"))?,
                    keyword: env::var("SEARCH_WEIGHT_KEYWORD")
                        .unwrap_or_else(|_| "0.3".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid SEARCH_WEIGHT_KEYWORD"))?,
                    recency: env::var("SEARCH_WEIGHT_RECENCY")
                        .unwrap_or_else(|_| "0.1".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid SEARCH_WEIGHT_RECENCY"))?,
                    relevance: env::var("SEARCH_WEIGHT_RELEVANCE")
                        .unwrap_or_else(|_| "0.5".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid SEARCH_WEIGHT_RELEVANCE"))?,
                },
                reranking_enabled: env::var("SEARCH_RERANKING_ENABLED")
                    .unwrap_or_else(|_| "false".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid SEARCH_RERANKING_ENABLED"))?,
                reranker_model: env::var("SEARCH_RERANKER_MODEL").ok(),
                ab_testing_enabled: env::var("SEARCH_AB_TESTING_ENABLED")
                    .unwrap_or_else(|_| "false".to_string())
                    .parse()
                    .map_err(|_| anyhow!("Invalid SEARCH_AB_TESTING_ENABLED"))?,
            },
        })
    }

    fn parse_providers() -> Result<std::collections::HashMap<String, ProviderConfig>> {
        let mut providers = std::collections::HashMap::new();

        // OpenAI provider
        if let (Ok(api_key), Ok(model)) = (
            env::var("OPENAI_API_KEY"),
            env::var("OPENAI_EMBEDDING_MODEL")
                .or_else(|_| Ok("text-embedding-ada-002".to_string())),
        ) {
            providers.insert(
                "openai".to_string(),
                ProviderConfig {
                    api_key,
                    model,
                    dimensions: env::var("OPENAI_EMBEDDING_DIMENSIONS")
                        .unwrap_or_else(|_| "1536".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid OPENAI_EMBEDDING_DIMENSIONS"))?,
                    max_tokens: env::var("OPENAI_EMBEDDING_MAX_TOKENS")
                        .unwrap_or_else(|_| "8191".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid OPENAI_EMBEDDING_MAX_TOKENS"))?,
                    cost_per_1k_tokens: env::var("OPENAI_EMBEDDING_COST_PER_1K")
                        .unwrap_or_else(|_| "0.0001".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid OPENAI_EMBEDDING_COST_PER_1K"))?,
                },
            );
        }

        // Cohere provider
        if let (Ok(api_key), Ok(model)) = (
            env::var("COHERE_API_KEY"),
            env::var("COHERE_EMBEDDING_MODEL").or_else(|_| Ok("embed-english-v3.0".to_string())),
        ) {
            providers.insert(
                "cohere".to_string(),
                ProviderConfig {
                    api_key,
                    model,
                    dimensions: env::var("COHERE_EMBEDDING_DIMENSIONS")
                        .unwrap_or_else(|_| "1024".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid COHERE_EMBEDDING_DIMENSIONS"))?,
                    max_tokens: env::var("COHERE_EMBEDDING_MAX_TOKENS")
                        .unwrap_or_else(|_| "2048".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid COHERE_EMBEDDING_MAX_TOKENS"))?,
                    cost_per_1k_tokens: env::var("COHERE_EMBEDDING_COST_PER_1K")
                        .unwrap_or_else(|_| "0.0001".to_string())
                        .parse()
                        .map_err(|_| anyhow!("Invalid COHERE_EMBEDDING_COST_PER_1K"))?,
                },
            );
        }

        // Add more providers as needed...

        if providers.is_empty() {
            return Err(anyhow!(
                "At least one embedding provider must be configured"
            ));
        }

        Ok(providers)
    }
}
