"""
RAG (Retrieval-Augmented Generation) API endpoints.

Provides context-aware AI responses with citation tracking,
conversation memory, and multi-language support for UPM.Plus.
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from app.services.rag_service import (
    get_rag_service,
    RAGService,
    RAGQuery,
    RAGResponse,
    RAGContext,
    RAGCitation,
    ConversationMemory
)
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


class RAGQueryRequest(BaseModel):
    """Request model for RAG queries."""
    query: str = Field(..., min_length=1, max_length=2000, description="User query")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for context")
    max_context_items: int = Field(5, ge=1, le=20, description="Maximum context items to retrieve")
    similarity_threshold: float = Field(0.7, ge=0.0, le=1.0, description="Minimum similarity threshold")
    include_sources: bool = Field(True, description="Include source citations")
    language: str = Field("en", description="Response language")
    max_tokens: int = Field(1000, ge=100, le=4000, description="Maximum tokens in response")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Response temperature")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")


class RAGQueryResponse(BaseModel):
    """Response model for RAG queries."""
    answer: str
    query: str
    context_items: List[Dict[str, Any]]
    citations: List[Dict[str, Any]]
    confidence_score: float
    language: str
    processing_time_ms: int
    tokens_used: int
    model_used: str
    conversation_id: str
    timestamp: str


class ConversationHistoryResponse(BaseModel):
    """Response model for conversation history."""
    conversation_id: str
    messages: List[Dict[str, Any]]
    total_messages: int
    language_preference: str
    last_updated: str


class ConversationSummaryResponse(BaseModel):
    """Summary of a conversation."""
    conversation_id: str
    user_id: str
    message_count: int
    language_preference: str
    last_updated: str
    created_at: str


class RAGAnalyticsResponse(BaseModel):
    """RAG system analytics and metrics."""
    total_queries: int
    average_confidence: float
    average_processing_time: float
    language_distribution: Dict[str, int]
    popular_topics: List[Dict[str, Any]]
    citation_accuracy: float
    cache_hit_rate: float


class FeedbackRequest(BaseModel):
    """Request model for providing feedback on RAG responses."""
    response_id: str
    conversation_id: str
    rating: int = Field(..., ge=1, le=5, description="Rating from 1-5")
    feedback_text: Optional[str] = Field(None, max_length=1000)
    helpful: bool
    issue_type: Optional[str] = Field(None, description="Type of issue if any")
    improvement_suggestions: Optional[str] = Field(None, max_length=2000)


@router.post("/query", response_model=RAGQueryResponse)
async def query_rag(
    request: RAGQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """Submit a RAG query and get context-aware AI response."""
    try:
        # Get RAG service
        rag_service = await get_rag_service()

        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or f"conv_{current_user.id}_{datetime.utcnow().timestamp()}"

        # Create RAG query
        rag_query = RAGQuery(
            query=request.query,
            conversation_id=conversation_id,
            user_id=str(current_user.id),
            max_context_items=request.max_context_items,
            similarity_threshold=request.similarity_threshold,
            include_sources=request.include_sources,
            language=request.language,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )

        # Process query
        response = await rag_service.process_query(rag_query)

        # Convert context items to dictionaries
        context_items = []
        for context in response.context_items:
            context_items.append({
                "content": context.content,
                "source": context.source,
                "document_id": context.document_id,
                "chunk_id": context.chunk_id,
                "similarity_score": context.similarity_score,
                "metadata": context.metadata,
                "relevance_rank": context.relevance_rank
            })

        # Convert citations to dictionaries
        citations = []
        for citation in response.citations:
            citations.append({
                "source": citation.source,
                "document_id": citation.document_id,
                "chunk_id": citation.chunk_id,
                "title": citation.title,
                "author": citation.author,
                "url": citation.url,
                "confidence": citation.confidence,
                "text_snippet": citation.text_snippet
            })

        return RAGQueryResponse(
            answer=response.answer,
            query=response.query,
            context_items=context_items,
            citations=citations,
            confidence_score=response.confidence_score,
            language=response.language,
            processing_time_ms=response.processing_time_ms,
            tokens_used=response.tokens_used,
            model_used=response.model_used,
            conversation_id=response.conversation_id,
            timestamp=response.timestamp.isoformat()
        )

    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")


@router.get("/conversations", response_model=List[ConversationSummaryResponse])
async def list_conversations(
    limit: int = Query(20, ge=1, le=100, description="Maximum conversations to return"),
    current_user: User = Depends(get_current_user)
):
    """List user's RAG conversations."""
    try:
        rag_service = await get_rag_service()

        # Get conversation summaries for user
        conversations = []
        user_conversations = {
            conv_id: memory for conv_id, memory in rag_service.conversation_memories.items()
            if memory.user_id == str(current_user.id)
        }

        # Sort by last updated
        sorted_conversations = sorted(
            user_conversations.items(),
            key=lambda x: x[1].last_updated,
            reverse=True
        )[:limit]

        for conv_id, memory in sorted_conversations:
            conversations.append(ConversationSummaryResponse(
                conversation_id=conv_id,
                user_id=memory.user_id,
                message_count=len(memory.messages),
                language_preference=memory.language_preference,
                last_updated=memory.last_updated.isoformat(),
                created_at=memory.last_updated.isoformat()  # Using last_updated as created_at for now
            ))

        return conversations

    except Exception as e:
        logger.error(f"Failed to list conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversations")


@router.get("/conversations/{conversation_id}/history", response_model=ConversationHistoryResponse)
async def get_conversation_history(
    conversation_id: str,
    max_messages: int = Query(50, ge=1, le=200, description="Maximum messages to return"),
    current_user: User = Depends(get_current_user)
):
    """Get conversation history for a specific conversation."""
    try:
        rag_service = await get_rag_service()

        # Verify conversation belongs to user
        if conversation_id not in rag_service.conversation_memories:
            raise HTTPException(status_code=404, detail="Conversation not found")

        memory = rag_service.conversation_memories[conversation_id]
        if memory.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")

        # Get messages
        messages = await rag_service.get_conversation_history(conversation_id, max_messages)

        return ConversationHistoryResponse(
            conversation_id=conversation_id,
            messages=messages,
            total_messages=len(memory.messages),
            language_preference=memory.language_preference,
            last_updated=memory.last_updated.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversation history")


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a conversation and its memory."""
    try:
        rag_service = await get_rag_service()

        # Verify conversation belongs to user
        if conversation_id not in rag_service.conversation_memories:
            raise HTTPException(status_code=404, detail="Conversation not found")

        memory = rag_service.conversation_memories[conversation_id]
        if memory.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")

        # Clear conversation memory
        success = await rag_service.clear_conversation_memory(conversation_id)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete conversation")

        return {"status": "deleted", "message": "Conversation deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete conversation: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete conversation")


@router.post("/conversations/{conversation_id}/clear")
async def clear_conversation_history(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Clear conversation history but keep the conversation active."""
    try:
        rag_service = await get_rag_service()

        # Verify conversation belongs to user
        if conversation_id not in rag_service.conversation_memories:
            raise HTTPException(status_code=404, detail="Conversation not found")

        memory = rag_service.conversation_memories[conversation_id]
        if memory.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")

        # Clear messages but keep conversation
        memory.messages = []
        memory.context_cache = []
        memory.last_updated = datetime.utcnow()

        return {"status": "cleared", "message": "Conversation history cleared successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to clear conversation history: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear conversation history")


@router.get("/languages")
async def get_supported_languages(
    current_user: User = Depends(get_current_user)
):
    """Get list of supported languages for RAG responses."""
    try:
        rag_service = await get_rag_service()
        languages = await rag_service.get_supported_languages()

        return {
            "supported_languages": languages,
            "default_language": "en",
            "current_language": "en"
        }

    except Exception as e:
        logger.error(f"Failed to get supported languages: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve supported languages")


@router.get("/health")
async def rag_health_check():
    """Check RAG service health."""
    try:
        rag_service = await get_rag_service()
        health = await rag_service.health_check()

        return {
            "service": "rag_service",
            "status": "healthy" if health.get("healthy", False) else "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "details": health
        }

    except Exception as e:
        logger.error(f"RAG health check failed: {e}")
        raise HTTPException(status_code=503, detail="RAG service unhealthy")


@router.post("/feedback")
async def provide_feedback(
    request: FeedbackRequest,
    current_user: User = Depends(get_current_user)
):
    """Provide feedback on RAG response quality."""
    try:
        rag_service = await get_rag_service()

        # Verify conversation belongs to user
        if request.conversation_id not in rag_service.conversation_memories:
            raise HTTPException(status_code=404, detail="Conversation not found")

        memory = rag_service.conversation_memories[request.conversation_id]
        if memory.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")

        # In a full implementation, store feedback in database
        # For now, log the feedback
        logger.info(f"RAG feedback received from user {current_user.id}:")
        logger.info(f"  Conversation: {request.conversation_id}")
        logger.info(f"  Rating: {request.rating}/5")
        logger.info(f"  Helpful: {request.helpful}")
        if request.feedback_text:
            logger.info(f"  Feedback: {request.feedback_text}")
        if request.issue_type:
            logger.info(f"  Issue Type: {request.issue_type}")

        return {
            "status": "received",
            "message": "Thank you for your feedback! This helps improve our AI responses.",
            "feedback_id": f"feedback_{datetime.utcnow().timestamp()}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to process feedback")


@router.get("/analytics", response_model=RAGAnalyticsResponse)
async def get_rag_analytics(
    current_user: User = Depends(get_current_user)
):
    """Get RAG system analytics for the current user."""
    try:
        rag_service = await get_rag_service()

        # Get user's conversations
        user_conversations = [
            memory for memory in rag_service.conversation_memories.values()
            if memory.user_id == str(current_user.id)
        ]

        if not user_conversations:
            return RAGAnalyticsResponse(
                total_queries=0,
                average_confidence=0.0,
                average_processing_time=0.0,
                language_distribution={},
                popular_topics=[],
                citation_accuracy=0.0,
                cache_hit_rate=0.0
            )

        # Calculate analytics
        total_queries = sum(len([msg for msg in conv.messages if msg.get("role") == "user"]) for conv in user_conversations)

        # Extract confidence scores from assistant messages
        confidence_scores = []
        processing_times = []
        languages = []

        for conv in user_conversations:
            for msg in conv.messages:
                if msg.get("role") == "assistant":
                    if "confidence" in msg:
                        confidence_scores.append(msg["confidence"])
                    languages.append(conv.language_preference)

        average_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0

        # Language distribution
        language_distribution = {}
        for lang in languages:
            language_distribution[lang] = language_distribution.get(lang, 0) + 1

        # Get popular topics from recent queries
        recent_queries = []
        for conv in user_conversations:
            for msg in conv.messages:
                if msg.get("role") == "user":
                    recent_queries.append(msg.get("content", ""))

        # Simple topic extraction (would use NLP in production)
        popular_topics = []
        if recent_queries:
            # Count common words in queries
            word_counts = {}
            for query in recent_queries[:20]:  # Last 20 queries
                words = query.lower().split()
                for word in words:
                    if len(word) > 3:  # Skip short words
                        word_counts[word] = word_counts.get(word, 0) + 1

            # Get top 5 most common words as "topics"
            top_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            popular_topics = [{"topic": word, "frequency": count} for word, count in top_words]

        return RAGAnalyticsResponse(
            total_queries=total_queries,
            average_confidence=average_confidence,
            average_processing_time=0.0,  # Would calculate from actual processing times
            language_distribution=language_distribution,
            popular_topics=popular_topics,
            citation_accuracy=0.85,  # Would calculate from actual citation accuracy
            cache_hit_rate=0.75  # Would calculate from actual cache metrics
        )

    except Exception as e:
        logger.error(f"Failed to get RAG analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


@router.get("/suggestions")
async def get_query_suggestions(
    query: Optional[str] = Query(None, description="Optional partial query for suggestions"),
    limit: int = Query(5, ge=1, le=10, description="Maximum suggestions to return"),
    current_user: User = Depends(get_current_user)
):
    """Get RAG query suggestions based on user's knowledge base."""
    try:
        # Generate contextual suggestions
        suggestions = {
            "general_suggestions": [
                "What documents do I have about project management?",
                "Summarize my recent meeting notes",
                "Find information about automation workflows",
                "What are the key topics in my documents?",
                "Help me analyze my knowledge base"
            ],
            "query_specific_suggestions": []
        }

        # Add query-specific suggestions if provided
        if query:
            query_lower = query.lower()
            suggestions["query_specific_suggestions"] = [
                f"Find documents related to {query}",
                f"What do I know about {query}?",
                f"Summarize information about {query}",
                f"Search for examples of {query}",
                f"Show me documents mentioning {query}"
            ]

        # Limit suggestions
        suggestions["general_suggestions"] = suggestions["general_suggestions"][:limit]
        suggestions["query_specific_suggestions"] = suggestions["query_specific_suggestions"][:limit]

        return suggestions

    except Exception as e:
        logger.error(f"Failed to get query suggestions: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate suggestions")


@router.get("/stats")
async def get_rag_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get RAG usage statistics for the current user."""
    try:
        rag_service = await get_rag_service()

        # Get user's conversations
        user_conversations = [
            memory for memory in rag_service.conversation_memories.values()
            if memory.user_id == str(current_user.id)
        ]

        # Calculate statistics
        total_conversations = len(user_conversations)
        total_messages = sum(len(conv.messages) for conv in user_conversations)

        # Message distribution
        user_messages = sum(
            len([msg for msg in conv.messages if msg.get("role") == "user"])
            for conv in user_conversations
        )
        assistant_messages = sum(
            len([msg for msg in conv.messages if msg.get("role") == "assistant"])
            for conv in user_conversations
        )

        # Language usage
        language_usage = {}
        for conv in user_conversations:
            lang = conv.language_preference
            language_usage[lang] = language_usage.get(lang, 0) + 1

        # Active conversations (last 24 hours)
        from datetime import timedelta
        one_day_ago = datetime.utcnow() - timedelta(days=1)
        active_conversations = len([
            conv for conv in user_conversations
            if conv.last_updated >= one_day_ago
        ])

        return {
            "conversations": {
                "total": total_conversations,
                "active_24h": active_conversations,
                "average_messages_per_conversation": total_messages / total_conversations if total_conversations > 0 else 0
            },
            "messages": {
                "total": total_messages,
                "user_messages": user_messages,
                "assistant_messages": assistant_messages
            },
            "languages": language_usage,
            "active_conversations": len(rag_service.conversation_memories)
        }

    except Exception as e:
        logger.error(f"Failed to get RAG statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")