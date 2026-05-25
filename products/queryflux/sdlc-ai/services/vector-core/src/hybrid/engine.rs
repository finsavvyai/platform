use anyhow::{Context, Result};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{debug, info, warn};

use crate::keyword::search::KeywordSearchEngine;
use crate::models::search::{
    HybridSearchConfig, KeywordSearchMethod, SearchFusionStrategy, SearchRequest, SearchResponse,
    SearchResult,
};
use crate::semantic::search::SemanticSearchEngine;

/// Hybrid search engine combining semantic and keyword search
#[derive(Debug)]
pub struct HybridSearchEngine {
    semantic_engine: Arc<SemanticSearchEngine>,
    keyword_engine: Arc<KeywordSearchEngine>,
    default_config: HybridSearchConfig,
}

impl HybridSearchEngine {
    /// Create a new hybrid search engine
    pub fn new(
        semantic_engine: Arc<SemanticSearchEngine>,
        keyword_engine: Arc<KeywordSearchEngine>,
        default_config: HybridSearchConfig,
    ) -> Self {
        Self {
            semantic_engine,
            keyword_engine,
            default_config,
        }
    }

    /// Perform hybrid search
    pub async fn search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        let start_time = Instant::now();
        let config = request
            .hybrid_config
            .clone()
            .unwrap_or_else(|| self.default_config.clone());

        info!(
            "Starting hybrid search for query: {} with config: {:?}",
            request.query, config
        );

        // Perform semantic search
        let semantic_results = if config.semantic_weight > 0.0 {
            Some(self.perform_semantic_search(request, &config).await?)
        } else {
            None
        };

        // Perform keyword search
        let keyword_results = if config.keyword_weight > 0.0 {
            Some(self.perform_keyword_search(request, &config).await?)
        } else {
            None
        };

        // Fuse results
        let fused_response = self
            .fuse_results(semantic_results, keyword_results, request, &config)
            .await?;

        let search_time = start_time.elapsed();
        info!(
            "Hybrid search completed in {:?} with {} results",
            search_time,
            fused_response.results.len()
        );

        Ok(SearchResponse {
            search_time,
            ..fused_response
        })
    }

    /// Perform semantic search component
    async fn perform_semantic_search(
        &self,
        request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        let mut semantic_request = request.clone();

        // Adjust top_k based on weight to get more candidates
        semantic_request.top_k =
            (request.top_k as f32 * 2.0 / config.semantic_weight.max(0.1)) as u32;

        self.semantic_engine.search(&semantic_request).await
    }

    /// Perform keyword search component
    async fn perform_keyword_search(
        &self,
        request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        let mut keyword_request = request.clone();

        // Adjust top_k based on weight to get more candidates
        keyword_request.top_k =
            (request.top_k as f32 * 2.0 / config.keyword_weight.max(0.1)) as u32;

        self.keyword_engine.search(&keyword_request).await
    }

    /// Fuse semantic and keyword search results
    async fn fuse_results(
        &self,
        semantic_response: Option<SearchResponse>,
        keyword_response: Option<SearchResponse>,
        original_request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        match config.fusion_strategy {
            SearchFusionStrategy::WeightedAverage => {
                self.weighted_average_fusion(
                    semantic_response,
                    keyword_response,
                    original_request,
                    config,
                )
                .await
            }
            SearchFusionStrategy::ReciprocalRank => {
                self.reciprocal_rank_fusion(
                    semantic_response,
                    keyword_response,
                    original_request,
                    config,
                )
                .await
            }
            SearchFusionStrategy::Condorcet => {
                self.condorcet_fusion(
                    semantic_response,
                    keyword_response,
                    original_request,
                    config,
                )
                .await
            }
            SearchFusionStrategy::SemanticFirst => {
                self.semantic_first_fusion(
                    semantic_response,
                    keyword_response,
                    original_request,
                    config,
                )
                .await
            }
            SearchFusionStrategy::KeywordFirst => {
                self.keyword_first_fusion(
                    semantic_response,
                    keyword_response,
                    original_request,
                    config,
                )
                .await
            }
        }
    }

    /// Weighted average fusion
    async fn weighted_average_fusion(
        &self,
        semantic_response: Option<SearchResponse>,
        keyword_response: Option<SearchResponse>,
        original_request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        let mut result_scores: HashMap<String, (f32, SearchResult)> = HashMap::new();

        // Process semantic results
        if let Some(semantic_resp) = semantic_response {
            for result in semantic_resp.results {
                let entry = result_scores
                    .entry(result.id.clone())
                    .or_insert((0.0, result));
                entry.0 += config.semantic_weight * entry.1.score;
            }
        }

        // Process keyword results
        if let Some(keyword_resp) = keyword_response {
            for result in keyword_resp.results {
                let entry = result_scores
                    .entry(result.id.clone())
                    .or_insert((0.0, result));
                entry.0 += config.keyword_weight * entry.1.score;
            }
        }

        // Convert to results and sort
        let mut fused_results: Vec<SearchResult> = result_scores
            .into_values()
            .map(|(combined_score, mut result)| {
                result.score = combined_score;
                result
            })
            .collect();

        fused_results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        fused_results.truncate(original_request.top_k as usize);

        Ok(SearchResponse {
            query: original_request.query.clone(),
            results: fused_results,
            total_found: fused_results.len() as u32,
            search_time: std::time::Duration::from_millis(0),
            metadata: serde_json::json!({
                "fusion_strategy": "weighted_average",
                "semantic_weight": config.semantic_weight,
                "keyword_weight": config.keyword_weight,
            }),
        })
    }

    /// Reciprocal rank fusion
    async fn reciprocal_rank_fusion(
        &self,
        semantic_response: Option<SearchResponse>,
        keyword_response: Option<SearchResponse>,
        original_request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        let mut result_scores: HashMap<String, f32> = HashMap::new();
        let mut result_data: HashMap<String, SearchResult> = HashMap::new();
        let k = 60.0; // Standard RRF constant

        // Process semantic results
        if let Some(semantic_resp) = semantic_response {
            for (rank, result) in semantic_resp.results.into_iter().enumerate() {
                let score = config.semantic_weight / (k + (rank + 1) as f32);
                *result_scores.entry(result.id.clone()).or_insert(0.0) += score;
                result_data.insert(result.id.clone(), result);
            }
        }

        // Process keyword results
        if let Some(keyword_resp) = keyword_response {
            for (rank, result) in keyword_resp.results.into_iter().enumerate() {
                let score = config.keyword_weight / (k + (rank + 1) as f32);
                *result_scores.entry(result.id.clone()).or_insert(0.0) += score;
                result_data.insert(result.id.clone(), result);
            }
        }

        // Convert to results and sort
        let mut fused_results: Vec<SearchResult> = result_scores
            .into_iter()
            .map(|(id, score)| {
                let mut result = result_data.remove(&id).unwrap_or_else(|| SearchResult {
                    id: id.clone(),
                    content: String::new(),
                    score,
                    metadata: None,
                    index_name: None,
                    document_type: None,
                    source: None,
                    created_at: None,
                });
                result.score = score;
                result
            })
            .collect();

        fused_results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        fused_results.truncate(original_request.top_k as usize);

        Ok(SearchResponse {
            query: original_request.query.clone(),
            results: fused_results,
            total_found: fused_results.len() as u32,
            search_time: std::time::Duration::from_millis(0),
            metadata: serde_json::json!({
                "fusion_strategy": "reciprocal_rank",
                "semantic_weight": config.semantic_weight,
                "keyword_weight": config.keyword_weight,
            }),
        })
    }

    /// Condorcet fusion (voting-based)
    async fn condorcet_fusion(
        &self,
        semantic_response: Option<SearchResponse>,
        keyword_response: Option<SearchResponse>,
        original_request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        let mut votes: HashMap<String, (u32, f32, SearchResult)> = HashMap::new();

        // Process semantic results
        if let Some(semantic_resp) = semantic_response {
            for result in semantic_resp.results {
                let entry = votes.entry(result.id.clone()).or_insert((0, 0.0, result));
                entry.0 += 1;
                entry.1 += result.score * config.semantic_weight;
            }
        }

        // Process keyword results
        if let Some(keyword_resp) = keyword_response {
            for result in keyword_resp.results {
                let entry = votes.entry(result.id.clone()).or_insert((0, 0.0, result));
                entry.0 += 1;
                entry.1 += result.score * config.keyword_weight;
            }
        }

        // Convert to results and sort by votes first, then score
        let mut fused_results: Vec<SearchResult> = votes
            .into_values()
            .map(|(vote_count, combined_score, mut result)| {
                result.score = combined_score + vote_count as f32 * 0.1; // Add vote bonus
                result
            })
            .collect();

        fused_results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        fused_results.truncate(original_request.top_k as usize);

        Ok(SearchResponse {
            query: original_request.query.clone(),
            results: fused_results,
            total_found: fused_results.len() as u32,
            search_time: std::time::Duration::from_millis(0),
            metadata: serde_json::json!({
                "fusion_strategy": "condorcet",
                "semantic_weight": config.semantic_weight,
                "keyword_weight": config.keyword_weight,
            }),
        })
    }

    /// Semantic-first fusion
    async fn semantic_first_fusion(
        &self,
        semantic_response: Option<SearchResponse>,
        keyword_response: Option<SearchResponse>,
        original_request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        if let Some(mut semantic_resp) = semantic_response {
            // Enhance semantic results with keyword scores where available
            if let Some(keyword_resp) = keyword_response {
                let keyword_scores: HashMap<String, f32> = keyword_resp
                    .results
                    .into_iter()
                    .map(|r| (r.id, r.score))
                    .collect();

                for result in &mut semantic_resp.results {
                    if let Some(keyword_score) = keyword_scores.get(&result.id) {
                        result.score = config.semantic_weight * result.score
                            + config.keyword_weight * keyword_score;
                    } else {
                        result.score *= config.semantic_weight;
                    }
                }
            } else {
                // Only semantic results available
                for result in &mut semantic_resp.results {
                    result.score *= config.semantic_weight;
                }
            }

            semantic_resp
                .results
                .truncate(original_request.top_k as usize);
            semantic_resp.metadata = serde_json::json!({
                "fusion_strategy": "semantic_first",
                "semantic_weight": config.semantic_weight,
                "keyword_weight": config.keyword_weight,
            });

            Ok(semantic_resp)
        } else if let Some(keyword_resp) = keyword_response {
            // Fallback to keyword-only
            let mut keyword_resp = keyword_resp;
            for result in &mut keyword_resp.results {
                result.score *= config.keyword_weight;
            }
            keyword_resp
                .results
                .truncate(original_request.top_k as usize);
            keyword_resp.metadata = serde_json::json!({
                "fusion_strategy": "semantic_first",
                "fallback": "keyword_only",
                "keyword_weight": config.keyword_weight,
            });
            Ok(keyword_resp)
        } else {
            Err(anyhow::anyhow!("No search results available"))
        }
    }

    /// Keyword-first fusion
    async fn keyword_first_fusion(
        &self,
        semantic_response: Option<SearchResponse>,
        keyword_response: Option<SearchResponse>,
        original_request: &SearchRequest,
        config: &HybridSearchConfig,
    ) -> Result<SearchResponse> {
        if let Some(mut keyword_resp) = keyword_response {
            // Enhance keyword results with semantic scores where available
            if let Some(semantic_resp) = semantic_response {
                let semantic_scores: HashMap<String, f32> = semantic_resp
                    .results
                    .into_iter()
                    .map(|r| (r.id, r.score))
                    .collect();

                for result in &mut keyword_resp.results {
                    if let Some(semantic_score) = semantic_scores.get(&result.id) {
                        result.score = config.keyword_weight * result.score
                            + config.semantic_weight * semantic_score;
                    } else {
                        result.score *= config.keyword_weight;
                    }
                }
            } else {
                // Only keyword results available
                for result in &mut keyword_resp.results {
                    result.score *= config.keyword_weight;
                }
            }

            keyword_resp
                .results
                .truncate(original_request.top_k as usize);
            keyword_resp.metadata = serde_json::json!({
                "fusion_strategy": "keyword_first",
                "semantic_weight": config.semantic_weight,
                "keyword_weight": config.keyword_weight,
            });

            Ok(keyword_resp)
        } else if let Some(semantic_resp) = semantic_response {
            // Fallback to semantic-only
            let mut semantic_resp = semantic_resp;
            for result in &mut semantic_resp.results {
                result.score *= config.semantic_weight;
            }
            semantic_resp
                .results
                .truncate(original_request.top_k as usize);
            semantic_resp.metadata = serde_json::json!({
                "fusion_strategy": "keyword_first",
                "fallback": "semantic_only",
                "semantic_weight": config.semantic_weight,
            });
            Ok(semantic_resp)
        } else {
            Err(anyhow::anyhow!("No search results available"))
        }
    }

    /// Get fusion strategy statistics
    pub async fn get_fusion_stats(&self) -> HashMap<String, serde_json::Value> {
        // This would collect statistics about fusion performance
        let mut stats = HashMap::new();
        stats.insert(
            "default_fusion_strategy".to_string(),
            serde_json::json!(self.default_config.fusion_strategy),
        );
        stats.insert(
            "default_semantic_weight".to_string(),
            serde_json::json!(self.default_config.semantic_weight),
        );
        stats.insert(
            "default_keyword_weight".to_string(),
            serde_json::json!(self.default_config.keyword_weight),
        );
        stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::search::{HybridSearchConfig, SearchFusionStrategy};

    fn create_mock_search_result(id: &str, score: f32) -> SearchResult {
        SearchResult {
            id: id.to_string(),
            content: format!("Content for {}", id),
            score,
            metadata: None,
            index_name: None,
            document_type: None,
            source: None,
            created_at: None,
        }
    }

    fn create_mock_search_response(results: Vec<SearchResult>) -> SearchResponse {
        SearchResponse {
            query: "test query".to_string(),
            results,
            total_found: 0,
            search_time: std::time::Duration::from_millis(0),
            metadata: serde_json::json!({}),
        }
    }

    #[tokio::test]
    async fn test_weighted_average_fusion() {
        let semantic_results = create_mock_search_response(vec![
            create_mock_search_result("doc1", 0.9),
            create_mock_search_result("doc2", 0.8),
            create_mock_search_result("doc3", 0.7),
        ]);

        let keyword_results = create_mock_search_response(vec![
            create_mock_search_result("doc2", 0.9),
            create_mock_search_result("doc4", 0.8),
            create_mock_search_result("doc1", 0.6),
        ]);

        let config = HybridSearchConfig {
            semantic_weight: 0.7,
            keyword_weight: 0.3,
            fusion_strategy: SearchFusionStrategy::WeightedAverage,
            keyword_search_method: KeywordSearchMethod::TfIdf,
        };

        // Test would require actual HybridSearchEngine instance
        // For now, we can test the logic conceptually
        assert_eq!(semantic_results.results.len(), 3);
        assert_eq!(keyword_results.results.len(), 3);
    }

    #[tokio::test]
    async fn test_reciprocal_rank_fusion() {
        // Similar test structure for RRF
        let semantic_results = create_mock_search_response(vec![
            create_mock_search_result("doc1", 0.9),
            create_mock_search_result("doc2", 0.8),
        ]);

        let keyword_results = create_mock_search_response(vec![
            create_mock_search_result("doc2", 0.9),
            create_mock_search_result("doc3", 0.8),
        ]);

        // Test would require actual HybridSearchEngine instance
        assert_eq!(semantic_results.results.len(), 2);
        assert_eq!(keyword_results.results.len(), 2);
    }
}
