"""
Conversational AI agent implementation with RAG capabilities.

This agent specializes in natural language interactions, knowledge retrieval,
and conversational workflow management.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel

from app.agents.base import (
    UPMAgent, Task, TaskResult, TaskStatus, TaskType, ExecutionContext,
    ExecutionStep, Capability, AgentStatus
)
from app.services.llm import llm_service
from app.core.vector_db import knowledge_manager

logger = logging.getLogger(__name__)


class ConversationMessage(BaseModel):
    """Individual conversation message."""
    message_id: UUID
    role: str  # user, assistant, system
    content: str
    timestamp: datetime
    metadata: Dict[str, Any] = {}


class ConversationSession(BaseModel):
    """Conversation session information."""
    session_id: UUID
    user_id: Optional[UUID] = None
    title: Optional[str] = None
    messages: List[ConversationMessage] = []
    context: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime


class KnowledgeQuery(BaseModel):
    """Knowledge retrieval query."""
    query: str
    filters: Dict[str, Any] = {}
    max_results: int = 5
    similarity_threshold: float = 0.7


class ConversationalAgent(UPMAgent):
    """
    Conversational AI agent with RAG capabilities.
    
    Capabilities:
    - Natural language conversation
    - Knowledge retrieval and synthesis
    - Context-aware responses
    - Multi-turn conversation management
    - Document-based question answering
    - Conversation summarization
    """
    
    def __init__(self, **kwargs):
        # Define conversational capabilities
        capabilities = [
            Capability(
                name="natural_conversation",
                description="Engage in natural language conversations",
                supported_task_types=[TaskType.CONVERSATION]
            ),
            Capability(
                name="knowledge_retrieval",
                description="Retrieve and synthesize information from knowledge base",
                supported_task_types=[TaskType.CONVERSATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="context_management",
                description="Maintain conversation context and memory",
                supported_task_types=[TaskType.CONVERSATION]
            ),
            Capability(
                name="document_qa",
                description="Answer questions based on document content",
                supported_task_types=[TaskType.CONVERSATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="conversation_summarization",
                description="Summarize conversation history and key points",
                supported_task_types=[TaskType.CONVERSATION]
            ),
            Capability(
                name="intent_recognition",
                description="Recognize user intents and extract entities",
                supported_task_types=[TaskType.CONVERSATION]
            )
        ]
        
        super().__init__(
            name=kwargs.get("name", "ConversationalAgent"),
            capabilities=capabilities,
            **kwargs
        )
        
        # Conversation-specific attributes
        self.active_sessions: Dict[UUID, ConversationSession] = {}
        self.conversation_history_limit = kwargs.get("history_limit", 50)
        self.default_system_prompt = kwargs.get(
            "system_prompt",
            "You are a helpful AI assistant with access to a knowledge base. "
            "Provide accurate, helpful, and contextual responses."
        )
    
    def _register_default_tools(self):
        """Register conversation-specific tools."""
        self.tools.register_tool("knowledge_search", self._search_knowledge)
        self.tools.register_tool("summarize_conversation", self._summarize_conversation)
        self.tools.register_tool("extract_entities", self._extract_entities)
        self.tools.register_tool("detect_intent", self._detect_intent)
    
    async def execute_task(self, task: Task, context: ExecutionContext) -> TaskResult:
        """Execute a conversational task."""
        self.status = AgentStatus.BUSY
        started_at = datetime.utcnow()
        execution_steps = []
        
        try:
            self.logger.info(f"Executing conversational task: {task.name}")
            
            # Parse task parameters
            task_type = task.parameters.get("task_type", "conversation")
            session_id = task.parameters.get("session_id")
            user_message = task.parameters.get("message", "")
            system_prompt = task.parameters.get("system_prompt", self.default_system_prompt)
            
            result = None
            
            if task_type == "conversation":
                result = await self._handle_conversation(
                    session_id, user_message, system_prompt, context, execution_steps
                )
            elif task_type == "knowledge_query":
                result = await self._handle_knowledge_query(
                    task.parameters, context, execution_steps
                )
            elif task_type == "summarize":
                result = await self._handle_summarization(
                    task.parameters, context, execution_steps
                )
            elif task_type == "intent_analysis":
                result = await self._handle_intent_analysis(
                    task.parameters, context, execution_steps
                )
            else:
                raise ValueError(f"Unsupported conversational task type: {task_type}")
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.COMPLETED,
                result=result,
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                metadata={
                    "task_type": task_type,
                    "session_id": str(session_id) if session_id else None
                }
            )
            
            # Update performance metrics
            self.update_performance_metrics(task_result)
            self.status = AgentStatus.IDLE
            
            return task_result
            
        except Exception as e:
            self.logger.error(f"Conversational task execution failed: {e}")
            self.status = AgentStatus.ERROR
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error=str(e),
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms
            )
            
            self.update_performance_metrics(task_result)
            return task_result
    
    async def _handle_conversation(
        self,
        session_id: Optional[UUID],
        user_message: str,
        system_prompt: str,
        context: ExecutionContext,
        execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle a conversation turn."""
        
        # Get or create session
        if session_id:
            session = self.active_sessions.get(session_id)
            if not session:
                session = ConversationSession(
                    session_id=session_id,
                    user_id=context.user_id,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                self.active_sessions[session_id] = session
        else:
            session_id = uuid4()
            session = ConversationSession(
                session_id=session_id,
                user_id=context.user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.active_sessions[session_id] = session
        
        # Add user message to session
        user_msg = ConversationMessage(
            message_id=uuid4(),
            role="user",
            content=user_message,
            timestamp=datetime.utcnow()
        )
        session.messages.append(user_msg)
        
        # Knowledge retrieval step
        step_started = datetime.utcnow()
        try:
            knowledge_results = await self._search_knowledge(user_message)
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="knowledge_retrieval",
                parameters={"query": user_message},
                result=knowledge_results,
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
        except Exception as e:
            self.logger.warning(f"Knowledge retrieval failed: {e}")
            knowledge_results = {"documents": [], "error": str(e)}
        
        # Generate response step
        step_started = datetime.utcnow()
        try:
            # Prepare conversation history
            conversation_history = []
            recent_messages = session.messages[-self.conversation_history_limit:]
            
            for msg in recent_messages[:-1]:  # Exclude the current user message
                conversation_history.append({
                    "role": msg.role,
                    "content": msg.content
                })
            
            # Prepare context from knowledge retrieval
            context_text = ""
            if knowledge_results.get("documents"):
                context_text = "\n\nRelevant context from knowledge base:\n"
                for doc in knowledge_results["documents"][:3]:  # Top 3 results
                    context_text += f"- {doc.get('content', '')[:200]}...\n"
            
            # Generate response using LLM
            enhanced_prompt = f"{system_prompt}\n{context_text}"
            
            response_result = await llm_service.generate_completion(
                prompt=user_message,
                system_message=enhanced_prompt,
                temperature=0.7,
                max_tokens=1000
            )
            
            assistant_response = response_result["content"]
            
            # Add assistant message to session
            assistant_msg = ConversationMessage(
                message_id=uuid4(),
                role="assistant",
                content=assistant_response,
                timestamp=datetime.utcnow(),
                metadata={
                    "knowledge_sources": len(knowledge_results.get("documents", [])),
                    "llm_usage": response_result.get("usage", {})
                }
            )
            session.messages.append(assistant_msg)
            session.updated_at = datetime.utcnow()
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="generate_response",
                parameters={"system_prompt": enhanced_prompt},
                result={"response": assistant_response, "usage": response_result.get("usage")},
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "session_id": str(session_id),
                "response": assistant_response,
                "message_id": str(assistant_msg.message_id),
                "knowledge_sources": len(knowledge_results.get("documents", [])),
                "conversation_length": len(session.messages)
            }
            
        except Exception as e:
            self.logger.error(f"Response generation failed: {e}")
            raise
    
    async def _handle_knowledge_query(
        self,
        parameters: Dict[str, Any],
        context: ExecutionContext,
        execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle a knowledge base query."""
        
        query = parameters.get("query", "")
        filters = parameters.get("filters", {})
        max_results = parameters.get("max_results", 5)
        
        step_started = datetime.utcnow()
        try:
            # Search knowledge base
            search_results = await knowledge_manager.search_documents(
                query=query,
                filters=filters,
                limit=max_results
            )
            
            # Synthesize results using LLM
            if search_results:
                synthesis_prompt = f"""
                Based on the following search results, provide a comprehensive answer to the query: "{query}"
                
                Search Results:
                """
                
                for i, result in enumerate(search_results[:5], 1):
                    synthesis_prompt += f"\n{i}. {result.get('content', '')[:500]}...\n"
                
                synthesis_prompt += "\nProvide a well-structured answer that synthesizes the information from these sources."
                
                synthesis_result = await llm_service.generate_completion(
                    prompt=synthesis_prompt,
                    temperature=0.3,
                    max_tokens=1000
                )
                
                synthesized_answer = synthesis_result["content"]
            else:
                synthesized_answer = "No relevant information found in the knowledge base."
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="knowledge_query_and_synthesis",
                parameters={"query": query, "filters": filters},
                result={
                    "synthesized_answer": synthesized_answer,
                    "source_count": len(search_results),
                    "sources": search_results
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "query": query,
                "answer": synthesized_answer,
                "sources": search_results,
                "source_count": len(search_results)
            }
            
        except Exception as e:
            self.logger.error(f"Knowledge query failed: {e}")
            raise
    
    async def _handle_summarization(
        self,
        parameters: Dict[str, Any],
        context: ExecutionContext,
        execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle conversation or document summarization."""
        
        content_type = parameters.get("content_type", "conversation")
        session_id = parameters.get("session_id")
        content = parameters.get("content", "")
        
        step_started = datetime.utcnow()
        try:
            if content_type == "conversation" and session_id:
                session = self.active_sessions.get(UUID(session_id))
                if not session:
                    raise ValueError(f"Session {session_id} not found")
                
                # Prepare conversation for summarization
                conversation_text = ""
                for msg in session.messages:
                    conversation_text += f"{msg.role}: {msg.content}\n"
                
                content_to_summarize = conversation_text
            else:
                content_to_summarize = content
            
            # Generate summary using LLM
            summary_prompt = f"""
            Please provide a concise summary of the following {content_type}:
            
            {content_to_summarize}
            
            Include:
            1. Main topics discussed
            2. Key decisions or conclusions
            3. Action items (if any)
            4. Important details
            """
            
            summary_result = await llm_service.generate_completion(
                prompt=summary_prompt,
                temperature=0.3,
                max_tokens=500
            )
            
            summary = summary_result["content"]
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="summarization",
                parameters={"content_type": content_type, "content_length": len(content_to_summarize)},
                result={"summary": summary},
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "content_type": content_type,
                "summary": summary,
                "original_length": len(content_to_summarize),
                "summary_length": len(summary)
            }
            
        except Exception as e:
            self.logger.error(f"Summarization failed: {e}")
            raise
    
    async def _handle_intent_analysis(
        self,
        parameters: Dict[str, Any],
        context: ExecutionContext,
        execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle intent recognition and entity extraction."""
        
        text = parameters.get("text", "")
        
        step_started = datetime.utcnow()
        try:
            # Use LLM for intent analysis
            intent_prompt = f"""
            Analyze the following text for intent and entities:
            
            Text: "{text}"
            
            Provide a JSON response with:
            {{
                "intent": "primary intent category",
                "confidence": 0.0-1.0,
                "entities": [
                    {{"type": "entity_type", "value": "entity_value", "start": 0, "end": 5}}
                ],
                "sentiment": "positive/negative/neutral",
                "urgency": "low/medium/high"
            }}
            """
            
            analysis_result = await llm_service.generate_completion(
                prompt=intent_prompt,
                temperature=0.1,
                max_tokens=300
            )
            
            # Try to parse JSON response
            import json
            try:
                analysis = json.loads(analysis_result["content"])
            except json.JSONDecodeError:
                # Fallback analysis
                analysis = {
                    "intent": "unknown",
                    "confidence": 0.5,
                    "entities": [],
                    "sentiment": "neutral",
                    "urgency": "medium",
                    "raw_response": analysis_result["content"]
                }
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="intent_analysis",
                parameters={"text": text},
                result=analysis,
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Intent analysis failed: {e}")
            raise
    
    async def _search_knowledge(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        """Search the knowledge base for relevant information."""
        try:
            results = await knowledge_manager.search_documents(
                query=query,
                limit=max_results
            )
            
            return {
                "documents": results,
                "count": len(results),
                "query": query
            }
            
        except Exception as e:
            self.logger.error(f"Knowledge search failed: {e}")
            return {
                "documents": [],
                "count": 0,
                "query": query,
                "error": str(e)
            }
    
    async def _summarize_conversation(self, session_id: UUID) -> str:
        """Summarize a conversation session."""
        session = self.active_sessions.get(session_id)
        if not session:
            return "Session not found"
        
        # Prepare conversation for summarization
        conversation_text = ""
        for msg in session.messages:
            conversation_text += f"{msg.role}: {msg.content}\n"
        
        try:
            result = await llm_service.generate_completion(
                prompt=f"Summarize this conversation:\n\n{conversation_text}",
                temperature=0.3,
                max_tokens=300
            )
            return result["content"]
        except Exception as e:
            self.logger.error(f"Conversation summarization failed: {e}")
            return f"Summarization failed: {e}"
    
    async def _extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract entities from text."""
        try:
            result = await llm_service.generate_completion(
                prompt=f"Extract named entities from this text and return as JSON array: {text}",
                temperature=0.1,
                max_tokens=200
            )
            
            import json
            try:
                entities = json.loads(result["content"])
                return entities if isinstance(entities, list) else []
            except json.JSONDecodeError:
                return []
                
        except Exception as e:
            self.logger.error(f"Entity extraction failed: {e}")
            return []
    
    async def _detect_intent(self, text: str) -> Dict[str, Any]:
        """Detect intent from text."""
        try:
            result = await llm_service.generate_completion(
                prompt=f"Detect the intent of this text and return as JSON: {text}",
                temperature=0.1,
                max_tokens=100
            )
            
            import json
            try:
                intent = json.loads(result["content"])
                return intent if isinstance(intent, dict) else {"intent": "unknown"}
            except json.JSONDecodeError:
                return {"intent": "unknown", "raw_response": result["content"]}
                
        except Exception as e:
            self.logger.error(f"Intent detection failed: {e}")
            return {"intent": "error", "error": str(e)}
    
    async def _contribute_to_collaboration(
        self, 
        objective: str, 
        context: Optional[ExecutionContext] = None
    ) -> Dict[str, Any]:
        """Contribute conversational AI capabilities to collaboration."""
        
        try:
            analysis = await llm_service.analyze_task(
                task_description=f"Conversational AI contribution to: {objective}",
                context=f"Available capabilities: {[cap.name for cap in self.capabilities]}"
            )
            
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "conversational_ai",
                "capabilities": [cap.name for cap in self.capabilities],
                "contribution_analysis": analysis.get("analysis", {}),
                "suggested_actions": [
                    "Facilitate natural language communication",
                    "Provide knowledge-based answers",
                    "Summarize findings and decisions",
                    "Extract key information from conversations",
                    "Maintain context across interactions"
                ]
            }
            
        except Exception as e:
            self.logger.error(f"Collaboration contribution analysis failed: {e}")
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "conversational_ai",
                "capabilities": [cap.name for cap in self.capabilities],
                "error": str(e)
            }
    
    def get_session(self, session_id: UUID) -> Optional[ConversationSession]:
        """Get a conversation session by ID."""
        return self.active_sessions.get(session_id)
    
    def list_sessions(self, user_id: Optional[UUID] = None) -> List[ConversationSession]:
        """List conversation sessions, optionally filtered by user."""
        sessions = list(self.active_sessions.values())
        if user_id:
            sessions = [s for s in sessions if s.user_id == user_id]
        return sessions
    
    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """Clean up old conversation sessions."""
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        old_sessions = [
            session_id for session_id, session in self.active_sessions.items()
            if session.updated_at < cutoff_time
        ]
        
        for session_id in old_sessions:
            del self.active_sessions[session_id]
            self.logger.info(f"Cleaned up old session: {session_id}")
        
        return len(old_sessions)
