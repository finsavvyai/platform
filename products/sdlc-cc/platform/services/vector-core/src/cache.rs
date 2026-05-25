use crate::config::CacheConfig;
use crate::error::{AppError, Result};
use async_trait::async_trait;
use redis::{AsyncCommands, Client, Connection};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, warn};

#[derive(Clone)]
pub struct CacheService {
    client: Client,
    config: CacheConfig,
}

#[async_trait]
pub trait Cache {
    async fn get<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de> + Send;

    async fn set<T>(&self, key: &str, value: &T, ttl: Option<Duration>) -> Result<()>
    where
        T: Serialize + Send + Sync;

    async fn delete(&self, key: &str) -> Result<bool>;

    async fn exists(&self, key: &str) -> Result<bool>;

    async fn expire(&self, key: &str, ttl: Duration) -> Result<bool>;

    async fn clear_pattern(&self, pattern: &str) -> Result<usize>;
}

impl CacheService {
    pub async fn new(config: &CacheConfig) -> Result<Self> {
        let client = Client::open(config.redis_url.clone()).map_err(|e| AppError::Redis(e))?;

        // Test connection
        let mut conn = client.get_async_connection().await.map_err(|e| {
            error!("Failed to connect to Redis: {}", e);
            AppError::Redis(e)
        })?;

        // Set a test key to verify connection
        let _: redis::RedisResult<String> = conn.set("__health_check__", "ok").await;
        let _: redis::RedisResult<i32> = conn.del("__health_check__").await;

        debug!("Redis cache service initialized successfully");

        Ok(CacheService {
            client,
            config: config.clone(),
        })
    }

    async fn get_connection(&self) -> Result<redis::aio::Connection> {
        self.client
            .get_async_connection()
            .await
            .map_err(|e| AppError::Redis(e))
    }

    // Specialized cache methods for different use cases

    pub async fn cache_search_results<T>(&self, key: &str, results: &T) -> Result<()>
    where
        T: Serialize + Send + Sync,
    {
        let ttl = Duration::from_secs(self.config.search_cache_ttl_seconds);
        self.set(key, results, Some(ttl)).await
    }

    pub async fn get_cached_search_results<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de> + Send,
    {
        self.get(key).await
    }

    pub async fn cache_embeddings<T>(&self, key: &str, embeddings: &T) -> Result<()>
    where
        T: Serialize + Send + Sync,
    {
        let ttl = Duration::from_secs(self.config.embedding_cache_ttl_seconds);
        self.set(key, embeddings, Some(ttl)).await
    }

    pub async fn get_cached_embeddings<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de> + Send,
    {
        self.get(key).await
    }

    pub async fn invalidate_tenant_cache(&self, tenant_id: &str) -> Result<usize> {
        let patterns = vec![
            format!("search:{}:*", tenant_id),
            format!("embed:{}:*", tenant_id),
            format!("index:{}:*", tenant_id),
        ];

        let mut total_invalidated = 0;
        for pattern in patterns {
            let count = self.clear_pattern(&pattern).await?;
            total_invalidated += count;
            debug!(
                "Invalidated {} cache entries for tenant {}",
                count, tenant_id
            );
        }

        Ok(total_invalidated)
    }

    pub async fn invalidate_index_cache(&self, index_id: &str) -> Result<usize> {
        let pattern = format!("index:*:{}", index_id);
        let count = self.clear_pattern(&pattern).await?;
        debug!("Invalidated {} cache entries for index {}", count, index_id);
        Ok(count)
    }

    // Cache warming and preloading
    pub async fn warm_search_cache(
        &self,
        tenant_id: &str,
        popular_queries: &[String],
    ) -> Result<()> {
        for query in popular_queries {
            let cache_key = format!("search:{}:{}", tenant_id, Self::hash_query(query));

            // Check if already cached
            if self.exists(&cache_key).await? {
                continue;
            }

            // This would trigger a background search to warm the cache
            // Implementation would depend on search service integration
            debug!("Warming cache for query: {}", query);
        }

        Ok(())
    }

    fn hash_query(query: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        query.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    // Cache statistics and monitoring
    pub async fn get_cache_stats(&self) -> Result<CacheStats> {
        let mut conn = self.get_connection().await?;

        let info: String = redis::cmd("INFO")
            .arg("memory")
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Redis(e))?;

        // Parse Redis info for memory usage
        let used_memory = Self::parse_memory_info(&info);

        let db_size: i64 = redis::cmd("DBSIZE")
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Redis(e))?;

        Ok(CacheStats {
            used_memory_bytes: used_memory,
            max_memory_bytes: self.config.max_memory_mb * 1024 * 1024,
            total_keys: db_size as usize,
            hit_rate: 0.0, // Would need to track this separately
        })
    }

    fn parse_memory_info(info: &str) -> usize {
        info.lines()
            .find(|line| line.starts_with("used_memory:"))
            .and_then(|line| line.split(':').nth(1))
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0)
    }
}

#[async_trait]
impl Cache for CacheService {
    async fn get<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de> + Send,
    {
        let mut conn = self.get_connection().await?;

        let result: Option<String> = conn.get(key).await.map_err(|e| AppError::Redis(e))?;

        match result {
            Some(data) => {
                let value: T =
                    serde_json::from_str(&data).map_err(|e| AppError::Serialization(e))?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    async fn set<T>(&self, key: &str, value: &T, ttl: Option<Duration>) -> Result<()>
    where
        T: Serialize + Send + Sync,
    {
        let mut conn = self.get_connection().await?;

        let data = serde_json::to_string(value).map_err(|e| AppError::Serialization(e))?;

        match ttl {
            Some(duration) => {
                let _: () = conn
                    .set_ex(key, data, duration.as_secs())
                    .await
                    .map_err(|e| AppError::Redis(e))?;
            }
            None => {
                let _: () = conn.set(key, data).await.map_err(|e| AppError::Redis(e))?;
            }
        }

        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<bool> {
        let mut conn = self.get_connection().await?;

        let count: i64 = conn.del(key).await.map_err(|e| AppError::Redis(e))?;

        Ok(count > 0)
    }

    async fn exists(&self, key: &str) -> Result<bool> {
        let mut conn = self.get_connection().await?;

        let exists: bool = conn.exists(key).await.map_err(|e| AppError::Redis(e))?;

        Ok(exists)
    }

    async fn expire(&self, key: &str, ttl: Duration) -> Result<bool> {
        let mut conn = self.get_connection().await?;

        let result: bool = conn
            .expire(key, ttl.as_secs() as i64)
            .await
            .map_err(|e| AppError::Redis(e))?;

        Ok(result)
    }

    async fn clear_pattern(&self, pattern: &str) -> Result<usize> {
        let mut conn = self.get_connection().await?;

        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(pattern)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Redis(e))?;

        if keys.is_empty() {
            return Ok(0);
        }

        let count: usize = conn.del(&keys).await.map_err(|e| AppError::Redis(e))?;

        Ok(count)
    }
}

// In-memory cache fallback for when Redis is unavailable
#[derive(Clone)]
pub struct MemoryCache {
    cache: dashmap::DashMap<String, (Vec<u8>, std::time::Instant)>,
    default_ttl: Duration,
}

impl MemoryCache {
    pub fn new(default_ttl_seconds: u64) -> Self {
        Self {
            cache: dashmap::DashMap::new(),
            default_ttl: Duration::from_secs(default_ttl_seconds),
        }
    }

    pub async fn cleanup_expired(&self) {
        let now = std::time::Instant::now();
        self.cache.retain(|_, pair| pair.1 > now);
    }
}

#[async_trait]
impl Cache for MemoryCache {
    async fn get<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de> + Send,
    {
        if let Some(entry) = self.cache.get(key) {
            let (data, expires) = entry.value();
            if expires > &std::time::Instant::now() {
                let value: T = bincode::deserialize(data)
                    .map_err(|e| AppError::Cache(format!("bincode deserialize: {}", e)))?;
                return Ok(Some(value));
            } else {
                drop(entry);
                self.cache.remove(key);
            }
        }
        Ok(None)
    }

    async fn set<T>(&self, key: &str, value: &T, ttl: Option<Duration>) -> Result<()>
    where
        T: Serialize + Send + Sync,
    {
        let data = bincode::serialize(value)
            .map_err(|e| AppError::Cache(format!("bincode serialize: {}", e)))?;

        let expires = std::time::Instant::now() + ttl.unwrap_or(self.default_ttl);
        self.cache.insert(key.to_string(), (data, expires));
        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<bool> {
        Ok(self.cache.remove(key).is_some())
    }

    async fn exists(&self, key: &str) -> Result<bool> {
        if let Some(entry) = self.cache.get(key) {
            Ok(entry.value().1 > std::time::Instant::now())
        } else {
            Ok(false)
        }
    }

    async fn expire(&self, key: &str, ttl: Duration) -> Result<bool> {
        let data = if let Some(entry) = self.cache.get(key) {
            entry.value().0.clone()
        } else {
            return Ok(false);
        };
        let expires = std::time::Instant::now() + ttl;
        self.cache.insert(key.to_string(), (data, expires));
        Ok(true)
    }

    async fn clear_pattern(&self, pattern: &str) -> Result<usize> {
        let pattern = pattern.replace('*', ".*");
        let regex = regex::Regex::new(&format!("^{}$", pattern))
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let keys_to_remove: Vec<String> = self
            .cache
            .iter()
            .map(|entry| entry.key().clone())
            .filter(|key| regex.is_match(key))
            .collect();

        let count = keys_to_remove.len();
        for key in keys_to_remove {
            self.cache.remove(&key);
        }

        Ok(count)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub used_memory_bytes: usize,
    pub max_memory_bytes: usize,
    pub total_keys: usize,
    pub hit_rate: f64,
}

impl CacheStats {
    pub fn memory_usage_percent(&self) -> f64 {
        if self.max_memory_bytes == 0 {
            return 0.0;
        }
        (self.used_memory_bytes as f64 / self.max_memory_bytes as f64) * 100.0
    }

    pub fn is_memory_pressure_high(&self) -> bool {
        self.memory_usage_percent() > 80.0
    }
}
