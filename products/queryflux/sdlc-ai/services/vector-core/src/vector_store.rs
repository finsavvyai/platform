use crate::cache::CacheService;
use crate::config::{Config, VectorizeConfig};
use crate::error::{AppError, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

// Vector store abstraction supporting both Cloudflare Vectorize and pgvector
#[async_trait]
pub trait VectorStore: Send + Sync {
    async fn create_index(&self, request: CreateIndexRequest) -> Result<CreateIndexResponse>;
    async fn upsert_vectors(&self, request: UpsertRequest) -> Result<UpsertResponse>;
    async fn search_vectors(&self, request: SearchRequest) -> Result<SearchResponse>;
    async fn delete_vectors(&self, request: DeleteRequest) -> Result<DeleteResponse>;
    async fn get_index_stats(&self, index_id: &str) -> Result<IndexStats>;
    async fn list_indexes(&self, tenant_id: &str) -> Result<Vec<IndexInfo>>;
    async fn delete_index(&self, index_id: &str) -> Result<()>;
}

// Cloudflare Vectorize implementation
pub struct CloudflareVectorize {
    client: reqwest::Client,
    config: VectorizeConfig,
    cache: CacheService,
}

impl CloudflareVectorize {
    pub async fn new(config: VectorizeConfig, cache: CacheService) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(30000))
            .build()
            .map_err(|e| AppError::HttpClient(e))?;

        // Test connection
        Self::test_connection(&client, &config).await?;

        info!("Cloudflare Vectorize client initialized successfully");

        Ok(Self {
            client,
            config,
            cache,
        })
    }

    async fn test_connection(client: &reqwest::Client, config: &VectorizeConfig) -> Result<()> {
        let url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/vectorize_indexes",
            config.account_id
        );

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", config.api_token))
            .send()
            .await
            .map_err(|e| AppError::HttpClient(e))?;

        if response.status().is_success() {
            debug!("Cloudflare Vectorize connection test successful");
            Ok(())
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "Cloudflare Vectorize connection test failed: {} - {}",
                status, error_text
            );
            Err(AppError::VectorStore(format!(
                "Connection test failed: {} - {}",
                status, error_text
            )))
        }
    }

    async fn make_request<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        method: reqwest::Method,
        endpoint: &str,
        body: Option<T>,
    ) -> Result<R> {
        let url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/vectorize/{}",
            self.config.account_id, endpoint
        );

        let mut request = self
            .client
            .request(method, &url)
            .header("Authorization", format!("Bearer {}", self.config.api_token))
            .header("Content-Type", "application/json");

        if let Some(b) = body {
            request = request.json(&b);
        }

        let response = request.send().await.map_err(|e| AppError::HttpClient(e))?;

        if response.status().is_success() {
            let result: CloudflareResponse<R> =
                response.json().await.map_err(|e| AppError::HttpClient(e))?;

            if result.success {
                Ok(result.result)
            } else {
                Err(AppError::VectorStore(result.errors.join("; ")))
            }
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            Err(AppError::VectorStore(format!(
                "API request failed: {} - {}",
                status, error_text
            )))
        }
    }
}

#[async_trait]
impl VectorStore for CloudflareVectorize {
    async fn create_index(&self, request: CreateIndexRequest) -> Result<CreateIndexResponse> {
        let cf_request = CloudflareCreateIndexRequest {
            name: request.index_id.clone(),
            description: request.description,
            dimensions: request.dimensions as u32,
            distance_metric: request.distance_metric.clone(),
            index_type: self.config.index_type.clone(),
            shards: Some(self.config.sharding_config.shards),
            replicas: Some(self.config.sharding_config.replicas),
        };

        let response: CloudflareIndex = self
            .make_request(reqwest::Method::POST, "indexes", Some(cf_request))
            .await?;

        Ok(CreateIndexResponse {
            index_id: response.uuid,
            status: "ready".to_string(),
            dimensions: response.dimensions as usize,
            vector_count: 0,
        })
    }

    async fn upsert_vectors(&self, request: UpsertRequest) -> Result<UpsertResponse> {
        let cf_vectors: Vec<CloudflareVector> = request
            .vectors
            .into_iter()
            .map(|v| CloudflareVector {
                id: v.id,
                values: v.values,
                metadata: v.metadata,
            })
            .collect();

        let cf_request = CloudflareUpsertRequest {
            index: request.index_id,
            vectors: cf_vectors,
        };

        let response: CloudflareUpsertResponse = self
            .make_request(reqwest::Method::POST, "upsert", Some(cf_request))
            .await?;

        Ok(UpsertResponse {
            upserted_count: response.count,
            failed_count: 0,
        })
    }

    async fn search_vectors(&self, request: SearchRequest) -> Result<SearchResponse> {
        // Check cache first
        let cache_key = format!(
            "search:{}:{}",
            request.tenant_id,
            Self::hash_search_request(&request)
        );

        if let Some(cached) = self
            .cache
            .get_cached_search_results::<SearchResponse>(&cache_key)
            .await?
        {
            debug!("Cache hit for search request");
            return Ok(cached);
        }

        let cf_request = CloudflareSearchRequest {
            index: request.index_id,
            query: CloudflareVector {
                id: "".to_string(),
                values: request.query_vector,
                metadata: HashMap::new(),
            },
            top_k: Some(request.limit as u32),
            include_values: request.include_values,
            include_metadata: request.include_metadata,
            filter: request.filter.clone(),
        };

        let response: CloudflareSearchResponse = self
            .make_request(reqwest::Method::POST, "query", Some(cf_request))
            .await?;

        let results: Vec<SearchResult> = response
            .matches
            .into_iter()
            .map(|m| SearchResult {
                id: m.id,
                score: m.score,
                values: m.values,
                metadata: m.metadata,
            })
            .collect();

        let search_response = SearchResponse {
            results,
            total_count: results.len(),
            search_time_ms: 0, // Vectorize doesn't provide this
        };

        // Cache the results
        self.cache
            .cache_search_results(&cache_key, &search_response)
            .await?;

        Ok(search_response)
    }

    async fn delete_vectors(&self, request: DeleteRequest) -> Result<DeleteResponse> {
        let cf_request = CloudflareDeleteRequest {
            index: request.index_id,
            ids: request.vector_ids,
        };

        let response: CloudflareDeleteResponse = self
            .make_request(reqwest::Method::POST, "delete", Some(cf_request))
            .await?;

        Ok(DeleteResponse {
            deleted_count: response.count,
        })
    }

    async fn get_index_stats(&self, index_id: &str) -> Result<IndexStats> {
        let response: CloudflareIndex = self
            .make_request(
                reqwest::Method::GET,
                &format!("indexes/{}", index_id),
                Option::<()>::None,
            )
            .await?;

        Ok(IndexStats {
            index_id: index_id.to_string(),
            vector_count: response.vector_count as usize,
            dimensions: response.dimensions as usize,
            status: "ready".to_string(),
            memory_usage_mb: 0, // Vectorize doesn't provide this
        })
    }

    async fn list_indexes(&self, tenant_id: &str) -> Result<Vec<IndexInfo>> {
        let response: Vec<CloudflareIndex> = self
            .make_request(reqwest::Method::GET, "indexes", Option::<()>::None)
            .await?;

        let indexes: Vec<IndexInfo> = response
            .into_iter()
            .filter(|index| index.name.starts_with(&format!("{}_", tenant_id)))
            .map(|index| IndexInfo {
                index_id: index.uuid,
                name: index.name,
                description: index.description,
                dimensions: index.dimensions as usize,
                vector_count: index.vector_count as usize,
                created_at: index.created_on,
                updated_at: index.modified_on,
            })
            .collect();

        Ok(indexes)
    }

    async fn delete_index(&self, index_id: &str) -> Result<()> {
        let _: serde_json::Value = self
            .make_request(
                reqwest::Method::DELETE,
                &format!("indexes/{}", index_id),
                Option::<()>::None,
            )
            .await?;

        Ok(())
    }
}

// PostgreSQL pgvector implementation as fallback
pub struct PgVectorStore {
    pool: PgPool,
    cache: CacheService,
}

impl PgVectorStore {
    pub async fn new(database_url: &str, cache: CacheService) -> Result<Self> {
        let pool = PgPool::connect(database_url)
            .await
            .map_err(|e| AppError::Database(e))?;

        // Ensure pgvector extension is installed
        sqlx::query("CREATE EXTENSION IF NOT EXISTS vector")
            .execute(&pool)
            .await
            .map_err(|e| AppError::Database(e))?;

        info!("PostgreSQL pgvector store initialized successfully");

        Ok(Self { pool, cache })
    }

    async fn ensure_index_table(&self, index_id: &str, dimensions: usize) -> Result<()> {
        let table_name = format!("vectors_{}", index_id);

        // Create table if it doesn't exist
        let create_table_query = format!(
            r#"
            CREATE TABLE IF NOT EXISTS {} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vector_id VARCHAR(255) NOT NULL UNIQUE,
                embedding vector({}),
                metadata JSONB DEFAULT '{{}}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_{}_vector_cosine ON {}
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);

            CREATE INDEX IF NOT EXISTS idx_{}_vector_id ON {} (vector_id);
            "#,
            table_name, dimensions, table_name, table_name, table_name, table_name
        );

        sqlx::query(&create_table_query)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e))?;

        Ok(())
    }
}

#[async_trait]
impl VectorStore for PgVectorStore {
    async fn create_index(&self, request: CreateIndexRequest) -> Result<CreateIndexResponse> {
        self.ensure_index_table(&request.index_id, request.dimensions)
            .await?;

        // Store index metadata
        sqlx::query(
            r#"
            INSERT INTO vector_indexes (id, name, description, dimensions, distance_metric, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                updated_at = NOW()
            "#,
        )
        .bind(&request.index_id)
        .bind(&request.name)
        .bind(&request.description)
        .bind(request.dimensions as i32)
        .bind(&request.distance_metric)
        .bind(&request.tenant_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        Ok(CreateIndexResponse {
            index_id: request.index_id,
            status: "ready".to_string(),
            dimensions: request.dimensions,
            vector_count: 0,
        })
    }

    async fn upsert_vectors(&self, request: UpsertRequest) -> Result<UpsertResponse> {
        let table_name = format!("vectors_{}", request.index_id);
        let mut upserted_count = 0;
        let mut failed_count = 0;

        for vector in request.vectors {
            let result = sqlx::query(&format!(
                r#"
                    INSERT INTO {} (vector_id, embedding, metadata)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (vector_id) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                    "#,
                table_name
            ))
            .bind(&vector.id)
            .bind(&vector.values)
            .bind(serde_json::to_value(&vector.metadata).unwrap())
            .execute(&self.pool)
            .await;

            match result {
                Ok(_) => upserted_count += 1,
                Err(e) => {
                    error!("Failed to upsert vector {}: {}", vector.id, e);
                    failed_count += 1;
                }
            }
        }

        Ok(UpsertResponse {
            upserted_count,
            failed_count,
        })
    }

    async fn search_vectors(&self, request: SearchRequest) -> Result<SearchResponse> {
        // Check cache first
        let cache_key = format!(
            "search:{}:{}",
            request.tenant_id,
            Self::hash_search_request(&request)
        );

        if let Some(cached) = self
            .cache
            .get_cached_search_results::<SearchResponse>(&cache_key)
            .await?
        {
            debug!("Cache hit for pgvector search request");
            return Ok(cached);
        }

        let table_name = format!("vectors_{}", request.index_id);
        let start_time = std::time::Instant::now();

        let mut query = format!(
            r#"
            SELECT
                vector_id,
                1 - (embedding <=> $1) as similarity,
                CASE WHEN $2 THEN embedding END as embedding,
                CASE WHEN $3 THEN metadata END as metadata
            FROM {}
            WHERE 1 - (embedding <=> $1) >= $4
            "#,
            table_name
        );

        // Add filter if provided
        if let Some(filter) = &request.filter {
            for (key, value) in filter {
                query.push_str(&format!(" AND metadata->>'{}' = '${}' ", key, value));
            }
        }

        query.push_str(&format!(" ORDER BY similarity DESC LIMIT $5"));

        let similarity_threshold = request
            .filter
            .get("similarity_threshold")
            .and_then(|v| v.parse::<f32>().ok())
            .unwrap_or(0.0);

        let rows = sqlx::query(&query)
            .bind(&request.query_vector)
            .bind(request.include_values)
            .bind(request.include_metadata)
            .bind(similarity_threshold)
            .bind(request.limit as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| AppError::Database(e))?;

        let results: Vec<SearchResult> = rows
            .into_iter()
            .map(|row| SearchResult {
                id: row.get("vector_id"),
                score: row.get::<f64, _>("similarity") as f32,
                values: if request.include_values {
                    Some(row.get("embedding"))
                } else {
                    None
                },
                metadata: if request.include_metadata {
                    row.get::<serde_json::Value, _>("metadata")
                        .as_object()
                        .cloned()
                        .unwrap_or_default()
                        .into_iter()
                        .collect()
                } else {
                    HashMap::new()
                },
            })
            .collect();

        let search_time_ms = start_time.elapsed().as_millis() as u64;
        let search_response = SearchResponse {
            results,
            total_count: results.len(),
            search_time_ms,
        };

        // Cache the results
        self.cache
            .cache_search_results(&cache_key, &search_response)
            .await?;

        Ok(search_response)
    }

    async fn delete_vectors(&self, request: DeleteRequest) -> Result<DeleteResponse> {
        let table_name = format!("vectors_{}", request.index_id);

        let result = sqlx::query(&format!(
            "DELETE FROM {} WHERE vector_id = ANY($1)",
            table_name
        ))
        .bind(&request.vector_ids)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        Ok(DeleteResponse {
            deleted_count: result.rows_affected() as usize,
        })
    }

    async fn get_index_stats(&self, index_id: &str) -> Result<IndexStats> {
        let table_name = format!("vectors_{}", index_id);

        let row = sqlx::query(&format!(
            r#"
                SELECT
                    COUNT(*) as vector_count,
                    (SELECT dimensions FROM vector_indexes WHERE id = $1) as dimensions
                FROM {}
                "#,
            table_name
        ))
        .bind(index_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        Ok(IndexStats {
            index_id: index_id.to_string(),
            vector_count: row.get::<i64, _>("vector_count") as usize,
            dimensions: row.get::<i32, _>("dimensions") as usize,
            status: "ready".to_string(),
            memory_usage_mb: 0,
        })
    }

    async fn list_indexes(&self, tenant_id: &str) -> Result<Vec<IndexInfo>> {
        let rows = sqlx::query(
            r#"
            SELECT
                id, name, description, dimensions, created_at, updated_at,
                (SELECT COUNT(*) FROM vectors_$1) as vector_count
            FROM vector_indexes
            WHERE tenant_id = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(format!("id"))
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        let indexes: Vec<IndexInfo> = rows
            .into_iter()
            .map(|row| IndexInfo {
                index_id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                dimensions: row.get::<i32, _>("dimensions") as usize,
                vector_count: row.get::<i64, _>("vector_count") as usize,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        Ok(indexes)
    }

    async fn delete_index(&self, index_id: &str) -> Result<()> {
        let table_name = format!("vectors_{}", index_id);

        // Drop the table
        sqlx::query(&format!("DROP TABLE IF EXISTS {}", table_name))
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e))?;

        // Remove from index registry
        sqlx::query("DELETE FROM vector_indexes WHERE id = $1")
            .bind(index_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e))?;

        Ok(())
    }
}

// Hybrid vector store that tries Vectorize first, falls back to pgvector
pub struct HybridVectorStore {
    vectorize: Option<CloudflareVectorize>,
    pgvector: PgVectorStore,
    config: VectorizeConfig,
}

impl HybridVectorStore {
    pub async fn new(config: &Config, cache: CacheService) -> Result<Self> {
        let pgvector = PgVectorStore::new(&config.database.url, cache.clone()).await?;

        let vectorize = if config.vectorize.enabled {
            match CloudflareVectorize::new(config.vectorize.clone(), cache.clone()).await {
                Ok(v) => {
                    info!("Cloudflare Vectorize initialized successfully");
                    Some(v)
                }
                Err(e) => {
                    warn!(
                        "Failed to initialize Cloudflare Vectorize, using pgvector fallback: {}",
                        e
                    );
                    None
                }
            }
        } else {
            info!("Cloudflare Vectorize disabled, using pgvector only");
            None
        };

        Ok(Self {
            vectorize,
            pgvector,
            config: config.vectorize.clone(),
        })
    }

    fn get_store(&self) -> &dyn VectorStore {
        match &self.vectorize {
            Some(vectorize) => vectorize,
            None => &self.pgvector,
        }
    }
}

#[async_trait]
impl VectorStore for HybridVectorStore {
    async fn create_index(&self, request: CreateIndexRequest) -> Result<CreateIndexResponse> {
        let store = if self.vectorize.is_some() {
            self.get_store()
        } else {
            &self.pgvector
        };

        store.create_index(request).await
    }

    async fn upsert_vectors(&self, request: UpsertRequest) -> Result<UpsertResponse> {
        let store = self.get_store();

        // Try primary store first
        match store.upsert_vectors(request.clone()).await {
            Ok(response) => Ok(response),
            Err(e) => {
                // If it's the vectorize store and we have fallback enabled, try pgvector
                if self.vectorize.is_some() && self.config.fallback_to_pgvector {
                    warn!("Vectorize upsert failed, falling back to pgvector: {}", e);
                    self.pgvector.upsert_vectors(request).await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn search_vectors(&self, request: SearchRequest) -> Result<SearchResponse> {
        let store = self.get_store();

        // Try primary store first
        match store.search_vectors(request.clone()).await {
            Ok(response) => Ok(response),
            Err(e) => {
                // If it's the vectorize store and we have fallback enabled, try pgvector
                if self.vectorize.is_some() && self.config.fallback_to_pgvector {
                    warn!("Vectorize search failed, falling back to pgvector: {}", e);
                    self.pgvector.search_vectors(request).await
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn delete_vectors(&self, request: DeleteRequest) -> Result<DeleteResponse> {
        let store = self.get_store();
        store.delete_vectors(request).await
    }

    async fn get_index_stats(&self, index_id: &str) -> Result<IndexStats> {
        let store = self.get_store();
        store.get_index_stats(index_id).await
    }

    async fn list_indexes(&self, tenant_id: &str) -> Result<Vec<IndexInfo>> {
        let store = self.get_store();
        store.list_indexes(tenant_id).await
    }

    async fn delete_index(&self, index_id: &str) -> Result<()> {
        let store = self.get_store();
        store.delete_index(index_id).await
    }
}

// Data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIndexRequest {
    pub index_id: String,
    pub name: String,
    pub description: Option<String>,
    pub dimensions: usize,
    pub distance_metric: String,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIndexResponse {
    pub index_id: String,
    pub status: String,
    pub dimensions: usize,
    pub vector_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertRequest {
    pub index_id: String,
    pub vectors: Vector<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertResponse {
    pub upserted_count: usize,
    pub failed_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub index_id: String,
    pub query_vector: Vec<f32>,
    pub limit: usize,
    pub include_values: bool,
    pub include_metadata: bool,
    pub filter: HashMap<String, String>,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub values: Option<Vec<f32>>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total_count: usize,
    pub search_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteRequest {
    pub index_id: String,
    pub vector_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResponse {
    pub deleted_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    pub index_id: String,
    pub vector_count: usize,
    pub dimensions: usize,
    pub status: String,
    pub memory_usage_mb: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub index_id: String,
    pub name: String,
    pub description: Option<String>,
    pub dimensions: usize,
    pub vector_count: usize,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// Cloudflare API structures
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareResponse<T> {
    success: bool,
    result: T,
    errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareCreateIndexRequest {
    name: String,
    description: Option<String>,
    dimensions: u32,
    distance_metric: String,
    index_type: String,
    shards: Option<u32>,
    replicas: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareIndex {
    uuid: String,
    name: String,
    description: Option<String>,
    dimensions: u32,
    distance_metric: String,
    index_type: String,
    vector_count: u32,
    created_on: chrono::DateTime<chrono::Utc>,
    modified_on: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareVector {
    id: String,
    values: Vec<f32>,
    metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareUpsertRequest {
    index: String,
    vectors: Vec<CloudflareVector>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareUpsertResponse {
    count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareSearchRequest {
    index: String,
    query: CloudflareVector,
    top_k: Option<u32>,
    include_values: bool,
    include_metadata: bool,
    filter: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareSearchResponse {
    matches: Vec<CloudflareSearchResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareSearchResult {
    id: String,
    score: f32,
    values: Vec<f32>,
    metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareDeleteRequest {
    index: String,
    ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloudflareDeleteResponse {
    count: u32,
}

// Helper methods
impl CloudflareVectorize {
    fn hash_search_request(request: &SearchRequest) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        request.index_id.hash(&mut hasher);
        request.limit.hash(&mut hasher);
        request.include_values.hash(&mut hasher);
        request.include_metadata.hash(&mut hasher);
        // Hash the query vector
        for v in &request.query_vector {
            v.to_bits().hash(&mut hasher);
        }
        format!("{:x}", hasher.finish())
    }
}

impl PgVectorStore {
    fn hash_search_request(request: &SearchRequest) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        request.index_id.hash(&mut hasher);
        request.limit.hash(&mut hasher);
        request.include_values.hash(&mut hasher);
        request.include_metadata.hash(&mut hasher);
        // Hash the query vector
        for v in &request.query_vector {
            v.to_bits().hash(&mut hasher);
        }
        format!("{:x}", hasher.finish())
    }
}

// Create the vector store index table
pub async fn create_vector_store_tables(pool: &PgPool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS vector_indexes (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            dimensions INTEGER NOT NULL,
            distance_metric VARCHAR(50) NOT NULL DEFAULT 'cosine',
            tenant_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_vector_indexes_tenant_id ON vector_indexes (tenant_id);
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(())
}
