"""
Agent Collaboration Framework Service

This service provides comprehensive agent collaboration capabilities including:
- Agent discovery and capability matching
- Secure inter-agent communication
- Task delegation and workflow orchestration
- Consensus decision-making
- Result aggregation and conflict resolution
"""

import asyncio
import json
import logging
import hashlib
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Union, Any, Callable
from uuid import UUID, uuid4
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from pydantic import BaseModel

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.collaboration import (
    CollaborationSession, CollaborationMessage, CollaborationTask,
    ConsensusVote, AgentCapability, CommunicationChannel,
    CollaborationPattern, PatternApplication, ChannelMetrics,
    CollaborationStatus, MessageType, MessagePriority
)
from app.models.agent import Agent as AgentModel
from app.agents.production_registry import get_production_registry, ProductionAgentRegistry
from app.agents.base import UPMAgent, Task, TaskType, AgentStatus


class CollaborationError(Exception):
    """Base exception for collaboration errors"""
    pass


class AgentNotFoundError(CollaborationError):
    """Raised when an agent is not found"""
    pass


class CommunicationError(CollaborationError):
    """Raised when communication fails"""
    pass


class ConsensusError(CollaborationError):
    """Raised when consensus cannot be reached"""
    pass


class DelegationError(CollaborationError):
    """Raised when task delegation fails"""
    pass


@dataclass
class AgentInfo:
    """Agent information for collaboration"""
    agent_id: UUID
    name: str
    agent_type: str
    capabilities: List[str]
    status: str
    current_load: float = 0.0
    performance_score: float = 0.5
    last_seen: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MessageEnvelope:
    """Message envelope for agent communication"""
    message_id: UUID
    sender_id: UUID
    recipient_id: Optional[UUID]
    message_type: MessageType
    priority: MessagePriority
    subject: Optional[str]
    content: str
    payload: Optional[Dict[str, Any]] = None
    thread_id: Optional[UUID] = None
    parent_message_id: Optional[UUID] = None
    requires_response: bool = False
    response_deadline: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    sent_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TaskDelegationRequest:
    """Task delegation request"""
    task_id: UUID
    delegating_agent_id: UUID
    task_type: str
    title: str
    description: str
    input_data: Dict[str, Any]
    requirements: Dict[str, Any] = field(default_factory=dict)
    constraints: Dict[str, Any] = field(default_factory=dict)
    priority: int = 5
    deadline: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CollaborationWorkflowStep:
    """Step in a collaboration workflow"""
    step_id: UUID
    step_type: str  # task_delegation, consensus, parallel_execution, sequential_execution
    description: str
    required_agents: List[UUID]
    optional_agents: List[UUID] = field(default_factory=list)
    dependencies: List[UUID] = field(default_factory=list)  # Step dependencies
    timeout_minutes: int = 30
    consensus_threshold: float = 0.7
    parameters: Dict[str, Any] = field(default_factory=dict)


class AgentDiscoveryService:
    """Service for discovering and matching agents based on capabilities"""

    def __init__(self, registry: ProductionAgentRegistry):
        self.registry = registry
        self.logger = logging.getLogger(self.__class__.__name__)
        self._capability_cache = {}
        self._cache_ttl = 300  # 5 minutes

    async def discover_agents_by_capability(
        self,
        required_capabilities: List[str],
        exclude_agents: Optional[List[UUID]] = None,
        min_performance_score: float = 0.3,
        max_agents: int = 10
    ) -> List[AgentInfo]:
        """
        Discover agents that have the required capabilities.

        Args:
            required_capabilities: List of required capability names
            exclude_agents: Agents to exclude from results
            min_performance_score: Minimum performance score threshold
            max_agents: Maximum number of agents to return

        Returns:
            List of matching AgentInfo objects
        """
        try:
            self.logger.info(f"Discovering agents with capabilities: {required_capabilities}")

            exclude_agents = exclude_agents or []
            matching_agents = []

            # Get all registered agents from registry
            system_overview = await self.registry.get_system_overview()
            registered_agents = system_overview.get("registry", {}).get("agents", [])

            for agent_data in registered_agents:
                agent_id = UUID(agent_data.get("id"))
                if agent_id in exclude_agents:
                    continue

                # Check if agent has required capabilities
                agent_capabilities = agent_data.get("capabilities", [])
                performance_score = agent_data.get("performance_metrics", {}).get("performance_score", 0.0)

                if (performance_score >= min_performance_score and
                    all(cap in agent_capabilities for cap in required_capabilities)):

                    agent_info = AgentInfo(
                        agent_id=agent_id,
                        name=agent_data.get("name", "Unknown"),
                        agent_type=agent_data.get("agent_type", "unknown"),
                        capabilities=agent_capabilities,
                        status=agent_data.get("status", "unknown"),
                        current_load=agent_data.get("current_load", 0.0),
                        performance_score=performance_score,
                        metadata=agent_data.get("metadata", {})
                    )
                    matching_agents.append(agent_info)

            # Sort by performance score and limit results
            matching_agents.sort(key=lambda x: x.performance_score, reverse=True)
            return matching_agents[:max_agents]

        except Exception as e:
            self.logger.error(f"Failed to discover agents by capability: {e}")
            raise CollaborationError(f"Agent discovery failed: {str(e)}")

    async def find_best_agent_for_task(
        self,
        task_type: str,
        requirements: Dict[str, Any],
        exclude_agents: Optional[List[UUID]] = None,
        load_balance: bool = True
    ) -> Optional[AgentInfo]:
        """
        Find the best agent for a specific task.

        Args:
            task_type: Type of task to be performed
            requirements: Task requirements and constraints
            exclude_agents: Agents to exclude from consideration
            load_balance: Whether to consider current load in selection

        Returns:
            Best matching AgentInfo or None
        """
        try:
            self.logger.info(f"Finding best agent for task type: {task_type}")

            # Determine required capabilities from task type
            required_capabilities = self._get_capabilities_for_task_type(task_type, requirements)

            # Discover matching agents
            matching_agents = await self.discover_agents_by_capability(
                required_capabilities=required_capabilities,
                exclude_agents=exclude_agents,
                min_performance_score=requirements.get("min_performance_score", 0.3)
            )

            if not matching_agents:
                return None

            if load_balance:
                # Score agents based on performance and load
                for agent in matching_agents:
                    agent.score = agent.performance_score * (1.0 - agent.current_load)
                matching_agents.sort(key=lambda x: x.score, reverse=True)
            else:
                matching_agents.sort(key=lambda x: x.performance_score, reverse=True)

            return matching_agents[0]

        except Exception as e:
            self.logger.error(f"Failed to find best agent for task: {e}")
            raise CollaborationError(f"Agent selection failed: {str(e)}")

    def _get_capabilities_for_task_type(self, task_type: str, requirements: Dict[str, Any]) -> List[str]:
        """Map task type to required capabilities"""
        capability_map = {
            "browser_automation": ["web_navigation", "form_filling", "screenshot_capture"],
            "data_analysis": ["data_processing", "statistical_analysis", "report_generation"],
            "infrastructure_management": ["server_management", "monitoring", "deployment"],
            "conversational_ai": ["natural_language_processing", "dialogue_management", "context_tracking"],
            "file_operations": ["file_read", "file_write", "file_processing"],
            "api_integration": ["http_requests", "authentication", "data_parsing"],
        }

        base_capabilities = capability_map.get(task_type, ["general_task_processing"])

        # Add specific capabilities from requirements
        additional_caps = requirements.get("required_capabilities", [])

        return list(set(base_capabilities + additional_caps))


class MessageRoutingService:
    """Service for routing messages between agents"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._channels: Dict[str, CommunicationChannel] = {}
        self._routing_rules: Dict[str, Callable] = {}
        self._message_handlers: Dict[MessageType, Callable] = {}

    async def send_message(
        self,
        envelope: MessageEnvelope,
        session_id: Optional[UUID] = None
    ) -> bool:
        """
        Send a message to the specified recipient(s).

        Args:
            envelope: Message envelope to send
            session_id: Optional collaboration session ID

        Returns:
            True if message was sent successfully
        """
        try:
            self.logger.info(f"Sending message {envelope.message_id} to {envelope.recipient_id}")

            # Store message in database if session provided
            if session_id:
                await self._store_message(envelope, session_id)

            # Route message based on recipient and type
            if envelope.recipient_id is None:
                # Broadcast message
                success = await self._broadcast_message(envelope)
            else:
                # Direct message
                success = await self._send_direct_message(envelope)

            if success:
                # Update delivery status
                await self._update_delivery_status(envelope.message_id, delivered=True)

            return success

        except Exception as e:
            self.logger.error(f"Failed to send message {envelope.message_id}: {e}")
            return False

    async def receive_message(
        self,
        message_id: UUID,
        agent_id: UUID
    ) -> Optional[MessageEnvelope]:
        """
        Receive and process a message for an agent.

        Args:
            message_id: Message ID to receive
            agent_id: Agent ID receiving the message

        Returns:
            Message envelope if found and accessible
        """
        try:
            # Retrieve message from database
            async with get_db() as db:
                result = await db.execute(
                    select(CollaborationMessage).where(
                        and_(
                            CollaborationMessage.id == message_id,
                            or_(
                                CollaborationMessage.recipient_agent_id == agent_id,
                                CollaborationMessage.recipient_agent_id.is_(None)  # Broadcast
                            )
                        )
                    )
                )
                db_message = result.scalar_one_or_none()

                if not db_message:
                    return None

                # Update read status
                db_message.read_at = datetime.utcnow()
                await db.commit()

                # Convert to envelope
                envelope = MessageEnvelope(
                    message_id=db_message.id,
                    sender_id=db_message.sender_agent_id,
                    recipient_id=db_message.recipient_agent_id,
                    message_type=MessageType(db_message.message_type),
                    priority=MessagePriority(db_message.priority),
                    subject=db_message.subject,
                    content=db_message.content,
                    payload=db_message.payload,
                    thread_id=db_message.thread_id,
                    parent_message_id=db_message.parent_message_id,
                    requires_response=db_message.requires_response,
                    response_deadline=db_message.response_deadline,
                    metadata=db_message.metadata,
                    sent_at=db_message.sent_at
                )

                return envelope

        except Exception as e:
            self.logger.error(f"Failed to receive message {message_id}: {e}")
            return None

    async def register_message_handler(
        self,
        message_type: MessageType,
        handler: Callable
    ):
        """Register a handler for specific message types"""
        self._message_handlers[message_type] = handler

    async def _store_message(self, envelope: MessageEnvelope, session_id: UUID):
        """Store message in database"""
        try:
            async with get_db() as db:
                db_message = CollaborationMessage(
                    session_id=session_id,
                    sender_agent_id=envelope.sender_id,
                    recipient_agent_id=envelope.recipient_id,
                    message_type=envelope.message_type.value,
                    priority=envelope.priority.value,
                    subject=envelope.subject,
                    content=envelope.content,
                    payload=envelope.payload,
                    thread_id=envelope.thread_id,
                    parent_message_id=envelope.parent_message_id,
                    requires_response=envelope.requires_response,
                    response_deadline=envelope.response_deadline,
                    metadata=envelope.metadata
                )
                db.add(db_message)
                await db.commit()

        except Exception as e:
            self.logger.error(f"Failed to store message {envelope.message_id}: {e}")

    async def _send_direct_message(self, envelope: MessageEnvelope) -> bool:
        """Send message directly to recipient"""
        try:
            # In a real implementation, this would use agent communication protocols
            # For now, we'll simulate delivery via Redis pub/sub

            message_data = {
                "message_id": str(envelope.message_id),
                "sender_id": str(envelope.sender_id),
                "recipient_id": str(envelope.recipient_id),
                "type": envelope.message_type.value,
                "content": envelope.content,
                "payload": envelope.payload
            }

            # Publish to Redis channel for recipient
            channel = f"agent_messages:{envelope.recipient_id}"
            await redis_client.publish(channel, json.dumps(message_data))

            return True

        except Exception as e:
            self.logger.error(f"Failed to send direct message: {e}")
            return False

    async def _broadcast_message(self, envelope: MessageEnvelope) -> bool:
        """Broadcast message to all agents in session"""
        try:
            # Get session participants
            if envelope.thread_id:  # Use thread_id as session_id for broadcasts
                session_id = envelope.thread_id
                async with get_db() as db:
                    result = await db.execute(
                        select(CollaborationSession).where(
                            CollaborationSession.id == session_id
                        )
                    )
                    session = result.scalar_one_or_none()

                    if session:
                        participants = session.participating_agents
                        for participant_id in participants:
                            if participant_id != envelope.sender_id:  # Don't send to sender
                                # Send to each participant
                                await self._send_direct_message(MessageEnvelope(
                                    message_id=envelope.message_id,
                                    sender_id=envelope.sender_id,
                                    recipient_id=UUID(participant_id),
                                    message_type=envelope.message_type,
                                    priority=envelope.priority,
                                    subject=envelope.subject,
                                    content=envelope.content,
                                    payload=envelope.payload,
                                    thread_id=envelope.thread_id
                                ))

            return True

        except Exception as e:
            self.logger.error(f"Failed to broadcast message: {e}")
            return False

    async def _update_delivery_status(self, message_id: UUID, delivered: bool):
        """Update message delivery status"""
        try:
            async with get_db() as db:
                result = await db.execute(
                    select(CollaborationMessage).where(
                        CollaborationMessage.id == message_id
                    )
                )
                message = result.scalar_one_or_none()

                if message and delivered:
                    message.delivered_at = datetime.utcnow()
                    await db.commit()

        except Exception as e:
            self.logger.error(f"Failed to update delivery status: {e}")


class TaskDelegationService:
    """Service for delegating tasks between agents"""

    def __init__(self, discovery_service: AgentDiscoveryService, routing_service: MessageRoutingService):
        self.discovery_service = discovery_service
        self.routing_service = routing_service
        self.logger = logging.getLogger(self.__class__.__name__)
        self._delegation_handlers: Dict[str, Callable] = {}

    async def delegate_task(
        self,
        request: TaskDelegationRequest,
        session_id: UUID
    ) -> Optional[UUID]:
        """
        Delegate a task to an appropriate agent.

        Args:
            request: Task delegation request
            session_id: Collaboration session ID

        Returns:
            ID of the agent that accepted the task, or None if delegation failed
        """
        try:
            self.logger.info(f"Delegating task {request.task_id} of type {request.task_type}")

            # Create collaboration task record
            collaboration_task = CollaborationTask(
                session_id=session_id,
                title=request.title,
                description=request.description,
                task_type=request.task_type,
                delegating_agent_id=request.delegating_agent_id,
                input_data=request.input_data,
                requirements=request.requirements,
                constraints=request.constraints,
                priority=request.priority,
                deadline=request.deadline,
                metadata=request.metadata
            )

            async with get_db() as db:
                db.add(collaboration_task)
                await db.commit()

            # Find best agent for the task
            best_agent = await self.discovery_service.find_best_agent_for_task(
                task_type=request.task_type,
                requirements=request.requirements,
                exclude_agents=[request.delegating_agent_id]
            )

            if not best_agent:
                self.logger.warning(f"No suitable agent found for task {request.task_id}")
                await self._mark_task_failed(collaboration_task.id, "No suitable agent found")
                return None

            # Send delegation message to selected agent
            delegation_envelope = MessageEnvelope(
                message_id=uuid4(),
                sender_id=request.delegating_agent_id,
                recipient_id=best_agent.agent_id,
                message_type=MessageType.TASK_DELEGATION,
                priority=MessagePriority.HIGH,
                subject=f"Task Delegation: {request.title}",
                content=f"Please perform task: {request.description}",
                payload={
                    "task_id": str(request.task_id),
                    "collaboration_task_id": str(collaboration_task.id),
                    "task_type": request.task_type,
                    "input_data": request.input_data,
                    "requirements": request.requirements,
                    "deadline": request.deadline.isoformat() if request.deadline else None
                },
                requires_response=True,
                response_deadline=datetime.utcnow() + timedelta(minutes=30)
            )

            # Send delegation message
            message_sent = await self.routing_service.send_message(
                delegation_envelope,
                session_id=session_id
            )

            if message_sent:
                # Update task assignment
                collaboration_task.assigned_agent_id = best_agent.agent_id
                collaboration_task.assigned_at = datetime.utcnow()
                collaboration_task.status = "assigned"

                async with get_db() as db:
                    await db.commit()

                self.logger.info(f"Task {request.task_id} delegated to agent {best_agent.agent_id}")
                return best_agent.agent_id
            else:
                await self._mark_task_failed(collaboration_task.id, "Failed to send delegation message")
                return None

        except Exception as e:
            self.logger.error(f"Failed to delegate task {request.task_id}: {e}")
            raise DelegationError(f"Task delegation failed: {str(e)}")

    async def handle_task_response(
        self,
        task_id: UUID,
        agent_id: UUID,
        accepted: bool,
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ):
        """Handle agent response to task delegation"""
        try:
            async with get_db() as db:
                # Find collaboration task
                result_query = await db.execute(
                    select(CollaborationTask).where(
                        CollaborationTask.id == task_id
                    )
                )
                task = result_query.scalar_one_or_none()

                if not task:
                    self.logger.warning(f"Collaboration task {task_id} not found")
                    return

                if accepted:
                    task.status = "in_progress"
                    task.started_at = datetime.utcnow()
                    self.logger.info(f"Agent {agent_id} accepted task {task_id}")
                else:
                    task.status = "failed"
                    task.error_message = error_message or "Task rejected by agent"
                    self.logger.info(f"Agent {agent_id} rejected task {task_id}")

                await db.commit()

        except Exception as e:
            self.logger.error(f"Failed to handle task response for {task_id}: {e}")

    async def complete_task(
        self,
        task_id: UUID,
        agent_id: UUID,
        result: Dict[str, Any],
        success: bool = True,
        execution_time_ms: Optional[float] = None
    ):
        """Complete a delegated task"""
        try:
            async with get_db() as db:
                # Find collaboration task
                result_query = await db.execute(
                    select(CollaborationTask).where(
                        CollaborationTask.id == task_id
                    )
                )
                task = result_query.scalar_one_or_none()

                if not task:
                    self.logger.warning(f"Collaboration task {task_id} not found")
                    return

                # Update task completion
                task.status = "completed" if success else "failed"
                task.completed_at = datetime.utcnow()
                task.result = result
                task.execution_time_ms = execution_time_ms
                task.success_score = 1.0 if success else 0.0

                if not success and not task.error_message:
                    task.error_message = "Task completed with errors"

                await db.commit()

                # Notify delegating agent
                notification_envelope = MessageEnvelope(
                    message_id=uuid4(),
                    sender_id=agent_id,
                    recipient_id=task.delegating_agent_id,
                    message_type=MessageType.TASK_RESPONSE,
                    priority=MessagePriority.NORMAL,
                    subject=f"Task Completion: {task.title}",
                    content=f"Task '{task.title}' has been {'completed' if success else 'failed'}",
                    payload={
                        "task_id": str(task_id),
                        "collaboration_task_id": str(task.id),
                        "success": success,
                        "result": result,
                        "execution_time_ms": execution_time_ms,
                        "error_message": task.error_message
                    }
                )

                await self.routing_service.send_message(notification_envelope)

                self.logger.info(f"Task {task_id} completed by agent {agent_id} (success: {success})")

        except Exception as e:
            self.logger.error(f"Failed to complete task {task_id}: {e}")

    async def _mark_task_failed(self, task_id: UUID, error_message: str):
        """Mark a task as failed"""
        try:
            async with get_db() as db:
                result = await db.execute(
                    select(CollaborationTask).where(CollaborationTask.id == task_id)
                )
                task = result.scalar_one_or_none()

                if task:
                    task.status = "failed"
                    task.error_message = error_message
                    await db.commit()

        except Exception as e:
            self.logger.error(f"Failed to mark task {task_id} as failed: {e}")


class ConsensusService:
    """Service for managing consensus decision-making"""

    def __init__(self, routing_service: MessageRoutingService):
        self.routing_service = routing_service
        self.logger = logging.getLogger(self.__class__.__name__)
        self._active_consensus_sessions: Dict[str, Dict] = {}

    async def initiate_consensus(
        self,
        session_id: UUID,
        proposal_id: str,
        participating_agents: List[UUID],
        proposal_data: Dict[str, Any],
        consensus_threshold: float = 0.7,
        voting_deadline: Optional[datetime] = None
    ) -> bool:
        """
        Initiate a consensus decision-making process.

        Args:
            session_id: Collaboration session ID
            proposal_id: Unique identifier for the proposal
            participating_agents: List of agents participating in consensus
            proposal_data: Data describing the proposal
            consensus_threshold: Threshold for reaching consensus (0.0-1.0)
            voting_deadline: Deadline for voting

        Returns:
            True if consensus process started successfully
        """
        try:
            self.logger.info(f"Initiating consensus for proposal {proposal_id}")

            # Set voting deadline if not provided
            if not voting_deadline:
                voting_deadline = datetime.utcnow() + timedelta(hours=1)

            # Store consensus session
            consensus_session = {
                "session_id": str(session_id),
                "proposal_id": proposal_id,
                "participating_agents": participating_agents,
                "proposal_data": proposal_data,
                "consensus_threshold": consensus_threshold,
                "voting_deadline": voting_deadline,
                "votes": {},
                "started_at": datetime.utcnow()
            }
            self._active_consensus_sessions[proposal_id] = consensus_session

            # Send consensus request to all participating agents
            for agent_id in participating_agents:
                consensus_envelope = MessageEnvelope(
                    message_id=uuid4(),
                    sender_id=UUID(session_id),  # Use session ID as sender for consensus
                    recipient_id=agent_id,
                    message_type=MessageType.CONSENSUS_REQUEST,
                    priority=MessagePriority.HIGH,
                    subject=f"Consensus Request: {proposal_id}",
                    content="Please vote on the following proposal",
                    payload={
                        "proposal_id": proposal_id,
                        "proposal_data": proposal_data,
                        "consensus_threshold": consensus_threshold,
                        "voting_deadline": voting_deadline.isoformat()
                    },
                    requires_response=True,
                    response_deadline=voting_deadline
                )

                await self.routing_service.send_message(consensus_envelope, session_id)

            self.logger.info(f"Consensus initiated for proposal {proposal_id} with {len(participating_agents)} agents")
            return True

        except Exception as e:
            self.logger.error(f"Failed to initiate consensus for proposal {proposal_id}: {e}")
            return False

    async def submit_vote(
        self,
        proposal_id: str,
        agent_id: UUID,
        vote_value: str,
        confidence_score: Optional[float] = None,
        reasoning: Optional[str] = None
    ) -> bool:
        """
        Submit a vote for a consensus proposal.

        Args:
            proposal_id: Proposal identifier
            agent_id: Agent submitting the vote
            vote_value: Vote value (approve, reject, abstain, or specific value)
            confidence_score: Confidence in the vote (0.0-1.0)
            reasoning: Reasoning for the vote

        Returns:
            True if vote was submitted successfully
        """
        try:
            # Check if consensus session exists
            if proposal_id not in self._active_consensus_sessions:
                self.logger.warning(f"Consensus session not found for proposal {proposal_id}")
                return False

            consensus_session = self._active_consensus_sessions[proposal_id]

            # Check voting deadline
            if datetime.utcnow() > consensus_session["voting_deadline"]:
                self.logger.warning(f"Voting deadline passed for proposal {proposal_id}")
                return False

            # Store vote
            vote_data = {
                "agent_id": str(agent_id),
                "vote_value": vote_value,
                "confidence_score": confidence_score,
                "reasoning": reasoning,
                "voted_at": datetime.utcnow()
            }
            consensus_session["votes"][str(agent_id)] = vote_data

            # Store vote in database
            session_id = UUID(consensus_session["session_id"])
            async with get_db() as db:
                vote_record = ConsensusVote(
                    session_id=session_id,
                    proposal_id=proposal_id,
                    voting_agent_id=agent_id,
                    vote_value=vote_value,
                    confidence_score=confidence_score,
                    reasoning=reasoning,
                    cast_at=datetime.utcnow()
                )
                db.add(vote_record)
                await db.commit()

            self.logger.info(f"Vote submitted by agent {agent_id} for proposal {proposal_id}")

            # Check if consensus has been reached
            await self._check_consensus(proposal_id)

            return True

        except Exception as e:
            self.logger.error(f"Failed to submit vote for proposal {proposal_id}: {e}")
            return False

    async def _check_consensus(self, proposal_id: str):
        """Check if consensus has been reached for a proposal"""
        try:
            consensus_session = self._active_consensus_sessions.get(proposal_id)
            if not consensus_session:
                return

            votes = consensus_session["votes"]
            participating_agents = consensus_session["participating_agents"]
            consensus_threshold = consensus_session["consensus_threshold"]

            # Check if all agents have voted or deadline passed
            all_voted = len(votes) == len(participating_agents)
            deadline_passed = datetime.utcnow() > consensus_session["voting_deadline"]

            if not all_voted and not deadline_passed:
                return  # Continue waiting for votes

            # Calculate consensus
            approve_votes = sum(1 for vote in votes.values() if vote["vote_value"] == "approve")
            reject_votes = sum(1 for vote in votes.values() if vote["vote_value"] == "reject")
            abstain_votes = sum(1 for vote in votes.values() if vote["vote_value"] == "abstain")

            total_votes = len(votes)
            if total_votes == 0:
                consensus_result = "no_votes"
            else:
                approve_ratio = approve_votes / total_votes
                if approve_ratio >= consensus_threshold:
                    consensus_result = "approved"
                elif reject_votes / total_votes > (1 - consensus_threshold):
                    consensus_result = "rejected"
                else:
                    consensus_result = "no_consensus"

            # Store consensus result
            session_id = UUID(consensus_session["session_id"])
            async with get_db() as db:
                result = await db.execute(
                    select(CollaborationSession).where(
                        CollaborationSession.id == session_id
                    )
                )
                session = result.scalar_one_or_none()

                if session:
                    session.consensus_result = {
                        "proposal_id": proposal_id,
                        "result": consensus_result,
                        "approve_votes": approve_votes,
                        "reject_votes": reject_votes,
                        "abstain_votes": abstain_votes,
                        "consensus_threshold": consensus_threshold,
                        "total_votes": total_votes,
                        "finalized_at": datetime.utcnow().isoformat()
                    }
                    await db.commit()

            # Notify participants of consensus result
            for agent_id in participating_agents:
                result_envelope = MessageEnvelope(
                    message_id=uuid4(),
                    sender_id=UUID(session_id),
                    recipient_id=agent_id,
                    message_type=MessageType.CONSENSUS_RESPONSE,
                    priority=MessagePriority.NORMAL,
                    subject=f"Consensus Result: {proposal_id}",
                    content=f"Consensus process completed for proposal {proposal_id}",
                    payload={
                        "proposal_id": proposal_id,
                        "consensus_result": consensus_result,
                        "approve_votes": approve_votes,
                        "reject_votes": reject_votes,
                        "abstain_votes": abstain_votes,
                        "total_votes": total_votes
                    }
                )
                await self.routing_service.send_message(result_envelope, session_id)

            self.logger.info(f"Consensus reached for proposal {proposal_id}: {consensus_result}")

            # Clean up consensus session
            del self._active_consensus_sessions[proposal_id]

        except Exception as e:
            self.logger.error(f"Failed to check consensus for proposal {proposal_id}: {e}")


class CollaborationService:
    """
    Main collaboration service that orchestrates agent collaboration
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._started = False

        # Initialize sub-services
        self._registry = get_production_registry()
        self._discovery_service = AgentDiscoveryService(self._registry)
        self._routing_service = MessageRoutingService()
        self._delegation_service = TaskDelegationService(self._discovery_service, self._routing_service)
        self._consensus_service = ConsensusService(self._routing_service)

        # Active sessions
        self._active_sessions: Dict[UUID, Dict] = {}

        # Register message handlers
        self._register_message_handlers()

    async def start(self):
        """Start the collaboration service"""
        if self._started:
            return

        self.logger.info("Starting Collaboration Service")

        # Ensure registry is started
        if not self._registry._started:
            await self._registry.start()

        self._started = True
        self.logger.info("Collaboration Service started successfully")

    async def stop(self):
        """Stop the collaboration service"""
        if not self._started:
            return

        self.logger.info("Stopping Collaboration Service")

        # Complete all active sessions
        for session_id in list(self._active_sessions.keys()):
            await self.end_session(session_id, reason="Service shutdown")

        self._started = False
        self.logger.info("Collaboration Service stopped")

    async def create_collaboration_session(
        self,
        name: str,
        description: str,
        collaboration_type: str,
        initiator_agent_id: UUID,
        participating_agents: List[UUID],
        workflow_definition: Optional[Dict[str, Any]] = None,
        max_duration_minutes: int = 60,
        consensus_threshold: float = 0.7,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UUID:
        """
        Create a new collaboration session.

        Args:
            name: Session name
            description: Session description
            collaboration_type: Type of collaboration
            initiator_agent_id: Agent initiating the session
            participating_agents: List of participating agent IDs
            workflow_definition: Optional workflow definition
            max_duration_minutes: Maximum duration in minutes
            consensus_threshold: Consensus decision threshold
            metadata: Additional metadata

        Returns:
            Session ID
        """
        try:
            self.logger.info(f"Creating collaboration session: {name}")

            session_id = uuid4()

            # Create session record
            session = CollaborationSession(
                id=session_id,
                name=name,
                description=description,
                collaboration_type=collaboration_type,
                initiator_agent_id=initiator_agent_id,
                participating_agents=[str(agent_id) for agent_id in participating_agents],
                status=CollaborationStatus.INITIALIZING,
                max_duration_minutes=max_duration_minutes,
                consensus_threshold=consensus_threshold,
                workflow_definition=workflow_definition or {},
                current_step=0,
                total_steps=len(workflow_definition.get("steps", [])) if workflow_definition else 0,
                timeout_at=datetime.utcnow() + timedelta(minutes=max_duration_minutes),
                metadata=metadata or {}
            )

            async with get_db() as db:
                db.add(session)
                await db.commit()

            # Store in active sessions
            self._active_sessions[session_id] = {
                "session_id": session_id,
                "name": name,
                "collaboration_type": collaboration_type,
                "initiator_agent_id": initiator_agent_id,
                "participating_agents": participating_agents,
                "workflow_definition": workflow_definition,
                "current_step": 0,
                "started_at": datetime.utcnow()
            }

            # Send invitation messages to all participants
            for agent_id in participating_agents:
                if agent_id != initiator_agent_id:
                    invitation_envelope = MessageEnvelope(
                        message_id=uuid4(),
                        sender_id=initiator_agent_id,
                        recipient_id=agent_id,
                        message_type=MessageType.COORDINATION,
                        priority=MessagePriority.HIGH,
                        subject=f"Collaboration Invitation: {name}",
                        content=f"You are invited to join collaboration session: {name}",
                        payload={
                            "session_id": str(session_id),
                            "session_name": name,
                            "description": description,
                            "collaboration_type": collaboration_type,
                            "initiator_agent_id": str(initiator_agent_id),
                            "workflow_definition": workflow_definition
                        },
                        thread_id=session_id,
                        requires_response=True
                    )
                    await self._routing_service.send_message(invitation_envelope, session_id)

            self.logger.info(f"Collaboration session {session_id} created successfully")
            return session_id

        except Exception as e:
            self.logger.error(f"Failed to create collaboration session: {e}")
            raise CollaborationError(f"Session creation failed: {str(e)}")

    async def start_session(self, session_id: UUID) -> bool:
        """Start a collaboration session"""
        try:
            if session_id not in self._active_sessions:
                self.logger.warning(f"Session {session_id} not found in active sessions")
                return False

            # Update session status
            async with get_db() as db:
                result = await db.execute(
                    select(CollaborationSession).where(
                        CollaborationSession.id == session_id
                    )
                )
                session = result.scalar_one_or_none()

                if session:
                    session.status = CollaborationStatus.ACTIVE
                    session.started_at = datetime.utcnow()
                    await db.commit()

            # Execute workflow if defined
            session_data = self._active_sessions[session_id]
            workflow = session_data.get("workflow_definition")
            if workflow:
                await self._execute_workflow_step(session_id, 0)

            self.logger.info(f"Collaboration session {session_id} started")
            return True

        except Exception as e:
            self.logger.error(f"Failed to start session {session_id}: {e}")
            return False

    async def end_session(
        self,
        session_id: UUID,
        reason: str = "Completed",
        final_result: Optional[Dict[str, Any]] = None
    ):
        """End a collaboration session"""
        try:
            self.logger.info(f"Ending collaboration session {session_id}: {reason}")

            # Update session status
            async with get_db() as db:
                result = await db.execute(
                    select(CollaborationSession).where(
                        CollaborationSession.id == session_id
                    )
                )
                session = result.scalar_one_or_none()

                if session:
                    session.status = CollaborationStatus.COMPLETED if reason == "Completed" else CollaborationStatus.FAILED
                    session.ended_at = datetime.utcnow()
                    session.final_result = final_result
                    await db.commit()

            # Remove from active sessions
            if session_id in self._active_sessions:
                del self._active_sessions[session_id]

            # Notify participants
            session_data = self._active_sessions.get(session_id, {})
            participating_agents = session_data.get("participating_agents", [])

            for agent_id in participating_agents:
                notification_envelope = MessageEnvelope(
                    message_id=uuid4(),
                    sender_id=UUID("00000000-0000-0000-0000-000000000000"),  # System sender
                    recipient_id=agent_id,
                    message_type=MessageType.COORDINATION,
                    priority=MessagePriority.NORMAL,
                    subject=f"Session Ended: {session_id}",
                    content=f"Collaboration session has ended: {reason}",
                    payload={
                        "session_id": str(session_id),
                        "reason": reason,
                        "final_result": final_result
                    }
                )
                await self._routing_service.send_message(notification_envelope, session_id)

        except Exception as e:
            self.logger.error(f"Failed to end session {session_id}: {e}")

    async def delegate_task_in_session(
        self,
        session_id: UUID,
        delegating_agent_id: UUID,
        task_type: str,
        title: str,
        description: str,
        input_data: Dict[str, Any],
        requirements: Optional[Dict[str, Any]] = None,
        priority: int = 5
    ) -> Optional[UUID]:
        """Delegate a task within a collaboration session"""
        try:
            task_id = uuid4()

            delegation_request = TaskDelegationRequest(
                task_id=task_id,
                delegating_agent_id=delegating_agent_id,
                task_type=task_type,
                title=title,
                description=description,
                input_data=input_data,
                requirements=requirements or {},
                priority=priority
            )

            assigned_agent_id = await self._delegation_service.delegate_task(
                delegation_request,
                session_id
            )

            if assigned_agent_id:
                self.logger.info(f"Task {task_id} delegated to agent {assigned_agent_id} in session {session_id}")
                return assigned_agent_id
            else:
                self.logger.warning(f"Failed to delegate task {task_id} in session {session_id}")
                return None

        except Exception as e:
            self.logger.error(f"Failed to delegate task in session {session_id}: {e}")
            return None

    async def initiate_consensus_in_session(
        self,
        session_id: UUID,
        proposal_id: str,
        proposal_data: Dict[str, Any],
        consensus_threshold: Optional[float] = None
    ) -> bool:
        """Initiate consensus within a collaboration session"""
        try:
            if session_id not in self._active_sessions:
                return False

            session_data = self._active_sessions[session_id]
            participating_agents = session_data.get("participating_agents", [])
            threshold = consensus_threshold or session_data.get("consensus_threshold", 0.7)

            success = await self._consensus_service.initiate_consensus(
                session_id=session_id,
                proposal_id=proposal_id,
                participating_agents=participating_agents,
                proposal_data=proposal_data,
                consensus_threshold=threshold
            )

            return success

        except Exception as e:
            self.logger.error(f"Failed to initiate consensus in session {session_id}: {e}")
            return False

    async def get_session_status(self, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Get collaboration session status"""
        try:
            async with get_db() as db:
                result = await db.execute(
                    select(CollaborationSession).where(
                        CollaborationSession.id == session_id
                    )
                )
                session = result.scalar_one_or_none()

                if not session:
                    return None

                # Get session metrics
                messages_result = await db.execute(
                    select(func.count(CollaborationMessage.id)).where(
                        CollaborationMessage.session_id == session_id
                    )
                )
                message_count = messages_result.scalar()

                tasks_result = await db.execute(
                    select(func.count(CollaborationTask.id)).where(
                        CollaborationTask.session_id == session_id
                    )
                )
                task_count = tasks_result.scalar()

                return {
                    "session_id": str(session.id),
                    "name": session.name,
                    "description": session.description,
                    "collaboration_type": session.collaboration_type,
                    "status": session.status,
                    "initiator_agent_id": str(session.initiator_agent_id),
                    "participating_agents": session.participating_agents,
                    "current_step": session.current_step,
                    "total_steps": session.total_steps,
                    "message_count": message_count,
                    "task_count": task_count,
                    "started_at": session.started_at.isoformat() if session.started_at else None,
                    "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                    "final_result": session.final_result,
                    "consensus_result": session.consensus_result
                }

        except Exception as e:
            self.logger.error(f"Failed to get session status for {session_id}: {e}")
            return None

    def _register_message_handlers(self):
        """Register message handlers for different message types"""
        self._routing_service.register_message_handler(
            MessageType.TASK_RESPONSE,
            self._handle_task_response_message
        )
        self._routing_service.register_message_handler(
            MessageType.CONSENSUS_RESPONSE,
            self._handle_consensus_response_message
        )

    async def _handle_task_response_message(self, envelope: MessageEnvelope):
        """Handle task response messages"""
        try:
            payload = envelope.payload or {}
            task_id = UUID(payload.get("task_id"))
            collaboration_task_id = UUID(payload.get("collaboration_task_id"))
            success = payload.get("success", False)
            result = payload.get("result")
            execution_time_ms = payload.get("execution_time_ms")

            await self._delegation_service.complete_task(
                task_id=collaboration_task_id,
                agent_id=envelope.sender_id,
                result=result or {},
                success=success,
                execution_time_ms=execution_time_ms
            )

        except Exception as e:
            self.logger.error(f"Failed to handle task response message: {e}")

    async def _handle_consensus_response_message(self, envelope: MessageEnvelope):
        """Handle consensus response messages"""
        try:
            payload = envelope.payload or {}
            proposal_id = payload.get("proposal_id")
            vote_value = payload.get("vote_value")
            confidence_score = payload.get("confidence_score")
            reasoning = payload.get("reasoning")

            if proposal_id:
                await self._consensus_service.submit_vote(
                    proposal_id=proposal_id,
                    agent_id=envelope.sender_id,
                    vote_value=vote_value,
                    confidence_score=confidence_score,
                    reasoning=reasoning
                )

        except Exception as e:
            self.logger.error(f"Failed to handle consensus response message: {e}")

    async def _execute_workflow_step(self, session_id: UUID, step_index: int):
        """Execute a workflow step"""
        try:
            if session_id not in self._active_sessions:
                return

            session_data = self._active_sessions[session_id]
            workflow = session_data.get("workflow_definition", {})
            steps = workflow.get("steps", [])

            if step_index >= len(steps):
                # Workflow completed
                await self.end_session(session_id, reason="Workflow completed")
                return

            step = steps[step_index]
            step_type = step.get("type")

            if step_type == "task_delegation":
                # Handle task delegation step
                await self._execute_delegation_step(session_id, step)
            elif step_type == "consensus":
                # Handle consensus step
                await self._execute_consensus_step(session_id, step)
            elif step_type == "parallel_execution":
                # Handle parallel execution step
                await self._execute_parallel_step(session_id, step)

            # Update current step
            session_data["current_step"] = step_index + 1

        except Exception as e:
            self.logger.error(f"Failed to execute workflow step {step_index} for session {session_id}: {e}")

    async def _execute_delegation_step(self, session_id: UUID, step: Dict[str, Any]):
        """Execute a task delegation workflow step"""
        try:
            step_data = step.get("data", {})
            await self.delegate_task_in_session(
                session_id=session_id,
                delegating_agent_id=UUID(step_data.get("delegating_agent_id")),
                task_type=step_data.get("task_type"),
                title=step_data.get("title"),
                description=step_data.get("description"),
                input_data=step_data.get("input_data", {}),
                requirements=step_data.get("requirements", {}),
                priority=step_data.get("priority", 5)
            )

        except Exception as e:
            self.logger.error(f"Failed to execute delegation step: {e}")

    async def _execute_consensus_step(self, session_id: UUID, step: Dict[str, Any]):
        """Execute a consensus workflow step"""
        try:
            step_data = step.get("data", {})
            await self.initiate_consensus_in_session(
                session_id=session_id,
                proposal_id=step_data.get("proposal_id"),
                proposal_data=step_data.get("proposal_data", {}),
                consensus_threshold=step_data.get("consensus_threshold")
            )

        except Exception as e:
            self.logger.error(f"Failed to execute consensus step: {e}")

    async def _execute_parallel_step(self, session_id: UUID, step: Dict[str, Any]):
        """Execute a parallel execution workflow step"""
        try:
            # For parallel execution, we would delegate multiple tasks simultaneously
            # This is a simplified implementation
            step_data = step.get("data", {})
            tasks = step_data.get("tasks", [])

            for task_data in tasks:
                await self.delegate_task_in_session(
                    session_id=session_id,
                    delegating_agent_id=UUID(task_data.get("delegating_agent_id")),
                    task_type=task_data.get("task_type"),
                    title=task_data.get("title"),
                    description=task_data.get("description"),
                    input_data=task_data.get("input_data", {}),
                    requirements=task_data.get("requirements", {}),
                    priority=task_data.get("priority", 5)
                )

        except Exception as e:
            self.logger.error(f"Failed to execute parallel step: {e}")


# Global collaboration service instance
collaboration_service = CollaborationService()


def get_collaboration_service() -> CollaborationService:
    """Get the global collaboration service instance"""
    return collaboration_service