use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

use crate::models::vector::VectorIndexConfig;
use crate::models::search::{SearchQuery, SearchResult, VectorSearchResult};

/// Cloudflare Vectorize client for vector database operations
#[derive(Debug, Clone)]
pub struct VectorizeClient {
    client: reqwest::Client,
    account_id: String,
    api_token: String,
    indexes: HashMap<String, VectorIndexConfig>,
    base_url: String,
}

impl VectorizeClient {
    /// Create a new Vectorize client
    pub fn new(
        account_id: String,
        api_token: String,
        base_url: Option<String>,
    ) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        let base_url = base_url.unwrap_or_else(|| "https://api.cloudflare.com/client/v4".to_string());

        Ok(Self {
            client,
            account_id,
            api_token,
            indexes: HashMap::new(),
            base_url,
        })
    }

    /// Initialize the client and load existing indexes
    pub async fn initialize(&mut self) -> Result<()> {
        info!("Initializing Vectorize client for account: {}", self.account_id);

        // Load existing indexes
        let indexes = self.list_indexes().await?;
        for index in indexes {
            self.indexes.insert(index.name.clone(), index);
        }

        info!("Loaded {} existing indexes", self.indexes.len());
        Ok(())
    }

    /// List all Vectorize indexes
    pub async fn list_indexes(&self) -> Result<Vec<VectorIndexConfig>> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes",
            self.base_url, self.account_id
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.api_token)
            .send()
            .await
            .context("Failed to send list indexes request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to list indexes: {} - {}",
                response.status(),
                error_text
            ));
        }

        let api_response: VectorizeApiResponse<Vec<VectorIndexConfig>> = response.json().await
            .context("Failed to parse indexes response")?;

        if !api_response.success {
            return Err(anyhow::anyhow!("API returned error: {:?}", api_response.errors));
        }

        Ok(api_response.result.unwrap_or_default())
    }

    /// Create a new Vectorize index
    pub async fn create_index(&self, config: &VectorIndexConfig) -> Result<VectorIndexConfig> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes",
            self.base_url, self.account_id
        );

        let create_request = CreateIndexRequest {
            name: config.name.clone(),
            dimensions: config.dimensions,
            metric: config.metric.clone(),
            description: config.description.clone(),
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.api_token)
            .json(&create_request)
            .send()
            .await
            .context("Failed to send create index request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to create index: {} - {}",
                response.status(),
                error_text
            ));
        }

        let api_response: VectorizeApiResponse<VectorIndexConfig> = response.json().await
            .context("Failed to parse create index response")?;

        if !api_response.success {
            return Err(anyhow::anyhow!("API returned error: {:?}", api_response.errors));
        }

        info!("Created Vectorize index: {}", config.name);
        Ok(api_response.result.unwrap())
    }

    /// Delete a Vectorize index
    pub async fn delete_index(&self, index_name: &str) -> Result<()> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes/{}",
            self.base_url, self.account_id, index_name
        );

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&self.api_token)
            .send()
            .await
            .context("Failed to send delete index request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to delete index: {} - {}",
                response.status(),
                error_text
            ));
        }

        info!("Deleted Vectorize index: {}", index_name);
        Ok(())
    }

    /// Insert vectors into an index
    pub async fn insert_vectors(
        &self,
        index_name: &str,
        vectors: Vec<VectorInsertRequest>,
    ) -> Result<Vec<String>> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes/{}/insert",
            self.base_url, self.account_id, index_name
        );

        let request = VectorInsertBatchRequest { vectors };

        let response = timeout(
            Duration::from_secs(60),
            self.client
                .post(&url)
                .bearer_auth(&self.api_token)
                .json(&request)
                .send()
        )
        .await
        .context("Insert vectors request timed out")?
        .context("Failed to send insert vectors request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to insert vectors: {} - {}",
                response.status(),
                error_text
            ));
        }

        let api_response: VectorizeApiResponse<Vec<String>> = response.json().await
            .context("Failed to parse insert vectors response")?;

        if !api_response.success {
            return Err(anyhow::anyhow!("API returned error: {:?}", api_response.errors));
        }

        Ok(api_response.result.unwrap_or_default())
    }

    /// Update vectors in an index
    pub async fn update_vectors(
        &self,
        index_name: &str,
        vectors: Vec<VectorUpdateRequest>,
    ) -> Result<Vec<String>> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes/{}/upsert",
            self.base_url, self.account_id, index_name
        );

        let request = VectorUpdateBatchRequest { vectors };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.api_token)
            .json(&request)
            .send()
            .await
            .context("Failed to send update vectors request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to update vectors: {} - {}",
                response.status(),
                error_text
            ));
        }

        let api_response: VectorizeApiResponse<Vec<String>> = response.json().await
            .context("Failed to parse update vectors response")?;

        if !api_response.success {
            return Err(anyhow::anyhow!("API returned error: {:?}", api_response.errors));
        }

        Ok(api_response.result.unwrap_or_default())
    }

    /// Delete vectors from an index
    pub async fn delete_vectors(
        &self,
        index_name: &str,
        vector_ids: Vec<String>,
    ) -> Result<()> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes/{}/delete",
            self.base_url, self.account_id, index_name
        );

        let request = VectorDeleteRequest { ids: vector_ids };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.api_token)
            .json(&request)
            .send()
            .await
            .context("Failed to send delete vectors request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to delete vectors: {} - {}",
                response.status(),
                error_text
            ));
        }

        Ok(())
    }

    /// Search for similar vectors
    pub async fn search(
        &self,
        index_name: &str,
        query: &VectorSearchQuery,
    ) -> Result<Vec<VectorSearchResult>> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes/{}/query",
            self.base_url, self.account_id, index_name
        );

        let response = timeout(
            Duration::from_secs(10),
            self.client
                .post(&url)
                .bearer_auth(&self.api_token)
                .json(query)
                .send()
        )
        .await
        .context("Search request timed out")?
        .context("Failed to send search request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to search vectors: {} - {}",
                response.status(),
                error_text
            ));
        }

        let api_response: VectorizeApiResponse<Vec<VectorSearchResult>> = response.json().await
            .context("Failed to parse search response")?;

        if !api_response.success {
            return Err(anyhow::anyhow!("API returned error: {:?}", api_response.errors));
        }

        Ok(api_response.result.unwrap_or_default())
    }

    /// Get index statistics
    pub async fn get_index_stats(&self, index_name: &str) -> Result<IndexStats> {
        let url = format!(
            "{}/accounts/{}/vectorize/indexes/{}/stats",
            self.base_url, self.account_id, index_name
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.api_token)
            .send()
            .await
            .context("Failed to send get stats request")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to get index stats: {} - {}",
                response.status(),
                error_text
            ));
        }

        let api_response: VectorizeApiResponse<IndexStats> = response.json().await
            .context("Failed to parse stats response")?;

        if !api_response.success {
            return Err(anyhow::anyhow!("API returned error: {:?}", api_response.errors));
        }

        Ok(api_response.result.unwrap())
    }

    /// Check if an index exists
    pub fn has_index(&self, index_name: &str) -> bool {
        self.indexes.contains_key(index_name)
    }

    /// Get index configuration
    pub fn get_index_config(&self, index_name: &str) -> Option<&VectorIndexConfig> {
        self.indexes.get(index_name)
    }

    /// Refresh index cache
    pub async fn refresh_indexes(&mut self) -> Result<()> {
        debug!("Refreshing index cache");
        self.indexes.clear();
        self.initialize().await
    }
}

// Request/Response structures

#[derive(Debug, Serialize)]
struct CreateIndexRequest {
    name: String,
    dimensions: u32,
    metric: String,
    description: Option<String>,
}

#[derive(Debug, Serialize)]
struct VectorInsertBatchRequest {
    vectors: Vec<VectorInsertRequest>,
}

#[derive(Debug, Serialize)]
struct VectorInsertRequest {
    id: String,
    values: Vec<f32>,
    metadata: Option<serde_json::Value>,
    namespace: Option<String>,
}

#[derive(Debug, Serialize)]
struct VectorUpdateBatchRequest {
    vectors: Vec<VectorUpdateRequest>,
}

#[derive(Debug, Serialize)]
struct VectorUpdateRequest {
    id: String,
    values: Vec<f32>,
    metadata: Option<serde_json::Value>,
    namespace: Option<String>,
}

#[derive(Debug, Serialize)]
struct VectorDeleteRequest {
    ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VectorSearchQuery {
    pub vector: Vec<f32>,
    pub top_k: u32,
    pub namespace: Option<String>,
    pub include_metadata: bool,
    pub filter: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct VectorSearchResult {
    pub id: String,
    pub score: f32,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct IndexStats {
    pub vector_count: u64,
    pub index_size: u64,
    pub dimensions: u32,
    pub metric: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
struct VectorizeApiResponse<T> {
    pub success: bool,
    pub result: Option<T>,
    pub errors: Option<Vec<serde_json::Value>>,
    pub messages: Option<Vec<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_vectorize_client_creation() {
        let client = VectorizeClient::new(
            "test_account".to_string(),
            "test_token".to_string(),
            None,
        );
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_has_index() {
        let mut client = VectorizeClient::new(
            "test_account".to_string(),
            "test_token".to_string(),
            None,
        ).unwrap();

        // Initially should have no indexes
        assert!(!client.has_index("test_index"));

        // Add a test index
        let test_config = VectorIndexConfig {
            name: "test_index".to_string(),
            dimensions: 384,
            metric: "cosine".to_string(),
            description: Some("Test index".to_string()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        client.indexes.insert("test_index".to_string(), test_config);

        // Now should have the index
        assert!(client.has_index("test_index"));
    }
}
