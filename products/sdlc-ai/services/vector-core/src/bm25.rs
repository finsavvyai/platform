use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::f64;
use tracing::{debug, info, warn};

/// BM25 (Best Match 25) algorithm implementation for keyword search
/// This provides the keyword matching component for hybrid search
#[derive(Debug, Clone)]
pub struct BM25Searcher {
    documents: Vec<Document>,
    doc_stats: Vec<DocumentStats>,
    vocab: HashMap<String, VocabStats>,
    avg_doc_length: f64,
    k1: f64,
    b: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub content: String,
    pub title: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Default)]
struct DocumentStats {
    term_frequencies: HashMap<String, u32>,
    doc_length: u32,
    max_term_freq: u32,
}

#[derive(Debug, Clone, Default)]
struct VocabStats {
    doc_frequency: u32,
    total_term_frequency: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BM25Query {
    pub query: String,
    pub boost_terms: Option<HashMap<String, f64>>,
    pub filters: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BM25Result {
    pub id: String,
    pub score: f64,
    pub matched_terms: Vec<String>,
    pub term_scores: HashMap<String, f64>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BM25SearchRequest {
    pub query: String,
    pub limit: usize,
    pub min_score: Option<f64>,
    pub boost_terms: Option<HashMap<String, f64>>,
    pub filters: Option<HashMap<String, String>>,
    pub tenant_id: String,
}

impl BM25Searcher {
    pub fn new(k1: f64, b: f64) -> Self {
        Self {
            documents: Vec::new(),
            doc_stats: Vec::new(),
            vocab: HashMap::new(),
            avg_doc_length: 0.0,
            k1,
            b,
        }
    }

    pub fn default() -> Self {
        Self::new(1.2, 0.75) // Standard BM25 parameters
    }

    /// Add documents to the index
    pub fn add_documents(&mut self, documents: Vec<Document>) -> Result<()> {
        info!("Adding {} documents to BM25 index", documents.len());

        let mut total_length = 0u64;
        let mut start_idx = self.documents.len();

        // Add documents
        for document in documents {
            self.documents.push(document.clone());

            // Process document content
            let content = Self::normalize_text(&document.content);
            let title = document
                .title
                .as_ref()
                .map(|t| Self::normalize_text(t))
                .unwrap_or_default();

            let full_text = format!("{} {}", title, content);
            let terms = Self::tokenize(&full_text);

            // Calculate term frequencies
            let mut term_frequencies: HashMap<String, u32> = HashMap::new();
            let mut max_term_freq = 0u32;

            for term in &terms {
                let count = term_frequencies.entry(term.clone()).or_insert(0);
                *count += 1;
                max_term_freq = max_term_freq.max(*count);
            }

            // Update vocabulary statistics
            for (term, freq) in &term_frequencies {
                let vocab_stats = self.vocab.entry(term.clone()).or_default();
                vocab_stats.doc_frequency += 1;
                vocab_stats.total_term_frequency += *freq as u64;
            }

            // Store document statistics
            self.doc_stats.push(DocumentStats {
                term_frequencies,
                doc_length: terms.len() as u32,
                max_term_freq,
            });

            total_length += terms.len() as u64;
        }

        // Update average document length
        let total_docs = self.documents.len() as f64;
        self.avg_doc_length = total_length as f64 / total_docs;

        debug!(
            "Added {} documents, avg doc length: {:.2}",
            self.documents.len() - start_idx,
            self.avg_doc_length
        );

        Ok(())
    }

    /// Search for documents using BM25
    pub fn search(&self, request: BM25SearchRequest) -> Result<Vec<BM25Result>> {
        info!("BM25 search for query: '{}'", request.query);

        let start_time = std::time::Instant::now();

        // Process query
        let query_terms = Self::tokenize(&Self::normalize_text(&request.query));
        if query_terms.is_empty() {
            return Ok(Vec::new());
        }

        debug!("Query terms: {:?}", query_terms);

        // Calculate BM25 scores for each document
        let mut results: Vec<BM25Result> = Vec::new();

        for (doc_idx, document) in self.documents.iter().enumerate() {
            // Apply filters first
            if !self.passes_filters(document, &request.filters) {
                continue;
            }

            let doc_stats = &self.doc_stats[doc_idx];
            let mut total_score = 0.0;
            let mut matched_terms = Vec::new();
            let mut term_scores = HashMap::new();

            // Calculate BM25 score for each query term
            for term in &query_terms {
                if let Some(term_freq) = doc_stats.term_frequencies.get(term) {
                    let idf = self.calculate_idf(term);
                    let bm25_score =
                        self.calculate_bm25_score(*term_freq, doc_stats.doc_length, idf);

                    // Apply term boost if specified
                    let boosted_score = request
                        .boost_terms
                        .as_ref()
                        .and_then(|boosts| boosts.get(term))
                        .map(|boost| bm25_score * boost)
                        .unwrap_or(bm25_score);

                    total_score += boosted_score;
                    matched_terms.push(term.clone());
                    term_scores.insert(term.clone(), boosted_score);
                }
            }

            // Check if document meets minimum score threshold
            if let Some(min_score) = request.min_score {
                if total_score < min_score {
                    continue;
                }
            }

            if total_score > 0.0 {
                results.push(BM25Result {
                    id: document.id.clone(),
                    score: total_score,
                    matched_terms,
                    term_scores,
                    metadata: document.metadata.clone(),
                });
            }
        }

        // Sort by score (descending)
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        // Limit results
        results.truncate(request.limit);

        let search_time = start_time.elapsed();
        info!(
            "BM25 search completed in {:?}, found {} results",
            search_time,
            results.len()
        );

        Ok(results)
    }

    /// Calculate IDF (Inverse Document Frequency) for a term
    fn calculate_idf(&self, term: &str) -> f64 {
        let doc_count = self.documents.len() as f64;
        let df = self
            .vocab
            .get(term)
            .map(|stats| stats.doc_frequency as f64)
            .unwrap_or(0.0);

        if df == 0.0 || df >= doc_count {
            return 0.0;
        }

        ((doc_count - df + 0.5) / (df + 0.5)).ln_1p()
    }

    /// Calculate BM25 score for a term in a document
    fn calculate_bm25_score(&self, term_freq: u32, doc_length: u32, idf: f64) -> f64 {
        let tf = term_freq as f64;
        let doc_len = doc_length as f64;
        let avg_doc_len = self.avg_doc_length;

        // BM25 formula
        let numerator = tf * (self.k1 + 1.0);
        let denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / avg_doc_len));

        idf * (numerator / denominator)
    }

    /// Normalize text by converting to lowercase and removing punctuation
    fn normalize_text(text: &str) -> String {
        text.to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>()
    }

    /// Tokenize text into terms
    fn tokenize(text: &str) -> Vec<String> {
        text.split_whitespace()
            .filter(|s| s.len() > 1) // Filter out single characters
            .map(|s| s.to_string())
            .collect()
    }

    /// Check if document passes the specified filters
    fn passes_filters(
        &self,
        document: &Document,
        filters: &Option<HashMap<String, String>>,
    ) -> bool {
        match filters {
            Some(filters) => {
                for (key, expected_value) in filters {
                    match key.as_str() {
                        "document_type" => {
                            if let Some(doc_type) = document.metadata.get(key) {
                                if let Some(type_str) = doc_type.as_str() {
                                    if type_str != expected_value {
                                        return false;
                                    }
                                } else {
                                    return false;
                                }
                            } else {
                                return false;
                            }
                        }
                        "created_after" => {
                            if let Some(created_at) = document.metadata.get("created_at") {
                                if let Ok(timestamp) = created_at.as_str() {
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
                            if let Some(metadata_value) = document.metadata.get(key) {
                                if let Some(str_value) = metadata_value.as_str() {
                                    if str_value != expected_value {
                                        return false;
                                    }
                                } else {
                                    return false;
                                }
                            } else {
                                return false;
                            }
                        }
                    }
                }
                true
            }
            None => true,
        }
    }

    /// Get index statistics
    pub fn get_stats(&self) -> BM25Stats {
        BM25Stats {
            document_count: self.documents.len(),
            vocab_size: self.vocab.len(),
            avg_doc_length: self.avg_doc_length,
            total_terms: self
                .doc_stats
                .iter()
                .map(|stats| stats.doc_length as u64)
                .sum(),
        }
    }

    /// Get term frequency information
    pub fn get_term_info(&self, term: &str) -> Option<TermInfo> {
        let vocab_stats = self.vocab.get(term)?;
        let doc_frequency = vocab_stats.doc_frequency;
        let total_term_frequency = vocab_stats.total_term_frequency;
        let idf = self.calculate_idf(term);

        // Find documents containing this term
        let mut containing_docs = Vec::new();
        for (doc_idx, doc_stats) in self.doc_stats.iter().enumerate() {
            if let Some(freq) = doc_stats.term_frequencies.get(term) {
                containing_docs.push((doc_idx, *freq));
            }
        }

        Some(TermInfo {
            term: term.to_string(),
            doc_frequency,
            total_term_frequency,
            idf,
            containing_docs,
        })
    }

    /// Optimize the index by removing rare terms
    pub fn optimize(&mut self, min_doc_frequency: u32) {
        info!(
            "Optimizing BM25 index, removing terms with DF < {}",
            min_doc_frequency
        );

        let mut terms_to_remove = Vec::new();
        for (term, stats) in &self.vocab {
            if stats.doc_frequency < min_doc_frequency {
                terms_to_remove.push(term.clone());
            }
        }

        // Remove rare terms from vocabulary
        for term in &terms_to_remove {
            self.vocab.remove(term);
        }

        // Remove terms from document statistics
        for doc_stats in &mut self.doc_stats {
            doc_stats
                .term_frequencies
                .retain(|term, _| !terms_to_remove.contains(term));
        }

        info!("Removed {} rare terms from index", terms_to_remove.len());
    }

    /// Merge another BM25 searcher into this one
    pub fn merge(&mut self, other: BM25Searcher) -> Result<()> {
        info!(
            "Merging BM25 index with {} documents",
            other.documents.len()
        );

        let start_doc_count = self.documents.len();

        // Add all documents from the other searcher
        self.add_documents(other.documents)?;

        // Merge vocabulary statistics
        for (term, other_stats) in other.vocab {
            let our_stats = self.vocab.entry(term.clone()).or_default();
            our_stats.doc_frequency += other_stats.doc_frequency;
            our_stats.total_term_frequency += other_stats.total_term_frequency;
        }

        info!(
            "Merged index now contains {} documents",
            self.documents.len()
        );

        Ok(())
    }
}

/// Advanced BM25 with additional features like field-specific search
pub struct AdvancedBM25Searcher {
    base_searcher: BM25Searcher,
    field_weights: HashMap<String, f64>,
}

impl AdvancedBM25Searcher {
    pub fn new(field_weights: HashMap<String, f64>) -> Self {
        Self {
            base_searcher: BM25Searcher::default(),
            field_weights,
        }
    }

    pub fn add_documents(&mut self, documents: Vec<Document>) -> Result<()> {
        self.base_searcher.add_documents(documents)
    }

    pub fn field_search(&self, request: FieldBM25SearchRequest) -> Result<Vec<BM25Result>> {
        info!("Field-based BM25 search: {:?}", request.fields);

        let mut field_results: HashMap<String, Vec<BM25Result>> = HashMap::new();

        // Search each field separately
        for (field_name, field_query) in &request.fields {
            let field_documents = self.extract_field_documents(field_name);

            if field_documents.is_empty() {
                continue;
            }

            let mut temp_searcher = BM25Searcher::default();
            temp_searcher.add_documents(field_documents)?;

            let field_request = BM25SearchRequest {
                query: field_query.clone(),
                limit: request.limit * 2, // Get more results to allow for merging
                min_score: request.min_score,
                boost_terms: request.boost_terms.clone(),
                filters: request.filters.clone(),
                tenant_id: request.tenant_id.clone(),
            };

            let results = temp_searcher.search(field_request)?;

            // Apply field weighting
            let field_weight = self.field_weights.get(field_name).unwrap_or(&1.0);
            let mut weighted_results = results;
            for result in &mut weighted_results {
                result.score *= field_weight;
            }

            field_results.insert(field_name.clone(), weighted_results);
        }

        // Merge results from different fields
        self.merge_field_results(field_results, request.limit)
    }

    fn extract_field_documents(&self, field_name: &str) -> Vec<Document> {
        self.base_searcher
            .documents
            .iter()
            .filter_map(|doc| {
                let field_content = match field_name {
                    "title" => doc.title.clone(),
                    "content" => Some(doc.content.clone()),
                    _ => doc
                        .metadata
                        .get(field_name)
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                };

                field_content.map(|content| Document {
                    id: doc.id.clone(),
                    content,
                    title: None, // We don't need nested titles
                    metadata: doc.metadata.clone(),
                })
            })
            .collect()
    }

    fn merge_field_results(
        &self,
        field_results: HashMap<String, Vec<BM25Result>>,
        limit: usize,
    ) -> Result<Vec<BM25Result>> {
        let mut merged_results: HashMap<String, BM25Result> = HashMap::new();

        // Merge results from different fields
        for (field_name, results) in field_results {
            for result in results {
                if let Some(existing) = merged_results.get_mut(&result.id) {
                    // Combine scores from different fields
                    existing.score += result.score;
                    existing.matched_terms.extend(result.matched_terms);
                    existing.term_scores.extend(result.term_scores);
                } else {
                    merged_results.insert(result.id.clone(), result);
                }
            }
        }

        // Convert to vector and sort by score
        let mut final_results: Vec<BM25Result> = merged_results.into_values().collect();
        final_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        final_results.truncate(limit);

        Ok(final_results)
    }
}

// Data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BM25Stats {
    pub document_count: usize,
    pub vocab_size: usize,
    pub avg_doc_length: f64,
    pub total_terms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TermInfo {
    pub term: String,
    pub doc_frequency: u32,
    pub total_term_frequency: u64,
    pub idf: f64,
    pub containing_docs: Vec<(usize, u32)>, // (doc_index, frequency)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldBM25SearchRequest {
    pub fields: HashMap<String, String>, // field_name -> query
    pub limit: usize,
    pub min_score: Option<f64>,
    pub boost_terms: Option<HashMap<String, f64>>,
    pub filters: Option<HashMap<String, String>>,
    pub tenant_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bm25_basic() {
        let mut searcher = BM25Searcher::new(1.2, 0.75);

        let documents = vec![
            Document {
                id: "doc1".to_string(),
                content: "the quick brown fox jumps over the lazy dog".to_string(),
                title: Some("Fox and Dog".to_string()),
                metadata: HashMap::new(),
            },
            Document {
                id: "doc2".to_string(),
                content: "never jump over the lazy dog".to_string(),
                title: Some("Dog Behavior".to_string()),
                metadata: HashMap::new(),
            },
        ];

        searcher.add_documents(documents).unwrap();

        let request = BM25SearchRequest {
            query: "quick brown fox".to_string(),
            limit: 10,
            min_score: None,
            boost_terms: None,
            filters: None,
            tenant_id: "test".to_string(),
        };

        let results = searcher.search(request).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "doc1");
        assert!(results[0].score > 0.0);
    }

    #[test]
    fn test_bm25_with_boosts() {
        let mut searcher = BM25Searcher::default();

        let documents = vec![
            Document {
                id: "doc1".to_string(),
                content: "artificial intelligence machine learning".to_string(),
                title: None,
                metadata: HashMap::new(),
            },
            Document {
                id: "doc2".to_string(),
                content: "machine learning algorithms".to_string(),
                title: None,
                metadata: HashMap::new(),
            },
        ];

        searcher.add_documents(documents).unwrap();

        let mut boost_terms = HashMap::new();
        boost_terms.insert("artificial".to_string(), 2.0);

        let request = BM25SearchRequest {
            query: "artificial intelligence machine learning".to_string(),
            limit: 10,
            min_score: None,
            boost_terms: Some(boost_terms),
            filters: None,
            tenant_id: "test".to_string(),
        };

        let results = searcher.search(request).unwrap();

        assert_eq!(results.len(), 2);
        // doc1 should rank higher due to "artificial" boost
        assert_eq!(results[0].id, "doc1");
    }

    #[test]
    fn test_text_normalization() {
        let normalized = BM25Searcher::normalize_text("Hello, World! This is a TEST.");
        assert_eq!(normalized, "hello world this is a test");
    }

    #[test]
    fn test_tokenization() {
        let tokens = BM25Searcher::tokenize("the quick brown fox");
        assert_eq!(tokens, vec!["the", "quick", "brown", "fox"]);
    }

    #[test]
    fn test_idf_calculation() {
        let mut searcher = BM25Searcher::default();

        let documents = vec![
            Document {
                id: "doc1".to_string(),
                content: "apple banana cherry".to_string(),
                title: None,
                metadata: HashMap::new(),
            },
            Document {
                id: "doc2".to_string(),
                content: "apple orange".to_string(),
                title: None,
                metadata: HashMap::new(),
            },
        ];

        searcher.add_documents(documents).unwrap();

        let apple_idf = searcher.calculate_idf("apple");
        let banana_idf = searcher.calculate_idf("banana");
        let cherry_idf = searcher.calculate_idf("cherry");
        let orange_idf = searcher.calculate_idf("orange");

        // Apple appears in both documents, so lower IDF
        assert!(apple_idf < banana_idf);
        assert!(apple_idf < cherry_idf);
        assert!(apple_idf < orange_idf);

        // Banana, cherry, and orange appear in one document each, so same IDF
        assert!((banana_idf - cherry_idf).abs() < 0.001);
        assert!((banana_idf - orange_idf).abs() < 0.001);
    }
}
