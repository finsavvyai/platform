// Test Template for Vector-Core Service (Rust)
// Location: SDLC/services/vector-core/tests/

use super::*;
use std::time::Instant;

// ============================================
// UNIT TESTS - Vector Embeddings
// ============================================

#[cfg(test)]
mod embedding_tests {
    use super::*;

    #[test]
    fn test_generate_embedding_success() {
        // Arrange
        let text = "This is a test document for embedding generation";
        let model = "text-embedding-ada-002";

        // Act
        let result = generate_embedding(text, model);

        // Assert
        assert!(result.is_ok());
        let embedding = result.unwrap();
        assert_eq!(embedding.len(), 1536); // OpenAI ada-002 dimension
        assert!(embedding.iter().all(|&v| v.is_finite()));
    }

    #[test]
    fn test_generate_embedding_empty_text() {
        // Arrange
        let text = "";

        // Act
        let result = generate_embedding(text, "text-embedding-ada-002");

        // Assert
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().to_string(),
            "Text cannot be empty"
        );
    }

    #[test]
    fn test_generate_embedding_invalid_model() {
        // Arrange
        let text = "Test text";
        let model = "invalid-model-name";

        // Act
        let result = generate_embedding(text, model);

        // Assert
        assert!(result.is_err());
    }

    #[test]
    fn test_batch_embedding_generation() {
        // Arrange
        let texts = vec![
            "First document",
            "Second document",
            "Third document",
        ];

        // Act
        let result = generate_embeddings_batch(&texts, "text-embedding-ada-002");

        // Assert
        assert!(result.is_ok());
        let embeddings = result.unwrap();
        assert_eq!(embeddings.len(), 3);
        assert!(embeddings.iter().all(|e| e.len() == 1536));
    }

    #[test]
    fn test_embedding_dimension_validation() {
        // Arrange
        let embedding = vec![0.1; 1536];

        // Act
        let result = validate_embedding_dimension(&embedding, 1536);

        // Assert
        assert!(result.is_ok());
    }

    #[test]
    fn test_embedding_dimension_validation_fails() {
        // Arrange
        let embedding = vec![0.1; 512]; // Wrong dimension

        // Act
        let result = validate_embedding_dimension(&embedding, 1536);

        // Assert
        assert!(result.is_err());
    }
}

// ============================================
// UNIT TESTS - Similarity Search
// ============================================

#[cfg(test)]
mod search_tests {
    use super::*;

    #[test]
    fn test_vector_similarity_search() {
        // Arrange
        let index = setup_test_index();
        let query_vector = vec![0.5; 1536];
        let k = 10;

        // Act
        let result = search_similar(&index, &query_vector, k);

        // Assert
        assert!(result.is_ok());
        let results = result.unwrap();
        assert!(results.len() <= k);
        assert!(results.windows(2).all(|w| w[0].score >= w[1].score)); // Sorted by score
    }

    #[test]
    fn test_search_with_filters() {
        // Arrange
        let index = setup_test_index();
        let query_vector = vec![0.5; 1536];
        let filters = vec![
            ("category", "technology"),
            ("author", "john"),
        ];

        // Act
        let result = search_with_filters(&index, &query_vector, 10, &filters);

        // Assert
        assert!(result.is_ok());
        let results = result.unwrap();
        assert!(results.iter().all(|r| {
            r.metadata.get("category") == Some(&"technology".to_string())
        }));
    }

    #[test]
    fn test_knn_search_accuracy() {
        // Arrange: Create index with known vectors
        let mut index = VectorIndex::new(1536);
        let target = vec![1.0; 1536];

        // Add similar vectors
        for i in 0..100 {
            let mut vec = target.clone();
            vec[0] += i as f32 * 0.01; // Small perturbation
            index.add(i as u64, vec, HashMap::new()).unwrap();
        }

        // Act: Search for exact target
        let results = search_similar(&index, &target, 5).unwrap();

        // Assert: Top 5 should be most similar
        assert_eq!(results.len(), 5);
        assert!(results[0].score > 0.99); // Very similar
    }

    #[test]
    fn test_ann_search_performance() {
        // Arrange
        let index = setup_large_test_index(10000); // 10K vectors
        let query = vec![0.5; 1536];

        // Act
        let start = Instant::now();
        let result = search_similar(&index, &query, 10);
        let duration = start.elapsed();

        // Assert
        assert!(result.is_ok());
        assert!(duration.as_millis() < 50); // Should be fast (<50ms)
    }

    #[test]
    fn test_search_with_score_threshold() {
        // Arrange
        let index = setup_test_index();
        let query = vec![0.5; 1536];
        let threshold = 0.8;

        // Act
        let result = search_with_threshold(&index, &query, 10, threshold);

        // Assert
        assert!(result.is_ok());
        let results = result.unwrap();
        assert!(results.iter().all(|r| r.score >= threshold));
    }

    #[test]
    fn test_hybrid_search() {
        // Arrange: Combine vector + keyword search
        let index = setup_test_index();
        let query_vector = vec![0.5; 1536];
        let keywords = vec!["machine", "learning"];

        // Act
        let result = hybrid_search(&index, &query_vector, &keywords, 10);

        // Assert
        assert!(result.is_ok());
        let results = result.unwrap();
        assert!(!results.is_empty());
    }

    #[test]
    fn test_search_pagination() {
        // Arrange
        let index = setup_test_index();
        let query = vec![0.5; 1536];

        // Act: Get first page
        let page1 = search_paginated(&index, &query, 10, 0).unwrap();
        // Get second page
        let page2 = search_paginated(&index, &query, 10, 10).unwrap();

        // Assert
        assert_eq!(page1.len(), 10);
        assert_eq!(page2.len(), 10);
        assert_ne!(page1[0].id, page2[0].id); // Different results
    }

    #[test]
    fn test_empty_search_results() {
        // Arrange: Empty index
        let index = VectorIndex::new(1536);
        let query = vec![0.5; 1536];

        // Act
        let result = search_similar(&index, &query, 10);

        // Assert
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
}

// ============================================
// INTEGRATION TESTS
// ============================================

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[test]
    fn test_end_to_end_indexing_and_search() {
        // Arrange: Create index and add documents
        let mut index = VectorIndex::new(1536);
        let documents = vec![
            ("The cat sat on the mat", "doc1"),
            ("The dog played in the park", "doc2"),
            ("Machine learning is fascinating", "doc3"),
        ];

        // Act: Index all documents
        for (text, id) in documents.iter() {
            let embedding = generate_embedding(text, "text-embedding-ada-002").unwrap();
            let metadata = HashMap::from([("id".to_string(), id.to_string())]);
            index.add(id.len() as u64, embedding, metadata).unwrap();
        }

        // Search for similar document
        let query_text = "A feline resting on a rug";
        let query_embedding = generate_embedding(query_text, "text-embedding-ada-002").unwrap();
        let results = search_similar(&index, &query_embedding, 3).unwrap();

        // Assert: "cat on mat" should be top result
        assert!(!results.is_empty());
        assert_eq!(results[0].metadata.get("id").unwrap(), "doc1");
    }

    #[test]
    fn test_concurrent_search_requests() {
        use std::thread;

        // Arrange
        let index = Arc::new(setup_test_index());
        let query = vec![0.5; 1536];

        // Act: Spawn multiple concurrent searches
        let mut handles = vec![];
        for _ in 0..10 {
            let index_clone = Arc::clone(&index);
            let query_clone = query.clone();

            let handle = thread::spawn(move || {
                search_similar(&index_clone, &query_clone, 10)
            });
            handles.push(handle);
        }

        // Assert: All searches succeed
        for handle in handles {
            let result = handle.join().unwrap();
            assert!(result.is_ok());
        }
    }
}

// ============================================
// PERFORMANCE TESTS
// ============================================

#[cfg(test)]
mod performance_tests {
    use super::*;

    #[test]
    fn test_index_build_performance() {
        // Arrange
        let vectors_count = 10000;
        let dimension = 1536;

        // Act
        let start = Instant::now();
        let mut index = VectorIndex::new(dimension);
        for i in 0..vectors_count {
            let vec = vec![0.5; dimension];
            index.add(i, vec, HashMap::new()).unwrap();
        }
        let duration = start.elapsed();

        // Assert: Should index 10K vectors quickly
        println!("Indexed {} vectors in {:?}", vectors_count, duration);
        assert!(duration.as_secs() < 5); // Less than 5 seconds
    }

    #[test]
    fn test_search_latency_p95() {
        // Arrange
        let index = setup_large_test_index(100000); // 100K vectors
        let query = vec![0.5; 1536];
        let iterations = 100;

        // Act: Measure search latency
        let mut latencies = vec![];
        for _ in 0..iterations {
            let start = Instant::now();
            search_similar(&index, &query, 10).unwrap();
            latencies.push(start.elapsed().as_millis());
        }

        // Assert: P95 latency should be acceptable
        latencies.sort();
        let p95_latency = latencies[(iterations * 95 / 100) as usize];
        println!("P95 latency: {}ms", p95_latency);
        assert!(p95_latency < 100); // Less than 100ms at P95
    }

    #[test]
    fn test_memory_usage() {
        // Arrange
        let vectors_count = 10000;
        let dimension = 1536;

        // Act: Build index and measure memory
        let mut index = VectorIndex::new(dimension);
        for i in 0..vectors_count {
            let vec = vec![0.5; dimension];
            index.add(i, vec, HashMap::new()).unwrap();
        }

        let memory_usage = index.memory_usage_bytes();

        // Assert: Memory should be reasonable
        let expected_min = vectors_count * dimension * 4; // f32 = 4 bytes
        let expected_max = expected_min * 2; // Allow 2x for overhead

        println!("Memory usage: {} MB", memory_usage / 1024 / 1024);
        assert!(memory_usage >= expected_min);
        assert!(memory_usage <= expected_max);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

fn setup_test_index() -> VectorIndex {
    let mut index = VectorIndex::new(1536);

    // Add some test vectors
    for i in 0..100 {
        let vec = vec![i as f32 / 100.0; 1536];
        let metadata = HashMap::from([
            ("id".to_string(), i.to_string()),
            ("category".to_string(), if i % 2 == 0 { "technology" } else { "science" }.to_string()),
        ]);
        index.add(i, vec, metadata).unwrap();
    }

    index
}

fn setup_large_test_index(size: usize) -> VectorIndex {
    let mut index = VectorIndex::new(1536);

    for i in 0..size {
        let vec = vec![i as f32 / size as f32; 1536];
        index.add(i as u64, vec, HashMap::new()).unwrap();
    }

    index
}

// Run tests with:
// cargo test
// cargo test --release  (for performance tests)
// cargo test -- --nocapture  (to see println! output)
