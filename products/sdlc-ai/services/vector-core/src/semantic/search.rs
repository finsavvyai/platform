use anyhow::{Context, Result};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{debug, info, warn};

use crate::models::search::{SearchRequest, SearchResponse, SearchResult, SimilarityMetric};
use crate::vectorize::manager::VectorIndexManager;

/// Semantic similarity search engine
#[derive(Debug)]
pub struct SemanticSearchEngine {
    index_manager: Arc<VectorIndexManager>,
    similarity_cache: Arc<dashmap::DashMap<String, f32>>,
    cache_size_limit: usize,
}

impl SemanticSearchEngine {
    /// Create a new semantic search engine
    pub fn new(index_manager: Arc<VectorIndexManager>) -> Self {
        Self {
            index_manager,
            similarity_cache: Arc::new(dashmap::DashMap::new()),
            cache_size_limit: 10000,
        }
    }

    /// Perform semantic similarity search
    pub async fn search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        let start_time = Instant::now();

        info!("Starting semantic search for query: {}", request.query);

        // Validate request
        if request.query_vector.is_none() && request.query.is_empty() {
            return Err(anyhow::anyhow!(
                "Either query vector or query text is required"
            ));
        }

        // If query text is provided, convert to vector (this would require embedding service)
        let query_vector = if let Some(vector) = &request.query_vector {
            vector.clone()
        } else {
            // TODO: Integrate with embedding service
            return Err(anyhow::anyhow!(
                "Query text to vector conversion not implemented yet"
            ));
        };

        // Normalize query vector if needed
        let normalized_query = self.normalize_vector(&query_vector, &request.similarity_metric);

        // Perform search based on similarity metric
        let mut search_request = request.clone();
        search_request.query_vector = Some(normalized_query);

        let response = self
            .index_manager
            .multi_index_search(&search_request)
            .await?;

        // Apply similarity-specific post-processing
        let processed_response = self
            .apply_similarity_post_processing(response, &request.similarity_metric)
            .await?;

        let search_time = start_time.elapsed();
        info!(
            "Semantic search completed in {:?} with {} results",
            search_time,
            processed_response.results.len()
        );

        Ok(processed_response)
    }

    /// Calculate cosine similarity between two vectors
    pub fn cosine_similarity(&self, vec_a: &[f32], vec_b: &[f32]) -> f32 {
        if vec_a.len() != vec_b.len() {
            warn!(
                "Vector dimensions don't match: {} vs {}",
                vec_a.len(),
                vec_b.len()
            );
            return 0.0;
        }

        let dot_product: f32 = vec_a.iter().zip(vec_b.iter()).map(|(a, b)| a * b).sum();
        let magnitude_a: f32 = vec_a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let magnitude_b: f32 = vec_b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if magnitude_a == 0.0 || magnitude_b == 0.0 {
            return 0.0;
        }

        dot_product / (magnitude_a * magnitude_b)
    }

    /// Calculate Euclidean distance between two vectors
    pub fn euclidean_distance(&self, vec_a: &[f32], vec_b: &[f32]) -> f32 {
        if vec_a.len() != vec_b.len() {
            warn!(
                "Vector dimensions don't match: {} vs {}",
                vec_a.len(),
                vec_b.len()
            );
            return f32::INFINITY;
        }

        vec_a
            .iter()
            .zip(vec_b.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum::<f32>()
            .sqrt()
    }

    /// Calculate dot product similarity between two vectors
    pub fn dot_product_similarity(&self, vec_a: &[f32], vec_b: &[f32]) -> f32 {
        if vec_a.len() != vec_b.len() {
            warn!(
                "Vector dimensions don't match: {} vs {}",
                vec_a.len(),
                vec_b.len()
            );
            return 0.0;
        }

        vec_a.iter().zip(vec_b.iter()).map(|(a, b)| a * b).sum()
    }

    /// Calculate Manhattan distance between two vectors
    pub fn manhattan_distance(&self, vec_a: &[f32], vec_b: &[f32]) -> f32 {
        if vec_a.len() != vec_b.len() {
            warn!(
                "Vector dimensions don't match: {} vs {}",
                vec_a.len(),
                vec_b.len()
            );
            return f32::INFINITY;
        }

        vec_a
            .iter()
            .zip(vec_b.iter())
            .map(|(a, b)| (a - b).abs())
            .sum()
    }

    /// Normalize vector based on similarity metric
    fn normalize_vector(&self, vector: &[f32], metric: &SimilarityMetric) -> Vec<f32> {
        match metric {
            SimilarityMetric::Cosine => {
                // Normalize to unit length for cosine similarity
                let magnitude: f32 = vector.iter().map(|x| x * x).sum::<f32>().sqrt();
                if magnitude > 0.0 {
                    vector.iter().map(|x| x / magnitude).collect()
                } else {
                    vector.to_vec()
                }
            }
            SimilarityMetric::Euclidean | SimilarityMetric::Manhattan => {
                // No normalization needed for distance metrics
                vector.to_vec()
            }
            SimilarityMetric::DotProduct => {
                // For dot product, we might want to normalize depending on use case
                vector.to_vec()
            }
        }
    }

    /// Apply metric-specific post-processing to search results
    async fn apply_similarity_post_processing(
        &self,
        mut response: SearchResponse,
        metric: &SimilarityMetric,
    ) -> Result<SearchResponse> {
        match metric {
            SimilarityMetric::Cosine => {
                // Cosine similarity already returns values between -1 and 1
                // Convert to 0-1 range for better interpretation
                for result in &mut response.results {
                    result.score = (result.score + 1.0) / 2.0;
                }
            }
            SimilarityMetric::Euclidean => {
                // Convert distance to similarity (inverse relationship)
                let max_distance = response.results.first().map(|r| r.score).unwrap_or(1.0);

                for result in &mut response.results {
                    result.score = 1.0 - (result.score / max_distance.max(1.0));
                }
            }
            SimilarityMetric::Manhattan => {
                // Similar to Euclidean, convert distance to similarity
                let max_distance = response.results.first().map(|r| r.score).unwrap_or(1.0);

                for result in &mut response.results {
                    result.score = 1.0 - (result.score / max_distance.max(1.0));
                }
            }
            SimilarityMetric::DotProduct => {
                // Dot product can be negative, normalize to 0-1 range
                let min_score = response
                    .results
                    .iter()
                    .map(|r| r.score)
                    .fold(f32::INFINITY, f32::min);
                let max_score = response
                    .results
                    .iter()
                    .map(|r| r.score)
                    .fold(f32::NEG_INFINITY, f32::max);
                let range = max_score - min_score;

                if range > 0.0 {
                    for result in &mut response.results {
                        result.score = (result.score - min_score) / range;
                    }
                }
            }
        }

        Ok(response)
    }

    /// Perform approximate nearest neighbor search
    pub async fn approximate_search(
        &self,
        request: &SearchRequest,
        epsilon: f32,
    ) -> Result<SearchResponse> {
        let mut search_request = request.clone();

        // For ANN search, we can use a higher top_k and filter by epsilon later
        search_request.top_k = (request.top_k as f32 * 2.0) as u32; // Get more candidates

        let response = self.search(&search_request).await?;

        // Filter results by epsilon threshold
        let filtered_results: Vec<SearchResult> = response
            .results
            .into_iter()
            .filter(|result| result.score >= epsilon)
            .take(request.top_k as usize)
            .collect();

        Ok(SearchResponse {
            query: response.query,
            results: filtered_results,
            total_found: filtered_results.len() as u32,
            search_time: response.search_time,
            metadata: {
                let mut meta = response.metadata;
                meta["approximate_search"] = serde_json::json!(true);
                meta["epsilon"] = serde_json::json!(epsilon);
                meta
            },
        })
    }

    /// Perform range-based similarity search
    pub async fn range_search(
        &self,
        request: &SearchRequest,
        min_similarity: f32,
        max_similarity: f32,
    ) -> Result<SearchResponse> {
        let mut search_request = request.clone();
        search_request.top_k = 1000; // Get more results for range filtering

        let response = self.search(&search_request).await?;

        // Filter results by similarity range
        let filtered_results: Vec<SearchResult> = response
            .results
            .into_iter()
            .filter(|result| result.score >= min_similarity && result.score <= max_similarity)
            .collect();

        Ok(SearchResponse {
            query: response.query,
            results: filtered_results,
            total_found: filtered_results.len() as u32,
            search_time: response.search_time,
            metadata: {
                let mut meta = response.metadata;
                meta["range_search"] = serde_json::json!(true);
                meta["min_similarity"] = serde_json::json!(min_similarity);
                meta["max_similarity"] = serde_json::json!(max_similarity);
                meta
            },
        })
    }

    /// Calculate similarity between multiple vectors and query
    pub async fn batch_similarity(
        &self,
        query_vector: &[f32],
        vectors: &[Vec<f32>],
        metric: &SimilarityMetric,
    ) -> Result<Vec<f32>> {
        let normalized_query = self.normalize_vector(query_vector, metric);

        let similarities: Vec<f32> = vectors
            .iter()
            .map(|vector| {
                let normalized_vector = self.normalize_vector(vector, metric);
                match metric {
                    SimilarityMetric::Cosine => {
                        self.cosine_similarity(&normalized_query, &normalized_vector)
                    }
                    SimilarityMetric::Euclidean => {
                        let distance =
                            self.euclidean_distance(&normalized_query, &normalized_vector);
                        // Convert to similarity
                        1.0 / (1.0 + distance)
                    }
                    SimilarityMetric::Manhattan => {
                        let distance =
                            self.manhattan_distance(&normalized_query, &normalized_vector);
                        // Convert to similarity
                        1.0 / (1.0 + distance)
                    }
                    SimilarityMetric::DotProduct => {
                        self.dot_product_similarity(&normalized_query, &normalized_vector)
                    }
                }
            })
            .collect();

        Ok(similarities)
    }

    /// Find most similar vectors to a query
    pub async fn find_most_similar(
        &self,
        query_vector: &[f32],
        candidates: &[Vec<f32>],
        top_k: usize,
        metric: &SimilarityMetric,
    ) -> Result<Vec<(usize, f32)>> {
        let similarities = self
            .batch_similarity(query_vector, candidates, metric)
            .await?;

        let mut indexed_similarities: Vec<(usize, f32)> =
            similarities.into_iter().enumerate().collect();

        // Sort by similarity (descending)
        indexed_similarities
            .sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take top k
        indexed_similarities.truncate(top_k);

        Ok(indexed_similarities)
    }

    /// Clear similarity cache
    pub fn clear_cache(&self) {
        self.similarity_cache.clear();
        info!("Similarity cache cleared");
    }

    /// Get cache statistics
    pub fn get_cache_stats(&self) -> HashMap<String, serde_json::Value> {
        let mut stats = HashMap::new();
        stats.insert(
            "cache_size".to_string(),
            serde_json::json!(self.similarity_cache.len()),
        );
        stats.insert(
            "cache_size_limit".to_string(),
            serde_json::json!(self.cache_size_limit),
        );
        stats.insert(
            "cache_usage_ratio".to_string(),
            serde_json::json!(self.similarity_cache.len() as f64 / self.cache_size_limit as f64),
        );
        stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_vector() -> Vec<f32> {
        vec![1.0, 0.0, 0.0, 0.0]
    }

    fn create_test_vector_2() -> Vec<f32> {
        vec![0.0, 1.0, 0.0, 0.0]
    }

    fn create_identical_vector() -> Vec<f32> {
        vec![1.0, 0.0, 0.0, 0.0]
    }

    #[test]
    fn test_cosine_similarity() {
        let engine = SemanticSearchEngine::new(Arc::new(
            VectorIndexManager::new(
                // Mock client would go here
                unimplemented!(),
            ),
            false,
        ));

        let vec1 = create_test_vector();
        let vec2 = create_test_vector_2();
        let vec3 = create_identical_vector();

        // Orthogonal vectors should have cosine similarity of 0
        assert!((engine.cosine_similarity(&vec1, &vec2) - 0.0).abs() < f32::EPSILON);

        // Identical vectors should have cosine similarity of 1
        assert!((engine.cosine_similarity(&vec1, &vec3) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_euclidean_distance() {
        let engine = SemanticSearchEngine::new(Arc::new(
            VectorIndexManager::new(
                // Mock client would go here
                unimplemented!(),
            ),
            false,
        ));

        let vec1 = create_test_vector();
        let vec2 = create_test_vector_2();
        let vec3 = create_identical_vector();

        // Orthogonal unit vectors should have distance of sqrt(2)
        assert!((engine.euclidean_distance(&vec1, &vec2) - 2.0_f32.sqrt()).abs() < f32::EPSILON);

        // Identical vectors should have distance of 0
        assert!((engine.euclidean_distance(&vec1, &vec3) - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_dot_product_similarity() {
        let engine = SemanticSearchEngine::new(Arc::new(
            VectorIndexManager::new(
                // Mock client would go here
                unimplemented!(),
            ),
            false,
        ));

        let vec1 = create_test_vector();
        let vec2 = create_test_vector_2();
        let vec3 = create_identical_vector();

        // Orthogonal vectors should have dot product of 0
        assert!((engine.dot_product_similarity(&vec1, &vec2) - 0.0).abs() < f32::EPSILON);

        // Identical vectors should have dot product of 1
        assert!((engine.dot_product_similarity(&vec1, &vec3) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_vector_normalization() {
        let engine = SemanticSearchEngine::new(Arc::new(
            VectorIndexManager::new(
                // Mock client would go here
                unimplemented!(),
            ),
            false,
        ));

        let vector = vec![3.0, 4.0, 0.0, 0.0];
        let normalized = engine.normalize_vector(&vector, &SimilarityMetric::Cosine);

        // Should be normalized to unit length
        let magnitude: f32 = normalized.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((magnitude - 1.0).abs() < f32::EPSILON);
    }

    #[tokio::test]
    async fn test_batch_similarity() {
        let engine = SemanticSearchEngine::new(Arc::new(
            VectorIndexManager::new(
                // Mock client would go here
                unimplemented!(),
            ),
            false,
        ));

        let query = vec![1.0, 0.0, 0.0, 0.0];
        let vectors = vec![
            vec![1.0, 0.0, 0.0, 0.0], // identical
            vec![0.0, 1.0, 0.0, 0.0], // orthogonal
            vec![0.5, 0.5, 0.0, 0.0], // 45 degrees
        ];

        let similarities = engine
            .batch_similarity(&query, &vectors, &SimilarityMetric::Cosine)
            .await
            .unwrap();

        assert!(similarities.len() == 3);
        assert!((similarities[0] - 1.0).abs() < f32::EPSILON); // identical
        assert!((similarities[1] - 0.0).abs() < f32::EPSILON); // orthogonal
        assert!((similarities[2] - 0.7071).abs() < 0.001); // 45 degrees ≈ 0.7071
    }
}
