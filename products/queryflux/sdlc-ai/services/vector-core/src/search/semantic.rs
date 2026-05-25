use anyhow::{Context, Result};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{debug, info, warn};

use crate::models::search::{SearchFilter, SearchRequest, SearchResult, SimilarityMetric};
use crate::vectorize::manager::VectorIndexManager;

/// Semantic similarity search engine
#[derive(Debug)]
pub struct SemanticSearchEngine {
    index_manager: Arc<VectorIndexManager>,
    similarity_cache: Arc<dashmap::DashMap<String, f32>>,
    cache_ttl: std::time::Duration,
}

impl SemanticSearchEngine {
    /// Create a new semantic search engine
    pub fn new(index_manager: Arc<VectorIndexManager>) -> Self {
        Self {
            index_manager,
            similarity_cache: Arc::new(dashmap::DashMap::new()),
            cache_ttl: std::time::Duration::from_secs(300), // 5 minutes cache
        }
    }

    /// Perform semantic search with specified similarity metric
    pub async fn search(&self, request: &SearchRequest) -> Result<Vec<SearchResult>> {
        let start_time = Instant::now();

        info!(
            "Performing semantic search with metric: {:?}",
            request.similarity_metric
        );

        let mut results = match request.similarity_metric {
            SimilarityMetric::Cosine => self.cosine_similarity_search(request).await?,
            SimilarityMetric::Euclidean => self.euclidean_similarity_search(request).await?,
            SimilarityMetric::DotProduct => self.dot_product_similarity_search(request).await?,
        };

        // Apply additional filters
        if let Some(filter) = &request.filter {
            results = self.apply_filters(results, filter).await?;
        }

        // Apply similarity threshold
        if let Some(threshold) = request.similarity_threshold {
            results.retain(|result| result.score >= threshold);
        }

        // Sort by similarity score (descending)
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Limit to top_k results
        results.truncate(request.top_k as usize);

        let search_time = start_time.elapsed();
        info!(
            "Semantic search completed in {}ms, found {} results",
            search_time.as_millis(),
            results.len()
        );

        Ok(results)
    }

    /// Cosine similarity search
    async fn cosine_similarity_search(&self, request: &SearchRequest) -> Result<Vec<SearchResult>> {
        debug!("Performing cosine similarity search");

        // Vectorize indexes already use cosine similarity by default
        let search_request = SearchRequest {
            similarity_metric: SimilarityMetric::Cosine,
            ..request.clone()
        };

        let response = if request.indexes.len() == 1 {
            // Single index search
            if let Some(index) = self.index_manager.get_index(&request.indexes[0]) {
                index.search(&search_request).await?
            } else {
                return Err(anyhow::anyhow!("Index not found: {}", request.indexes[0]));
            }
        } else {
            // Multi-index search
            self.index_manager
                .multi_index_search(&search_request)
                .await?
        };

        Ok(response.results)
    }

    /// Euclidean distance similarity search
    async fn euclidean_similarity_search(
        &self,
        request: &SearchRequest,
    ) -> Result<Vec<SearchResult>> {
        debug!("Performing euclidean similarity search");

        // For euclidean search, we need to use indexes configured with euclidean metric
        let search_request = SearchRequest {
            similarity_metric: SimilarityMetric::Euclidean,
            ..request.clone()
        };

        // Find indexes configured for euclidean distance
        let euclidean_indexes: Vec<String> = request
            .indexes
            .iter()
            .filter(|&index_name| {
                if let Some(index) = self.index_manager.get_index(index_name) {
                    index.config().metric == "euclidean"
                } else {
                    false
                }
            })
            .cloned()
            .collect();

        if euclidean_indexes.is_empty() {
            warn!("No indexes configured for euclidean distance found, falling back to cosine");
            return self.cosine_similarity_search(request).await;
        }

        let mut search_request = search_request;
        search_request.indexes = euclidean_indexes;

        let response = if search_request.indexes.len() == 1 {
            if let Some(index) = self.index_manager.get_index(&search_request.indexes[0]) {
                index.search(&search_request).await?
            } else {
                return Err(anyhow::anyhow!(
                    "Index not found: {}",
                    search_request.indexes[0]
                ));
            }
        } else {
            self.index_manager
                .multi_index_search(&search_request)
                .await?
        };

        Ok(response.results)
    }

    /// Dot product similarity search
    async fn dot_product_similarity_search(
        &self,
        request: &SearchRequest,
    ) -> Result<Vec<SearchResult>> {
        debug!("Performing dot product similarity search");

        // Dot product similarity requires vectors to be normalized
        let normalized_query = self.normalize_vector(
            &request
                .query_vector
                .clone()
                .ok_or_else(|| anyhow::anyhow!("Query vector is required"))?,
        )?;

        let mut search_request = request.clone();
        search_request.query_vector = Some(normalized_query);

        // Use cosine similarity as proxy for dot product (since vectors are normalized)
        self.cosine_similarity_search(&search_request).await
    }

    /// Approximate Nearest Neighbor (ANN) search
    pub async fn ann_search(
        &self,
        request: &SearchRequest,
        ef_search: Option<u32>,
    ) -> Result<Vec<SearchResult>> {
        debug!("Performing ANN search with ef_search: {:?}", ef_search);

        let mut search_request = request.clone();

        // Add ANN parameters to metadata
        if let Some(ef) = ef_search {
            if let Some(mut metadata) = search_request.metadata {
                metadata["ef_search"] = serde_json::Value::Number(ef.into());
                search_request.metadata = Some(metadata);
            } else {
                search_request.metadata = Some(serde_json::json!({
                    "ef_search": ef
                }));
            }
        }

        self.search(&search_request).await
    }

    /// K-Nearest Neighbors (k-NN) search
    pub async fn knn_search(&self, request: &SearchRequest, k: u32) -> Result<Vec<SearchResult>> {
        debug!("Performing k-NN search with k: {}", k);

        let mut search_request = request.clone();
        search_request.top_k = k;

        self.search(&search_request).await
    }

    /// Range-based similarity search
    pub async fn range_search(
        &self,
        request: &SearchRequest,
        range: f32,
    ) -> Result<Vec<SearchResult>> {
        debug!("Performing range search with range: {}", range);

        let mut results = self.search(request).await?;

        // Filter results within the specified range
        results.retain(|result| result.score <= range);

        Ok(results)
    }

    /// Similarity threshold filtering
    pub async fn threshold_search(
        &self,
        request: &SearchRequest,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        debug!("Performing threshold search with threshold: {}", threshold);

        let mut search_request = request.clone();
        search_request.similarity_threshold = Some(threshold);

        self.search(&search_request).await
    }

    /// Apply filters to search results
    async fn apply_filters(
        &self,
        mut results: Vec<SearchResult>,
        filter: &SearchFilter,
    ) -> Result<Vec<SearchResult>> {
        debug!("Applying filters to {} results", results.len());

        // Filter by document type
        if let Some(document_types) = &filter.document_types {
            results.retain(|result| {
                if let Some(result_type) = &result.document_type {
                    document_types.contains(result_type)
                } else {
                    false
                }
            });
        }

        // Filter by source
        if let Some(sources) = &filter.sources {
            results.retain(|result| {
                if let Some(result_source) = &result.source {
                    sources.contains(result_source)
                } else {
                    false
                }
            });
        }

        // Filter by date range
        if let Some(start_date) = &filter.start_date {
            results.retain(|result| {
                if let Some(created_at) = &result.created_at {
                    created_at >= start_date
                } else {
                    false
                }
            });
        }

        if let Some(end_date) = &filter.end_date {
            results.retain(|result| {
                if let Some(created_at) = &result.created_at {
                    created_at <= end_date
                } else {
                    false
                }
            });
        }

        // Filter by custom metadata
        if let Some(custom_filters) = &filter.custom_filters {
            for (key, value) in custom_filters {
                results.retain(|result| {
                    if let Some(metadata) = &result.metadata {
                        metadata.get(key).map_or(false, |v| v == value)
                    } else {
                        false
                    }
                });
            }
        }

        debug!("Filtered results: {} remaining", results.len());
        Ok(results)
    }

    /// Normalize a vector to unit length
    fn normalize_vector(&self, vector: &[f32]) -> Result<Vec<f32>> {
        let norm = vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm == 0.0 {
            return Err(anyhow::anyhow!("Cannot normalize zero vector"));
        }

        Ok(vector.iter().map(|x| x / norm).collect())
    }

    /// Calculate cosine similarity between two vectors
    pub fn cosine_similarity(&self, vec1: &[f32], vec2: &[f32]) -> f32 {
        if vec1.len() != vec2.len() {
            warn!(
                "Vector dimensions mismatch: {} vs {}",
                vec1.len(),
                vec2.len()
            );
            return 0.0;
        }

        let dot_product: f32 = vec1.iter().zip(vec2.iter()).map(|(a, b)| a * b).sum();
        let norm1: f32 = vec1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm2: f32 = vec2.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm1 == 0.0 || norm2 == 0.0 {
            return 0.0;
        }

        dot_product / (norm1 * norm2)
    }

    /// Calculate euclidean distance between two vectors
    pub fn euclidean_distance(&self, vec1: &[f32], vec2: &[f32]) -> f32 {
        if vec1.len() != vec2.len() {
            warn!(
                "Vector dimensions mismatch: {} vs {}",
                vec1.len(),
                vec2.len()
            );
            return f32::INFINITY;
        }

        vec1.iter()
            .zip(vec2.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum::<f32>()
            .sqrt()
    }

    /// Calculate dot product between two vectors
    pub fn dot_product(&self, vec1: &[f32], vec2: &[f32]) -> f32 {
        if vec1.len() != vec2.len() {
            warn!(
                "Vector dimensions mismatch: {} vs {}",
                vec1.len(),
                vec2.len()
            );
            return 0.0;
        }

        vec1.iter().zip(vec2.iter()).map(|(a, b)| a * b).sum()
    }

    /// Get cached similarity score
    fn get_cached_similarity(&self, key: &str) -> Option<f32> {
        self.similarity_cache.get(key).map(|entry| *entry.value())
    }

    /// Cache similarity score
    fn cache_similarity(&self, key: String, score: f32) {
        self.similarity_cache.insert(key, score);

        // Schedule cache cleanup
        let cache = self.similarity_cache.clone();
        let ttl = self.cache_ttl;
        tokio::spawn(async move {
            tokio::time::sleep(ttl).await;
            cache.remove(&key);
        });
    }

    /// Clear similarity cache
    pub fn clear_cache(&self) {
        self.similarity_cache.clear();
        info!("Semantic similarity cache cleared");
    }

    /// Get cache statistics
    pub fn get_cache_stats(&self) -> HashMap<String, u64> {
        HashMap::from([
            ("cache_size".to_string(), self.similarity_cache.len() as u64),
            ("cache_ttl_seconds".to_string(), self.cache_ttl.as_secs()),
        ])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::search::{SearchFilter, SimilarityMetric};

    #[test]
    fn test_cosine_similarity() {
        let engine = SemanticSearchEngine::new(std::sync::Arc::new(
            crate::vectorize::manager::VectorIndexManager::new(
                crate::vectorize::client::VectorizeClient::new(
                    "test".to_string(),
                    "test".to_string(),
                    None,
                )
                .unwrap(),
                true,
            ),
        ));

        let vec1 = vec![1.0, 0.0, 0.0];
        let vec2 = vec![0.0, 1.0, 0.0];
        let vec3 = vec![1.0, 0.0, 0.0];

        // Orthogonal vectors should have 0 similarity
        assert!((engine.cosine_similarity(&vec1, &vec2) - 0.0).abs() < f32::EPSILON);

        // Identical vectors should have 1 similarity
        assert!((engine.cosine_similarity(&vec1, &vec3) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_euclidean_distance() {
        let engine = SemanticSearchEngine::new(std::sync::Arc::new(
            crate::vectorize::manager::VectorIndexManager::new(
                crate::vectorize::client::VectorizeClient::new(
                    "test".to_string(),
                    "test".to_string(),
                    None,
                )
                .unwrap(),
                true,
            ),
        ));

        let vec1 = vec![0.0, 0.0, 0.0];
        let vec2 = vec![1.0, 0.0, 0.0];
        let vec3 = vec![1.0, 1.0, 0.0];

        // Distance from origin
        assert!((engine.euclidean_distance(&vec1, &vec2) - 1.0).abs() < f32::EPSILON);

        // Distance between two points
        assert!((engine.euclidean_distance(&vec2, &vec3) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_dot_product() {
        let engine = SemanticSearchEngine::new(std::sync::Arc::new(
            crate::vectorize::manager::VectorIndexManager::new(
                crate::vectorize::client::VectorizeClient::new(
                    "test".to_string(),
                    "test".to_string(),
                    None,
                )
                .unwrap(),
                true,
            ),
        ));

        let vec1 = vec![1.0, 2.0, 3.0];
        let vec2 = vec![4.0, 5.0, 6.0];

        let expected = 1.0 * 4.0 + 2.0 * 5.0 + 3.0 * 6.0; // 4 + 10 + 18 = 32
        assert!((engine.dot_product(&vec1, &vec2) - expected).abs() < f32::EPSILON);
    }

    #[test]
    fn test_vector_normalization() {
        let engine = SemanticSearchEngine::new(std::sync::Arc::new(
            crate::vectorize::manager::VectorIndexManager::new(
                crate::vectorize::client::VectorizeClient::new(
                    "test".to_string(),
                    "test".to_string(),
                    None,
                )
                .unwrap(),
                true,
            ),
        ));

        let vector = vec![3.0, 4.0];
        let normalized = engine.normalize_vector(&vector).unwrap();

        // Check that the normalized vector has unit length
        let norm: f32 = normalized.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < f32::EPSILON);

        // Check that the direction is preserved
        assert!(normalized[0] > 0.0 && normalized[1] > 0.0);
    }
}
