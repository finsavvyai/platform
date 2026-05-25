use crate::cache::CacheService;
use crate::config::{Config, EmbeddingConfig, ProviderConfig};
use crate::error::{AppError, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use tracing::{debug, error, info, warn};

pub struct EmbeddingService {
    providers: HashMap<String, Box<dyn EmbeddingProvider>>,
    config: EmbeddingConfig,
    cache: CacheService,
    rate_limiters: HashMap<String, Semaphore>,
}

impl EmbeddingService {
    pub async fn new(config: &Config, cache: CacheService) -> Result<Self> {
        let mut providers: HashMap<String, Box<dyn EmbeddingProvider>> = HashMap::new();
        let mut rate_limiters: HashMap<String, Semaphore> = HashMap::new();

        // Initialize OpenAI provider
        if let Some(openai_config) = config.embedding.providers.get("openai") {
            let openai_provider = OpenAIProvider::new(openai_config.clone())?;
            providers.insert("openai".to_string(), Box::new(openai_provider));

            // Create rate limiter (assuming 100 requests per second for OpenAI)
            rate_limiters.insert("openai".to_string(), Semaphore::new(100));
        }

        // Initialize Cohere provider
        if let Some(cohere_config) = config.embedding.providers.get("cohere") {
            let cohere_provider = CohereProvider::new(cohere_config.clone())?;
            providers.insert("cohere".to_string(), Box::new(cohere_provider));

            // Create rate limiter (assuming 50 requests per second for Cohere)
            rate_limiters.insert("cohere".to_string(), Semaphore::new(50));
        }

        // Initialize local embedding provider (using candle-core)
        let local_provider = LocalEmbeddingProvider::new(&config)?;
        providers.insert("local".to_string(), Box::new(local_provider));
        rate_limiters.insert("local".to_string(), Semaphore::new(200)); // Higher limit for local

        info!("Initialized {} embedding providers", providers.len());

        Ok(EmbeddingService {
            providers,
            config: config.embedding.clone(),
            cache,
            rate_limiters,
        })
    }

    pub async fn generate_embeddings(
        &self,
        request: EmbeddingRequest,
    ) -> Result<EmbeddingResponse> {
        let start_time = Instant::now();

        // Determine which provider to use
        let provider_name = request
            .model_provider
            .as_deref()
            .unwrap_or(&self.config.default_provider);

        let provider = self
            .providers
            .get(provider_name)
            .ok_or_else(|| AppError::ProviderNotAvailable)?;

        // Check cache for existing embeddings
        let mut embeddings = Vec::with_capacity(request.texts.len());
        let mut uncached_texts = Vec::new();
        let mut uncached_indices = Vec::new();

        for (index, text) in request.texts.iter().enumerate() {
            let cache_key = format!(
                "embed:{}:{}:{}",
                provider_name,
                self.get_model_hash(provider_name),
                self.hash_text(text)
            );

            if let Some(cached_embedding) = self
                .cache
                .get_cached_embeddings::<Vec<f32>>(&cache_key)
                .await?
            {
                embeddings.push((index, cached_embedding));
            } else {
                uncached_texts.push((index, text.clone()));
                uncached_indices.push(index);
            }
        }

        // Generate embeddings for uncached texts
        if !uncached_texts.is_empty() {
            debug!(
                "Generating embeddings for {} uncached texts",
                uncached_texts.len()
            );

            // Apply rate limiting
            let permit = self
                .rate_limiters
                .get(provider_name)
                .ok_or_else(|| AppError::ProviderNotAvailable)?
                .acquire()
                .await
                .map_err(|_| AppError::RateLimitExceeded)?;

            let new_embeddings = self
                .generate_batch_embeddings(provider.as_ref(), &uncached_texts)
                .await?;
            drop(permit);

            // Cache new embeddings
            for (text_index, text) in &uncached_texts {
                let cache_key = format!(
                    "embed:{}:{}:{}",
                    provider_name,
                    self.get_model_hash(provider_name),
                    self.hash_text(text)
                );

                if let Some(embedding) = new_embeddings.get(*text_index) {
                    self.cache.cache_embeddings(&cache_key, embedding).await?;
                }
            }

            // Combine cached and new embeddings
            for (index, embedding) in new_embeddings.into_iter().enumerate() {
                embeddings.push((uncached_indices[index], embedding));
            }
        }

        // Sort embeddings by original order
        embeddings.sort_by_key(|(index, _)| *index);
        let final_embeddings: Vec<Vec<f32>> = embeddings
            .into_iter()
            .map(|(_, embedding)| embedding)
            .collect();

        let duration = start_time.elapsed();
        info!(
            "Generated {} embeddings in {:?}",
            final_embeddings.len(),
            duration
        );

        Ok(EmbeddingResponse {
            embeddings: final_embeddings,
            model: provider.get_model().to_string(),
            provider: provider_name.to_string(),
            usage: EmbeddingUsage {
                prompt_tokens: self.estimate_tokens(&request.texts),
                total_tokens: self.estimate_tokens(&request.texts),
            },
            processing_time_ms: duration.as_millis() as u64,
        })
    }

    async fn generate_batch_embeddings(
        &self,
        provider: &dyn EmbeddingProvider,
        texts: &[(usize, String)],
    ) -> Result<Vec<Vec<f32>>> {
        let texts: Vec<String> = texts.iter().map(|(_, text)| text.clone()).collect();
        let batch_size = self.config.batch_size.min(texts.len());

        if texts.len() <= batch_size {
            // Single batch
            let response = provider.generate_embeddings(&texts).await?;
            Ok(response.embeddings)
        } else {
            // Multiple batches
            let mut all_embeddings = Vec::with_capacity(texts.len());

            for chunk in texts.chunks(batch_size) {
                let chunk_texts: Vec<String> = chunk.to_vec();
                let response = provider.generate_embeddings(&chunk_texts).await?;
                all_embeddings.extend(response.embeddings);

                // Small delay between batches to avoid overwhelming the provider
                tokio::time::sleep(Duration::from_millis(100)).await;
            }

            Ok(all_embeddings)
        }
    }

    fn get_model_hash(&self, provider_name: &str) -> String {
        if let Some(provider) = self.providers.get(provider_name) {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};

            let mut hasher = DefaultHasher::new();
            provider.get_model().hash(&mut hasher);
            format!("{:x}", hasher.finish())
        } else {
            "unknown".to_string()
        }
    }

    fn hash_text(&self, text: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    fn estimate_tokens(&self, texts: &[String]) -> u32 {
        // Simple token estimation (rough approximation: 4 characters ≈ 1 token)
        let total_chars: usize = texts.iter().map(|s| s.len()).sum();
        (total_chars / 4) as u32
    }

    pub async fn get_provider_info(&self) -> Vec<ProviderInfo> {
        let mut providers_info = Vec::new();

        for (name, provider) in &self.providers {
            providers_info.push(ProviderInfo {
                name: name.clone(),
                model: provider.get_model().to_string(),
                dimensions: provider.get_dimensions(),
                max_tokens: provider.get_max_tokens(),
                available: provider.is_available().await,
            });
        }

        providers_info
    }
}

#[async_trait]
pub trait EmbeddingProvider: Send + Sync {
    async fn generate_embeddings(&self, texts: &[String]) -> Result<EmbeddingResponse>;
    fn get_model(&self) -> &str;
    fn get_dimensions(&self) -> usize;
    fn get_max_tokens(&self) -> usize;
    async fn is_available(&self) -> bool;
}

// OpenAI Embedding Provider
pub struct OpenAIProvider {
    config: ProviderConfig,
    client: reqwest::Client,
}

impl OpenAIProvider {
    pub fn new(config: ProviderConfig) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {}", config.api_key).parse().unwrap(),
                );
                headers.insert(
                    reqwest::header::CONTENT_TYPE,
                    "application/json".parse().unwrap(),
                );
                headers
            })
            .build()
            .map_err(|e| AppError::HttpClient(e))?;

        Ok(Self { config, client })
    }
}

#[async_trait]
impl EmbeddingProvider for OpenAIProvider {
    async fn generate_embeddings(&self, texts: &[String]) -> Result<EmbeddingResponse> {
        let request_body = OpenAIRequest {
            model: self.config.model.clone(),
            input: texts.to_vec(),
            encoding_format: Some("float".to_string()),
        };

        let response = self
            .client
            .post("https://api.openai.com/v1/embeddings")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| AppError::HttpClient(e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::EmbeddingGeneration(format!(
                "OpenAI API error: {} - {}",
                status,
                error_text
            )));
        }

        let openai_response: OpenAIResponse =
            response.json().await.map_err(|e| AppError::HttpClient(e))?;

        let embeddings: Vec<Vec<f32>> = openai_response
            .data
            .into_iter()
            .map(|item| item.embedding)
            .collect();

        Ok(EmbeddingResponse {
            embeddings,
            model: self.config.model.clone(),
            provider: "openai".to_string(),
            usage: EmbeddingUsage {
                prompt_tokens: openai_response.usage.prompt_tokens,
                total_tokens: openai_response.usage.total_tokens,
            },
            processing_time_ms: 0, // Not provided by OpenAI
        })
    }

    fn get_model(&self) -> &str {
        &self.config.model
    }

    fn get_dimensions(&self) -> usize {
        self.config.dimensions
    }

    fn get_max_tokens(&self) -> usize {
        self.config.max_tokens
    }

    async fn is_available(&self) -> bool {
        // Simple health check - try to get models list
        let response = self
            .client
            .get("https://api.openai.com/v1/models")
            .send()
            .await;

        response.map(|r| r.status().is_success()).unwrap_or(false)
    }
}

// Cohere Embedding Provider
pub struct CohereProvider {
    config: ProviderConfig,
    client: reqwest::Client,
}

impl CohereProvider {
    pub fn new(config: ProviderConfig) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {}", config.api_key).parse().unwrap(),
                );
                headers.insert(
                    reqwest::header::CONTENT_TYPE,
                    "application/json".parse().unwrap(),
                );
                headers
            })
            .build()
            .map_err(|e| AppError::HttpClient(e))?;

        Ok(Self { config, client })
    }
}

#[async_trait]
impl EmbeddingProvider for CohereProvider {
    async fn generate_embeddings(&self, texts: &[String]) -> Result<EmbeddingResponse> {
        let request_body = CohereRequest {
            model: self.config.model.clone(),
            texts: texts.to_vec(),
            input_type: "search_document".to_string(),
        };

        let response = self
            .client
            .post("https://api.cohere.ai/v1/embed")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| AppError::HttpClient(e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::EmbeddingGeneration(format!(
                "Cohere API error: {} - {}",
                status,
                error_text
            )));
        }

        let cohere_response: CohereResponse =
            response.json().await.map_err(|e| AppError::HttpClient(e))?;

        Ok(EmbeddingResponse {
            embeddings: cohere_response.embeddings,
            model: self.config.model.clone(),
            provider: "cohere".to_string(),
            usage: EmbeddingUsage {
                prompt_tokens: 0, // Cohere doesn't provide token usage
                total_tokens: 0,
            },
            processing_time_ms: 0,
        })
    }

    fn get_model(&self) -> &str {
        &self.config.model
    }

    fn get_dimensions(&self) -> usize {
        self.config.dimensions
    }

    fn get_max_tokens(&self) -> usize {
        self.config.max_tokens
    }

    async fn is_available(&self) -> bool {
        let response = self
            .client
            .get("https://api.cohere.ai/v1/models")
            .send()
            .await;

        response.map(|r| r.status().is_success()).unwrap_or(false)
    }
}

// Local Embedding Provider using candle-core
pub struct LocalEmbeddingProvider {
    model: String,
    dimensions: usize,
    _model_handle: (), // Placeholder for actual model handle
}

impl LocalEmbeddingProvider {
    pub fn new(config: &Config) -> Result<Self> {
        // Initialize local embedding model using candle-core
        // This is a placeholder implementation
        info!("Initializing local embedding provider");

        Ok(Self {
            model: "all-MiniLM-L6-v2".to_string(),
            dimensions: 384,
            _model_handle: (),
        })
    }
}

#[async_trait]
impl EmbeddingProvider for LocalEmbeddingProvider {
    async fn generate_embeddings(&self, texts: &[String]) -> Result<EmbeddingResponse> {
        // Placeholder implementation for local embeddings
        // In a real implementation, this would use candle-core to generate embeddings

        debug!("Generating {} embeddings using local model", texts.len());

        let mut embeddings = Vec::with_capacity(texts.len());
        for text in texts {
            // Simple hash-based embedding for demonstration
            let embedding = self.simple_text_embedding(text);
            embeddings.push(embedding);
        }

        Ok(EmbeddingResponse {
            embeddings,
            model: self.model.clone(),
            provider: "local".to_string(),
            usage: EmbeddingUsage {
                prompt_tokens: self.estimate_tokens(texts),
                total_tokens: self.estimate_tokens(texts),
            },
            processing_time_ms: 100, // Simulated processing time
        })
    }

    fn get_model(&self) -> &str {
        &self.model
    }

    fn get_dimensions(&self) -> usize {
        self.dimensions
    }

    fn get_max_tokens(&self) -> usize {
        512 // Typical limit for local models
    }

    async fn is_available(&self) -> bool {
        true // Local provider is always available if initialized
    }
}

impl LocalEmbeddingProvider {
    fn simple_text_embedding(&self, text: &str) -> Vec<f32> {
        // Very simple hash-based embedding for demonstration
        // In production, this would use actual ML model inference

        let mut embedding = vec![0.0; self.dimensions];
        let bytes = text.as_bytes();

        for (i, &byte) in bytes.iter().enumerate() {
            let index = i % self.dimensions;
            embedding[index] += (byte as f32) / 255.0;
        }

        // Normalize the embedding
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for value in &mut embedding {
                *value /= norm;
            }
        }

        embedding
    }

    fn estimate_tokens(&self, texts: &[String]) -> u32 {
        let total_chars: usize = texts.iter().map(|s| s.len()).sum();
        (total_chars / 4) as u32
    }
}

// Data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub texts: Vec<String>,
    pub model_provider: Option<String>,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embeddings: Vec<Vec<f32>>,
    pub model: String,
    pub provider: String,
    pub usage: EmbeddingUsage,
    pub processing_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingUsage {
    pub prompt_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub name: String,
    pub model: String,
    pub dimensions: usize,
    pub max_tokens: usize,
    pub available: bool,
}

// OpenAI API structures
#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIRequest {
    model: String,
    input: Vec<String>,
    encoding_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIResponse {
    data: Vec<OpenAIEmbedding>,
    usage: OpenAIUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIEmbedding {
    object: String,
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    total_tokens: u32,
}

// Cohere API structures
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CohereRequest {
    model: String,
    texts: Vec<String>,
    input_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CohereResponse {
    embeddings: Vec<Vec<f32>>,
    id: String,
    texts: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_response_serialization() {
        let response = EmbeddingResponse {
            embeddings: vec![vec![0.1, 0.2, 0.3]],
            model: "test-model".to_string(),
            provider: "test-provider".to_string(),
            usage: EmbeddingUsage {
                prompt_tokens: 10,
                total_tokens: 10,
            },
            processing_time_ms: 100,
        };

        let json = serde_json::to_string(&response).unwrap();
        let _deserialized: EmbeddingResponse = serde_json::from_str(&json).unwrap();
    }

    #[test]
    fn test_local_provider_simple_embedding() {
        let provider = LocalEmbeddingProvider {
            model: "test".to_string(),
            dimensions: 10,
            _model_handle: (),
        };

        let embedding = provider.simple_text_embedding("hello world");
        assert_eq!(embedding.len(), 10);

        // Check that embedding is normalized
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-6);
    }
}
