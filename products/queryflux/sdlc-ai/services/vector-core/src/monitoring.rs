use crate::error::Result;
use prometheus::{Counter, Encoder, Gauge, Histogram, Registry, TextEncoder};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

#[derive(Clone)]
pub struct MetricsService {
    registry: Arc<Registry>,
    counters: Arc<RwLock<HashMap<String, Counter>>>,
    histograms: Arc<RwLock<HashMap<String, Histogram>>>,
    gauges: Arc<RwLock<HashMap<String, Gauge>>>,
    search_metrics: Arc<RwLock<SearchMetrics>>,
}

#[derive(Debug, Default)]
struct SearchMetrics {
    total_searches: u64,
    successful_searches: u64,
    failed_searches: u64,
    total_response_time_ms: u64,
    total_cache_hits: u64,
    total_cache_misses: u64,
    avg_result_count: f64,
    query_stats: HashMap<String, QueryMetrics>,
}

#[derive(Debug, Default)]
struct QueryMetrics {
    count: u64,
    total_response_time_ms: u64,
    total_result_count: u64,
    last_used: Option<Instant>,
}

impl MetricsService {
    pub fn new() -> Self {
        let registry = Arc::new(Registry::new());

        // Pre-register common metrics
        let search_total = Counter::new("vector_searches_total", "Total number of vector searches")
            .expect("Failed to create counter");

        let search_duration = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "vector_search_duration_seconds",
                "Vector search duration in seconds",
            )
            .buckets(vec![0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]),
        )
        .expect("Failed to create histogram");

        let embedding_requests = Counter::new(
            "embedding_requests_total",
            "Total number of embedding requests",
        )
        .expect("Failed to create counter");

        let embedding_duration = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "embedding_duration_seconds",
                "Embedding generation duration in seconds",
            )
            .buckets(vec![0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 50.0]),
        )
        .expect("Failed to create histogram");

        let cache_hits = Counter::new("cache_hits_total", "Total number of cache hits")
            .expect("Failed to create counter");

        let cache_misses = Counter::new("cache_misses_total", "Total number of cache misses")
            .expect("Failed to create counter");

        let active_connections = Gauge::new("active_connections", "Number of active connections")
            .expect("Failed to create gauge");

        registry.register(Box::new(search_total)).unwrap();
        registry.register(Box::new(search_duration)).unwrap();
        registry.register(Box::new(embedding_requests)).unwrap();
        registry.register(Box::new(embedding_duration)).unwrap();
        registry.register(Box::new(cache_hits)).unwrap();
        registry.register(Box::new(cache_misses)).unwrap();
        registry.register(Box::new(active_connections)).unwrap();

        let mut counters = HashMap::new();
        counters.insert("searches_total".to_string(), search_total);
        counters.insert("embedding_requests_total".to_string(), embedding_requests);
        counters.insert("cache_hits_total".to_string(), cache_hits);
        counters.insert("cache_misses_total".to_string(), cache_misses);

        let mut histograms = HashMap::new();
        histograms.insert("search_duration_seconds".to_string(), search_duration);
        histograms.insert("embedding_duration_seconds".to_string(), embedding_duration);

        let mut gauges = HashMap::new();
        gauges.insert("active_connections".to_string(), active_connections);

        Self {
            registry,
            counters: Arc::new(RwLock::new(counters)),
            histograms: Arc::new(RwLock::new(histograms)),
            gauges: Arc::new(RwLock::new(gauges)),
            search_metrics: Arc::new(RwLock::new(SearchMetrics::default())),
        }
    }

    pub async fn record_search_start(&self) {
        if let Some(counter) = self.counters.read().await.get("searches_total") {
            counter.inc();
        }

        let mut metrics = self.search_metrics.write().await;
        metrics.total_searches += 1;
    }

    pub async fn record_search_success(&self, duration: Duration, result_count: usize) {
        let duration_seconds = duration.as_secs_f64();

        if let Some(histogram) = self.histograms.read().await.get("search_duration_seconds") {
            histogram.observe(duration_seconds);
        }

        let mut metrics = self.search_metrics.write().await;
        metrics.successful_searches += 1;
        metrics.total_response_time_ms += duration.as_millis() as u64;

        // Update average result count
        let total_results = metrics.avg_result_count * (metrics.successful_searches - 1) as f64
            + result_count as f64;
        metrics.avg_result_count = total_results / metrics.successful_searches as f64;
    }

    pub async fn record_search_error(&self, duration: Duration, error_message: &str) {
        let duration_seconds = duration.as_secs_f64();

        if let Some(histogram) = self.histograms.read().await.get("search_duration_seconds") {
            histogram.observe(duration_seconds);
        }

        let mut metrics = self.search_metrics.write().await;
        metrics.failed_searches += 1;
        metrics.total_response_time_ms += duration.as_millis() as u64;

        // Record error type metrics
        let error_type = self.categorize_error(error_message);
        let counter_name = format!("search_errors_{}_total", error_type);

        // Create error counter if it doesn't exist
        {
            let mut counters = self.counters.write().await;
            if !counters.contains_key(&counter_name) {
                let counter = Counter::new(&counter_name, &format!("Total {} errors", error_type))
                    .expect("Failed to create error counter");
                self.registry.register(Box::new(counter.clone())).unwrap();
                counters.insert(counter_name.clone(), counter);
            }
        }

        if let Some(counter) = self.counters.read().await.get(&counter_name) {
            counter.inc();
        }
    }

    pub async fn record_embedding_request(&self, duration: Duration, text_count: usize) {
        let duration_seconds = duration.as_secs_f64();

        if let Some(counter) = self.counters.read().await.get("embedding_requests_total") {
            counter.inc();
        }

        if let Some(histogram) = self
            .histograms
            .read()
            .await
            .get("embedding_duration_seconds")
        {
            histogram.observe(duration_seconds);
        }

        // Record batch size metrics
        let gauge_name = "embedding_batch_size".to_string();
        {
            let mut gauges = self.gauges.write().await;
            if !gauges.contains_key(&gauge_name) {
                let gauge = Gauge::new(&gauge_name, "Current embedding batch size")
                    .expect("Failed to create gauge");
                self.registry.register(Box::new(gauge.clone())).unwrap();
                gauges.insert(gauge_name.clone(), gauge);
            }
        }

        if let Some(gauge) = self.gauges.read().await.get(&gauge_name) {
            gauge.set(text_count as f64);
        }
    }

    pub async fn record_cache_hit(&self) {
        if let Some(counter) = self.counters.read().await.get("cache_hits_total") {
            counter.inc();
        }

        let mut metrics = self.search_metrics.write().await;
        metrics.total_cache_hits += 1;
    }

    pub async fn record_cache_miss(&self) {
        if let Some(counter) = self.counters.read().await.get("cache_misses_total") {
            counter.inc();
        }

        let mut metrics = self.search_metrics.write().await;
        metrics.total_cache_misses += 1;
    }

    pub async fn record_query_performance(
        &self,
        query_hash: &str,
        duration: Duration,
        result_count: usize,
    ) {
        let mut metrics = self.search_metrics.write().await;
        let query_metrics = metrics
            .query_stats
            .entry(query_hash.to_string())
            .or_insert_with(QueryMetrics::default);

        query_metrics.count += 1;
        query_metrics.total_response_time_ms += duration.as_millis() as u64;
        query_metrics.total_result_count += result_count as u64;
        query_metrics.last_used = Some(Instant::now());
    }

    pub async fn increment_active_connections(&self) {
        if let Some(gauge) = self.gauges.read().await.get("active_connections") {
            gauge.inc();
        }
    }

    pub async fn decrement_active_connections(&self) {
        if let Some(gauge) = self.gauges.read().await.get("active_connections") {
            gauge.dec();
        }
    }

    pub async fn record_vector_count(&self, index_id: &str, count: usize) {
        let gauge_name = format!("vectors_in_index_{}", index_id);

        {
            let mut gauges = self.gauges.write().await;
            if !gauges.contains_key(&gauge_name) {
                let gauge = Gauge::new(
                    &gauge_name,
                    &format!("Number of vectors in index {}", index_id),
                )
                .expect("Failed to create gauge");
                self.registry.register(Box::new(gauge.clone())).unwrap();
                gauges.insert(gauge_name.clone(), gauge);
            }
        }

        if let Some(gauge) = self.gauges.read().await.get(&gauge_name) {
            gauge.set(count as f64);
        }
    }

    pub async fn record_embedding_provider_usage(&self, provider: &str, success: bool) {
        let counter_name = if success {
            format!("embedding_provider_{}_success_total", provider)
        } else {
            format!("embedding_provider_{}_error_total", provider)
        };

        {
            let mut counters = self.counters.write().await;
            if !counters.contains_key(&counter_name) {
                let counter = Counter::new(
                    &counter_name,
                    &format!(
                        "Total {} embeddings for {}",
                        if success { "successful" } else { "failed" },
                        provider
                    ),
                )
                .expect("Failed to create counter");
                self.registry.register(Box::new(counter.clone())).unwrap();
                counters.insert(counter_name.clone(), counter);
            }
        }

        if let Some(counter) = self.counters.read().await.get(&counter_name) {
            counter.inc();
        }
    }

    pub async fn export(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();

        encoder.encode(&metric_families, &mut buffer).unwrap();

        String::from_utf8(buffer).unwrap_or_else(|_| "# Failed to encode metrics\n".to_string())
    }

    pub async fn get_search_analytics(&self) -> SearchAnalyticsReport {
        let metrics = self.search_metrics.read().await;
        let total_requests = metrics.total_cache_hits + metrics.total_cache_misses;
        let cache_hit_rate = if total_requests > 0 {
            metrics.total_cache_hits as f64 / total_requests as f64
        } else {
            0.0
        };

        let error_rate = if metrics.total_searches > 0 {
            metrics.failed_searches as f64 / metrics.total_searches as f64
        } else {
            0.0
        };

        let avg_response_time = if metrics.successful_searches > 0 {
            metrics.total_response_time_ms as f64 / metrics.successful_searches as f64
        } else {
            0.0
        };

        // Get top queries
        let mut top_queries: Vec<_> = metrics
            .query_stats
            .iter()
            .map(|(hash, stats)| QueryStatsReport {
                query_hash: hash.clone(),
                count: stats.count,
                avg_response_time_ms: if stats.count > 0 {
                    stats.total_response_time_ms as f64 / stats.count as f64
                } else {
                    0.0
                },
                avg_result_count: if stats.count > 0 {
                    stats.total_result_count as f64 / stats.count as f64
                } else {
                    0.0
                },
            })
            .collect();

        top_queries.sort_by(|a, b| b.count.cmp(&a.count));
        top_queries.truncate(10); // Top 10 queries

        SearchAnalyticsReport {
            total_searches: metrics.total_searches,
            successful_searches: metrics.successful_searches,
            failed_searches: metrics.failed_searches,
            avg_response_time_ms,
            cache_hit_rate,
            error_rate,
            avg_result_count: metrics.avg_result_count,
            top_queries,
        }
    }

    pub async fn cleanup_old_query_metrics(&self, max_age: Duration) {
        let mut metrics = self.search_metrics.write().await;
        let now = Instant::now();

        metrics.query_stats.retain(|_, stats| {
            stats
                .last_used
                .map(|last| now.duration_since(last) < max_age)
                .unwrap_or(false)
        });

        let old_count = metrics.query_stats.len();
        info!("Cleaned up {} old query metrics", old_count);
    }

    fn categorize_error(&self, error_message: &str) -> &'static str {
        match error_message.to_lowercase().as_str() {
            msg if msg.contains("timeout") => "timeout",
            msg if msg.contains("rate limit") => "rate_limit",
            msg if msg.contains("vector") => "vector_error",
            msg if msg.contains("embedding") => "embedding_error",
            msg if msg.contains("database") || msg.contains("db") => "database_error",
            msg if msg.contains("cache") => "cache_error",
            msg if msg.contains("validation") => "validation_error",
            msg if msg.contains("network") || msg.contains("connection") => "network_error",
            _ => "unknown",
        }
    }
}

// Performance monitoring for A/B testing
pub struct ABTestMetrics {
    test_name: String,
    variant_a_metrics: Arc<RwLock<VariantMetrics>>,
    variant_b_metrics: Arc<RwLock<VariantMetrics>>,
    current_assignment: Arc<RwLock<HashMap<String, char>>>, // user_id -> variant
}

#[derive(Debug, Default)]
struct VariantMetrics {
    requests: u64,
    successful_requests: u64,
    total_response_time_ms: u64,
    avg_result_count: f64,
    user_satisfaction_scores: Vec<f64>,
}

impl ABTestMetrics {
    pub fn new(test_name: String) -> Self {
        Self {
            test_name,
            variant_a_metrics: Arc::new(RwLock::new(VariantMetrics::default())),
            variant_b_metrics: Arc::new(RwLock::new(VariantMetrics::default())),
            current_assignment: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn assign_variant(&self, user_id: &str) -> char {
        let mut assignments = self.current_assignment.write().await;

        if let Some(&variant) = assignments.get(user_id) {
            return variant;
        }

        // Assign variant based on user ID hash (consistent assignment)
        let hash = self.hash_user_id(user_id);
        let variant = if hash % 2 == 0 { 'A' } else { 'B' };

        assignments.insert(user_id.to_string(), variant);
        variant
    }

    pub async fn record_search(
        &self,
        user_id: &str,
        variant: char,
        duration: Duration,
        result_count: usize,
    ) {
        let metrics = match variant {
            'A' => &self.variant_a_metrics,
            'B' => &self.variant_b_metrics,
            _ => return,
        };

        let mut metrics = metrics.write().await;
        metrics.requests += 1;
        metrics.total_response_time_ms += duration.as_millis() as u64;

        // Update average result count
        let total_results =
            metrics.avg_result_count * (metrics.requests - 1) as f64 + result_count as f64;
        metrics.avg_result_count = total_results / metrics.requests as f64;
    }

    pub async fn record_success(&self, variant: char) {
        let metrics = match variant {
            'A' => &self.variant_a_metrics,
            'B' => &self.variant_b_metrics,
            _ => return,
        };

        metrics.write().await.successful_requests += 1;
    }

    pub async fn record_satisfaction(&self, variant: char, score: f64) {
        let metrics = match variant {
            'A' => &self.variant_a_metrics,
            'B' => &self.variant_b_metrics,
            _ => return,
        };

        metrics.write().await.user_satisfaction_scores.push(score);
    }

    pub async fn get_results(&self) -> ABTestResults {
        let variant_a = self.variant_a_metrics.read().await;
        let variant_b = self.variant_b_metrics.read().await;

        ABTestResults {
            test_name: self.test_name.clone(),
            variant_a: VariantResults {
                requests: variant_a.requests,
                success_rate: if variant_a.requests > 0 {
                    variant_a.successful_requests as f64 / variant_a.requests as f64
                } else {
                    0.0
                },
                avg_response_time_ms: if variant_a.requests > 0 {
                    variant_a.total_response_time_ms as f64 / variant_a.requests as f64
                } else {
                    0.0
                },
                avg_result_count: variant_a.avg_result_count,
                avg_satisfaction_score: if !variant_a.user_satisfaction_scores.is_empty() {
                    variant_a.user_satisfaction_scores.iter().sum::<f64>()
                        / variant_a.user_satisfaction_scores.len() as f64
                } else {
                    0.0
                },
            },
            variant_b: VariantResults {
                requests: variant_b.requests,
                success_rate: if variant_b.requests > 0 {
                    variant_b.successful_requests as f64 / variant_b.requests as f64
                } else {
                    0.0
                },
                avg_response_time_ms: if variant_b.requests > 0 {
                    variant_b.total_response_time_ms as f64 / variant_b.requests as f64
                } else {
                    0.0
                },
                avg_result_count: variant_b.avg_result_count,
                avg_satisfaction_score: if !variant_b.user_satisfaction_scores.is_empty() {
                    variant_b.user_satisfaction_scores.iter().sum::<f64>()
                        / variant_b.user_satisfaction_scores.len() as f64
                } else {
                    0.0
                },
            },
        }
    }

    fn hash_user_id(&self, user_id: &str) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        user_id.hash(&mut hasher);
        hasher.finish()
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchAnalyticsReport {
    pub total_searches: u64,
    pub successful_searches: u64,
    pub failed_searches: u64,
    pub avg_response_time_ms: f64,
    pub cache_hit_rate: f64,
    pub error_rate: f64,
    pub avg_result_count: f64,
    pub top_queries: Vec<QueryStatsReport>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QueryStatsReport {
    pub query_hash: String,
    pub count: u64,
    pub avg_response_time_ms: f64,
    pub avg_result_count: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ABTestResults {
    pub test_name: String,
    pub variant_a: VariantResults,
    pub variant_b: VariantResults,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VariantResults {
    pub requests: u64,
    pub success_rate: f64,
    pub avg_response_time_ms: f64,
    pub avg_result_count: f64,
    pub avg_satisfaction_score: f64,
}

impl Default for MetricsService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn test_metrics_recording() {
        let metrics = MetricsService::new();

        metrics.record_search_start().await;
        metrics
            .record_search_success(Duration::from_millis(100), 5)
            .await;

        let analytics = metrics.get_search_analytics().await;
        assert_eq!(analytics.total_searches, 1);
        assert_eq!(analytics.successful_searches, 1);
        assert_eq!(analytics.avg_response_time_ms, 100.0);
        assert_eq!(analytics.avg_result_count, 5.0);
    }

    #[tokio::test]
    async fn test_cache_metrics() {
        let metrics = MetricsService::new();

        metrics.record_cache_hit().await;
        metrics.record_cache_miss().await;
        metrics.record_cache_hit().await;

        let analytics = metrics.get_search_analytics().await;
        assert_eq!(analytics.cache_hit_rate, 2.0 / 3.0);
    }

    #[tokio::test]
    async fn test_ab_test_assignment() {
        let ab_test = ABTestMetrics::new("test_search".to_string());

        let variant1 = ab_test.assign_variant("user1").await;
        let variant2 = ab_test.assign_variant("user1").await; // Should be consistent
        let variant3 = ab_test.assign_variant("user2").await;

        assert_eq!(variant1, variant2);
        // user1 and user2 might get same or different variants, that's fine
    }
}
