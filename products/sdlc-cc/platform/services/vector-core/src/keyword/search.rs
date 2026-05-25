use anyhow::{Context, Result};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{debug, info, warn};

use crate::models::search::{KeywordSearchMethod, SearchRequest, SearchResponse, SearchResult};

/// Keyword search engine for traditional text-based search
#[derive(Debug)]
pub struct KeywordSearchEngine {
    // In a real implementation, this would connect to a search engine like Elasticsearch
    // or maintain inverted indexes. For now, we'll implement basic algorithms.
}

impl KeywordSearchEngine {
    /// Create a new keyword search engine
    pub fn new() -> Self {
        Self {}
    }

    /// Perform keyword search
    pub async fn search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        let start_time = Instant::now();

        info!(
            "Starting keyword search for query: {} with method: {:?}",
            request.query, request.keyword_search_method
        );

        match request.keyword_search_method {
            KeywordSearchMethod::TfIdf => self.tfidf_search(request).await,
            KeywordSearchMethod::BM25 => self.bm25_search(request).await,
            KeywordSearchMethod::Simple => self.simple_keyword_search(request).await,
        }
    }

    /// Simple keyword search with basic matching
    async fn simple_keyword_search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        let query_terms = self.tokenize_query(&request.query);
        let mut results = Vec::new();

        // In a real implementation, this would search through indexed documents
        // For now, we'll create mock results based on the query
        for (i, term) in query_terms.iter().enumerate() {
            let result = SearchResult {
                id: format!("keyword_doc_{}", i),
                content: format!("Mock content containing term: {}", term),
                score: 1.0 - (i as f32 * 0.1), // Decreasing scores
                metadata: Some(serde_json::json!({
                    "matched_terms": vec![term.clone()],
                    "match_type": "simple_keyword"
                })),
                index_name: Some("keyword_index".to_string()),
                document_type: Some("text".to_string()),
                source: Some("keyword_search".to_string()),
                created_at: Some(chrono::Utc::now()),
            };
            results.push(result);
        }

        // Sort by score
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(request.top_k as usize);

        Ok(SearchResponse {
            query: request.query.clone(),
            results,
            total_found: results.len() as u32,
            search_time: std::time::Duration::from_millis(0),
            metadata: serde_json::json!({
                "search_method": "simple_keyword",
                "query_terms": query_terms,
            }),
        })
    }

    /// TF-IDF based keyword search
    async fn tfidf_search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        let query_terms = self.tokenize_query(&request.query);
        let query_tfidf = self.calculate_query_tfidf(&query_terms);

        // Mock document collection with TF-IDF scores
        let mock_documents = self.create_mock_documents_with_tfidf();
        let mut results = Vec::new();

        for (doc_id, (content, doc_tfidf)) in mock_documents {
            let similarity_score = self.calculate_cosine_similarity(&query_tfidf, &doc_tfidf);

            if similarity_score > 0.0 {
                let result = SearchResult {
                    id: doc_id,
                    content: content.clone(),
                    score: similarity_score,
                    metadata: Some(serde_json::json!({
                        "matched_terms": query_terms.clone(),
                        "match_type": "tfidf",
                        "tfidf_score": similarity_score
                    })),
                    index_name: Some("keyword_index".to_string()),
                    document_type: Some("text".to_string()),
                    source: Some("keyword_search".to_string()),
                    created_at: Some(chrono::Utc::now()),
                };
                results.push(result);
            }
        }

        // Sort by TF-IDF similarity score
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(request.top_k as usize);

        Ok(SearchResponse {
            query: request.query.clone(),
            results,
            total_found: results.len() as u32,
            search_time: std::time::Duration::from_millis(0),
            metadata: serde_json::json!({
                "search_method": "tfidf",
                "query_terms": query_terms,
                "query_vector_length": query_tfidf.len(),
            }),
        })
    }

    /// BM25 based keyword search
    async fn bm25_search(&self, request: &SearchRequest) -> Result<SearchResponse> {
        let query_terms = self.tokenize_query(&request.query);
        let mut results = Vec::new();

        // Mock document collection with BM25 parameters
        let mock_documents = self.create_mock_documents_for_bm25();
        let k1 = 1.2; // BM25 parameter
        let b = 0.75; // BM25 parameter

        for (doc_id, (content, term_freqs, doc_length)) in mock_documents {
            let bm25_score =
                self.calculate_bm25_score(&query_terms, &term_freqs, doc_length, k1, b);

            if bm25_score > 0.0 {
                let result = SearchResult {
                    id: doc_id,
                    content: content.clone(),
                    score: bm25_score,
                    metadata: Some(serde_json::json!({
                        "matched_terms": query_terms.clone(),
                        "match_type": "bm25",
                        "bm25_score": bm25_score,
                        "doc_length": doc_length
                    })),
                    index_name: Some("keyword_index".to_string()),
                    document_type: Some("text".to_string()),
                    source: Some("keyword_search".to_string()),
                    created_at: Some(chrono::Utc::now()),
                };
                results.push(result);
            }
        }

        // Sort by BM25 score
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(request.top_k as usize);

        Ok(SearchResponse {
            query: request.query.clone(),
            results,
            total_found: results.len() as u32,
            search_time: std::time::Duration::from_millis(0),
            metadata: serde_json::json!({
                "search_method": "bm25",
                "query_terms": query_terms,
                "bm25_params": {
                    "k1": k1,
                    "b": b
                }
            }),
        })
    }

    /// Tokenize query into terms
    fn tokenize_query(&self, query: &str) -> Vec<String> {
        query
            .to_lowercase()
            .split_whitespace()
            .map(|term| {
                term.trim_matches(|c| c == '.' || c == ',' || c == '!' || c == '?')
                    .to_string()
            })
            .filter(|term| !term.is_empty())
            .collect()
    }

    /// Calculate TF-IDF vector for query
    fn calculate_query_tfidf(&self, query_terms: &[String]) -> HashMap<String, f32> {
        let mut tfidf_vector = HashMap::new();
        let total_terms = query_terms.len() as f32;

        // Calculate term frequency
        for term in query_terms {
            let tf = query_terms.iter().filter(|t| t == term).count() as f32 / total_terms;
            // In a real implementation, IDF would be calculated from document collection
            let idf = 1.0; // Mock IDF
            tfidf_vector.insert(term.clone(), tf * idf);
        }

        tfidf_vector
    }

    /// Calculate cosine similarity between TF-IDF vectors
    fn calculate_cosine_similarity(
        &self,
        vec_a: &HashMap<String, f32>,
        vec_b: &HashMap<String, f32>,
    ) -> f32 {
        let mut dot_product = 0.0;
        let mut magnitude_a = 0.0;
        let mut magnitude_b = 0.0;

        // Calculate dot product and magnitudes
        for (term, tfidf_a) in vec_a {
            if let Some(tfidf_b) = vec_b.get(term) {
                dot_product += tfidf_a * tfidf_b;
            }
            magnitude_a += tfidf_a * tfidf_a;
        }

        for tfidf_b in vec_b.values() {
            magnitude_b += tfidf_b * tfidf_b;
        }

        magnitude_a = magnitude_a.sqrt();
        magnitude_b = magnitude_b.sqrt();

        if magnitude_a == 0.0 || magnitude_b == 0.0 {
            return 0.0;
        }

        dot_product / (magnitude_a * magnitude_b)
    }

    /// Calculate BM25 score
    fn calculate_bm25_score(
        &self,
        query_terms: &[String],
        term_freqs: &HashMap<String, u32>,
        doc_length: u32,
        k1: f32,
        b: f32,
    ) -> f32 {
        let avg_doc_length = 100.0; // Mock average document length
        let mut score = 0.0;

        for term in query_terms {
            if let Some(tf) = term_freqs.get(term) {
                let tf = *tf as f32;
                // In a real implementation, IDF would be calculated from document collection
                let idf = 1.0; // Mock IDF

                let numerator = tf * (k1 + 1.0);
                let denominator = tf + k1 * (1.0 - b + b * (doc_length as f32 / avg_doc_length));

                score += idf * (numerator / denominator);
            }
        }

        score
    }

    /// Create mock documents with TF-IDF vectors for testing
    fn create_mock_documents_with_tfidf(&self) -> Vec<(String, (String, HashMap<String, f32>))> {
        vec![
            (
                "doc1".to_string(),
                (
                    "This is a document about artificial intelligence and machine learning"
                        .to_string(),
                    {
                        let mut map = HashMap::new();
                        map.insert("artificial".to_string(), 0.5);
                        map.insert("intelligence".to_string(), 0.6);
                        map.insert("machine".to_string(), 0.4);
                        map.insert("learning".to_string(), 0.5);
                        map
                    },
                ),
            ),
            (
                "doc2".to_string(),
                (
                    "Machine learning algorithms are used in data science".to_string(),
                    {
                        let mut map = HashMap::new();
                        map.insert("machine".to_string(), 0.7);
                        map.insert("learning".to_string(), 0.8);
                        map.insert("algorithms".to_string(), 0.6);
                        map.insert("data".to_string(), 0.5);
                        map.insert("science".to_string(), 0.5);
                        map
                    },
                ),
            ),
            (
                "doc3".to_string(),
                (
                    "Natural language processing uses AI techniques".to_string(),
                    {
                        let mut map = HashMap::new();
                        map.insert("natural".to_string(), 0.5);
                        map.insert("language".to_string(), 0.5);
                        map.insert("processing".to_string(), 0.6);
                        map.insert("ai".to_string(), 0.4);
                        map.insert("techniques".to_string(), 0.5);
                        map
                    },
                ),
            ),
        ]
    }

    /// Create mock documents for BM25 testing
    fn create_mock_documents_for_bm25(&self) -> Vec<(String, (String, HashMap<String, u32>, u32))> {
        vec![
            (
                "doc1".to_string(),
                (
                    "This is a document about artificial intelligence and machine learning"
                        .to_string(),
                    {
                        let mut map = HashMap::new();
                        map.insert("artificial".to_string(), 1);
                        map.insert("intelligence".to_string(), 1);
                        map.insert("machine".to_string(), 1);
                        map.insert("learning".to_string(), 1);
                        map
                    },
                    9,
                ),
            ),
            (
                "doc2".to_string(),
                (
                    "Machine learning algorithms are used in data science".to_string(),
                    {
                        let mut map = HashMap::new();
                        map.insert("machine".to_string(), 1);
                        map.insert("learning".to_string(), 1);
                        map.insert("algorithms".to_string(), 1);
                        map.insert("data".to_string(), 1);
                        map.insert("science".to_string(), 1);
                        map
                    },
                    8,
                ),
            ),
            (
                "doc3".to_string(),
                (
                    "Natural language processing uses AI techniques".to_string(),
                    {
                        let mut map = HashMap::new();
                        map.insert("natural".to_string(), 1);
                        map.insert("language".to_string(), 1);
                        map.insert("processing".to_string(), 1);
                        map.insert("ai".to_string(), 1);
                        map.insert("techniques".to_string(), 1);
                        map
                    },
                    7,
                ),
            ),
        ]
    }

    /// Extract key phrases from text
    pub fn extract_key_phrases(&self, text: &str, max_phrases: usize) -> Vec<String> {
        let words: Vec<String> = text
            .to_lowercase()
            .split_whitespace()
            .map(|w| {
                w.trim_matches(|c| {
                    c == '.' || c == ',' || c == '!' || c == '?' || c == '(' || c == ')'
                })
                .to_string()
            })
            .filter(|w| !w.is_empty() && w.len() > 3) // Filter short words
            .collect();

        // Simple n-gram extraction for key phrases
        let mut phrases = Vec::new();

        // Single words
        for word in &words {
            if self.is_important_word(word) {
                phrases.push(word.clone());
            }
        }

        // Two-word phrases
        for i in 0..words.len().saturating_sub(1) {
            if self.is_important_word(&words[i]) && self.is_important_word(&words[i + 1]) {
                phrases.push(format!("{} {}", words[i], words[i + 1]));
            }
        }

        // Remove duplicates and limit
        phrases.sort();
        phrases.dedup();
        phrases.truncate(max_phrases);
        phrases
    }

    /// Check if a word is important (not a stop word)
    fn is_important_word(&self, word: &str) -> bool {
        let stop_words = vec![
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "by", "from", "up", "about", "into", "through", "during", "before", "after", "above",
            "below", "between", "among", "is", "are", "was", "were", "be", "been", "being", "have",
            "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
            "must", "can", "this", "that", "these", "those", "i", "you", "he", "she", "it", "we",
            "they", "what", "which", "who", "when", "where", "why", "how",
        ];

        !stop_words.contains(&word)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simple_keyword_search() {
        let engine = KeywordSearchEngine::new();
        let request = SearchRequest {
            query: "test query".to_string(),
            query_vector: None,
            top_k: 5,
            indexes: vec!["keyword_index".to_string()],
            filters: None,
            similarity_metric: Default::default(),
            hybrid_config: None,
            keyword_search_method: KeywordSearchMethod::Simple,
            namespace: None,
        };

        let response = engine.search(&request).await.unwrap();
        assert!(!response.results.is_empty());
        assert_eq!(response.query, "test query");
    }

    #[tokio::test]
    async fn test_tfidf_search() {
        let engine = KeywordSearchEngine::new();
        let request = SearchRequest {
            query: "machine learning".to_string(),
            query_vector: None,
            top_k: 5,
            indexes: vec!["keyword_index".to_string()],
            filters: None,
            similarity_metric: Default::default(),
            hybrid_config: None,
            keyword_search_method: KeywordSearchMethod::TfIdf,
            namespace: None,
        };

        let response = engine.search(&request).await.unwrap();
        assert!(!response.results.is_empty());
        assert_eq!(response.query, "machine learning");
    }

    #[tokio::test]
    async fn test_bm25_search() {
        let engine = KeywordSearchEngine::new();
        let request = SearchRequest {
            query: "machine learning".to_string(),
            query_vector: None,
            top_k: 5,
            indexes: vec!["keyword_index".to_string()],
            filters: None,
            similarity_metric: Default::default(),
            hybrid_config: None,
            keyword_search_method: KeywordSearchMethod::BM25,
            namespace: None,
        };

        let response = engine.search(&request).await.unwrap();
        assert!(!response.results.is_empty());
        assert_eq!(response.query, "machine learning");
    }

    #[test]
    fn test_tokenize_query() {
        let engine = KeywordSearchEngine::new();
        let terms = engine.tokenize_query("Hello, world! This is a test.");
        assert_eq!(terms, vec!["hello", "world", "this", "is", "a", "test"]);
    }

    #[test]
    fn test_extract_key_phrases() {
        let engine = KeywordSearchEngine::new();
        let text =
            "Machine learning algorithms are transforming artificial intelligence and data science";
        let phrases = engine.extract_key_phrases(text, 10);
        assert!(!phrases.is_empty());
        assert!(phrases.len() <= 10);
    }

    #[test]
    fn test_cosine_similarity() {
        let engine = KeywordSearchEngine::new();
        let mut vec_a = HashMap::new();
        vec_a.insert("term1".to_string(), 0.5);
        vec_a.insert("term2".to_string(), 0.7);

        let mut vec_b = HashMap::new();
        vec_b.insert("term1".to_string(), 0.3);
        vec_b.insert("term3".to_string(), 0.8);

        let similarity = engine.calculate_cosine_similarity(&vec_a, &vec_b);
        assert!(similarity > 0.0);
        assert!(similarity <= 1.0);
    }
}
