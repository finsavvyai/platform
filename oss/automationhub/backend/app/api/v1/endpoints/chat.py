"""
Conversational AI API endpoints.

Provides intelligent chat capabilities with RAG-powered responses,
knowledge integration, and conversation management for UPM.Plus.
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from app.services.conversational_ai import (
    conversational_ai,
    ConversationResponse,
    ConversationMessage
)
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """Request model for chat messages."""
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ConversationSummary(BaseModel):
    """Summary of a conversation."""
    conversation_id: str
    created_at: str
    updated_at: str
    message_count: int
    last_message: Optional[Dict[str, Any]]
    has_knowledge_context: bool


@router.post("/chat", response_model=ConversationResponse)
async def chat_with_ai(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Send a message to the conversational AI and get an intelligent response."""
    try:
        response = await conversational_ai.chat(
            message=request.message,
            user_id=current_user.id,
            conversation_id=request.conversation_id,
            context=request.context
        )

        return response

    except Exception as e:
        logger.error(f"Chat request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    limit: int = Query(20, ge=1, le=100, description="Maximum number of conversations to return"),
    current_user: User = Depends(get_current_user)
):
    """List user's conversations."""
    try:
        conversations = await conversational_ai.list_conversations(
            user_id=current_user.id,
            limit=limit
        )

        return [ConversationSummary(**conv) for conv in conversations]

    except Exception as e:
        logger.error(f"Failed to list conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversations")


@router.get("/conversations/{conversation_id}/messages", response_model=List[ConversationMessage])
async def get_conversation_history(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of messages to return"),
    current_user: User = Depends(get_current_user)
):
    """Get conversation history."""
    try:
        messages = await conversational_ai.get_conversation_history(
            conversation_id=conversation_id,
            user_id=current_user.id,
            limit=limit
        )

        return messages

    except Exception as e:
        logger.error(f"Failed to get conversation history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversation history")


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a conversation."""
    try:
        success = await conversational_ai.delete_conversation(
            conversation_id=conversation_id,
            user_id=current_user.id
        )

        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")

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
    """Clear conversation history but keep the conversation."""
    try:
        success = await conversational_ai.clear_conversation_history(
            conversation_id=conversation_id,
            user_id=current_user.id
        )

        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")

        return {"status": "cleared", "message": "Conversation history cleared successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to clear conversation history: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear conversation history")


@router.get("/suggestions")
async def get_conversation_suggestions(
    query: Optional[str] = Query(None, description="Optional query for context-specific suggestions"),
    current_user: User = Depends(get_current_user)
):
    """Get conversation suggestions and prompts."""
    try:
        # Basic conversation starters and suggestions
        suggestions = {
            "starters": [
                "How can I automate my daily tasks?",
                "Help me create a workflow for data processing",
                "What can you find in my documents about project management?",
                "Show me how to integrate different tools",
                "Create a workflow for social media posting"
            ],
            "categories": [
                {
                    "name": "Automation",
                    "icon": "auto_fix_high",
                    "examples": [
                        "Create a workflow to backup my files",
                        "Automate my email responses",
                        "Set up recurring data processing"
                    ]
                },
                {
                    "name": "Knowledge Search",
                    "icon": "search",
                    "examples": [
                        "Find information about machine learning in my docs",
                        "What did I learn about Python last week?",
                        "Search for meeting notes from Q2"
                    ]
                },
                {
                    "name": "Workflow Creation",
                    "icon": "workflow",
                    "examples": [
                        "Build a content creation pipeline",
                        "Create an onboarding workflow",
                        "Design a data analysis process"
                    ]
                },
                {
                    "name": "Integration",
                    "icon": "integration_instructions",
                    "examples": [
                        "Connect my CRM to spreadsheets",
                        "Integrate Slack with project management",
                        "Set up API connections"
                    ]
                }
            ]
        }

        # Add query-specific suggestions if provided
        if query:
            query_lower = query.lower()

            if "workflow" in query_lower or "automate" in query_lower:
                suggestions["contextual"] = [
                    f"Create a workflow for {query}",
                    f"Automate the process of {query}",
                    f"Set up monitoring for {query}"
                ]
            elif "search" in query_lower or "find" in query_lower:
                suggestions["contextual"] = [
                    f"Search my documents for {query}",
                    f"Find similar content to {query}",
                    f"Show me everything related to {query}"
                ]
            else:
                suggestions["contextual"] = [
                    f"Tell me more about {query}",
                    f"How can I work with {query}?",
                    f"Create something using {query}"
                ]

        return suggestions

    except Exception as e:
        logger.error(f"Failed to get conversation suggestions: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate suggestions")


@router.get("/health")
async def chat_health_check():
    """Check conversational AI service health."""
    try:
        # Basic health indicators
        active_conversations = len(conversational_ai.conversations)

        return {
            "status": "healthy",
            "active_conversations": active_conversations,
            "cache_ttl_hours": conversational_ai.conversation_cache_ttl // 3600,
            "features": {
                "rag_enabled": True,
                "knowledge_integration": True,
                "workflow_suggestions": True,
                "multi_turn_conversations": True
            }
        }

    except Exception as e:
        logger.error(f"Chat health check failed: {e}")
        raise HTTPException(status_code=503, detail="Conversational AI service unhealthy")


@router.post("/conversations/{conversation_id}/feedback")
async def provide_conversation_feedback(
    conversation_id: str,
    feedback: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Provide feedback on conversation quality."""
    try:
        # In a full implementation, this would store feedback for model improvement
        # For now, just log the feedback

        logger.info(f"Conversation feedback received for {conversation_id}: {feedback}")

        # Validate conversation belongs to user
        conversation = conversational_ai.conversations.get(conversation_id)
        if not conversation or conversation.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return {
            "status": "received",
            "message": "Thank you for your feedback! This helps improve our AI responses.",
            "feedback_id": str(conversation_id)  # In production, would generate unique feedback ID
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to process feedback")


@router.get("/stats")
async def get_conversation_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get conversation statistics for the current user."""
    try:
        # Get user's conversations
        user_conversations = [
            conv for conv in conversational_ai.conversations.values()
            if conv.user_id == current_user.id
        ]

        # Calculate statistics
        total_conversations = len(user_conversations)
        total_messages = sum(len(conv.messages) for conv in user_conversations)

        # Message distribution by role
        user_messages = sum(
            len([msg for msg in conv.messages if msg.role == "user"])
            for conv in user_conversations
        )
        assistant_messages = sum(
            len([msg for msg in conv.messages if msg.role == "assistant"])
            for conv in user_conversations
        )

        # Knowledge usage
        conversations_with_knowledge = len([
            conv for conv in user_conversations
            if len(conv.knowledge_context) > 0
        ])

        # Recent activity (last 7 days)
        from datetime import datetime, timedelta
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_conversations = len([
            conv for conv in user_conversations
            if conv.updated_at >= seven_days_ago
        ])

        return {
            "conversations": {
                "total": total_conversations,
                "recent_week": recent_conversations,
                "with_knowledge": conversations_with_knowledge
            },
            "messages": {
                "total": total_messages,
                "user_messages": user_messages,
                "assistant_messages": assistant_messages,
                "average_per_conversation": total_messages / total_conversations if total_conversations > 0 else 0
            },
            "usage": {
                "knowledge_usage_rate": conversations_with_knowledge / total_conversations if total_conversations > 0 else 0,
                "active_conversations": len([
                    conv for conv in user_conversations
                    if conv.updated_at >= datetime.utcnow() - timedelta(hours=24)
                ])
            }
        }

    except Exception as e:
        logger.error(f"Failed to get conversation statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")