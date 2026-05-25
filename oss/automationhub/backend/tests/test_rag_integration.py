"""
Integration tests for RAG system with actual services.

Tests integration between RAG service, vector store, LLM service,
and caching components.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from datetime import datetime
from uuid import uuid4

from app.services.rag_service import RAGService, RAGQuery
from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.services.llm_service import LLMService
from app.services.cache_service import SmartCacheService


@pytest.fixture
async def mock_rag_service():
    """Create RAG service with mocked dependencies for integration testing."""
    service = RAGService()

    # Mock vector store
    service.vector_store = AsyncMock(spec=VectorStoreService)
    service.vector_store.hybrid_search.return_value = {
        "results": [
            {
                "id": "test_chunk_1",
                "content": "Artificial Intelligence (AI) is transforming how we interact with technology. Machine learning algorithms enable computers to learn from data.",
                "combined_score": 0.92,
                "similarity_score": 0.92,
                "metadata": {
                    "document_id": "doc_ai_guide",
                    "source": "ai_documentation",
                    "title": "Complete Guide to AI",
                    "author": "AI Research Team",
                    "url": "https://example.com/ai-guide"
                }
            },
            {
                "id": "test_chunk_2",
                "content": "Deep learning is a subset of machine learning that uses neural networks with multiple layers to progressively extract higher-level features.",
                "combined_score": 0.85,
                "similarity_score": 0.85,
                "metadata": {
                    "document_id": "doc_dl_basics",
                    "source": "ml_documentation",
                    "title": "Deep Learning Fundamentals"
                }
            }
        ]
    }

    # Mock embedding service
    service.embedding_service = AsyncMock(spec=EmbeddingService)
    service.embedding_service.health_check.return_value = True

    # Mock LLM service
    service.llm_service = AsyncMock(spec=LLMService)
    service.llm_service.generate_response.return_value = {
        "content": "Based on the context provided, Artificial Intelligence (AI) is indeed transforming technology through machine learning algorithms that enable computers to learn from data. Deep learning, a subset of ML, uses multi-layered neural networks to extract features progressively.",
        "tokens_used": 65,
        "model": "gpt-4",
        "confidence_score": 0.94
    }

    # Mock cache service
    service.cache_service = AsyncMock(spec=SmartCacheService)
    service.cache_service.get.return_value = None  # No cache hits initially
    service.cache_service.set.return_value = True

    return service


class TestRAGIntegration:
    """Integration tests for RAG system components."""

    @pytest.mark.asyncio
    async def test_complete_rag_pipeline(self, mock_rag_service):
        """Test complete RAG pipeline from query to response."""
        query = RAGQuery(
            query="What is the relationship between AI and deep learning?",
            conversation_id="test_conv_integration",
            user_id="test_user_123",
            max_context_items=5,
            similarity_threshold=0.7,
            include_sources=True,
            language="en"
        )

        # Process query
        response = await mock_rag_service.process_query(query)

        # Verify pipeline executed correctly
        assert response.query == query.query
        assert response.conversation_id == query.conversation_id
        assert response.answer
        assert response.confidence_score > 0.9  # High confidence with good context
        assert response.processing_time_ms > 0
        assert response.tokens_used == 65

        # Verify context retrieval
        assert len(response.context_items) == 2
        assert all(context.similarity_score >= query.similarity_threshold for context in response.context_items)

        # Verify citations
        assert len(response.citations) == 2
        assert all(citation.confidence >= mock_rag_service.citation_min_confidence for citation in response.citations)

        # Verify service calls
        mock_rag_service.vector_store.hybrid_search.assert_called_once()
        mock_rag_service.llm_service.generate_response.assert_called_once()

    @pytest.mark.asyncio
    async def test_rag_with_caching(self, mock_rag_service):
        """Test RAG functionality with caching."""
        query = RAGQuery(
            query="Explain machine learning",
            conversation_id="test_conv_cache",
            user_id="test_user_123"
        )

        # First query - no cache hit
        response1 = await mock_rag_service.process_query(query)
        mock_rag_service.cache_service.get.assert_called()
        mock_rag_service.cache_service.set.assert_called()

        # Reset mocks
        mock_rag_service.cache_service.get.reset_mock()
        mock_rag_service.cache_service.set.reset_mock()

        # Second query - cache hit (mocked)
        mock_rag_service.cache_service.get.return_value = response1
        response2 = await mock_rag_service.process_query(query)

        # Verify cache was checked
        mock_rag_service.cache_service.get.assert_called()

    @pytest.mark.asyncio
    async def test_rag_conversation_context(self, mock_rag_service):
        """Test RAG with conversation context maintenance."""
        conversation_id = "test_conv_context"
        user_id = "test_user_123"

        # First query
        query1 = RAGQuery(
            query="What is AI?",
            conversation_id=conversation_id,
            user_id=user_id
        )
        response1 = await mock_rag_service.process_query(query1)

        # Second query - should use conversation context
        query2 = RAGQuery(
            query="Tell me more about its applications",
            conversation_id=conversation_id,
            user_id=user_id
        )
        response2 = await mock_rag_service.process_query(query2)

        # Verify conversation memory
        assert conversation_id in mock_rag_service.conversation_memories
        memory = mock_rag_service.conversation_memories[conversation_id]
        assert len(memory.messages) == 4  # 2 user + 2 assistant messages

        # Verify context was used in second query
        assert response2.conversation_id == conversation_id

    @pytest.mark.asyncio
    async def test_rag_multi_language_pipeline(self, mock_rag_service):
        """Test RAG pipeline with different languages."""
        languages_and_queries = [
            ("en", "What is artificial intelligence?"),
            ("es", "¿Qué es la inteligencia artificial?"),
            ("fr", "Qu'est-ce que l'intelligence artificielle?")
        ]

        for language, query_text in languages_and_queries:
            query = RAGQuery(
                query=query_text,
                conversation_id=f"conv_{language}",
                user_id="test_user_123",
                language=language
            )

            # Mock language-specific response
            expected_responses = {
                "en": "Based on the context, artificial intelligence is...",
                "es": "Según el contexto, la inteligencia artificial es...",
                "fr": "Selon le contexte, l'intelligence artificielle est..."
            }

            mock_rag_service.llm_service.generate_response.return_value = {
                "content": expected_responses[language],
                "tokens_used": 45,
                "model": "gpt-4",
                "confidence_score": 0.88
            }

            response = await mock_rag_service.process_query(query)

            # Verify language-specific processing
            assert response.language == language
            assert response.answer == expected_responses[language]

    @pytest.mark.asyncio
    async def test_rag_error_handling_pipeline(self, mock_rag_service):
        """Test RAG pipeline error handling."""
        query = RAGQuery(
            query="Test query",
            conversation_id="test_error_conv",
            user_id="test_user_123"
        )

        # Test vector store failure
        mock_rag_service.vector_store.hybrid_search.side_effect = Exception("Vector store unavailable")

        response = await mock_rag_service.process_query(query)

        # Verify graceful degradation
        assert response.confidence_score < 0.5  # Lower confidence without context
        assert len(response.context_items) == 0
        assert len(response.citations) == 0
        assert response.answer  # Still generates response

        # Reset and test LLM failure
        mock_rag_service.vector_store.hybrid_search.side_effect = None
        mock_rag_service.vector_store.hybrid_search.return_value = {"results": []}
        mock_rag_service.llm_service.generate_response.side_effect = Exception("LLM unavailable")

        response = await mock_rag_service.process_query(query)

        # Verify error handling
        assert response.confidence_score == 0.0
        assert "apologize" in response.answer.lower()
        assert response.tokens_used == 0

    @pytest.mark.asyncio
    async def test_rag_citation_quality(self, mock_rag_service):
        """Test RAG citation generation and quality."""
        # Create high-quality context
        mock_rag_service.vector_store.hybrid_search.return_value = {
            "results": [
                {
                    "id": "chunk_citation_1",
                    "content": "According to research by Smith et al. (2023), AI systems demonstrate significant improvements in accuracy when trained on diverse datasets.",
                    "combined_score": 0.95,
                    "similarity_score": 0.95,
                    "metadata": {
                        "document_id": "doc_research_paper",
                        "source": "academic_journal",
                        "title": "AI Research Advances: A Comprehensive Study",
                        "author": "Dr. Jane Smith",
                        "url": "https://doi.org/10.1234/ai-research.2023",
                        "publication_date": "2023-03-15"
                    }
                }
            ]
        }

        query = RAGQuery(
            query="What does recent research say about AI accuracy?",
            conversation_id="test_citation_conv",
            user_id="test_user_123",
            include_sources=True
        )

        response = await mock_rag_service.process_query(query)

        # Verify citation quality
        assert len(response.citations) == 1
        citation = response.citations[0]

        assert citation.source == "academic_journal"
        assert citation.document_id == "doc_research_paper"
        assert citation.title == "AI Research Advances: A Comprehensive Study"
        assert citation.author == "Dr. Jane Smith"
        assert citation.url == "https://doi.org/10.1234/ai-research.2023"
        assert citation.confidence >= mock_rag_service.citation_min_confidence
        assert citation.text_snippet  # Should contain text snippet

    @pytest.mark.asyncio
    async def test_rag_confidence_scoring(self, mock_rag_service):
        """Test RAG confidence scoring algorithm."""
        # Test high confidence scenario
        mock_rag_service.vector_store.hybrid_search.return_value = {
            "results": [
                {
                    "id": "high_conf_chunk",
                    "content": "This is highly relevant content with a perfect match.",
                    "combined_score": 0.98,
                    "similarity_score": 0.98,
                    "metadata": {"document_id": "doc_1", "source": "test", "title": "High Quality Document"}
                }
            ]
        }

        high_conf_query = RAGQuery(
            query="Perfect match query",
            conversation_id="test_high_conf",
            user_id="test_user_123"
        )

        response = await mock_rag_service.process_query(high_conf_query)
        assert response.confidence_score > 0.8  # High confidence with excellent context

        # Test low confidence scenario
        mock_rag_service.vector_store.hybrid_search.return_value = {"results": []}
        mock_rag_service.llm_service.generate_response.return_value = {
            "content": "I don't have enough information to answer this question.",
            "tokens_used": 15,
            "model": "gpt-4",
            "confidence_score": 0.3
        }

        low_conf_query = RAGQuery(
            query="Query with no relevant context",
            conversation_id="test_low_conf",
            user_id="test_user_123"
        )

        response = await mock_rag_service.process_query(low_conf_query)
        assert response.confidence_score < 0.5  # Low confidence without context

    @pytest.mark.asyncio
    async def test_rag_concurrent_processing(self, mock_rag_service):
        """Test RAG concurrent query processing."""
        queries = []
        expected_responses = []

        for i in range(5):
            query = RAGQuery(
                query=f"Concurrent test query {i}",
                conversation_id=f"conv_concurrent_{i}",
                user_id="test_user_123"
            )
            queries.append(query)

            # Mock different responses for each query
            mock_rag_service.llm_service.generate_response.return_value = {
                "content": f"Response to concurrent test query {i}",
                "tokens_used": 40 + i,
                "model": "gpt-4",
                "confidence_score": 0.85 + (i * 0.01)
            }

        # Process queries concurrently
        tasks = [mock_rag_service.process_query(query) for query in queries]
        responses = await asyncio.gather(*tasks)

        # Verify all queries were processed correctly
        assert len(responses) == 5
        for i, response in enumerate(responses):
            assert f"Response to concurrent test query {i}" in response.answer
            assert response.conversation_id == f"conv_concurrent_{i}"
            assert response.tokens_used == 40 + i
            assert response.confidence_score == 0.85 + (i * 0.01)

        # Verify service calls were made correctly
        assert mock_rag_service.vector_store.hybrid_search.call_count == 5
        assert mock_rag_service.llm_service.generate_response.call_count == 5

    @pytest.mark.asyncio
    async def test_rag_memory_cleanup(self, mock_rag_service):
        """Test RAG conversation memory cleanup."""
        from datetime import timedelta

        # Create old conversation
        old_conversation_id = "old_conv_cleanup"
        old_memory = mock_rag_service.conversation_memories[old_conversation_id] = mock_rag_service.conversation_memories.get(
            old_conversation_id,
            type('Memory', (), {
                'user_id': 'test_user_123',
                'last_updated': datetime.utcnow() - timedelta(hours=25),
                'messages': [{'role': 'user', 'content': 'Old message'}],
                'context_cache': []
            })()
        )

        # Create recent conversation
        recent_query = RAGQuery(
            query="Recent query",
            conversation_id="recent_conv_cleanup",
            user_id="test_user_123"
        )

        # Process recent query (should trigger cleanup)
        await mock_rag_service.process_query(recent_query)

        # Verify old conversation was cleaned up
        assert old_conversation_id not in mock_rag_service.conversation_memories
        assert "recent_conv_cleanup" in mock_rag_service.conversation_memories

    @pytest.mark.asyncio
    async def test_rag_context_limit_handling(self, mock_rag_service):
        """Test RAG handling of context length limits."""
        # Create many context items to test limit
        many_results = {
            "results": [
                {
                    "id": f"chunk_{i}",
                    "content": f"Context item {i} with relevant information.",
                    "combined_score": 0.9 - (i * 0.05),  # Decreasing scores
                    "similarity_score": 0.9 - (i * 0.05),
                    "metadata": {"document_id": f"doc_{i}", "source": "test", "title": f"Document {i}"}
                }
                for i in range(10)  # 10 items, more than typical max_context_items
            ]
        }

        mock_rag_service.vector_store.hybrid_search.return_value = many_results

        query = RAGQuery(
            query="Query that should have many results",
            conversation_id="test_context_limit",
            user_id="test_user_123",
            max_context_items=5  # Limit to 5 items
        )

        response = await mock_rag_service.process_query(query)

        # Verify context was limited
        assert len(response.context_items) <= query.max_context_items
        assert len(response.citations) <= query.max_context_items

        # Verify highest scoring items were selected
        context_scores = [ctx.similarity_score for ctx in response.context_items]
        assert all(score >= query.similarity_threshold for score in context_scores)

    @pytest.mark.asyncio
    async def test_rag_service_health_monitoring(self, mock_rag_service):
        """Test RAG service health monitoring."""
        # Configure healthy dependencies
        mock_rag_service.vector_store.health_check.return_value = True
        mock_rag_service.embedding_service.health_check.return_value = True

        # Test LLM health check
        mock_rag_service.llm_service.generate_response.return_value = {
            "content": "Health check response",
            "tokens_used": 10,
            "model": "gpt-4"
        }

        health = await mock_rag_service.health_check()

        # Verify health check results
        assert health["healthy"] is True
        assert health["vector_store"] is True
        assert health["embedding_service"] is True
        assert health["llm_service"] is True
        assert "active_conversations" in health
        assert "timestamp" in health

        # Test unhealthy dependency
        mock_rag_service.vector_store.health_check.return_value = False
        health = await mock_rag_service.health_check()
        assert health["healthy"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])