use anyhow::Result;
use axum::{Router, routing::get, routing::post, Extension};
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, Level};
use tracing_subscriber;

mod config;
mod vector_store;
mod search;
mod embeddings;
mod monitoring;
mod cache;
mod error;

use config::Config;
use vector_store::VectorStore;
use search::SearchService;
use embeddings::EmbeddingService;
use monitoring::MetricsService;
use cache::CacheService;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub vector_store: VectorStore,
    pub search_service: SearchService,
    pub embedding_service: EmbeddingService,
    pub metrics_service: MetricsService,
    pub cache_service: CacheService,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .with_target(false)
        .init();

    info!("Starting Vector Core Service v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    let config = Config::from_env()?;
    info!("Configuration loaded successfully");

    // Initialize services
    let vector_store = VectorStore::new(&config).await?;
    let cache_service = CacheService::new(&config).await?;
    let metrics_service = MetricsService::new();
    let embedding_service = EmbeddingService::new(&config, cache_service.clone()).await?;
    let search_service = SearchService::new(
        vector_store.clone(),
        embedding_service.clone(),
        cache_service.clone(),
        metrics_service.clone(),
    ).await?;

    let app_state = AppState {
        config: config.clone(),
        vector_store,
        search_service,
        embedding_service,
        metrics_service,
        cache_service,
    };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics))
        .route("/search", post(search))
        .route("/embed", post(embed))
        .route("/index", post(create_index))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
        )
        .layer(Extension(app_state));

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));
    info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn metrics(Extension(state): Extension<AppState>) -> String {
    state.metrics_service.export().await
}

async fn search(
    axum::extract::Json(payload): axum::extract::Json<search::SearchRequest>,
    Extension(state): Extension<AppState>,
) -> Result<axum::extract::Json<search::SearchResponse>, error::AppError> {
    let response = state.search_service.search(payload).await?;
    Ok(axum::extract::Json(response))
}

async fn embed(
    axum::extract::Json(payload): axum::extract::Json<embeddings::EmbeddingRequest>,
    Extension(state): Extension<AppState>,
) -> Result<axum::extract::Json<embeddings::EmbeddingResponse>, error::AppError> {
    let response = state.embedding_service.generate_embeddings(payload).await?;
    Ok(axum::extract::Json(response))
}

async fn create_index(
    axum::extract::Json(payload): axum::extract::Json<vector_store::CreateIndexRequest>,
    Extension(state): Extension<AppState>,
) -> Result<axum::extract::Json<vector_store::CreateIndexResponse>, error::AppError> {
    let response = state.vector_store.create_index(payload).await?;
    Ok(axum::extract::Json(response))
}
