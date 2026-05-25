"""
Enhanced Conversational AI Service with RAG capabilities.

Provides intelligent conversation handling with context awareness,
knowledge retrieval, and multi-turn conversation management for
the UPM.Plus platform.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.core.redis import redis_client
from app.services.knowledge_management import knowledge_service, KnowledgeQuery
from app.services.llm import llm_service
from app.services.mcp_integration import mcp_service
from app.services.workflow_engine import workflow_engine

logger = logging.getLogger(__name__)


class ConversationMessage(BaseModel):
    """A message in a conversation."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    role: str  # user, assistant, system
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConversationContext(BaseModel):
    """Context for a conversation."""
    user_id: UUID
    conversation_id: str = Field(default_factory=lambda: str(uuid4()))
    messages: List[ConversationMessage] = Field(default_factory=list)
    knowledge_context: List[Dict[str, Any]] = Field(default_factory=list)
    workflow_context: Optional[Dict[str, Any]] = None
    active_tools: List[str] = Field(default_factory=list)
    user_preferences: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationResponse(BaseModel):
    """Response from the conversational AI."""
    message: str
    message_id: str
    conversation_id: str
    knowledge_sources: List[Dict[str, Any]] = Field(default_factory=list)
    suggested_actions: List[Dict[str, Any]] = Field(default_factory=list)
    workflow_suggestions: List[Dict[str, Any]] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    tools_used: List[str] = Field(default_factory=list)
    confidence_score: float = 0.8
    processing_time_ms: int


class ConversationalAIService:
    """
    Enhanced conversational AI service with RAG capabilities.

    Features:
    - Multi-turn conversation management
    - Knowledge retrieval and contextual responses
    - Workflow and automation suggestions
    - Tool integration and execution
    - Personalized responses based on user context
    """

    def __init__(self):
        self.conversations: Dict[str, ConversationContext] = {}
        self.conversation_cache_ttl = 3600 * 24  # 24 hours

    async def chat(
        self,
        message: str,
        user_id: UUID,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> ConversationResponse:
        """Process a chat message and generate an intelligent response."""
        start_time = datetime.utcnow()

        try:
            # Get or create conversation context
            conversation = await self._get_or_create_conversation(
                user_id=user_id,
                conversation_id=conversation_id
            )

            # Add user message to conversation
            user_message = ConversationMessage(
                role="user",
                content=message,
                metadata=context or {}
            )
            conversation.messages.append(user_message)

            # Analyze user intent and extract entities
            intent_analysis = await self._analyze_user_intent(message, conversation)

            # Retrieve relevant knowledge
            knowledge_results = await self._retrieve_knowledge(
                query=message,
                user_id=user_id,
                conversation=conversation,
                intent=intent_analysis
            )

            # Generate contextual response
            response_content = await self._generate_response(
                user_message=message,
                conversation=conversation,
                knowledge_results=knowledge_results,
                intent_analysis=intent_analysis
            )

            # Generate suggestions and follow-ups
            suggestions = await self._generate_suggestions(
                conversation=conversation,
                intent_analysis=intent_analysis,
                knowledge_results=knowledge_results
            )

            # Create assistant message
            assistant_message = ConversationMessage(
                role="assistant",
                content=response_content["message"],
                metadata={
                    "knowledge_sources": len(knowledge_results.get("results", [])),
                    "intent": intent_analysis.get("intent", "unknown"),
                    "confidence": response_content.get("confidence", 0.8)
                }
            )
            conversation.messages.append(assistant_message)

            # Update conversation
            conversation.knowledge_context = knowledge_results.get("results", [])[:5]  # Keep last 5
            conversation.updated_at = datetime.utcnow()

            # Cache conversation
            await self._cache_conversation(conversation)

            # Calculate processing time
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return ConversationResponse(
                message=response_content["message"],
                message_id=assistant_message.id,
                conversation_id=conversation.conversation_id,
                knowledge_sources=knowledge_results.get("results", []),
                suggested_actions=suggestions.get("actions", []),
                workflow_suggestions=suggestions.get("workflows", []),
                follow_up_questions=suggestions.get("follow_ups", []),
                tools_used=response_content.get("tools_used", []),
                confidence_score=response_content.get("confidence", 0.8),
                processing_time_ms=processing_time
            )

        except Exception as e:
            logger.error(f"Conversation processing failed: {e}")
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return ConversationResponse(
                message="I apologize, but I encountered an error processing your request. Please try again.",
                message_id=str(uuid4()),
                conversation_id=conversation_id or str(uuid4()),
                confidence_score=0.0,
                processing_time_ms=processing_time
            )

    async def _get_or_create_conversation(
        self,
        user_id: UUID,
        conversation_id: Optional[str] = None
    ) -> ConversationContext:
        """Get existing conversation or create a new one."""
        if conversation_id:
            # Try to load from cache
            cached_conversation = await redis_client.get(f"conversation:{conversation_id}")
            if cached_conversation:
                try:
                    conversation_data = json.loads(cached_conversation)
                    return ConversationContext(**conversation_data)
                except Exception as e:
                    logger.warning(f"Failed to load cached conversation: {e}")

            # Try to load from memory
            if conversation_id in self.conversations:
                return self.conversations[conversation_id]

        # Create new conversation
        conversation = ConversationContext(
            user_id=user_id,
            conversation_id=conversation_id or str(uuid4())
        )

        self.conversations[conversation.conversation_id] = conversation
        return conversation

    async def _analyze_user_intent(
        self,
        message: str,
        conversation: ConversationContext
    ) -> Dict[str, Any]:
        """Analyze user intent and extract entities."""
        try:
            # Get conversation history for context
            recent_messages = conversation.messages[-5:]  # Last 5 messages
            conversation_history = "\n".join([
                f"{msg.role}: {msg.content}" for msg in recent_messages
            ])

            # Use LLM to analyze intent
            analysis = await llm_service.analyze_task(
                task_description=f"Analyze the user's intent in this message: '{message}'",
                context=f"Conversation history:\n{conversation_history}\n\nCurrent message: {message}"
            )

            # Extract intent information
            intent_data = {"intent": "general_query", "entities": [], "confidence": 0.7}

            if isinstance(analysis, dict) and "analysis" in analysis:
                analysis_result = analysis["analysis"]
                if isinstance(analysis_result, dict):
                    intent_data.update({
                        "intent": analysis_result.get("intent", "general_query"),
                        "entities": analysis_result.get("entities", []),
                        "confidence": analysis_result.get("confidence", 0.7),
                        "topic": analysis_result.get("topic", ""),
                        "action_required": analysis_result.get("action_required", False)
                    })

            # Detect specific intents
            message_lower = message.lower()

            if any(word in message_lower for word in ["create", "build", "make", "generate"]):
                intent_data["intent"] = "creation"
            elif any(word in message_lower for word in ["workflow", "automation", "automate"]):
                intent_data["intent"] = "workflow"
            elif any(word in message_lower for word in ["search", "find", "look for", "show me"]):
                intent_data["intent"] = "search"
            elif any(word in message_lower for word in ["help", "how", "what", "explain"]):
                intent_data["intent"] = "help"
            elif any(word in message_lower for word in ["run", "execute", "start", "launch"]):
                intent_data["intent"] = "execution"

            return intent_data

        except Exception as e:
            logger.error(f"Intent analysis failed: {e}")
            return {"intent": "general_query", "entities": [], "confidence": 0.5}

    async def _retrieve_knowledge(
        self,
        query: str,
        user_id: UUID,
        conversation: ConversationContext,
        intent: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Retrieve relevant knowledge from the user's knowledge base."""
        try:
            # Skip knowledge retrieval for certain intents
            if intent.get("intent") in ["greeting", "goodbye", "thanks"]:
                return {"results": [], "summary": None}

            # Build enhanced query from conversation context
            enhanced_query = query

            # Add context from recent messages
            if conversation.messages:
                recent_context = " ".join([
                    msg.content for msg in conversation.messages[-3:]
                    if msg.role == "user"
                ])
                enhanced_query = f"{recent_context} {query}"

            # Query knowledge base
            knowledge_query = KnowledgeQuery(
                query=enhanced_query,
                max_results=5,
                similarity_threshold=0.6,
                user_id=user_id,
                filters={}
            )

            knowledge_result = await knowledge_service.query_knowledge(knowledge_query)

            return {
                "results": knowledge_result.results,
                "summary": knowledge_result.summary,
                "total_found": knowledge_result.total_found
            }

        except Exception as e:
            logger.error(f"Knowledge retrieval failed: {e}")
            return {"results": [], "summary": None}

    async def _generate_response(
        self,
        user_message: str,
        conversation: ConversationContext,
        knowledge_results: Dict[str, Any],
        intent_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate contextual response using LLM."""
        try:
            # Build context for response generation
            context_parts = []

            # Add conversation history
            if conversation.messages:
                recent_messages = conversation.messages[-6:]  # Last 3 exchanges
                context_parts.append("Recent conversation:")
                for msg in recent_messages:
                    context_parts.append(f"{msg.role}: {msg.content}")

            # Add knowledge context
            if knowledge_results.get("results"):
                context_parts.append("\nRelevant knowledge:")
                for i, result in enumerate(knowledge_results["results"][:3]):
                    context_parts.append(f"{i+1}. {result['content'][:200]}...")

            # Add intent context
            intent = intent_analysis.get("intent", "general_query")
            context_parts.append(f"\nUser intent: {intent}")

            # Generate response
            full_context = "\n".join(context_parts)

            # Use different prompts based on intent
            if intent == "workflow":
                response_prompt = f"Help the user with workflow/automation needs. User message: '{user_message}'"
            elif intent == "search":
                response_prompt = f"Help the user find information. User message: '{user_message}'"
            elif intent == "creation":
                response_prompt = f"Help the user create or build something. User message: '{user_message}'"
            else:
                response_prompt = f"Provide a helpful response to: '{user_message}'"

            analysis = await llm_service.analyze_task(
                task_description=response_prompt,
                context=full_context
            )

            # Extract response
            response_text = "I understand you're asking about that. Let me help you with the information I have."
            tools_used = []
            confidence = 0.7

            if isinstance(analysis, dict) and "analysis" in analysis:
                analysis_result = analysis["analysis"]
                if isinstance(analysis_result, dict):
                    response_text = analysis_result.get("response", response_text)
                    tools_used = analysis_result.get("tools_used", [])
                    confidence = analysis_result.get("confidence", 0.7)

            # Enhance response with knowledge summary
            if knowledge_results.get("summary"):
                response_text += f"\n\nBased on your documents: {knowledge_results['summary']}"

            return {
                "message": response_text,
                "tools_used": tools_used,
                "confidence": confidence
            }

        except Exception as e:
            logger.error(f"Response generation failed: {e}")
            return {
                "message": "I'm here to help! Could you provide more details about what you're looking for?",
                "tools_used": [],
                "confidence": 0.5
            }

    async def _generate_suggestions(
        self,
        conversation: ConversationContext,
        intent_analysis: Dict[str, Any],
        knowledge_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate actionable suggestions and follow-up questions."""
        try:
            suggestions = {
                "actions": [],
                "workflows": [],
                "follow_ups": []
            }

            intent = intent_analysis.get("intent", "general_query")

            # Intent-based suggestions
            if intent == "workflow":
                suggestions["actions"].append({
                    "title": "Create New Workflow",
                    "description": "Build a visual workflow with drag-and-drop",
                    "action": "create_workflow",
                    "icon": "add_circle"
                })

                suggestions["workflows"].append({
                    "title": "AI-Generated Workflow",
                    "description": "Let AI create a workflow from your description",
                    "action": "generate_workflow",
                    "icon": "auto_fix_high"
                })

            elif intent == "search":
                suggestions["actions"].append({
                    "title": "Advanced Search",
                    "description": "Use filters and semantic search",
                    "action": "advanced_search",
                    "icon": "search"
                })

            elif intent == "creation":
                suggestions["actions"].extend([
                    {
                        "title": "Upload Document",
                        "description": "Add documents to your knowledge base",
                        "action": "upload_document",
                        "icon": "upload_file"
                    },
                    {
                        "title": "Create Workflow",
                        "description": "Build automated processes",
                        "action": "create_workflow",
                        "icon": "workflow"
                    }
                ])

            # Knowledge-based suggestions
            if knowledge_results.get("results"):
                suggestions["follow_ups"].extend([
                    "Can you tell me more about this topic?",
                    "How does this relate to my other documents?",
                    "What are the key points I should remember?"
                ])

            # Default follow-ups
            if not suggestions["follow_ups"]:
                suggestions["follow_ups"] = [
                    "What else would you like to know?",
                    "How can I help you with automation?",
                    "Would you like to create a workflow for this?"
                ]

            return suggestions

        except Exception as e:
            logger.error(f"Suggestion generation failed: {e}")
            return {"actions": [], "workflows": [], "follow_ups": []}

    async def _cache_conversation(self, conversation: ConversationContext):
        """Cache conversation in Redis."""
        try:
            conversation_data = conversation.dict()
            await redis_client.set(
                f"conversation:{conversation.conversation_id}",
                json.dumps(conversation_data, default=str),
                expire=self.conversation_cache_ttl
            )
        except Exception as e:
            logger.error(f"Failed to cache conversation: {e}")

    async def get_conversation_history(
        self,
        conversation_id: str,
        user_id: UUID,
        limit: int = 50
    ) -> List[ConversationMessage]:
        """Get conversation history."""
        try:
            conversation = await self._get_or_create_conversation(
                user_id=user_id,
                conversation_id=conversation_id
            )

            # Check permissions
            if conversation.user_id != user_id:
                return []

            return conversation.messages[-limit:]

        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}")
            return []

    async def list_conversations(
        self,
        user_id: UUID,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """List user's conversations."""
        try:
            # Get conversations for user
            user_conversations = [
                conv for conv in self.conversations.values()
                if conv.user_id == user_id
            ]

            # Sort by last update
            user_conversations.sort(key=lambda x: x.updated_at, reverse=True)

            # Return conversation summaries
            conversation_summaries = []
            for conv in user_conversations[:limit]:
                last_message = conv.messages[-1] if conv.messages else None
                conversation_summaries.append({
                    "conversation_id": conv.conversation_id,
                    "created_at": conv.created_at,
                    "updated_at": conv.updated_at,
                    "message_count": len(conv.messages),
                    "last_message": {
                        "content": last_message.content[:100] + "..." if last_message and len(last_message.content) > 100 else last_message.content if last_message else "",
                        "timestamp": last_message.timestamp if last_message else conv.created_at,
                        "role": last_message.role if last_message else "system"
                    } if last_message else None,
                    "has_knowledge_context": len(conv.knowledge_context) > 0
                })

            return conversation_summaries

        except Exception as e:
            logger.error(f"Failed to list conversations: {e}")
            return []

    async def delete_conversation(
        self,
        conversation_id: str,
        user_id: UUID
    ) -> bool:
        """Delete a conversation."""
        try:
            conversation = self.conversations.get(conversation_id)
            if not conversation or conversation.user_id != user_id:
                return False

            # Remove from memory
            del self.conversations[conversation_id]

            # Remove from cache
            await redis_client.delete(f"conversation:{conversation_id}")

            logger.info(f"Deleted conversation: {conversation_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete conversation: {e}")
            return False

    async def clear_conversation_history(
        self,
        conversation_id: str,
        user_id: UUID
    ) -> bool:
        """Clear conversation history but keep the conversation."""
        try:
            conversation = self.conversations.get(conversation_id)
            if not conversation or conversation.user_id != user_id:
                return False

            # Clear messages and context
            conversation.messages = []
            conversation.knowledge_context = []
            conversation.updated_at = datetime.utcnow()

            # Update cache
            await self._cache_conversation(conversation)

            logger.info(f"Cleared conversation history: {conversation_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to clear conversation history: {e}")
            return False


# Global conversational AI service instance
conversational_ai = ConversationalAIService()