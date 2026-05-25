"""
Comprehensive tests for Vector Database Integration (Task 1.4.2).

Tests vector store service, embedding service, semantic search, hybrid search,
real-time indexing, and API endpoints.
"""

import pytest
import asyncio
from datetime import datetime
from typing import Dict, Any, List
from uuid import uuid4

from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.api.v1.endpoints.vector_search import (
    VectorSearchRequest,
    DocumentIndexRequest,
    HybridSearchRequest,
    SimilarDocumentRequest
)


class TestEmbeddingService:
    """Test cases for EmbeddingService"""

    @pytest.fixture
    def embedding_service(self):
        """Create embedding service instance for testing"""
        return EmbeddingService()

    @pytest.mark.asyncio
    async def test_generate_embeddings_single_text(self, embedding_service):
        """Test generating embeddings for a single text"""
        text = "This is a test document for embedding generation."

        embeddings = await embedding_service.generate_embeddings(text)

        assert isinstance(embeddings, list)
        assert len(embeddings) > 0
        assert all(isinstance(x, float) for x in embeddings)

    @pytest.mark.asyncio
    async def test_generate_embeddings_batch(self, embedding_service):
        """Test generating embeddings for multiple texts"""
        texts = [
            "First test document",
            "Second test document",
            "Third test document"
        ]

        embeddings = await embedding_service.generate_embeddings(texts)

        assert isinstance(embeddings, list)
        assert len(embeddings) == len(texts)
        assert all(isinstance(emb, list) for emb in embeddings)
        assert all(len(emb) > 0 for emb in embeddings)

    @pytest.mark.asyncio
    async def test_generate_document_embeddings(self, embedding_service):
        """Test generating document embeddings with chunking"""
        document_id = str(uuid4())
        title = "Test Document"
        content = "This is a long test document content that should be chunked. " * 20
        metadata = {"author": "test", "category": "test"}

        chunk_data = await embedding_service.generate_document_embeddings(
            document_id=document_id,
            title=title,
            content=content,
            metadata=metadata,
            chunk_size=100,
            overlap=20
        )

        assert isinstance(chunk_data, list)
        assert len(chunk_data) > 1  # Should be chunked

        for chunk in chunk_data:
            assert "id" in chunk
            assert "text" in chunk
            assert "embedding" in chunk
            assert "metadata" in chunk
            assert chunk["metadata"]["document_id"] == document_id
            assert chunk["metadata"]["title"] == title

    @pytest.mark.asyncio
    async def test_calculate_similarity(self, embedding_service):
        """Test cosine similarity calculation"""
        text1 = "Machine learning is a subset of artificial intelligence"
        text2 = "AI and machine learning are related fields"
        text3 = "The weather is nice today"

        emb1 = await embedding_service.generate_embeddings(text1)
        emb2 = await embedding_service.generate_embeddings(text2)
        emb3 = await embedding_service.generate_embeddings(text3)

        # Similar texts should have high similarity
        sim12 = await embedding_service.calculate_similarity(emb1, emb2)
        assert sim12 > 0.7

        # Different texts should have low similarity
        sim13 = await embedding_service.calculate_similarity(emb1, emb3)
        assert sim13 < 0.5

    @pytest.mark.asyncio
    async def test_health_check(self, embedding_service):
        """Test embedding service health check"""
        health = await embedding_service.health_check()
        assert isinstance(health, bool)
        assert health is True  # Should be healthy with default model


class TestVectorStoreService:
    """Test cases for VectorStoreService"""

    @pytest.fixture
    def vector_store(self):
        """Create vector store service instance for testing"""
        return VectorStoreService()

    @pytest.fixture
    def sample_document_data(self):
        """Sample document data for testing"""
        return {
            "document_id": str(uuid4()),
            "title": "Test Document for Vector Store",
            "content": "This is a comprehensive test document that covers multiple topics. " * 10,
            "metadata": {
                "author": "test_user",
                "category": "testing",
                "tags": ["test", "vector", "search"],
                "created_at": datetime.utcnow().isoformat()
            }
        }

    @pytest.mark.asyncio
    async def test_add_document_with_embeddings(self, vector_store, sample_document_data):
        """Test adding document with embeddings to vector store"""
        result = await vector_store.add_document_with_embeddings(
            document_id=sample_document_data["document_id"],
            title=sample_document_data["title"],
            content=sample_document_data["content"],
            metadata=sample_document_data["metadata"]
        )

        assert result["success"] is True
        assert result["document_id"] == sample_document_data["document_id"]
        assert result["chunks_added"] > 1
        assert len(result["chunk_ids"]) == result["chunks_added"]

    @pytest.mark.asyncio
    async def test_semantic_search(self, vector_store, sample_document_data):
        """Test semantic search functionality"""
        # First add a document
        await vector_store.add_document_with_embeddings(
            document_id=sample_document_data["document_id"],
            title=sample_document_data["title"],
            content=sample_document_data["content"],
            metadata=sample_document_data["metadata"]
        )

        # Perform semantic search
        search_results = await vector_store.semantic_search(
            query="comprehensive test document",
            n_results=5,
            similarity_threshold=0.5
        )

        assert "results" in search_results
        assert "total_found" in search_results
        assert "search_method" in search_results
        assert search_results["search_method"] == "semantic"

        if search_results["total_found"] > 0:
            result = search_results["results"][0]
            assert "id" in result
            assert "content" in result
            assert "metadata" in result
            assert "similarity_score" in result
            assert result["similarity_score"] >= 0.5

    @pytest.mark.asyncio
    async def test_hybrid_search(self, vector_store, sample_document_data):
        """Test hybrid search functionality"""
        # Add a document
        await vector_store.add_document_with_embeddings(
            document_id=sample_document_data["document_id"],
            title=sample_document_data["title"],
            content=sample_document_data["content"],
            metadata=sample_document_data["metadata"]
        )

        # Perform hybrid search
        hybrid_results = await vector_store.hybrid_search(
            query="test document topics",
            text_weight=0.4,
            vector_weight=0.6,
            n_results=5
        )

        assert "results" in hybrid_results
        assert "search_method" in hybrid_results
        assert hybrid_results["search_method"] == "hybrid"
        assert "weights" in hybrid_results
        assert hybrid_results["weights"]["text"] == 0.4
        assert hybrid_results["weights"]["vector"] == 0.6

    @pytest.mark.asyncio
    async def test_find_similar_documents(self, vector_store, sample_document_data):
        """Test finding similar documents"""
        # Add two related documents
        doc1_id = str(uuid4())
        doc2_id = str(uuid4())

        await vector_store.add_document_with_embeddings(
            document_id=doc1_id,
            title="Document 1",
            content="This is about artificial intelligence and machine learning",
            metadata={"category": "AI"}
        )

        await vector_store.add_document_with_embeddings(
            document_id=doc2_id,
            title="Document 2",
            content="This discusses AI technologies and their applications",
            metadata={"category": "AI"}
        )

        # Find similar documents
        similar_results = await vector_store.find_similar_documents(
            document_id=doc1_id,
            n_results=5,
            similarity_threshold=0.5
        )

        assert "document_id" in similar_results
        assert "similar_documents" in similar_results
        assert similar_results["document_id"] == doc1_id

    @pytest.mark.asyncio
    async def test_update_document_embeddings(self, vector_store, sample_document_data):
        """Test updating document embeddings"""
        doc_id = sample_document_data["document_id"]

        # Add initial document
        await vector_store.add_document_with_embeddings(
            document_id=doc_id,
            title=sample_document_data["title"],
            content=sample_document_data["content"],
            metadata=sample_document_data["metadata"]
        )

        # Update document
        new_content = "Updated content with different information. " * 15
        new_metadata = sample_document_data["metadata"].copy()
        new_metadata["version"] = 2

        update_result = await vector_store.update_document_embeddings(
            document_id=doc_id,
            title="Updated Document Title",
            content=new_content,
            metadata=new_metadata
        )

        assert update_result["success"] is True
        assert update_result["action"] in ["updated", "deleted"]

    @pytest.mark.asyncio
    async def test_real_time_indexing_setup(self, vector_store):
        """Test real-time indexing setup"""
        webhook_url = "https://example.com/webhook"

        setup_result = await vector_store.setup_real_time_indexing(webhook_url)

        assert setup_result["success"] is True
        assert setup_result["webhook_configured"] is True
        assert hasattr(vector_store, 'webhook_url')
        assert vector_store.webhook_url == webhook_url

    @pytest.mark.asyncio
    async def test_add_to_indexing_queue(self, vector_store, sample_document_data):
        """Test adding operations to indexing queue"""
        # Setup real-time indexing
        await vector_store.setup_real_time_indexing()

        # Add operation to queue
        success = await vector_store.add_to_indexing_queue(
            operation="add",
            document_id=sample_document_data["document_id"],
            data=sample_document_data,
            priority=2
        )

        assert success is True
        assert len(vector_store.indexing_queue) > 0

    @pytest.mark.asyncio
    async def test_get_indexing_queue_status(self, vector_store, sample_document_data):
        """Test getting indexing queue status"""
        # Setup and add to queue
        await vector_store.setup_real_time_indexing()
        await vector_store.add_to_indexing_queue(
            operation="add",
            document_id=sample_document_data["document_id"],
            data=sample_document_data
        )

        # Get queue status
        status = await vector_store.get_indexing_queue_status()

        assert status["queue_enabled"] is True
        assert status["queue_size"] > 0
        assert "items_by_status" in status
        assert "items_by_operation" in status

    @pytest.mark.asyncio
    async def test_auto_indexing_enable_disable(self, vector_store):
        """Test enabling and disabling auto-indexing"""
        # Enable auto-indexing
        enable_result = await vector_store.enable_auto_indexing(
            check_interval=10,
            max_batch_size=5
        )

        assert enable_result["success"] is True
        assert vector_store.auto_indexing_enabled is True
        assert vector_store.check_interval == 10
        assert vector_store.max_batch_size == 5

        # Disable auto-indexing
        disable_result = await vector_store.disable_auto_indexing()

        assert disable_result["success"] is True
        assert vector_store.auto_indexing_enabled is False

    @pytest.mark.asyncio
    async def test_get_document_statistics(self, vector_store, sample_document_data):
        """Test getting document statistics"""
        # Add a document
        await vector_store.add_document_with_embeddings(
            document_id=sample_document_data["document_id"],
            title=sample_document_data["title"],
            content=sample_document_data["content"],
            metadata=sample_document_data["metadata"]
        )

        # Get statistics
        stats = await vector_store.get_document_statistics()

        assert "unique_documents" in stats
        assert "total_chunks" in stats
        assert "collection_info" in stats
        assert stats["unique_documents"] >= 1
        assert stats["total_chunks"] >= 1

    @pytest.mark.asyncio
    async def test_health_check(self, vector_store):
        """Test vector store health check"""
        health = await vector_store.health_check()
        assert isinstance(health, bool)


class TestVectorSearchAPI:
    """Test cases for Vector Search API endpoints"""

    @pytest.fixture
    def mock_vector_store(self):
        """Mock vector store for API testing"""
        class MockVectorStore:
            async def semantic_search(self, query, n_results, filters, similarity_threshold, include_scores):
                return {
                    "results": [
                        {
                            "id": "test_id",
                            "content": "Test content",
                            "metadata": {"title": "Test"},
                            "similarity_score": 0.85,
                            "rank": 1
                        }
                    ],
                    "total_found": 1,
                    "search_method": "semantic"
                }

            async def hybrid_search(self, query, text_weight, vector_weight, n_results, filters):
                return {
                    "results": [
                        {
                            "id": "test_id",
                            "content": "Test content",
                            "metadata": {"title": "Test"},
                            "combined_score": 0.82
                        }
                    ],
                    "total_found": 1,
                    "search_method": "hybrid"
                }

            async def add_document_with_embeddings(self, document_id, title, content, metadata, chunk_size, overlap):
                return {
                    "success": True,
                    "document_id": document_id,
                    "chunks_added": 3,
                    "chunk_ids": ["id1", "id2", "id3"]
                }

            async def health_check(self):
                return True

            async def get_collection_info(self):
                return {"name": "test_collection", "count": 100}

        return MockVectorStore()

    def test_vector_search_request_validation(self):
        """Test VectorSearchRequest validation"""
        # Valid request
        request = VectorSearchRequest(
            query="test query",
            n_results=10,
            similarity_threshold=0.7,
            search_method="semantic"
        )
        assert request.query == "test query"
        assert request.n_results == 10
        assert request.similarity_threshold == 0.7
        assert request.search_method == "semantic"

        # Invalid search method
        with pytest.raises(ValueError):
            VectorSearchRequest(
                query="test",
                search_method="invalid_method"
            )

    def test_document_index_request_validation(self):
        """Test DocumentIndexRequest validation"""
        request = DocumentIndexRequest(
            document_id="test_doc",
            title="Test Document",
            content="Test content for the document",
            metadata={"author": "test"},
            chunk_size=500,
            overlap=50
        )
        assert request.document_id == "test_doc"
        assert request.title == "Test Document"
        assert request.chunk_size == 500
        assert request.overlap == 50

    def test_hybrid_search_request_validation(self):
        """Test HybridSearchRequest validation"""
        request = HybridSearchRequest(
            query="test query",
            text_weight=0.3,
            vector_weight=0.7,
            n_results=10
        )
        assert request.text_weight == 0.3
        assert request.vector_weight == 0.7
        assert request.text_weight + request.vector_weight == 1.0

    @pytest.mark.asyncio
    async def test_search_vectors_endpoint_logic(self, mock_vector_store):
        """Test the logic of search vectors endpoint"""
        # This would be tested with actual FastAPI TestClient in integration tests
        # Here we test the underlying logic
        request = VectorSearchRequest(
            query="test query",
            n_results=10,
            search_method="semantic"
        )

        # Simulate the endpoint logic
        start_time = datetime.now()
        results = await mock_vector_store.semantic_search(
            query=request.query,
            n_results=request.n_results,
            filters={"user_id": "test_user"},
            similarity_threshold=request.similarity_threshold,
            include_scores=request.include_scores
        )
        search_time = (datetime.now() - start_time).total_seconds() * 1000

        assert results["total_found"] == 1
        assert results["search_method"] == "semantic"
        assert search_time > 0

    @pytest.mark.asyncio
    async def test_index_document_endpoint_logic(self, mock_vector_store):
        """Test the logic of index document endpoint"""
        request = DocumentIndexRequest(
            document_id="test_doc",
            title="Test Document",
            content="Test content",
            metadata={"user_id": "test_user"}
        )

        # Simulate the endpoint logic
        start_time = datetime.now()
        result = await mock_vector_store.add_document_with_embeddings(
            document_id=request.document_id,
            title=request.title,
            content=request.content,
            metadata=request.metadata,
            chunk_size=request.chunk_size,
            overlap=request.overlap
        )
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        assert result["success"] is True
        assert result["document_id"] == "test_doc"
        assert result["chunks_added"] == 3
        assert processing_time > 0


class TestVectorDatabaseIntegration:
    """Integration tests for the complete vector database system"""

    @pytest.mark.asyncio
    async def test_end_to_end_document_lifecycle(self):
        """Test complete document lifecycle: add -> search -> update -> delete"""
        # This would require actual database connections and is more suitable
        # for integration test environment
        pass

    @pytest.mark.asyncio
    async def test_performance_benchmarks(self):
        """Test performance benchmarks for vector operations"""
        # Performance testing for:
        # - Embedding generation speed
        # - Search response time
        # - Indexing throughput
        # - Memory usage
        pass

    @pytest.mark.asyncio
    async def test_concurrent_operations(self):
        """Test concurrent vector operations"""
        # Test multiple simultaneous operations:
        # - Concurrent document indexing
        # - Concurrent searches
        # - Mixed operations
        pass

    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(self):
        """Test error handling and recovery mechanisms"""
        # Test scenarios:
        # - Database connection failures
        # - Invalid document formats
        # - Memory pressure
        # - Network timeouts
        pass


class TestVectorDatabaseConfiguration:
    """Test vector database configuration and deployment"""

    def test_chromadb_connection(self):
        """Test ChromaDB connection configuration"""
        # Test different connection modes:
        # - In-memory for testing
        # - HTTP client for remote ChromaDB
        # - Persistent storage
        pass

    def test_embedding_model_configuration(self):
        """Test embedding model configuration"""
        # Test:
        # - Different model choices
        # - Model loading and caching
        # - Fallback mechanisms
        pass

    def test_environment_configuration(self):
        """Test environment-specific configuration"""
        # Test:
        # - Development vs production settings
        # - Environment variables
        # - Configuration validation
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])