"""
RAG (Retrieval-Augmented Generation) Service for Context-Aware AI Responses
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
import logging
import uuid
import json
import re
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import numpy as np

from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.services.llm_service import LLMService
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)


@dataclass
class RAGQuery:
    """RAG query request with context and parameters."""
    query: str
    conversation_id: str
    user_id: str
    max_context_items: int = 5
    similarity_threshold: float = 0.7
    include_sources: bool = True
    language: str = "en"
    max_tokens: int = 1000
    temperature: float = 0.7


@dataclass
class RAGContext:
    """Individual context item for RAG processing."""
    content: str
    source: str
    document_id: str
    chunk_id: str
    similarity_score: float
    metadata: Dict[str, Any]
    relevance_rank: int


@dataclass
class RAGCitation:
    """Citation information for RAG responses."""
    source: str
    document_id: str
    chunk_id: str
    title: str
    author: Optional[str] = None
    url: Optional[str] = None
    confidence: float = 0.0
    text_snippet: str = ""


@dataclass
class RAGResponse:
    """Complete RAG response with context and citations."""
    answer: str
    query: str
    context_items: List[RAGContext]
    citations: List[RAGCitation]
    confidence_score: float
    language: str
    processing_time_ms: int
    tokens_used: int
    model_used: str
    conversation_id: str
    timestamp: datetime


@dataclass
class ConversationMemory:
    """Conversation memory for context retention."""
    conversation_id: str
    user_id: str
    messages: List[Dict[str, Any]]
    context_cache: List[Dict[str, Any]]
    last_updated: datetime
    language_preference: str = "en"


class RAGService:
    """Service for Retrieval-Augmented Generation with context-aware responses."""

    def __init__(self):
        self.vector_store = VectorStoreService()
        self.embedding_service = EmbeddingService()
        self.llm_service = LLMService()
        self.cache_service = CacheService()
        self.conversation_memories: Dict[str, ConversationMemory] = {}

        # RAG configuration
        self.max_context_length = 4000  # characters
        self.context_overlap_ratio = 0.1
        self.citation_min_confidence = 0.5
        self.cache_ttl = 3600  # 1 hour

    async def process_query(self, query: RAGQuery) -> RAGResponse:
        """Process a RAG query and generate context-aware response."""
        start_time = datetime.utcnow()

        try:
            logger.info(f"Processing RAG query: {query.query[:100]}...")

            # Step 1: Retrieve relevant context
            context_items = await self._retrieve_context(query)

            # Step 2: Generate citations from context
            citations = await self._generate_citations(context_items, query)

            # Step 3: Construct context prompt
            context_prompt = await self._construct_context_prompt(context_items, query)

            # Step 4: Generate response using LLM
            llm_response = await self._generate_llm_response(
                query.query,
                context_prompt,
                query
            )

            # Step 5: Calculate confidence score
            confidence_score = await self._calculate_confidence_score(
                llm_response, context_items, citations
            )

            # Step 6: Update conversation memory
            await self._update_conversation_memory(query, llm_response, context_items)

            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            response = RAGResponse(
                answer=llm_response.get("content", ""),
                query=query.query,
                context_items=context_items,
                citations=citations,
                confidence_score=confidence_score,
                language=query.language,
                processing_time_ms=processing_time,
                tokens_used=llm_response.get("tokens_used", 0),
                model_used=llm_response.get("model", "unknown"),
                conversation_id=query.conversation_id,
                timestamp=start_time
            )

            logger.info(f"RAG query processed in {processing_time}ms with confidence {confidence_score:.2f}")
            return response

        except Exception as e:
            logger.error(f"RAG query processing failed: {e}")
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Return error response
            return RAGResponse(
                answer="I apologize, but I encountered an error while processing your query. Please try again.",
                query=query.query,
                context_items=[],
                citations=[],
                confidence_score=0.0,
                language=query.language,
                processing_time_ms=processing_time,
                tokens_used=0,
                model_used="error",
                conversation_id=query.conversation_id,
                timestamp=start_time
            )

    async def _retrieve_context(self, query: RAGQuery) -> List[RAGContext]:
        """Retrieve relevant context items for the query."""
        try:
            # Get conversation context if available
            conversation_context = await self._get_conversation_context(query.conversation_id)

            # Perform hybrid search for relevant documents
            search_results = await self.vector_store.hybrid_search(
                query=query.query,
                text_weight=0.3,
                vector_weight=0.7,
                n_results=query.max_context_items * 2,  # Get more to filter
                filters={"language": query.language} if query.language != "en" else None
            )

            # Convert search results to context items
            context_items = []
            for i, result in enumerate(search_results.get("results", [])):
                if len(context_items) >= query.max_context_items:
                    break

                similarity_score = result.get("combined_score", result.get("similarity_score", 0))
                if similarity_score >= query.similarity_threshold:
                    metadata = result.get("metadata", {})

                    context_item = RAGContext(
                        content=result.get("content", ""),
                        source=metadata.get("source", "unknown"),
                        document_id=metadata.get("document_id", ""),
                        chunk_id=result.get("id", ""),
                        similarity_score=similarity_score,
                        metadata=metadata,
                        relevance_rank=i + 1
                    )
                    context_items.append(context_item)

            # Add conversation context if available
            if conversation_context:
                for conv_item in conversation_context[:2]:  # Limit conversation context
                    if len(context_items) < query.max_context_items:
                        context_items.append(conv_item)

            # Sort by relevance and return
            context_items.sort(key=lambda x: x.similarity_score, reverse=True)
            return context_items[:query.max_context_items]

        except Exception as e:
            logger.error(f"Context retrieval failed: {e}")
            return []

    async def _generate_citations(self, context_items: List[RAGContext], query: RAGQuery) -> List[RAGCitation]:
        """Generate citations from context items."""
        if not query.include_sources:
            return []

        citations = []
        for context_item in context_items:
            metadata = context_item.metadata

            # Generate text snippet (first 200 characters)
            text_snippet = context_item.content[:200] + "..." if len(context_item.content) > 200 else context_item.content

            citation = RAGCitation(
                source=metadata.get("source", "unknown"),
                document_id=context_item.document_id,
                chunk_id=context_item.chunk_id,
                title=metadata.get("title", "Untitled Document"),
                author=metadata.get("author"),
                url=metadata.get("url"),
                confidence=context_item.similarity_score,
                text_snippet=text_snippet
            )

            # Only include citations with sufficient confidence
            if citation.confidence >= self.citation_min_confidence:
                citations.append(citation)

        return citations

    async def _construct_context_prompt(self, context_items: List[RAGContext], query: RAGQuery) -> str:
        """Construct context prompt for LLM."""
        if not context_items:
            return "No specific context available for this query."

        context_parts = []
        total_length = 0
        max_length = self.max_context_length

        # Add conversation history if available
        conversation_memory = self.conversation_memories.get(query.conversation_id)
        if conversation_memory and conversation_memory.messages:
            recent_messages = conversation_memory.messages[-3:]  # Last 3 messages
            context_parts.append("Recent conversation context:")
            for msg in recent_messages:
                role = msg.get("role", "unknown")
                content = msg.get("content", "")[:200]
                context_parts.append(f"{role.title()}: {content}")
            context_parts.append("")  # Empty line

        # Add retrieved context
        context_parts.append("Relevant information from knowledge base:")
        for i, context_item in enumerate(context_items):
            if total_length >= max_length:
                break

            # Truncate content if needed
            content = context_item.content
            available_length = max_length - total_length - 100  # Reserve space for numbering

            if len(content) > available_length:
                content = content[:available_length] + "..."

            context_part = f"{i+1}. {content}"
            context_parts.append(context_part)
            total_length += len(context_part)

            # Add source information
            if context_item.metadata.get("title"):
                source_info = f"   Source: {context_item.metadata['title']}"
                context_parts.append(source_info)
                total_length += len(source_part)

        return "\n".join(context_parts)

    async def _generate_llm_response(self, query: str, context_prompt: str, rag_query: RAGQuery) -> Dict[str, Any]:
        """Generate LLM response with context."""
        try:
            # Construct system prompt for RAG
            system_prompt = self._get_rag_system_prompt(rag_query.language)

            # Construct user prompt
            user_prompt = f"""
Context Information:
{context_prompt}

User Query: {query}

Please provide a comprehensive answer based on the context information above. If the context doesn't contain sufficient information to answer the query completely, please indicate what information is missing and provide the best possible answer based on available context.
"""

            # Generate response using LLM service
            response = await self.llm_service.generate_response(
                prompt=user_prompt,
                system_prompt=system_prompt,
                max_tokens=rag_query.max_tokens,
                temperature=rag_query.temperature,
                user_id=rag_query.user_id
            )

            return response

        except Exception as e:
            logger.error(f"LLM response generation failed: {e}")
            return {
                "content": "I apologize, but I'm having trouble generating a response right now. Please try again.",
                "tokens_used": 0,
                "model": "error"
            }

    def _get_rag_system_prompt(self, language: str = "en") -> str:
        """Get system prompt for RAG based on language."""
        prompts = {
            "en": """
You are a helpful AI assistant with access to a knowledge base through Retrieval-Augmented Generation (RAG).

Your role is to:
1. Use the provided context information to answer user queries accurately and comprehensively
2. Always base your answers on the provided context when possible
3. If the context doesn't contain enough information, clearly indicate what's missing
4. Provide clear, well-structured responses
5. Cite your sources appropriately when referencing specific information
6. Be helpful and professional in your responses

Format your response as a clear, readable answer that directly addresses the user's question.
""",
            "es": """
Eres un asistente de IA útil con acceso a una base de conocimiento a través de Generación Aumentada por Recuperación (RAG).

Tu rol es:
1. Usar la información de contexto proporcionada para responder preguntas de manera precisa y completa
2. Basar siempre tus respuestas en el contexto proporcionado cuando sea posible
3. Si el contexto no contiene suficiente información, indicar claramente lo que falta
4. Proporcionar respuestas claras y bien estructuradas
5. Citar tus fuentes apropiadamente al referenciar información específica
6. Ser útil y profesional en tus respuestas

Formatea tu respuesta como una respuesta clara y legible que aborde directamente la pregunta del usuario.
""",
            "fr": """
Vous êtes un assistant IA utile avec accès à une base de connaissances via la Génération Augmentée par Récupération (RAG).

Votre rôle est de :
1. Utiliser les informations de contexte fournies pour répondre aux questions avec précision et de manière complète
2. Toujours baser vos réponses sur le contexte fourni lorsque possible
3. Si le contexte ne contient pas suffisamment d'informations, indiquer clairement ce qui manque
4. Fournir des réponses claires et bien structurées
5. Citer vos sources de manière appropriée lors de la référence d'informations spécifiques
6. Être utile et professionnel dans vos réponses

Formatez votre réponse comme une réponse claire et lisible qui répond directement à la question de l'utilisateur.
"""
        }

        return prompts.get(language, prompts["en"])

    async def _calculate_confidence_score(self, llm_response: Dict[str, Any],
                                        context_items: List[RAGContext],
                                        citations: List[RAGCitation]) -> float:
        """Calculate confidence score for the RAG response."""
        try:
            # Base confidence from context relevance
            if not context_items:
                return 0.3  # Low confidence without context

            # Average similarity score of context items
            avg_similarity = np.mean([item.similarity_score for item in context_items])

            # Citation coverage factor
            citation_factor = min(len(citations) / max(len(context_items), 1), 1.0)

            # Response quality factor (length and completeness)
            response_content = llm_response.get("content", "")
            response_length_factor = min(len(response_content) / 200, 1.0)  # Normalize to 200 chars

            # Combined confidence score
            confidence_score = (
                avg_similarity * 0.5 +      # 50% weight on context relevance
                citation_factor * 0.3 +    # 30% weight on citation coverage
                response_length_factor * 0.2  # 20% weight on response quality
            )

            return min(max(confidence_score, 0.0), 1.0)  # Clamp between 0 and 1

        except Exception as e:
            logger.error(f"Confidence score calculation failed: {e}")
            return 0.5  # Default medium confidence

    async def _get_conversation_context(self, conversation_id: str) -> List[RAGContext]:
        """Get context from conversation memory."""
        try:
            if conversation_id not in self.conversation_memories:
                return []

            memory = self.conversation_memories[conversation_id]
            context_items = []

            # Convert recent conversation context to RAGContext items
            for item in memory.context_cache[-2:]:  # Last 2 context items
                if isinstance(item, dict):
                    context_item = RAGContext(
                        content=item.get("content", ""),
                        source="conversation",
                        document_id=item.get("document_id", ""),
                        chunk_id=item.get("chunk_id", ""),
                        similarity_score=item.get("similarity_score", 0.5),
                        metadata=item.get("metadata", {}),
                        relevance_rank=0
                    )
                    context_items.append(context_item)

            return context_items

        except Exception as e:
            logger.error(f"Failed to get conversation context: {e}")
            return []

    async def _update_conversation_memory(self, query: RAGQuery, llm_response: Dict[str, Any],
                                        context_items: List[RAGContext]):
        """Update conversation memory with new interaction."""
        try:
            # Get or create conversation memory
            if query.conversation_id not in self.conversation_memories:
                self.conversation_memories[query.conversation_id] = ConversationMemory(
                    conversation_id=query.conversation_id,
                    user_id=query.user_id,
                    messages=[],
                    context_cache=[],
                    last_updated=datetime.utcnow(),
                    language_preference=query.language
                )

            memory = self.conversation_memories[query.conversation_id]

            # Add user message
            memory.messages.append({
                "role": "user",
                "content": query.query,
                "timestamp": datetime.utcnow().isoformat()
            })

            # Add assistant message
            memory.messages.append({
                "role": "assistant",
                "content": llm_response.get("content", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "confidence": llm_response.get("confidence_score", 0.0)
            })

            # Update context cache
            memory.context_cache.extend([
                asdict(context_item) for context_item in context_items
            ])

            # Keep only recent context (last 10 items)
            if len(memory.context_cache) > 10:
                memory.context_cache = memory.context_cache[-10:]

            # Keep only recent messages (last 20 messages)
            if len(memory.messages) > 20:
                memory.messages = memory.messages[-20:]

            # Update timestamp
            memory.last_updated = datetime.utcnow()

            # Clean up old memories (older than 24 hours)
            await self._cleanup_old_memories()

        except Exception as e:
            logger.error(f"Failed to update conversation memory: {e}")

    async def _cleanup_old_memories(self):
        """Clean up old conversation memories."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=24)

            old_conversations = [
                conv_id for conv_id, memory in self.conversation_memories.items()
                if memory.last_updated < cutoff_time
            ]

            for conv_id in old_conversations:
                del self.conversation_memories[conv_id]
                logger.info(f"Cleaned up old conversation memory: {conv_id}")

        except Exception as e:
            logger.error(f"Failed to cleanup old memories: {e}")

    async def get_conversation_history(self, conversation_id: str,
                                     max_messages: int = 10) -> List[Dict[str, Any]]:
        """Get conversation history for a given conversation."""
        try:
            if conversation_id not in self.conversation_memories:
                return []

            memory = self.conversation_memories[conversation_id]
            return memory.messages[-max_messages:]

        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}")
            return []

    async def clear_conversation_memory(self, conversation_id: str) -> bool:
        """Clear conversation memory for a given conversation."""
        try:
            if conversation_id in self.conversation_memories:
                del self.conversation_memories[conversation_id]
                logger.info(f"Cleared conversation memory: {conversation_id}")
                return True
            return False

        except Exception as e:
            logger.error(f"Failed to clear conversation memory: {e}")
            return False

    async def get_supported_languages(self) -> List[str]:
        """Get list of supported languages."""
        return ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "zh", "ko"]

    async def health_check(self) -> Dict[str, Any]:
        """Check RAG service health."""
        try:
            # Check dependencies
            vector_store_healthy = await self.vector_store.health_check()
            embedding_healthy = await self.embedding_service.health_check()

            # Check LLM service
            try:
                test_response = await self.llm_service.generate_response(
                    prompt="Hello",
                    max_tokens=10,
                    temperature=0.1,
                    user_id="health_check"
                )
                llm_healthy = bool(test_response.get("content"))
            except:
                llm_healthy = False

            overall_health = vector_store_healthy and embedding_healthy and llm_healthy

            return {
                "healthy": overall_health,
                "vector_store": vector_store_healthy,
                "embedding_service": embedding_healthy,
                "llm_service": llm_healthy,
                "active_conversations": len(self.conversation_memories),
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"RAG service health check failed: {e}")
            return {
                "healthy": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


# Global RAG service instance
_rag_service = None

async def get_rag_service() -> RAGService:
    """Get or create RAG service instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service