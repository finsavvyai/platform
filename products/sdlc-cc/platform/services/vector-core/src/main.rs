use anyhow::Result;
use axum::{Router, routing::get, routing::post, Extension};
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, Level};

mod config;
mod vector_store;
mod search;
mod embeddings;
mod monitoring;
mod cache;
mod error;
mod simd_kernels;

use config::Config;
use vector_store::{VectorStore, PgVectorStore};
use search::SearchService;
use embeddings::EmbeddingService;
use monitoring::MetricsService;
use cache::CacheService;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub vector_store: Arc<dyn VectorStore>,
    pub search_service: Arc<SearchService>,
    pub embedding_service: Arc<EmbeddingService>,
    pub metrics_service: MetricsService,
    pub cache_service: CacheService,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .with_target(false)
        .init();

    info!("Starting Vector Core Service v{}", env!("CARGO_PKG_VERSION"));

    let config = Config::from_env()?;
    info!("Configuration loaded successfully");

    let cache_service = CacheService::new(&config.cache).await?;
    let metrics_service = MetricsService::new();

    let pg_store = PgVectorStore::new(&config.database.url, cache_service.clone()).await?;
    let vector_store: Arc<dyn VectorStore> = Arc::new(pg_store);

    let embedding_service = Arc::new(
        EmbeddingService::new(&config, cache_service.clone()).await?,
    );

    let search_service = Arc::new(
        SearchService::new(
            vector_store.clone(),
            embedding_service.clone(),
            cache_service.clone(),
            metrics_service.clone(),
        )
        .await?,
    );

    let app_state = AppState {
        config: config.clone(),
        vector_store,
        search_service,
        embedding_service,
        metrics_service,
        cache_service,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics))
        .route("/search", post(search))
        .route("/embed", post(embed))
        .route("/index", post(create_index))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive()),
        )
        .layer(Extension(app_state));

    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));
    info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Vector Core Service shutdown complete");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => { info!("Ctrl+C received, starting graceful shutdown"); },
        _ = terminate => { info!("SIGTERM received, starting graceful shutdown"); },
    }
}

async fn health_check() -> &'static str {
    "OK"
}

async fn metrics(Extension(state): Extension<AppState>) -> String {
    state.metrics_service.export().await
}

#[axum::debug_handler]
async fn search(
    Extension(state): Extension<AppState>,
    axum::extract::Json(payload): axum::extract::Json<search::SearchRequest>,
) -> std::result::Result<axum::extract::Json<search::SearchResponse>, error::AppError> {
    let response = state.search_service.search(payload).await?;
    Ok(axum::extract::Json(response))
}

#[axum::debug_handler]
async fn embed(
    Extension(state): Extension<AppState>,
    axum::extract::Json(payload): axum::extract::Json<embeddings::EmbeddingRequest>,
) -> std::result::Result<axum::extract::Json<embeddings::EmbeddingResponse>, error::AppError> {
    let response = state.embedding_service.generate_embeddings(payload).await?;
    Ok(axum::extract::Json(response))
}

#[axum::debug_handler]
async fn create_index(
    Extension(state): Extension<AppState>,
    axum::extract::Json(payload): axum::extract::Json<vector_store::CreateIndexRequest>,
) -> std::result::Result<axum::extract::Json<vector_store::CreateIndexResponse>, error::AppError> {
    let response = state.vector_store.create_index(payload).await?;
    Ok(axum::extract::Json(response))
}
