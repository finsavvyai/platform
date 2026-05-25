"""
Collaboration API endpoints for agent collaboration management
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.collaboration import (
    CollaborationSession, CollaborationMessage, CollaborationTask,
    ConsensusVote, CollaborationStatus, MessageType, MessagePriority
)
from app.services.collaboration import get_collaboration_service
from app.schemas.collaboration import (
    CollaborationSessionRequest,
    CollaborationSessionResponse,
    CollaborationMessageRequest,
    CollaborationMessageResponse,
    CollaborationTaskRequest,
    CollaborationTaskResponse,
    ConsensusVoteRequest,
    ConsensusResponse,
    AgentCapabilityResponse
)


router = APIRouter(prefix="/collaboration", tags=["collaboration"])


@router.post("/sessions", response_model=CollaborationSessionResponse)
async def create_collaboration_session(
    session_request: CollaborationSessionRequest,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Create a new collaboration session.

    This endpoint allows authenticated users to create new collaboration sessions
    where multiple agents can work together on complex tasks.
    """
    try:
        session_id = await collaboration_service.create_collaboration_session(
            name=session_request.name,
            description=session_request.description,
            collaboration_type=session_request.collaboration_type,
            initiator_agent_id=session_request.initiator_agent_id,
            participating_agents=session_request.participating_agents,
            workflow_definition=session_request.workflow_definition,
            max_duration_minutes=session_request.max_duration_minutes,
            consensus_threshold=session_request.consensus_threshold,
            metadata=session_request.metadata
        )

        # Get session details
        session_status = await collaboration_service.get_session_status(session_id)
        if not session_status:
            raise HTTPException(status_code=500, detail="Failed to retrieve created session")

        return CollaborationSessionResponse(
            id=session_id,
            **session_status
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create collaboration session: {str(e)}")


@router.get("/sessions", response_model=List[CollaborationSessionResponse])
async def list_collaboration_sessions(
    status: Optional[str] = Query(None, description="Filter by session status"),
    collaboration_type: Optional[str] = Query(None, description="Filter by collaboration type"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of sessions to return"),
    offset: int = Query(0, ge=0, description="Number of sessions to skip"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List collaboration sessions with optional filtering.
    """
    try:
        query = select(CollaborationSession)

        # Apply filters
        if status:
            query = query.where(CollaborationSession.status == status)
        if collaboration_type:
            query = query.where(CollaborationSession.collaboration_type == collaboration_type)

        # Apply pagination and ordering
        query = query.order_by(desc(CollaborationSession.created_at))
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        sessions = result.scalars().all()

        return [
            CollaborationSessionResponse(
                id=session.id,
                name=session.name,
                description=session.description,
                collaboration_type=session.collaboration_type,
                status=session.status,
                initiator_agent_id=session.initiator_agent_id,
                participating_agents=session.participating_agents,
                current_step=session.current_step,
                total_steps=session.total_steps,
                created_at=session.created_at,
                started_at=session.started_at,
                ended_at=session.ended_at,
                metadata=session.metadata
            )
            for session in sessions
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list collaboration sessions: {str(e)}")


@router.get("/sessions/{session_id}", response_model=CollaborationSessionResponse)
async def get_collaboration_session(
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Get detailed information about a specific collaboration session.
    """
    try:
        session_status = await collaboration_service.get_session_status(session_id)
        if not session_status:
            raise HTTPException(status_code=404, detail="Collaboration session not found")

        return CollaborationSessionResponse(
            id=session_id,
            **session_status
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get collaboration session: {str(e)}")


@router.post("/sessions/{session_id}/start")
async def start_collaboration_session(
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Start a collaboration session.

    This begins the execution of the defined workflow and enables agent participation.
    """
    try:
        success = await collaboration_service.start_session(session_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to start collaboration session")

        return {"message": "Collaboration session started successfully", "session_id": str(session_id)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start collaboration session: {str(e)}")


@router.post("/sessions/{session_id}/end")
async def end_collaboration_session(
    session_id: UUID,
    reason: str = Query("Completed", description="Reason for ending the session"),
    final_result: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    End a collaboration session.

    This terminates the session and notifies all participating agents.
    """
    try:
        await collaboration_service.end_session(
            session_id=session_id,
            reason=reason,
            final_result=final_result
        )

        return {"message": "Collaboration session ended successfully", "session_id": str(session_id)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end collaboration session: {str(e)}")


@router.post("/sessions/{session_id}/tasks", response_model=Dict[str, Any])
async def delegate_task_in_session(
    session_id: UUID,
    task_request: CollaborationTaskRequest,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Delegate a task within a collaboration session.

    This allows agents to delegate specific tasks to other agents in the session.
    """
    try:
        assigned_agent_id = await collaboration_service.delegate_task_in_session(
            session_id=session_id,
            delegating_agent_id=task_request.delegating_agent_id,
            task_type=task_request.task_type,
            title=task_request.title,
            description=task_request.description,
            input_data=task_request.input_data,
            requirements=task_request.requirements,
            priority=task_request.priority
        )

        if not assigned_agent_id:
            raise HTTPException(status_code=400, detail="No suitable agent found for task delegation")

        return {
            "message": "Task delegated successfully",
            "session_id": str(session_id),
            "assigned_agent_id": str(assigned_agent_id),
            "task_type": task_request.task_type,
            "title": task_request.title
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delegate task: {str(e)}")


@router.get("/sessions/{session_id}/tasks", response_model=List[CollaborationTaskResponse])
async def list_session_tasks(
    session_id: UUID,
    status: Optional[str] = Query(None, description="Filter by task status"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all tasks within a collaboration session.
    """
    try:
        query = select(CollaborationTask).where(CollaborationTask.session_id == session_id)

        if status:
            query = query.where(CollaborationTask.status == status)

        query = query.order_by(desc(CollaborationTask.created_at))

        result = await db.execute(query)
        tasks = result.scalars().all()

        return [
            CollaborationTaskResponse(
                id=task.id,
                session_id=task.session_id,
                title=task.title,
                description=task.description,
                task_type=task.task_type,
                delegating_agent_id=task.delegating_agent_id,
                assigned_agent_id=task.assigned_agent_id,
                status=task.status,
                priority=task.priority,
                input_data=task.input_data,
                requirements=task.requirements,
                result=task.result,
                error_message=task.error_message,
                success_score=task.success_score,
                created_at=task.created_at,
                assigned_at=task.assigned_at,
                started_at=task.started_at,
                completed_at=task.completed_at,
                deadline=task.deadline
            )
            for task in tasks
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list session tasks: {str(e)}")


@router.get("/sessions/{session_id}/messages", response_model=List[CollaborationMessageResponse])
async def list_session_messages(
    session_id: UUID,
    message_type: Optional[str] = Query(None, description="Filter by message type"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of messages to return"),
    offset: int = Query(0, ge=0, description="Number of messages to skip"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List messages within a collaboration session.
    """
    try:
        query = select(CollaborationMessage).where(CollaborationMessage.session_id == session_id)

        if message_type:
            query = query.where(CollaborationMessage.message_type == message_type)

        query = query.order_by(desc(CollaborationMessage.sent_at))
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        messages = result.scalars().all()

        return [
            CollaborationMessageResponse(
                id=message.id,
                session_id=message.session_id,
                sender_agent_id=message.sender_agent_id,
                recipient_agent_id=message.recipient_agent_id,
                message_type=message.message_type,
                priority=message.priority,
                subject=message.subject,
                content=message.content,
                payload=message.payload,
                thread_id=message.thread_id,
                parent_message_id=message.parent_message_id,
                requires_response=message.requires_response,
                response_deadline=message.response_deadline,
                sent_at=message.sent_at,
                delivered_at=message.delivered_at,
                read_at=message.read_at
            )
            for message in messages
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list session messages: {str(e)}")


@router.post("/sessions/{session_id}/messages")
async def send_message_in_session(
    session_id: UUID,
    message_request: CollaborationMessageRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Send a message within a collaboration session.
    """
    try:
        from app.services.collaboration import MessageEnvelope, MessageType, MessagePriority

        envelope = MessageEnvelope(
            message_id=uuid4(),
            sender_id=message_request.sender_agent_id,
            recipient_id=message_request.recipient_agent_id,
            message_type=MessageType(message_request.message_type),
            priority=MessagePriority(message_request.priority),
            subject=message_request.subject,
            content=message_request.content,
            payload=message_request.payload,
            thread_id=session_id,
            parent_message_id=message_request.parent_message_id,
            requires_response=message_request.requires_response,
            response_deadline=message_request.response_deadline,
            metadata=message_request.metadata
        )

        success = await collaboration_service._routing_service.send_message(envelope, session_id)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to send message")

        return {
            "message": "Message sent successfully",
            "message_id": str(envelope.message_id),
            "session_id": str(session_id)
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid message type or priority: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")


@router.post("/sessions/{session_id}/consensus")
async def initiate_consensus_in_session(
    session_id: UUID,
    consensus_request: ConsensusVoteRequest,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Initiate a consensus decision-making process within a collaboration session.
    """
    try:
        success = await collaboration_service.initiate_consensus_in_session(
            session_id=session_id,
            proposal_id=consensus_request.proposal_id,
            proposal_data=consensus_request.proposal_data,
            consensus_threshold=consensus_request.consensus_threshold
        )

        if not success:
            raise HTTPException(status_code=400, detail="Failed to initiate consensus process")

        return {
            "message": "Consensus process initiated successfully",
            "session_id": str(session_id),
            "proposal_id": consensus_request.proposal_id,
            "consensus_threshold": consensus_request.consensus_threshold
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate consensus: {str(e)}")


@router.post("/consensus/{proposal_id}/vote")
async def submit_consensus_vote(
    proposal_id: str,
    vote_request: ConsensusResponse,
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Submit a vote for a consensus proposal.
    """
    try:
        success = await collaboration_service._consensus_service.submit_vote(
            proposal_id=proposal_id,
            agent_id=vote_request.voting_agent_id,
            vote_value=vote_request.vote_value,
            confidence_score=vote_request.confidence_score,
            reasoning=vote_request.reasoning
        )

        if not success:
            raise HTTPException(status_code=400, detail="Failed to submit vote")

        return {
            "message": "Vote submitted successfully",
            "proposal_id": proposal_id,
            "voting_agent_id": str(vote_request.voting_agent_id),
            "vote_value": vote_request.vote_value
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit vote: {str(e)}")


@router.get("/agents/discover", response_model=List[AgentCapabilityResponse])
async def discover_agents_by_capability(
    required_capabilities: List[str] = Query(..., description="List of required capabilities"),
    min_performance_score: float = Query(0.0, ge=0.0, le=1.0, description="Minimum performance score"),
    max_agents: int = Query(10, ge=1, le=50, description="Maximum number of agents to return"),
    current_user: dict = Depends(get_current_user),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Discover agents based on required capabilities.

    This endpoint helps identify suitable agents for specific tasks or collaboration needs.
    """
    try:
        agents = await collaboration_service._discovery_service.discover_agents_by_capability(
            required_capabilities=required_capabilities,
            min_performance_score=min_performance_score,
            max_agents=max_agents
        )

        return [
            AgentCapabilityResponse(
                agent_id=agent.agent_id,
                name=agent.name,
                agent_type=agent.agent_type,
                capabilities=agent.capabilities,
                status=agent.status,
                current_load=agent.current_load,
                performance_score=agent.performance_score,
                last_seen=agent.last_seen,
                metadata=agent.metadata
            )
            for agent in agents
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to discover agents: {str(e)}")


@router.get("/agents/{agent_id}/capabilities", response_model=AgentCapabilityResponse)
async def get_agent_capabilities(
    agent_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed capabilities and performance information for a specific agent.
    """
    try:
        # This would integrate with the agent capability discovery service
        # For now, we'll return a basic response

        from app.models.agent import Agent
        from sqlalchemy import select

        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        return AgentCapabilityResponse(
            agent_id=agent.id,
            name=agent.name,
            agent_type=agent.agent_type,
            capabilities=agent.capabilities or [],
            status=agent.status,
            performance_score=agent.success_rate / 100.0 if agent.success_rate else 0.0,
            metadata=agent.settings or {}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent capabilities: {str(e)}")


@router.get("/patterns", response_model=List[Dict[str, Any]])
async def list_collaboration_patterns(
    pattern_type: Optional[str] = Query(None, description="Filter by pattern type"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List available collaboration patterns.

    Collaboration patterns are reusable workflows for common multi-agent scenarios.
    """
    try:
        from app.models.collaboration import CollaborationPattern
        from sqlalchemy import select

        query = select(CollaborationPattern).where(CollaborationPattern.is_active == True)

        if pattern_type:
            query = query.where(CollaborationPattern.pattern_type == pattern_type)

        query = query.order_by(desc(CollaborationPattern.usage_count))

        result = await db.execute(query)
        patterns = result.scalars().all()

        return [
            {
                "id": str(pattern.id),
                "name": pattern.name,
                "description": pattern.description,
                "pattern_type": pattern.pattern_type,
                "workflow_definition": pattern.workflow_definition,
                "required_capabilities": pattern.required_capabilities,
                "optimal_agent_count": pattern.optimal_agent_count,
                "min_agent_count": pattern.min_agent_count,
                "max_agent_count": pattern.max_agent_count,
                "usage_count": pattern.usage_count,
                "success_rate": pattern.success_rate,
                "average_completion_time_ms": pattern.average_completion_time_ms,
                "version": pattern.version
            }
            for pattern in patterns
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list collaboration patterns: {str(e)}")


@router.get("/channels", response_model=List[Dict[str, Any]])
async def list_communication_channels(
    channel_type: Optional[str] = Query(None, description="Filter by channel type"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List available communication channels for agent collaboration.
    """
    try:
        from app.models.collaboration import CommunicationChannel
        from sqlalchemy import select

        query = select(CommunicationChannel).where(CommunicationChannel.is_active == True)

        if channel_type:
            query = query.where(CommunicationChannel.channel_type == channel_type)

        query = query.order_by(CommunicationChannel.name)

        result = await db.execute(query)
        channels = result.scalars().all()

        return [
            {
                "id": str(channel.id),
                "name": channel.name,
                "channel_type": channel.channel_type,
                "description": channel.description,
                "participants": channel.participants,
                "is_persistent": channel.is_persistent,
                "max_message_size": channel.max_message_size,
                "requires_authentication": channel.requires_authentication,
                "encryption_enabled": channel.encryption_enabled,
                "rate_limit_per_minute": channel.rate_limit_per_minute,
                "message_retention_hours": channel.message_retention_hours,
                "created_at": channel.created_at,
                "last_activity": channel.last_activity
            }
            for channel in channels
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list communication channels: {str(e)}")


@router.get("/metrics")
async def get_collaboration_metrics(
    session_id: Optional[UUID] = Query(None, description="Get metrics for specific session"),
    period_hours: int = Query(24, ge=1, le=168, description="Time period in hours"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get collaboration metrics and analytics.
    """
    try:
        from sqlalchemy import func, and_
        from app.models.collaboration import CollaborationSession, CollaborationMessage, CollaborationTask

        since = datetime.utcnow() - timedelta(hours=period_hours)

        metrics = {
            "period_hours": period_hours,
            "since": since.isoformat(),
            "session_metrics": {},
            "message_metrics": {},
            "task_metrics": {},
            "system_metrics": {}
        }

        if session_id:
            # Session-specific metrics
            session_query = select(CollaborationSession).where(
                and_(
                    CollaborationSession.id == session_id,
                    CollaborationSession.created_at >= since
                )
            )
            session_result = await db.execute(session_query)
            session = session_result.scalar_one_or_none()

            if session:
                metrics["session_metrics"] = {
                    "session_id": str(session.id),
                    "name": session.name,
                    "status": session.status,
                    "total_messages": session.total_messages,
                    "total_tasks_delegated": session.total_tasks_delegated,
                    "average_response_time_ms": session.average_response_time_ms,
                    "created_at": session.created_at.isoformat(),
                    "started_at": session.started_at.isoformat() if session.started_at else None,
                    "ended_at": session.ended_at.isoformat() if session.ended_at else None
                }

        # System-wide metrics
        # Session metrics
        session_count_query = select(func.count(CollaborationSession.id)).where(
            CollaborationSession.created_at >= since
        )
        session_count_result = await db.execute(session_count_query)
        total_sessions = session_count_result.scalar()

        # Message metrics
        message_count_query = select(func.count(CollaborationMessage.id)).where(
            CollaborationMessage.sent_at >= since
        )
        message_count_result = await db.execute(message_count_query)
        total_messages = message_count_result.scalar()

        # Task metrics
        task_count_query = select(func.count(CollaborationTask.id)).where(
            CollaborationTask.created_at >= since
        )
        task_count_result = await db.execute(task_count_query)
        total_tasks = task_count_result.scalar()

        # Success rate
        completed_tasks_query = select(func.count(CollaborationTask.id)).where(
            and_(
                CollaborationTask.created_at >= since,
                CollaborationTask.status == "completed"
            )
        )
        completed_tasks_result = await db.execute(completed_tasks_query)
        completed_tasks = completed_tasks_result.scalar()

        success_rate = (completed_tasks / total_tasks) if total_tasks > 0 else 0.0

        metrics["system_metrics"] = {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "success_rate": success_rate
        }

        return metrics

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get collaboration metrics: {str(e)}")


@router.post("/sessions/{session_id}/pause")
async def pause_collaboration_session(
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Pause a collaboration session temporarily.
    """
    try:
        result = await db.execute(
            select(CollaborationSession).where(CollaborationSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Collaboration session not found")

        if session.status != CollaborationStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Session is not active")

        session.status = CollaborationStatus.PAUSED
        await db.commit()

        return {"message": "Collaboration session paused successfully", "session_id": str(session_id)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pause session: {str(e)}")


@router.post("/sessions/{session_id}/resume")
async def resume_collaboration_session(
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Resume a paused collaboration session.
    """
    try:
        result = await db.execute(
            select(CollaborationSession).where(CollaborationSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Collaboration session not found")

        if session.status != CollaborationStatus.PAUSED:
            raise HTTPException(status_code=400, detail="Session is not paused")

        session.status = CollaborationStatus.ACTIVE
        await db.commit()

        return {"message": "Collaboration session resumed successfully", "session_id": str(session_id)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume session: {str(e)}")


# Error handlers
@router.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "error": {
            "code": exc.status_code,
            "message": exc.detail,
            "type": "http_error"
        }
    }


@router.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return {
        "error": {
            "code": 500,
            "message": "Internal server error",
            "type": "internal_error",
            "details": str(exc)
        }
    }