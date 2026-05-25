use crate::cache::CacheService;
use crate::config::{Config, HybridWeights, SearchConfig};
use crate::embeddings::EmbeddingService;
use crate::error::{AppError, Result};
use crate::monitoring::MetricsService;
pub use crate::vector_store::{SearchRequest, SearchResponse, SearchResult};
use crate::vector_store::VectorStore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tracing::{debug, error, info, warn};

pub struct SearchService {
    vector_store: Arc<dyn VectorStore>,
    embedding_service: Arc<EmbeddingService>,
    cache: CacheService,
    metrics: MetricsService,
    config: SearchConfig,
}

impl SearchService {
    pub async fn new(
        vector_store: Arc<dyn VectorStore>,
        embedding_service: Arc<EmbeddingService>,
        cache: CacheService,
        metrics: MetricsService,
    ) -> Result<Self> {
        let config = Config::from_env()?.search;

        Ok(Self {
            vector_store,
            embedding_service,
            cache,
            metrics,
            config,
        })
    }

    pub async fn search(&self, request: SearchRequest) -> Result<SearchResponse> {
        let start_time = Instant::now();

        // Record search start
        self.metrics.record_search_start().await;

        // Check cache first
        let cache_key = self.generate_cache_key(&request);
        if let Some(cached_response) = self.cache.get_cached_search_results(&cache_key).await? {
            debug!("Cache hit for search query");
            self.metrics.record_cache_hit().await;
            return Ok(cached_response);
        }

        // Validate request
        self.validate_search_request(&request)?;

        // Perform search
        let search_result = self.perform_search(request.clone()).await;

        // Record metrics
        let duration = start_time.elapsed();
        match &search_result {
            Ok(response) => {
                self.metrics
                    .record_search_success(duration, response.results.len())
                    .await;

                // Cache successful results
                self.cache
                    .cache_search_results(&cache_key, response)
                    .await?;
            }
            Err(e) => {
                self.metrics
                    .record_search_error(duration, &e.to_string())
                    .await;
            }
        }

        search_result
    }

    async fn perform_search(&self, request: SearchRequest) -> Result<SearchResponse> {
        info!("Performing vector search for index: {}", request.index_id);

        // Perform semantic search
        let semantic_results = self.vector_store.search_vectors(request.clone()).await?;

        // Apply ranking and filtering if needed
        let mut results = semantic_results.results;

        // Apply reranking if enabled
        if self.config.reranking_enabled {
            results = self.apply_reranking(&request, results).await?;
        }

        // Apply result filtering
        results = self.apply_result_filtering(&request, results);

        let total_count = results.len();
        Ok(SearchResponse {
            results,
            total_count,
            search_time_ms: semantic_results.search_time_ms,
        })
    }

    fn validate_search_request(&self, request: &SearchRequest) -> Result<()> {
        if request.query_vector.is_empty() {
            return Err(AppError::Validation(
                "Query vector cannot be empty".to_string(),
            ));
        }

        if request.limit == 0 {
            return Err(AppError::Validation(
                "Limit must be greater than 0".to_string(),
            ));
        }

        if request.limit > self.config.max_limit {
            return Err(AppError::Validation(format!(
                "Limit cannot exceed maximum of {}",
                self.config.max_limit
            )));
        }

        if request.index_id.is_empty() {
            return Err(AppError::Validation("Index ID cannot be empty".to_string()));
        }

        if request.tenant_id.is_empty() {
            return Err(AppError::Validation(
                "Tenant ID cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    async fn apply_reranking(
        &self,
        request: &SearchRequest,
        results: Vec<SearchResult>,
    ) -> Result<Vec<SearchResult>> {
        if let Some(reranker_model) = &self.config.reranker_model {
            info!("Applying reranking with model: {}", reranker_model);

            // For now, we'll implement a simple relevance-based reranking
            // In a production system, this would use a dedicated reranking model
            let mut reranked_results = results;

            // Apply relevance scoring based on metadata and other factors
            for result in &mut reranked_results {
                let relevance_score = self.calculate_relevance_score(request, result);
                // Combine the original similarity score with relevance score
                result.score = (result.score * 0.7) + (relevance_score * 0.3);
            }

            // Sort by the combined score
            reranked_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

            Ok(reranked_results)
        } else {
            Ok(results)
        }
    }

    fn calculate_relevance_score(&self, request: &SearchRequest, result: &SearchResult) -> f32 {
        let mut relevance_score = 0.0;

        // Check for document recency in metadata
        if let Some(created_at) = result.metadata.get("created_at") {
            if let Some(timestamp) = created_at.as_str() {
                if let Ok(datetime) = timestamp.parse::<chrono::DateTime<chrono::Utc>>() {
                    let days_old = (chrono::Utc::now() - datetime).num_days();
                    // More recent documents get higher relevance
                    let recency_factor = 1.0 / (1.0 + days_old as f32 * 0.1);
                    relevance_score += recency_factor * self.config.hybrid_weights.recency;
                }
            }
        }

        // Check for document type relevance
        if let Some(doc_type) = result.metadata.get("document_type") {
            if let Some(type_str) = doc_type.as_str() {
                // Boost certain document types
                let type_boost = match type_str {
                    "research_paper" => 0.1,
                    "technical_document" => 0.08,
                    "user_manual" => 0.05,
                    _ => 0.0,
                };
                relevance_score += type_boost;
            }
        }

        // Check for content quality indicators
        if let Some(quality_score) = result.metadata.get("quality_score") {
            if let Some(score) = quality_score.as_f64() {
                relevance_score += (score as f32) * 0.1;
            }
        }

        relevance_score.clamp(0.0, 1.0)
    }

    fn apply_result_filtering(
        &self,
        request: &SearchRequest,
        results: Vec<SearchResult>,
    ) -> Vec<SearchResult> {
        results
            .into_iter()
            .filter(|result| {
                // Apply minimum score threshold
                if result.score < 0.1 {
                    return false;
                }

                // Apply additional filters based on request parameters
                self.passes_filters(result, &request.filter)
            })
            .take(request.limit)
            .collect()
    }

    fn passes_filters(&self, result: &SearchResult, filters: &HashMap<String, String>) -> bool {
        for (key, expected_value) in filters {
            match key.as_str() {
                "similarity_threshold" => {
                    if let Ok(threshold) = expected_value.parse::<f32>() {
                        if result.score < threshold {
                            return false;
                        }
                    }
                }
                "document_type" => {
                    if let Some(doc_type) = result.metadata.get("document_type") {
                        if let Some(type_str) = doc_type.as_str() {
                            if type_str != expected_value {
                                return false;
                            }
                        }
                    }
                }
                "created_after" => {
                    if let Some(created_at) = result.metadata.get("created_at") {
                        if let Some(timestamp) = created_at.as_str() {
                            if let Ok(filter_date) =
                                timestamp.parse::<chrono::DateTime<chrono::Utc>>()
                            {
                                if let Ok(min_date) =
                                    expected_value.parse::<chrono::DateTime<chrono::Utc>>()
                                {
                                    if filter_date < min_date {
                                        return false;
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {
                    // Generic metadata filtering
                    if let Some(metadata_value) = result.metadata.get(key) {
                        if let Some(str_value) = metadata_value.as_str() {
                            if str_value != expected_value {
                                return false;
                            }
                        }
                    }
                }
            }
        }
        true
    }

    fn generate_cache_key(&self, request: &SearchRequest) -> String {
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

        // Hash filters
        for (key, value) in &request.filter {
            key.hash(&mut hasher);
            value.hash(&mut hasher);
        }

        format!(
            "search:{}:{}",
            request.tenant_id,
            format!("{:x}", hasher.finish())
        )
    }

    // Hybrid search combining semantic and keyword matching
    pub async fn hybrid_search(
        &self,
        request: HybridSearchRequest,
    ) -> Result<HybridSearchResponse> {
        let start_time = Instant::now();

        info!("Performing hybrid search for query: {}", request.query);

        // Generate embedding for semantic search
        let embedding_request = crate::embeddings::EmbeddingRequest {
            texts: vec![request.query.clone()],
            model_provider: request.embedding_model.clone(),
            tenant_id: request.tenant_id.clone(),
        };

        let embedding_response = self
            .embedding_service
            .generate_embeddings(embedding_request)
            .await?;
        let query_vector = embedding_response
            .embeddings
            .into_iter()
            .next()
            .ok_or_else(|| AppError::EmbeddingGeneration("No embedding generated".to_string()))?;

        // Perform semantic search
        let semantic_request = SearchRequest {
            index_id: request.index_id.clone(),
            query_vector: query_vector.clone(),
            limit: request.semantic_limit,
            include_values: false,
            include_metadata: true,
            filter: request.filter.clone(),
            tenant_id: request.tenant_id.clone(),
        };

        let semantic_results = self.vector_store.search_vectors(semantic_request).await?;

        // Perform keyword search (BM25)
        let keyword_results = self.perform_keyword_search(&request).await;

        let semantic_count = semantic_results.results.len();
        let keyword_count = keyword_results.len();

        // Combine results using hybrid scoring
        let combined_results = self.combine_search_results(
            semantic_results.results,
            keyword_results,
            &request.weights,
        );

        let total_time = start_time.elapsed();

        Ok(HybridSearchResponse {
            results: combined_results,
            semantic_count,
            keyword_count,
            total_time_ms: total_time.as_millis() as u64,
            query: request.query,
            weights: request.weights,
        })
    }

    async fn perform_keyword_search(
        &self,
        request: &HybridSearchRequest,
    ) -> Vec<KeywordSearchResult> {
        // This would integrate with a full-text search engine like Elasticsearch or PostgreSQL FTS
        // For now, we'll implement a basic keyword search simulation

        info!("Performing keyword search for: {}", request.query);

        // In a real implementation, this would:
        // 1. Connect to Elasticsearch or PostgreSQL FTS
        // 2. Perform BM25 search with the query
        // 3. Return ranked results with BM25 scores

        // For demonstration, return empty results
        vec![]
    }

    fn combine_search_results(
        &self,
        semantic_results: Vec<SearchResult>,
        keyword_results: Vec<KeywordSearchResult>,
        weights: &HybridWeights,
    ) -> Vec<HybridSearchResult> {
        let mut combined_results: HashMap<String, HybridSearchResult> = HashMap::new();

        // Process semantic results
        for semantic_result in semantic_results {
            let hybrid_result = HybridSearchResult {
                id: semantic_result.id.clone(),
                score: semantic_result.score * weights.semantic,
                semantic_score: Some(semantic_result.score),
                keyword_score: None,
                metadata: semantic_result.metadata,
                source: "semantic".to_string(),
            };

            combined_results.insert(semantic_result.id, hybrid_result);
        }

        // Process keyword results and merge
        for keyword_result in keyword_results {
            let keyword_score = keyword_result.score * weights.keyword;

            if let Some(existing_result) = combined_results.get_mut(&keyword_result.id) {
                // Merge with existing semantic result
                existing_result.score += keyword_score;
                existing_result.keyword_score = Some(keyword_result.score);
                existing_result.source = "hybrid".to_string();
            } else {
                // Add new keyword-only result
                let hybrid_result = HybridSearchResult {
                    id: keyword_result.id.clone(),
                    score: keyword_score,
                    semantic_score: None,
                    keyword_score: Some(keyword_result.score),
                    metadata: keyword_result.metadata,
                    source: "keyword".to_string(),
                };

                combined_results.insert(keyword_result.id, hybrid_result);
            }
        }

        // Convert to vector and sort by final score
        let mut results: Vec<HybridSearchResult> = combined_results.into_values().collect();
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        results
    }
}

// Semantic similarity calculation utilities
pub mod similarity {
    use crate::error::{AppError, Result};

    /// Calculate cosine similarity between two vectors
    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> Result<f32> {
        if a.len() != b.len() {
            return Err(AppError::Validation(format!(
                "Vectors must have the same dimension: {} vs {}",
                a.len(),
                b.len()
            )));
        }

        if a.is_empty() {
            return Err(AppError::Validation("Vectors cannot be empty".to_string()));
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return Ok(0.0);
        }

        Ok(dot_product / (norm_a * norm_b))
    }

    /// Calculate Euclidean distance between two vectors
    pub fn euclidean_distance(a: &[f32], b: &[f32]) -> Result<f32> {
        if a.len() != b.len() {
            return Err(AppError::Validation(format!(
                "Vectors must have the same dimension: {} vs {}",
                a.len(),
                b.len()
            )));
        }

        let sum_squares: f32 = a.iter().zip(b.iter()).map(|(x, y)| (x - y).powi(2)).sum();

        Ok(sum_squares.sqrt())
    }

    /// Calculate Manhattan distance between two vectors
    pub fn manhattan_distance(a: &[f32], b: &[f32]) -> Result<f32> {
        if a.len() != b.len() {
            return Err(AppError::Validation(format!(
                "Vectors must have the same dimension: {} vs {}",
                a.len(),
                b.len()
            )));
        }

        let sum_abs: f32 = a.iter().zip(b.iter()).map(|(x, y)| (x - y).abs()).sum();

        Ok(sum_abs)
    }

    /// Calculate dot product between two vectors
    pub fn dot_product(a: &[f32], b: &[f32]) -> Result<f32> {
        if a.len() != b.len() {
            return Err(AppError::Validation(format!(
                "Vectors must have the same dimension: {} vs {}",
                a.len(),
                b.len()
            )));
        }

        Ok(a.iter().zip(b.iter()).map(|(x, y)| x * y).sum())
    }

    /// Normalize a vector to unit length
    pub fn normalize(vector: &[f32]) -> Result<Vec<f32>> {
        if vector.is_empty() {
            return Err(AppError::Validation(
                "Cannot normalize empty vector".to_string(),
            ));
        }

        let norm: f32 = vector.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm == 0.0 {
            return Err(AppError::Validation(
                "Cannot normalize zero vector".to_string(),
            ));
        }

        Ok(vector.iter().map(|x| x / norm).collect())
    }

    /// Batch calculate cosine similarities
    pub fn batch_cosine_similarity(query: &[f32], documents: &[Vec<f32>]) -> Result<Vec<f32>> {
        let normalized_query = normalize(query)?;

        let mut similarities = Vec::with_capacity(documents.len());
        for doc in documents {
            let similarity = cosine_similarity(&normalized_query, doc)?;
            similarities.push(similarity);
        }

        Ok(similarities)
    }

    /// Find top-k most similar vectors
    pub fn top_k_similar(
        query: &[f32],
        documents: &[Vec<f32>],
        k: usize,
    ) -> Result<Vec<(usize, f32)>> {
        if k > documents.len() {
            return Err(AppError::Validation(format!(
                "k ({}) cannot be greater than number of documents ({})",
                k,
                documents.len()
            )));
        }

        let mut similarities: Vec<(usize, f32)> = documents
            .iter()
            .enumerate()
            .map(|(i, doc)| (i, cosine_similarity(query, doc).unwrap_or(0.0)))
            .collect();

        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        Ok(similarities.into_iter().take(k).collect())
    }
}

// Data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchRequest {
    pub query: String,
    pub index_id: String,
    pub semantic_limit: usize,
    pub keyword_limit: usize,
    pub embedding_model: Option<String>,
    pub filter: HashMap<String, String>,
    pub weights: HybridWeights,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchResponse {
    pub results: Vec<HybridSearchResult>,
    pub semantic_count: usize,
    pub keyword_count: usize,
    pub total_time_ms: u64,
    pub query: String,
    pub weights: HybridWeights,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchResult {
    pub id: String,
    pub score: f32,
    pub semantic_score: Option<f32>,
    pub keyword_score: Option<f32>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub source: String, // "semantic", "keyword", or "hybrid"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeywordSearchResult {
    pub id: String,
    pub score: f32,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchAnalytics {
    pub total_searches: u64,
    pub avg_response_time_ms: f64,
    pub cache_hit_rate: f64,
    pub error_rate: f64,
    pub top_queries: Vec<QueryStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryStats {
    pub query: String,
    pub count: u64,
    pub avg_response_time_ms: f64,
    pub avg_result_count: f64,
}

#[cfg(test)]
mod tests {
    use super::similarity::*;
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];

        let similarity = cosine_similarity(&a, &b).unwrap();
        assert!(similarity > 0.9 && similarity <= 1.0);
    }

    #[test]
    fn test_normalize() {
        let vector = vec![3.0, 4.0];
        let normalized = normalize(&vector).unwrap();

        let norm: f32 = normalized.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_top_k_similar() {
        let query = vec![1.0, 0.0];
        let documents = vec![
            vec![1.0, 0.0],     // identical
            vec![0.0, 1.0],     // orthogonal
            vec![0.707, 0.707], // 45 degrees
            vec![-1.0, 0.0],    // opposite
        ];

        let top_k = top_k_similar(&query, &documents, 2).unwrap();

        assert_eq!(top_k.len(), 2);
        assert_eq!(top_k[0].0, 0); // Most similar (identical)
        assert!(top_k[0].1 > top_k[1].1); // First is more similar than second
    }
}
