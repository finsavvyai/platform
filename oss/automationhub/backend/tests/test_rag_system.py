"""
Comprehensive test suite for RAG (Retrieval-Augmented Generation) system.

Tests cover RAG service functionality, API endpoints, citation tracking,
conversation memory, and multi-language support.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from uuid import uuid4

from app.services.rag_service import (
    RAGService,
    RAGQuery,
    RAGResponse,
    RAGContext,
    RAGCitation,
    ConversationMemory,
    get_rag_service
)


@pytest.fixture
async def rag_service():
    """Create RAG service instance for testing."""
    service = RAGService()

    # Mock dependencies
    service.vector_store = AsyncMock()
    service.embedding_service = AsyncMock()
    service.llm_service = AsyncMock()
    service.cache_service = AsyncMock()

    # Configure vector store mock
    service.vector_store.hybrid_search.return_value = {
        "results": [
            {
                "id": "chunk_1",
                "content": "Python is a high-level programming language",
                "combined_score": 0.85,
                "similarity_score": 0.85,
                "metadata": {
                    "document_id": "doc_1",
                    "source": "test_document",
                    "title": "Python Programming Guide"
                }
            },
            {
                "id": "chunk_2",
                "content": "FastAPI is a modern web framework for Python",
                "combined_score": 0.75,
                "similarity_score": 0.75,
                "metadata": {
                    "document_id": "doc_2",
                    "source": "test_document",
                    "title": "FastAPI Documentation"
                }
            }
        ]
    }

    # Configure LLM service mock
    service.llm_service.generate_response.return_value = {
        "content": "Python is indeed a high-level programming language known for its simplicity and readability. FastAPI is built on Python and provides a modern approach to web development.",
        "tokens_used": 45,
        "model": "gpt-4",
        "confidence_score": 0.9
    }

    return service


@pytest.fixture
def sample_user():
    """Create sample user for testing."""
    return {
        "id": str(uuid4()),
        "email": "test@example.com",
        "username": "testuser",
        "is_superuser": False
    }


@pytest.fixture
def sample_rag_query():
    """Create sample RAG query for testing."""
    return RAGQuery(
        query="What is Python?",
        conversation_id="conv_123",
        user_id="user_123",
        max_context_items=5,
        similarity_threshold=0.7,
        include_sources=True,
        language="en",
        max_tokens=1000,
        temperature=0.7
    )


class TestRAGService:
    """Test cases for RAGService class."""

    @pytest.mark.asyncio
    async def test_process_query_success(self, rag_service, sample_rag_query):
        """Test successful RAG query processing."""
        # Process query
        response = await rag_service.process_query(sample_rag_query)

        # Verify response structure
        assert isinstance(response, RAGResponse)
        assert response.query == sample_rag_query.query
        assert response.conversation_id == sample_rag_query.conversation_id
        assert response.confidence_score > 0.0
        assert response.processing_time_ms > 0
        assert response.tokens_used > 0
        assert len(response.context_items) > 0
        assert len(response.citations) > 0

        # Verify context items
        for context_item in response.context_items:
            assert isinstance(context_item, RAGContext)
            assert context_item.similarity_score >= sample_rag_query.similarity_threshold
            assert context_item.content
            assert context_item.source

        # Verify citations
        for citation in response.citations:
            assert isinstance(citation, RAGCitation)
            assert citation.document_id
            assert citation.title
            assert citation.confidence > 0

        # Verify vector store was called
        rag_service.vector_store.hybrid_search.assert_called_once()

        # Verify LLM service was called
        rag_service.llm_service.generate_response.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_query_with_no_context(self, rag_service, sample_rag_query):
        """Test RAG query processing with no relevant context."""
        # Configure vector store to return no results
        rag_service.vector_store.hybrid_search.return_value = {"results": []}

        # Process query
        response = await rag_service.process_query(sample_rag_query)

        # Verify response has no context but still generates answer
        assert isinstance(response, RAGResponse)
        assert len(response.context_items) == 0
        assert len(response.citations) == 0
        assert response.answer
        assert response.confidence_score < 0.5  # Lower confidence without context

    @pytest.mark.asyncio
    async def test_process_query_with_error(self, rag_service, sample_rag_query):
        """Test RAG query processing with error."""
        # Configure LLM service to raise error
        rag_service.llm_service.generate_response.side_effect = Exception("LLM error")

        # Process query
        response = await rag_service.process_query(sample_rag_query)

        # Verify error handling
        assert isinstance(response, RAGResponse)
        assert "apologize" in response.answer.lower()
        assert response.confidence_score == 0.0
        assert response.tokens_used == 0

    @pytest.mark.asyncio
    async def test_conversation_memory_management(self, rag_service, sample_rag_query):
        """Test conversation memory management."""
        # Process first query
        response1 = await rag_service.process_query(sample_rag_query)

        # Verify conversation memory was created
        assert sample_rag_query.conversation_id in rag_service.conversation_memories
        memory = rag_service.conversation_memories[sample_rag_query.conversation_id]
        assert len(memory.messages) == 2  # User + assistant messages
        assert memory.messages[0]["role"] == "user"
        assert memory.messages[1]["role"] == "assistant"

        # Process second query in same conversation
        second_query = RAGQuery(
            query="Tell me more about FastAPI",
            conversation_id=sample_rag_query.conversation_id,
            user_id=sample_rag_query.user_id
        )
        response2 = await rag_service.process_query(second_query)

        # Verify memory was updated
        memory = rag_service.conversation_memories[sample_rag_query.conversation_id]
        assert len(memory.messages) == 4  # 2 user + 2 assistant messages

    @pytest.mark.asyncio
    async def test_conversation_cleanup(self, rag_service, sample_rag_query):
        """Test automatic cleanup of old conversations."""
        # Create old conversation
        old_conversation_id = "old_conv_123"
        old_memory = ConversationMemory(
            conversation_id=old_conversation_id,
            user_id="user_123",
            messages=[],
            context_cache=[],
            last_updated=datetime.utcnow() - timedelta(hours=25),  # 25 hours old
            language_preference="en"
        )
        rag_service.conversation_memories[old_conversation_id] = old_memory

        # Process new query (triggers cleanup)
        await rag_service.process_query(sample_rag_query)

        # Verify old conversation was cleaned up
        assert old_conversation_id not in rag_service.conversation_memories
        assert sample_rag_query.conversation_id in rag_service.conversation_memories

    @pytest.mark.asyncio
    async def test_get_conversation_history(self, rag_service, sample_rag_query):
        """Test retrieving conversation history."""
        # Process a query to create memory
        await rag_service.process_query(sample_rag_query)

        # Get conversation history
        history = await rag_service.get_conversation_history(
            sample_rag_query.conversation_id,
            max_messages=10
        )

        # Verify history
        assert len(history) == 2  # User + assistant messages
        assert history[0]["role"] == "user"
        assert history[1]["role"] == "assistant"

    @pytest.mark.asyncio
    async def test_clear_conversation_memory(self, rag_service, sample_rag_query):
        """Test clearing conversation memory."""
        # Process a query to create memory
        await rag_service.process_query(sample_rag_query)

        # Verify memory exists
        assert sample_rag_query.conversation_id in rag_service.conversation_memories

        # Clear conversation memory
        success = await rag_service.clear_conversation_memory(sample_rag_query.conversation_id)

        # Verify memory was cleared
        assert success
        assert sample_rag_query.conversation_id not in rag_service.conversation_memories

    @pytest.mark.asyncio
    async def test_multi_language_support(self, rag_service):
        """Test multi-language support."""
        # Test Spanish query
        spanish_query = RAGQuery(
            query="¿Qué es Python?",
            conversation_id="conv_es",
            user_id="user_123",
            language="es"
        )

        with patch.object(rag_service.llm_service, 'generate_response') as mock_llm:
            mock_llm.return_value = {
                "content": "Python es un lenguaje de programación de alto nivel",
                "tokens_used": 25,
                "model": "gpt-4",
                "confidence_score": 0.9
            }

            response = await rag_service.process_query(spanish_query)

            # Verify response language
            assert response.language == "es"
            assert response.answer  # Should contain Spanish response

    @pytest.mark.asyncio
    async def test_confidence_score_calculation(self, rag_service, sample_rag_query):
        """Test confidence score calculation."""
        response = await rag_service.process_query(sample_rag_query)

        # Verify confidence score is reasonable
        assert 0.0 <= response.confidence_score <= 1.0
        assert response.confidence_score > 0.5  # Should have decent confidence with context

    @pytest.mark.asyncio
    async def test_citation_generation(self, rag_service, sample_rag_query):
        """Test citation generation from context items."""
        response = await rag_service.process_query(sample_rag_query)

        # Verify citations were generated
        assert len(response.citations) > 0

        for citation in response.citations:
            assert citation.source
            assert citation.document_id
            assert citation.chunk_id
            assert citation.title
            assert citation.confidence >= rag_service.citation_min_confidence

    @pytest.mark.asyncio
    async def test_context_retrieval_with_filters(self, rag_service):
        """Test context retrieval with filters."""
        query_with_filters = RAGQuery(
            query="Python programming",
            conversation_id="conv_filtered",
            user_id="user_123",
            language="es"  # Filter by language
        )

        await rag_service.process_query(query_with_filters)

        # Verify vector store was called with filters
        rag_service.vector_store.hybrid_search.assert_called_with(
            query="Python programming",
            text_weight=0.3,
            vector_weight=0.7,
            n_results=10,  # max_context_items * 2
            filters={"language": "es"}
        )

    @pytest.mark.asyncio
    async def test_health_check(self, rag_service):
        """Test RAG service health check."""
        # Mock dependency health checks
        rag_service.vector_store.health_check.return_value = True
        rag_service.embedding_service.health_check.return_value = True
        rag_service.llm_service.generate_response.return_value = {"content": "ok"}

        health = await rag_service.health_check()

        # Verify health check results
        assert health["healthy"] is True
        assert "vector_store" in health
        assert "embedding_service" in health
        assert "llm_service" in health
        assert "active_conversations" in health
        assert "timestamp" in health

    @pytest.mark.asyncio
    async def test_get_supported_languages(self, rag_service):
        """Test getting supported languages."""
        languages = await rag_service.get_supported_languages()

        # Verify supported languages
        assert isinstance(languages, list)
        assert "en" in languages
        assert "es" in languages
        assert "fr" in languages


class TestRAGAPIEndpoints:
    """Test cases for RAG API endpoints."""

    @pytest.mark.asyncio
    async def test_rag_query_endpoint(self, client, sample_user):
        """Test RAG query endpoint."""
        # Mock authentication
        with patch('app.api.v1.endpoints.rag.get_current_user') as mock_auth:
            mock_auth.return_value = sample_user

            # Mock RAG service
            with patch('app.api.v1.endpoints.rag.get_rag_service') as mock_service:
                mock_rag = AsyncMock()
                mock_rag.process_query.return_value = RAGResponse(
                    answer="Python is a programming language",
                    query="What is Python?",
                    context_items=[],
                    citations=[],
                    confidence_score=0.9,
                    language="en",
                    processing_time_ms=500,
                    tokens_used=50,
                    model_used="gpt-4",
                    conversation_id="conv_123",
                    timestamp=datetime.utcnow()
                )
                mock_service.return_value = mock_rag

                # Make request
                response = await client.post("/api/v1/rag/query", json={
                    "query": "What is Python?",
                    "max_context_items": 5,
                    "similarity_threshold": 0.7,
                    "include_sources": True,
                    "language": "en"
                })

                # Verify response
                assert response.status_code == 200
                data = response.json()
                assert data["query"] == "What is Python?"
                assert data["answer"] == "Python is a programming language"
                assert data["confidence_score"] == 0.9
                assert data["language"] == "en"

    @pytest.mark.asyncio
    async def test_list_conversations_endpoint(self, client, sample_user):
        """Test listing conversations endpoint."""
        with patch('app.api.v1.endpoints.rag.get_current_user') as mock_auth:
            mock_auth.return_value = sample_user

            with patch('app.api.v1.endpoints.rag.get_rag_service') as mock_service:
                mock_rag = AsyncMock()

                # Mock conversation memories
                conv_memory = ConversationMemory(
                    conversation_id="conv_123",
                    user_id=str(sample_user["id"]),
                    messages=[{"role": "user", "content": "Hello"}],
                    context_cache=[],
                    last_updated=datetime.utcnow(),
                    language_preference="en"
                )
                mock_rag.conversation_memories = {"conv_123": conv_memory}
                mock_service.return_value = mock_rag

                response = await client.get("/api/v1/rag/conversations")

                assert response.status_code == 200
                data = response.json()
                assert len(data) == 1
                assert data[0]["conversation_id"] == "conv_123"
                assert data[0]["user_id"] == str(sample_user["id"])

    @pytest.mark.asyncio
    async def test_get_conversation_history_endpoint(self, client, sample_user):
        """Test getting conversation history endpoint."""
        with patch('app.api.v1.endpoints.rag.get_current_user') as mock_auth:
            mock_auth.return_value = sample_user

            with patch('app.api.v1.endpoints.rag.get_rag_service') as mock_service:
                mock_rag = AsyncMock()
                mock_rag.conversation_memories = {
                    "conv_123": ConversationMemory(
                        conversation_id="conv_123",
                        user_id=str(sample_user["id"]),
                        messages=[{"role": "user", "content": "Hello"}],
                        context_cache=[],
                        last_updated=datetime.utcnow(),
                        language_preference="en"
                    )
                }
                mock_rag.get_conversation_history.return_value = [
                    {"role": "user", "content": "Hello"},
                    {"role": "assistant", "content": "Hi there!"}
                ]
                mock_service.return_value = mock_rag

                response = await client.get("/api/v1/rag/conversations/conv_123/history")

                assert response.status_code == 200
                data = response.json()
                assert data["conversation_id"] == "conv_123"
                assert len(data["messages"]) == 2

    @pytest.mark.asyncio
    async def test_delete_conversation_endpoint(self, client, sample_user):
        """Test deleting conversation endpoint."""
        with patch('app.api.v1.endpoints.rag.get_current_user') as mock_auth:
            mock_auth.return_value = sample_user

            with patch('app.api.v1.endpoints.rag.get_rag_service') as mock_service:
                mock_rag = AsyncMock()
                mock_rag.conversation_memories = {
                    "conv_123": ConversationMemory(
                        conversation_id="conv_123",
                        user_id=str(sample_user["id"]),
                        messages=[],
                        context_cache=[],
                        last_updated=datetime.utcnow(),
                        language_preference="en"
                    )
                }
                mock_rag.clear_conversation_memory.return_value = True
                mock_service.return_value = mock_rag

                response = await client.delete("/api/v1/rag/conversations/conv_123")

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "deleted"

    @pytest.mark.asyncio
    async def test_health_check_endpoint(self, client):
        """Test RAG health check endpoint."""
        with patch('app.api.v1.endpoints.rag.get_rag_service') as mock_service:
            mock_rag = AsyncMock()
            mock_rag.health_check.return_value = {
                "healthy": True,
                "vector_store": True,
                "embedding_service": True,
                "llm_service": True,
                "active_conversations": 5,
                "timestamp": datetime.utcnow().isoformat()
            }
            mock_service.return_value = mock_rag

            response = await client.get("/api/v1/rag/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["details"]["healthy"] is True

    @pytest.mark.asyncio
    async def test_get_supported_languages_endpoint(self, client, sample_user):
        """Test getting supported languages endpoint."""
        with patch('app.api.v1.endpoints.rag.get_current_user') as mock_auth:
            mock_auth.return_value = sample_user

            with patch('app.api.v1.endpoints.rag.get_rag_service') as mock_service:
                mock_rag = AsyncMock()
                mock_rag.get_supported_languages.return_value = ["en", "es", "fr", "de"]
                mock_service.return_value = mock_rag

                response = await client.get("/api/v1/rag/languages")

                assert response.status_code == 200
                data = response.json()
                assert "supported_languages" in data
                assert len(data["supported_languages"]) == 4
                assert "en" in data["supported_languages"]

    @pytest.mark.asyncio
    async def test_feedback_endpoint(self, client, sample_user):
        """Test providing feedback endpoint."""
        with patch('app.api.v1.endpoints.rag.get_current_user') as mock_auth:
            mock_auth.return_value = sample_user

            with patch('app.api.v1.endpoints.rag.get_rag_service') as mock_service:
                mock_rag = AsyncMock()
                mock_rag.conversation_memories = {
                    "conv_123": ConversationMemory(
                        conversation_id="conv_123",
                        user_id=str(sample_user["id"]),
                        messages=[],
                        context_cache=[],
                        last_updated=datetime.utcnow(),
                        language_preference="en"
                    )
                }
                mock_service.return_value = mock_rag

                response = await client.post("/api/v1/rag/feedback", json={
                    "response_id": "resp_123",
                    "conversation_id": "conv_123",
                    "rating": 5,
                    "feedback_text": "Great response!",
                    "helpful": True
                })

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "received"
                assert "feedback_id" in data


class TestRAGIntegration:
    """Integration tests for RAG system."""

    @pytest.mark.asyncio
    async def test_end_to_end_rag_workflow(self, rag_service, sample_rag_query):
        """Test end-to-end RAG workflow."""
        # Process query
        response = await rag_service.process_query(sample_rag_query)

        # Verify complete workflow
        assert response.answer
        assert response.confidence_score > 0
        assert response.processing_time_ms > 0

        # Verify conversation memory was updated
        memory = rag_service.conversation_memories[sample_rag_query.conversation_id]
        assert len(memory.messages) == 2

        # Process follow-up query
        follow_up_query = RAGQuery(
            query="Can you explain more about that?",
            conversation_id=sample_rag_query.conversation_id,
            user_id=sample_rag_query.user_id
        )
        follow_up_response = await rag_service.process_query(follow_up_query)

        # Verify follow-up uses conversation context
        assert follow_up_response.answer
        assert len(rag_service.conversation_memories[sample_rag_query.conversation_id].messages) == 4

    @pytest.mark.asyncio
    async def test_rag_with_different_languages(self, rag_service):
        """Test RAG with different languages."""
        languages = ["en", "es", "fr"]

        for lang in languages:
            query = RAGQuery(
                query=f"Question in {lang}",
                conversation_id=f"conv_{lang}",
                user_id="user_123",
                language=lang
            )

            # Mock language-specific response
            with patch.object(rag_service.llm_service, 'generate_response') as mock_llm:
                mock_llm.return_value = {
                    "content": f"Response in {lang}",
                    "tokens_used": 30,
                    "model": "gpt-4",
                    "confidence_score": 0.85
                }

                response = await rag_service.process_query(query)
                assert response.language == lang
                assert response.answer == f"Response in {lang}"

    @pytest.mark.asyncio
    async def test_rag_performance_under_load(self, rag_service):
        """Test RAG performance under concurrent load."""
        queries = []
        for i in range(10):
            query = RAGQuery(
                query=f"Test query {i}",
                conversation_id=f"conv_{i}",
                user_id="user_123"
            )
            queries.append(query)

        # Process queries concurrently
        tasks = [rag_service.process_query(query) for query in queries]
        responses = await asyncio.gather(*tasks)

        # Verify all responses are valid
        assert len(responses) == 10
        for response in responses:
            assert isinstance(response, RAGResponse)
            assert response.answer
            assert response.confidence_score >= 0
            assert response.processing_time_ms > 0

    @pytest.mark.asyncio
    async def test_rag_error_recovery(self, rag_service, sample_rag_query):
        """Test RAG error recovery mechanisms."""
        # Test LLM service failure
        rag_service.llm_service.generate_response.side_effect = Exception("LLM down")

        response = await rag_service.process_query(sample_rag_query)

        # Verify graceful error handling
        assert response.confidence_score == 0.0
        assert "apologize" in response.answer.lower()
        assert response.tokens_used == 0

        # Test vector store failure
        rag_service.vector_store.hybrid_search.side_effect = Exception("Vector store down")
        rag_service.llm_service.generate_response.side_effect = None
        rag_service.llm_service.generate_response.return_value = {
            "content": "I apologize, but I cannot access the knowledge base right now.",
            "tokens_used": 20,
            "model": "gpt-4"
        }

        response = await rag_service.process_query(sample_rag_query)

        # Verify graceful degradation
        assert len(response.context_items) == 0
        assert len(response.citations) == 0
        assert response.confidence_score < 0.5


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])