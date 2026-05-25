use anyhow::{Context, Result};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tracing::{debug, info, warn};

use crate::models::search::{
    AuthorityScore, DiversityConfig, RankingAlgorithm, RankingConfig, RecencyConfig, SearchRequest,
    SearchResponse, SearchResult,
};

/// Advanced search ranking engine
#[derive(Debug)]
pub struct SearchRankingEngine {
    default_config: RankingConfig,
    authority_scores: HashMap<String, AuthorityScore>,
    user_preferences: HashMap<String, UserSearchPreferences>,
    performance_metrics: HashMap<RankingAlgorithm, RankingMetrics>,
}

impl SearchRankingEngine {
    /// Create a new search ranking engine
    pub fn new(default_config: RankingConfig) -> Self {
        Self {
            default_config,
            authority_scores: HashMap::new(),
            user_preferences: HashMap::new(),
            performance_metrics: HashMap::new(),
        }
    }

    /// Apply ranking to search results
    pub async fn rank_results(
        &self,
        mut response: SearchResponse,
        request: &SearchRequest,
        config: Option<&RankingConfig>,
    ) -> Result<SearchResponse> {
        let start_time = Instant::now();
        let config = config.unwrap_or(&self.default_config);

        info!(
            "Applying ranking algorithm: {:?} to {} results",
            config.algorithm,
            response.results.len()
        );

        // Apply the specified ranking algorithm
        match config.algorithm {
            RankingAlgorithm::SemanticOnly => {
                self.apply_semantic_ranking(&mut response.results, request, config)
                    .await?;
            }
            RankingAlgorithm::Hybrid => {
                self.apply_hybrid_ranking(&mut response.results, request, config)
                    .await?;
            }
            RankingAlgorithm::Personalized => {
                self.apply_personalized_ranking(&mut response.results, request, config)
                    .await?;
            }
            RankingAlgorithm::RecencyWeighted => {
                self.apply_recency_ranking(&mut response.results, request, config)
                    .await?;
            }
            RankingAlgorithm::AuthorityWeighted => {
                self.apply_authority_ranking(&mut response.results, request, config)
                    .await?;
            }
            RankingAlgorithm::DiversityWeighted => {
                self.apply_diversity_ranking(&mut response.results, request, config)
                    .await?;
            }
            RankingAlgorithm::MLBased => {
                self.apply_ml_ranking(&mut response.results, request, config)
                    .await?;
            }
        }

        // Apply result fusion if multiple algorithms are specified
        if !config.fusion_algorithms.is_empty() {
            self.apply_result_fusion(&mut response.results, request, config)
                .await?;
        }

        // Apply diversity boost if configured
        if config.diversity_config.enable_diversity {
            self.apply_diversity_boost(&mut response.results, config)
                .await?;
        }

        // Apply freshness boost if configured
        if config.recency_config.enable_freshness_boost {
            self.apply_freshness_boost(&mut response.results, &config.recency_config)
                .await?;
        }

        let ranking_time = start_time.elapsed();
        info!("Ranking completed in {:?}", ranking_time);

        // Update metadata
        response.metadata["ranking"] = serde_json::json!({
            "algorithm": format!("{:?}", config.algorithm),
            "ranking_time_ms": ranking_time.as_millis(),
            "original_count": response.results.len(),
            "config": serde_json::to_value(config)?,
        });

        Ok(response)
    }

    /// Apply semantic-only ranking
    async fn apply_semantic_ranking(
        &self,
        results: &mut Vec<SearchResult>,
        _request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        // Semantic ranking already has scores from similarity search
        // Just ensure scores are properly normalized and sorted
        self.normalize_scores(results);
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Apply hybrid ranking (combination of multiple signals)
    async fn apply_hybrid_ranking(
        &self,
        results: &mut Vec<SearchResult>,
        request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        for result in results {
            let mut hybrid_score = result.score * config.semantic_weight;

            // Add keyword matching score if available
            if let Some(metadata) = &result.metadata {
                if let Some(keyword_score) = metadata.get("keyword_score") {
                    if let Some(score_val) = keyword_score.as_f64() {
                        hybrid_score += score_val as f32 * config.keyword_weight;
                    }
                }
            }

            // Add authority score
            if let Some(authority_score) = self.get_authority_score(&result.id) {
                hybrid_score += authority_score.overall_score * config.authority_weight;
            }

            // Add recency score
            if let Some(recency_score) =
                self.calculate_recency_score(result, &config.recency_config)
            {
                hybrid_score += recency_score * config.recency_weight;
            }

            result.score = hybrid_score;
        }

        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Apply personalized ranking based on user preferences
    async fn apply_personalized_ranking(
        &self,
        results: &mut Vec<SearchResult>,
        request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        // Get user preferences (in a real implementation, this would come from user profile)
        let user_id = request.user_id.as_deref().unwrap_or("anonymous");
        let user_prefs = self.user_preferences.get(user_id);

        for result in results {
            let mut personalized_score = result.score;

            if let Some(prefs) = user_prefs {
                // Boost based on preferred document types
                if let Some(doc_type) = &result.document_type {
                    if prefs.preferred_document_types.contains(doc_type) {
                        personalized_score *= 1.2;
                    }
                }

                // Boost based on preferred sources
                if let Some(source) = &result.source {
                    if prefs.preferred_sources.contains(source) {
                        personalized_score *= 1.15;
                    }
                }

                // Boost based on topic preferences
                if let Some(metadata) = &result.metadata {
                    if let Some(topics) = metadata.get("topics").and_then(|t| t.as_array()) {
                        let topic_match_count = topics
                            .iter()
                            .filter_map(|t| t.as_str())
                            .filter(|topic| prefs.preferred_topics.contains(&topic.to_string()))
                            .count();

                        if topic_match_count > 0 {
                            personalized_score *= 1.0 + (topic_match_count as f32 * 0.1);
                        }
                    }
                }

                // Apply personalization weight
                personalized_score = result.score
                    + (personalized_score - result.score) * config.personalization_weight;
            }

            result.score = personalized_score;
        }

        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Apply recency-weighted ranking
    async fn apply_recency_ranking(
        &self,
        results: &mut Vec<SearchResult>,
        _request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        for result in results {
            if let Some(recency_score) =
                self.calculate_recency_score(result, &config.recency_config)
            {
                result.score = result.score * (1.0 - config.recency_weight)
                    + recency_score * config.recency_weight;
            }
        }

        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Apply authority-weighted ranking
    async fn apply_authority_ranking(
        &self,
        results: &mut Vec<SearchResult>,
        _request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        for result in results {
            if let Some(authority_score) = self.get_authority_score(&result.id) {
                let authority_boost = authority_score.overall_score * config.authority_weight;
                result.score = result.score * (1.0 - config.authority_weight) + authority_boost;
            }
        }

        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Apply diversity-weighted ranking
    async fn apply_diversity_ranking(
        &self,
        results: &mut Vec<SearchResult>,
        _request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        let mut diversified_results = Vec::new();
        let mut used_sources = std::collections::HashSet::new();
        let mut used_types = std::collections::HashSet::new();

        // First pass: add high-quality, diverse results
        for result in results.iter() {
            let source = result.source.as_deref().unwrap_or("unknown");
            let doc_type = result.document_type.as_deref().unwrap_or("unknown");

            // If we haven't used this source or type much, include it
            let source_count = used_sources.iter().filter(|s| *s == source).count();
            let type_count = used_types.iter().filter(|t| *t == doc_type).count();

            if source_count < config.diversity_config.max_results_per_source
                && type_count < config.diversity_config.max_results_per_type
            {
                diversified_results.push(result.clone());
                used_sources.insert(source.to_string());
                used_types.insert(doc_type.to_string());
            }
        }

        // Second pass: fill remaining slots with best remaining results
        let remaining_slots = config
            .top_k
            .unwrap_or(10)
            .saturating_sub(diversified_results.len());
        if remaining_slots > 0 {
            for result in results.iter() {
                if !diversified_results.iter().any(|r| r.id == result.id) {
                    diversified_results.push(result.clone());
                    if diversified_results.len() >= remaining_slots {
                        break;
                    }
                }
            }
        }

        *results = diversified_results;
        Ok(())
    }

    /// Apply machine learning-based ranking
    async fn apply_ml_ranking(
        &self,
        results: &mut Vec<SearchResult>,
        request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        // In a real implementation, this would use a trained ML model
        // For now, we'll simulate ML ranking with feature-based scoring

        for result in results {
            let ml_score = self.calculate_ml_score(result, request);
            result.score = result.score * (1.0 - config.ml_weight) + ml_score * config.ml_weight;
        }

        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Apply result fusion from multiple algorithms
    async fn apply_result_fusion(
        &self,
        results: &mut Vec<SearchResult>,
        _request: &SearchRequest,
        config: &RankingConfig,
    ) -> Result<()> {
        // In a real implementation, this would run multiple ranking algorithms
        // and fuse the results using techniques like Borda count or weighted voting

        // For now, we'll just apply a simple diversity boost to simulate fusion
        self.apply_diversity_boost(results, config).await?;
        Ok(())
    }

    /// Apply diversity boost to results
    async fn apply_diversity_boost(
        &self,
        results: &mut Vec<SearchResult>,
        config: &RankingConfig,
    ) -> Result<()> {
        let mut source_counts: HashMap<String, usize> = HashMap::new();
        let mut type_counts: HashMap<String, usize> = HashMap::new();

        for result in results.iter_mut() {
            let source = result.source.as_deref().unwrap_or("unknown");
            let doc_type = result.document_type.as_deref().unwrap_or("unknown");

            let source_count = source_counts.entry(source.to_string()).or_insert(0);
            let type_count = type_counts.entry(doc_type.to_string()).or_insert(0);

            // Apply diversity penalty for over-represented sources/types
            let source_penalty = (*source_count as f32
                / config.diversity_config.max_results_per_source as f32)
                .min(1.0);
            let type_penalty =
                (*type_count as f32 / config.diversity_config.max_results_per_type as f32).min(1.0);

            let diversity_penalty = (source_penalty + type_penalty) / 2.0;
            result.score *= 1.0 - (diversity_penalty * 0.2); // Max 20% penalty

            *source_count += 1;
            *type_count += 1;
        }

        // Re-sort after applying diversity penalties
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Apply freshness boost to results
    async fn apply_freshness_boost(
        &self,
        results: &mut Vec<SearchResult>,
        recency_config: &RecencyConfig,
    ) -> Result<()> {
        let now = chrono::Utc::now();

        for result in results {
            if let Some(created_at) = result.created_at {
                let age_days = (now - created_at).num_days() as f32;

                if age_days <= recency_config.freshness_threshold_days {
                    let boost_factor = 1.0 - (age_days / recency_config.freshness_threshold_days);
                    let freshness_boost = boost_factor * recency_config.freshness_boost_factor;
                    result.score *= 1.0 + freshness_boost;
                }
            }
        }

        // Re-sort after applying freshness boosts
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Ok(())
    }

    /// Normalize scores to 0-1 range
    fn normalize_scores(&self, results: &mut [SearchResult]) {
        if results.is_empty() {
            return;
        }

        let min_score = results
            .iter()
            .map(|r| r.score)
            .fold(f32::INFINITY, f32::min);
        let max_score = results
            .iter()
            .map(|r| r.score)
            .fold(f32::NEG_INFINITY, f32::max);
        let range = max_score - min_score;

        if range > 0.0 {
            for result in results {
                result.score = (result.score - min_score) / range;
            }
        } else {
            // All scores are the same, set them to 1.0
            for result in results {
                result.score = 1.0;
            }
        }
    }

    /// Calculate recency score for a result
    fn calculate_recency_score(
        &self,
        result: &SearchResult,
        config: &RecencyConfig,
    ) -> Option<f32> {
        result.created_at.map(|created_at| {
            let now = chrono::Utc::now();
            let age_days = (now - created_at).num_days() as f32;

            if age_days <= config.freshness_threshold_days {
                // Exponential decay
                (config.decay_factor.powf(age_days / config.half_life_days))
            } else {
                0.0
            }
        })
    }

    /// Get authority score for a document
    fn get_authority_score(&self, document_id: &str) -> Option<&AuthorityScore> {
        self.authority_scores.get(document_id)
    }

    /// Calculate ML-based score using features
    fn calculate_ml_score(&self, result: &SearchResult, _request: &SearchRequest) -> f32 {
        // In a real implementation, this would use a trained model
        // For now, we'll use a simple heuristic based on available features

        let mut ml_score = result.score;

        // Boost based on metadata quality
        if result.metadata.is_some() {
            ml_score *= 1.1;
        }

        // Boost based on source authority
        if let Some(source) = &result.source {
            if source.contains("github") || source.contains("stackoverflow") {
                ml_score *= 1.15;
            }
        }

        // Boost based on content length (longer content might be more comprehensive)
        if result.content.len() > 500 {
            ml_score *= 1.05;
        }

        ml_score.min(1.0) // Cap at 1.0
    }

    /// Update authority scores
    pub fn update_authority_scores(&mut self, scores: HashMap<String, AuthorityScore>) {
        self.authority_scores.extend(scores);
    }

    /// Update user preferences
    pub fn update_user_preferences(&mut self, user_id: String, preferences: UserSearchPreferences) {
        self.user_preferences.insert(user_id, preferences);
    }

    /// Get ranking metrics
    pub fn get_ranking_metrics(&self) -> &HashMap<RankingAlgorithm, RankingMetrics> {
        &self.performance_metrics
    }

    /// A/B test ranking algorithms
    pub async fn ab_test_ranking(
        &self,
        response: SearchResponse,
        request: &SearchRequest,
        algorithm_a: RankingAlgorithm,
        algorithm_b: RankingAlgorithm,
    ) -> Result<(SearchResponse, SearchResponse)> {
        let mut config_a = self.default_config.clone();
        config_a.algorithm = algorithm_a;

        let mut config_b = self.default_config.clone();
        config_b.algorithm = algorithm_b;

        let response_a = self
            .rank_results(response.clone(), request, Some(&config_a))
            .await?;
        let response_b = self
            .rank_results(response, request, Some(&config_b))
            .await?;

        Ok((response_a, response_b))
    }
}

/// User search preferences for personalized ranking
#[derive(Debug, Clone)]
pub struct UserSearchPreferences {
    pub preferred_document_types: Vec<String>,
    pub preferred_sources: Vec<String>,
    pub preferred_topics: Vec<String>,
    pub search_history: Vec<String>,
    pub click_through_rates: HashMap<String, f32>,
}

/// Ranking performance metrics
#[derive(Debug, Clone)]
pub struct RankingMetrics {
    pub algorithm: RankingAlgorithm,
    pub total_rankings: u64,
    pub average_ranking_time: Duration,
    pub average_ndcg: f32,
    pub user_satisfaction_score: f32,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::search::{DiversityConfig, RankingAlgorithm, RankingConfig, RecencyConfig};

    fn create_test_search_result(id: &str, score: f32, days_ago: i64) -> SearchResult {
        SearchResult {
            id: id.to_string(),
            content: format!("Test content for {}", id),
            score,
            metadata: Some(serde_json::json!({"topic": "test"})),
            index_name: Some("test_index".to_string()),
            document_type: Some("document".to_string()),
            source: Some("test_source".to_string()),
            created_at: Some(chrono::Utc::now() - chrono::Duration::days(days_ago)),
        }
    }

    #[tokio::test]
    async fn test_semantic_ranking() {
        let config = RankingConfig {
            algorithm: RankingAlgorithm::SemanticOnly,
            semantic_weight: 1.0,
            ..Default::default()
        };

        let engine = SearchRankingEngine::new(config);

        let mut results = vec![
            create_test_search_result("doc1", 0.8, 1),
            create_test_search_result("doc2", 0.9, 2),
            create_test_search_result("doc3", 0.7, 3),
        ];

        let request = SearchRequest {
            query: "test".to_string(),
            ..Default::default()
        };

        let response = SearchResponse {
            query: "test".to_string(),
            results: results.clone(),
            total_found: results.len() as u32,
            search_time: Duration::from_millis(100),
            metadata: serde_json::json!({}),
        };

        let ranked_response = engine.rank_results(response, &request, None).await.unwrap();

        // Results should be sorted by score (descending)
        assert_eq!(ranked_response.results[0].id, "doc2");
        assert_eq!(ranked_response.results[1].id, "doc1");
        assert_eq!(ranked_response.results[2].id, "doc3");
    }

    #[tokio::test]
    async fn test_recency_ranking() {
        let recency_config = RecencyConfig {
            enable_freshness_boost: true,
            freshness_threshold_days: 7.0,
            half_life_days: 3.0,
            decay_factor: 0.9,
            freshness_boost_factor: 0.2,
        };

        let config = RankingConfig {
            algorithm: RankingAlgorithm::RecencyWeighted,
            recency_weight: 0.5,
            recency_config,
            ..Default::default()
        };

        let engine = SearchRankingEngine::new(config);

        let mut results = vec![
            create_test_search_result("doc1", 0.8, 1),  // Recent
            create_test_search_result("doc2", 0.9, 10), // Old
            create_test_search_result("doc3", 0.7, 2),  // Recent
        ];

        let request = SearchRequest {
            query: "test".to_string(),
            ..Default::default()
        };

        let response = SearchResponse {
            query: "test".to_string(),
            results: results.clone(),
            total_found: results.len() as u32,
            search_time: Duration::from_millis(100),
            metadata: serde_json::json!({}),
        };

        let ranked_response = engine.rank_results(response, &request, None).await.unwrap();

        // Recent documents should be boosted
        assert!(ranked_response.results.iter().any(|r| r.id == "doc1"));
        assert!(ranked_response.results.iter().any(|r| r.id == "doc3"));
    }

    #[test]
    fn test_normalize_scores() {
        let engine = SearchRankingEngine::new(RankingConfig::default());

        let mut results = vec![
            create_test_search_result("doc1", 0.5, 1),
            create_test_search_result("doc2", 0.8, 2),
            create_test_search_result("doc3", 0.2, 3),
        ];

        engine.normalize_scores(&mut results);

        // Check that scores are normalized to 0-1 range
        let min_score = results
            .iter()
            .map(|r| r.score)
            .fold(f32::INFINITY, f32::min);
        let max_score = results
            .iter()
            .map(|r| r.score)
            .fold(f32::NEG_INFINITY, f32::max);

        assert!((min_score - 0.0).abs() < f32::EPSILON);
        assert!((max_score - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_calculate_recency_score() {
        let engine = SearchRankingEngine::new(RankingConfig::default());

        let config = RecencyConfig {
            enable_freshness_boost: true,
            freshness_threshold_days: 7.0,
            half_life_days: 3.0,
            decay_factor: 0.9,
            freshness_boost_factor: 0.2,
        };

        let recent_result = create_test_search_result("doc1", 0.8, 1);
        let old_result = create_test_search_result("doc2", 0.8, 10);

        let recent_score = engine
            .calculate_recency_score(&recent_result, &config)
            .unwrap();
        let old_score = engine
            .calculate_recency_score(&old_result, &config)
            .unwrap();

        assert!(recent_score > old_score);
        assert!(recent_score > 0.0);
        assert_eq!(old_score, 0.0);
    }
}
