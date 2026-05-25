"""
Agent management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List, Optional
import logging
from uuid import UUID

from app.core.database import get_db
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse
from app.services.task_executor import get_task_executor
from app.agents.registry import agent_registry
from app.agents import BrowserAgent, ConversationalAgent, InfrastructureAgent, DataAgent

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[AgentResponse])
async def get_agents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    agent_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_enabled: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get list of agents with filtering options."""
    try:
        query = select(Agent)
        
        # Apply filters
        if agent_type:
            query = query.where(Agent.agent_type == agent_type)
        if status_filter:
            query = query.where(Agent.status == status_filter)
        if is_enabled is not None:
            query = query.where(Agent.is_enabled == is_enabled)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        agents = result.scalars().all()
        
        return [AgentResponse.model_validate(agent) for agent in agents]
        
    except Exception as e:
        logger.error(f"Failed to list agents: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve agents")


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new agent."""
    try:
        # Create database record
        db_agent = Agent(
            name=agent_data.name,
            description=agent_data.description,
            agent_type=agent_data.agent_type,
            capabilities=agent_data.capabilities,
            llm_config=agent_data.llm_config,
            tools=agent_data.tools,
            memory_config=agent_data.memory_config,
            settings=agent_data.settings,
            environment_variables=agent_data.environment_variables,
            is_enabled=agent_data.is_enabled,
            status="inactive"
        )
        
        db.add(db_agent)
        await db.commit()
        await db.refresh(db_agent)
        
        # Create and register runtime agent instance
        await _create_runtime_agent(db_agent, db)
        
        logger.info(f"Created agent: {db_agent.name} ({db_agent.id})")
        return AgentResponse.model_validate(db_agent)
        
    except Exception as e:
        logger.error(f"Failed to create agent: {e}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create agent: {str(e)}")


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get agent by ID."""
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return AgentResponse.model_validate(agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve agent")


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    agent_data: AgentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an agent."""
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Update fields
        update_data = agent_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(agent, field, value)
        
        await db.commit()
        await db.refresh(agent)
        
        logger.info(f"Updated agent: {agent.name} ({agent.id})")
        return AgentResponse.model_validate(agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update agent: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update agent: {str(e)}")


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete an agent."""
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Deregister from runtime registry
        try:
            agent_registry.deregister_agent(agent_id)
        except Exception as e:
            logger.warning(f"Failed to deregister agent from runtime: {e}")
        
        await db.delete(agent)
        await db.commit()
        
        logger.info(f"Deleted agent: {agent.name} ({agent.id})")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete agent: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete agent: {str(e)}")


@router.post("/{agent_id}/activate", response_model=AgentResponse)
async def activate_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Activate an agent."""
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Update status
        agent.status = "active"
        agent.is_enabled = True
        
        await db.commit()
        await db.refresh(agent)
        
        # Create/register runtime agent if not already registered
        await _create_runtime_agent(agent, db)
        
        logger.info(f"Activated agent: {agent.name} ({agent.id})")
        return AgentResponse.model_validate(agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to activate agent: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to activate agent: {str(e)}")


@router.post("/{agent_id}/deactivate", response_model=AgentResponse)
async def deactivate_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Deactivate an agent."""
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Update status
        agent.status = "inactive"
        agent.is_enabled = False
        
        await db.commit()
        await db.refresh(agent)
        
        # Deregister from runtime
        try:
            agent_registry.deregister_agent(agent_id)
        except Exception as e:
            logger.warning(f"Failed to deregister agent from runtime: {e}")
        
        logger.info(f"Deactivated agent: {agent.name} ({agent.id})")
        return AgentResponse.model_validate(agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to deactivate agent: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to deactivate agent: {str(e)}")


@router.get("/{agent_id}/status", response_model=dict)
async def get_agent_status(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed agent status including runtime metrics."""
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get runtime agent if available
        runtime_agent = agent_registry.get_agent(agent_id)
        
        status_data = {
            "id": str(agent.id),
            "name": agent.name,
            "type": agent.agent_type,
            "status": agent.status,
            "is_enabled": agent.is_enabled,
            "performance_metrics": agent.performance_metrics or {},
            "success_rate": agent.success_rate,
            "average_execution_time": agent.average_execution_time,
            "last_active": agent.last_active.isoformat() if agent.last_active else None,
        }
        
        if runtime_agent:
            status_data["runtime_status"] = runtime_agent.status.value
            status_data["runtime_metrics"] = {
                "tasks_completed": runtime_agent.performance_metrics.tasks_completed,
                "tasks_failed": runtime_agent.performance_metrics.tasks_failed,
                "success_rate": runtime_agent.performance_metrics.success_rate,
                "average_execution_time_ms": runtime_agent.performance_metrics.average_execution_time_ms,
            }
        
        return status_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get agent status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get agent status: {str(e)}")


async def _create_runtime_agent(db_agent: Agent, db: AsyncSession):
    """Create and register a runtime agent instance from database agent."""
    try:
        # Map agent type to agent class
        agent_classes = {
            "browser": BrowserAgent,
            "browser_automation": BrowserAgent,
            "conversational": ConversationalAgent,
            "conversation": ConversationalAgent,
            "infrastructure": InfrastructureAgent,
            "data": DataAgent,
            "data_processing": DataAgent,
        }
        
        agent_class = agent_classes.get(db_agent.agent_type.lower())
        if not agent_class:
            logger.warning(f"Unknown agent type: {db_agent.agent_type}, skipping runtime creation")
            return
        
        # Create runtime agent instance
        runtime_agent = agent_class(
            agent_id=db_agent.id,
            name=db_agent.name,
            agent_type=db_agent.agent_type
        )
        
        # Register with registry
        agent_registry.register_agent(runtime_agent)
        
        # Register with task executor
        executor = await get_task_executor(db)
        await executor.register_agent(runtime_agent)
        
        logger.info(f"Created runtime agent instance for {db_agent.name}")
        
    except Exception as e:
        logger.error(f"Failed to create runtime agent: {e}")
        # Don't raise - database agent still exists even if runtime creation fails
