use anyhow::{Context, Result};
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::models::search::{SearchRequest, SearchResponse, SearchResult};
use crate::models::vector::{VectorIndexConfig, VectorIndexType};
use crate::vectorize::client::{VectorSearchQuery, VectorizeClient};

/// Vector index manager for handling multiple indexes and tenant isolation
#[derive(Debug)]
pub struct VectorIndexManager {
    client: Arc<VectorizeClient>,
    indexes: Arc<DashMap<String, Arc<VectorIndex>>>,
    tenant_isolation: bool,
    cache_ttl: Duration,
}

impl VectorIndexManager {
    /// Create a new vector index manager
    pub fn new(client: VectorizeClient, tenant_isolation: bool) -> Self {
        Self {
            client: Arc::new(client),
            indexes: Arc::new(DashMap::new()),
            tenant_isolation,
            cache_ttl: Duration::from_secs(300), // 5 minutes cache TTL
        }
    }

    /// Initialize the manager and create default indexes
    pub async fn initialize(&self) -> Result<()> {
        info!("Initializing Vector Index Manager");

        // Refresh client indexes
        let mut client = (*self.client).clone();
        client
            .refresh_indexes()
            .await
            .context("Failed to refresh Vectorize client indexes")?;

        // Create default indexes if they don't exist
        self.create_default_indexes().await?;

        info!("Vector Index Manager initialized successfully");
        Ok(())
    }

    /// Create default indexes for different use cases
    async fn create_default_indexes(&self) -> Result<()> {
        let default_indexes = vec![
            VectorIndexConfig {
                name: "documents_semantic".to_string(),
                dimensions: 384,
                metric: "cosine".to_string(),
                description: Some("Semantic search for documents".to_string()),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            VectorIndexConfig {
                name: "code_embeddings".to_string(),
                dimensions: 768,
                metric: "cosine".to_string(),
                description: Some("Code embeddings for semantic code search".to_string()),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            VectorIndexConfig {
                name: "user_queries".to_string(),
                dimensions: 384,
                metric: "euclidean".to_string(),
                description: Some("User query embeddings for query similarity".to_string()),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        ];

        for config in default_indexes {
            if !self.client.has_index(&config.name) {
                info!("Creating default index: {}", config.name);
                match self.client.create_index(&config).await {
                    Ok(created_config) => {
                        let index = VectorIndex::new(created_config, self.client.clone());
                        self.indexes.insert(config.name.clone(), Arc::new(index));
                    }
                    Err(e) => {
                        warn!("Failed to create index {}: {}", config.name, e);
                    }
                }
            } else {
                info!("Index already exists: {}", config.name);
                if let Some(existing_config) = self.client.get_index_config(&config.name) {
                    let index = VectorIndex::new(existing_config.clone(), self.client.clone());
                    self.indexes.insert(config.name.clone(), Arc::new(index));
                }
            }
        }

        Ok(())
    }

    /// Get or create a tenant-specific index
    pub async fn get_tenant_index(
        &self,
        tenant_id: &str,
        index_type: VectorIndexType,
    ) -> Result<Arc<VectorIndex>> {
        let index_name = if self.tenant_isolation {
            format!("tenant_{}_{}", tenant_id, index_type.to_string())
        } else {
            index_type.to_string()
        };

        // Check cache first
        if let Some(index) = self.indexes.get(&index_name) {
            return Ok(index.clone());
        }

        // Create new index if it doesn't exist
        if !self.client.has_index(&index_name) {
            let config = VectorIndexConfig {
                name: index_name.clone(),
                dimensions: index_type.default_dimensions(),
                metric: "cosine".to_string(),
                description: Some(format!(
                    "{} index for tenant {}",
                    index_type.to_string(),
                    tenant_id
                )),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            };

            info!("Creating tenant index: {}", index_name);
            let created_config = self.client.create_index(&config).await?;
            let index = VectorIndex::new(created_config, self.client.clone());
            self.indexes.insert(index_name.clone(), Arc::new(index));
        } else {
            // Load existing index
            if let Some(existing_config) = self.client.get_index_config(&index_name) {
                let index = VectorIndex::new(existing_config.clone(), self.client.clone());
                self.indexes.insert(index_name.clone(), Arc::new(index));
            }
        }

        Ok(self.indexes.get(&index_name).unwrap().clone())
    }

    /// Get an index by name
    pub fn get_index(&self, index_name: &str) -> Option<Arc<VectorIndex>> {
        self.indexes.get(index_name).map(|index| index.clone())
    }

    /// Search across multiple indexes
    pub async fn multi_index_search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        let mut all_results = Vec::new();
        let indexes_to_search = request.indexes.clone();

        for index_name in indexes_to_search {
            if let Some(index) = self.get_index(&index_name) {
                let mut search_request = request.clone();
                search_request.indexes = vec![index_name.clone()];

                match index.search(&search_request).await {
                    Ok(mut response) => {
                        // Add index name to results for tracking
                        for result in &mut response.results {
                            result.index_name = Some(index_name.clone());
                        }
                        all_results.extend(response.results);
                    }
                    Err(e) => {
                        warn!("Failed to search index {}: {}", index_name, e);
                    }
                }
            }
        }

        // Sort and rank results
        all_results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        all_results.truncate(request.top_k as usize);

        Ok(SearchResponse {
            query: request.query.clone(),
            results: all_results,
            total_found: all_results.len() as u32,
            search_time: std::time::Duration::from_millis(0), // TODO: track timing
            metadata: serde_json::json!({
                "indexes_searched": request.indexes,
                "multi_index_search": true
            }),
        })
    }

    /// List all managed indexes
    pub fn list_indexes(&self) -> Vec<String> {
        self.indexes
            .iter()
            .map(|entry| entry.key().clone())
            .collect()
    }

    /// Get index statistics
    pub async fn get_index_stats(
        &self,
        index_name: &str,
    ) -> Result<crate::vectorize::client::IndexStats> {
        if let Some(index) = self.get_index(index_name) {
            index.get_stats().await
        } else {
            Err(anyhow::anyhow!("Index not found: {}", index_name))
        }
    }

    /// Cleanup unused indexes
    pub async fn cleanup_unused_indexes(&self) -> Result<Vec<String>> {
        let mut cleaned = Vec::new();
        let client_indexes = self.client.list_indexes().await?;

        for client_index in client_indexes {
            if !self.indexes.contains_key(&client_index.name) {
                // Don't delete default indexes
                if !client_index.name.starts_with("tenant_")
                    && !["documents_semantic", "code_embeddings", "user_queries"]
                        .contains(&client_index.name.as_str())
                {
                    info!("Cleaning up unused index: {}", client_index.name);
                    if let Err(e) = self.client.delete_index(&client_index.name).await {
                        warn!("Failed to delete index {}: {}", client_index.name, e);
                    } else {
                        cleaned.push(client_index.name);
                    }
                }
            }
        }

        Ok(cleaned)
    }

    /// Refresh all indexes
    pub async fn refresh_all_indexes(&self) -> Result<()> {
        info!("Refreshing all vector indexes");

        // Clear cache
        self.indexes.clear();

        // Reinitialize
        self.initialize().await
    }
}

/// Individual vector index wrapper
#[derive(Debug)]
pub struct VectorIndex {
    config: VectorIndexConfig,
    client: Arc<VectorizeClient>,
    last_accessed: Arc<RwLock<Instant>>,
    search_count: Arc<RwLock<u64>>,
}

impl VectorIndex {
    /// Create a new vector index
    pub fn new(config: VectorIndexConfig, client: Arc<VectorizeClient>) -> Self {
        Self {
            config,
            client,
            last_accessed: Arc::new(RwLock::new(Instant::now())),
            search_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Search the index
    pub async fn search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        // Update access tracking
        *self.last_accessed.write().await = Instant::now();
        *self.search_count.write().await += 1;

        let query = VectorSearchQuery {
            vector: request
                .query_vector
                .clone()
                .ok_or_else(|| anyhow::anyhow!("Query vector is required for vector search"))?,
            top_k: request.top_k,
            namespace: request.namespace.clone(),
            include_metadata: true,
            filter: request.filter.clone(),
        };

        let start_time = Instant::now();
        let results = self.client.search(&self.config.name, &query).await?;
        let search_time = start_time.elapsed();

        let search_results: Vec<SearchResult> = results
            .into_iter()
            .map(|result| SearchResult {
                id: result.id,
                content: result
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("content"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                score: result.score,
                metadata: result.metadata,
                index_name: Some(self.config.name.clone()),
                document_type: result
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("document_type"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                source: result
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("source"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                created_at: result
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("created_at"))
                    .and_then(|v| v.as_str())
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&chrono::Utc)),
            })
            .collect();

        Ok(SearchResponse {
            query: request.query.clone(),
            results: search_results,
            total_found: search_results.len() as u32,
            search_time,
            metadata: serde_json::json!({
                "index_name": self.config.name,
                "index_dimensions": self.config.dimensions,
                "index_metric": self.config.metric,
                "search_count": *self.search_count.read().await,
            }),
        })
    }

    /// Insert vectors into the index
    pub async fn insert_vectors(
        &self,
        vectors: Vec<crate::vectorize::client::VectorInsertRequest>,
    ) -> Result<Vec<String>> {
        self.client.insert_vectors(&self.config.name, vectors).await
    }

    /// Update vectors in the index
    pub async fn update_vectors(
        &self,
        vectors: Vec<crate::vectorize::client::VectorUpdateRequest>,
    ) -> Result<Vec<String>> {
        self.client.update_vectors(&self.config.name, vectors).await
    }

    /// Delete vectors from the index
    pub async fn delete_vectors(&self, vector_ids: Vec<String>) -> Result<()> {
        self.client
            .delete_vectors(&self.config.name, vector_ids)
            .await
    }

    /// Get index statistics
    pub async fn get_stats(&self) -> Result<crate::vectorize::client::IndexStats> {
        self.client.get_index_stats(&self.config.name).await
    }

    /// Get index configuration
    pub fn config(&self) -> &VectorIndexConfig {
        &self.config
    }

    /// Get last accessed time
    pub async fn last_accessed(&self) -> Instant {
        *self.last_accessed.read().await
    }

    /// Get search count
    pub async fn search_count(&self) -> u64 {
        *self.search_count.read().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::vector::VectorIndexType;

    #[tokio::test]
    async fn test_vector_index_manager_creation() {
        // This test requires a real Vectorize client, which we can't create in unit tests
        // In a real scenario, you'd mock the VectorizeClient
    }

    #[test]
    fn test_vector_index_type_dimensions() {
        assert_eq!(VectorIndexType::Documents.default_dimensions(), 384);
        assert_eq!(VectorIndexType::Code.default_dimensions(), 768);
        assert_eq!(VectorIndexType::Queries.default_dimensions(), 384);
    }

    #[test]
    fn test_tenant_index_name_generation() {
        let tenant_id = "tenant_123";
        let index_type = VectorIndexType::Documents;

        let index_name = format!("tenant_{}_{}", tenant_id, index_type.to_string());
        assert_eq!(index_name, "tenant_tenant_123_documents");
    }
}
