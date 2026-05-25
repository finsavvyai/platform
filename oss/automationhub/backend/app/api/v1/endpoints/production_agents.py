"""
Production-Grade Agent Registry API Endpoints

This module provides REST API endpoints for the production-grade agent registry,
including agent management, health monitoring, capability discovery, performance
analytics, and failover management.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Path, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from uuid import UUID
import json
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.agents import (
    production_registry, get_production_registry,
    UPMAgent, TaskType, AgentStatus
)
from app.agents.enhanced_registry import RegistrationStatus, LoadBalancingStrategy
from app.services.agent_health import HealthCheckLevel
from app.services.capability_discovery import SkillLevel, MatchingAlgorithm
from app.services.performance_analytics import MetricType, AlertSeverity
from app.services.failover_manager import LoadBalancingMode, FailoverState


# Pydantic Models for API Requests/Responses

class AgentRegistrationRequest(BaseModel):
    """Request model for agent registration."""
    agent_id: Optional[UUID] = None
    agent_type: str
    name: str
    description: Optional[str] = None
    capabilities: List[str] = []
    metadata: Dict[str, Any] = {}
    weight: float = 1.0
    max_concurrent_tasks: int = 10
    auto_discover_capabilities: bool = True
    enable_health_monitoring: bool = True
    enable_performance_tracking: bool = True
    failover_group: Optional[str] = None


class AgentRegistrationResponse(BaseModel):
    """Response model for agent registration."""
    agent_id: UUID
    status: str
    message: str
    capabilities_discovered: int
    registration_metadata: Dict[str, Any]


class TaskAssignmentRequest(BaseModel):
    """Request model for task assignment."""
    task_id: UUID
    task_type: str
    task_name: str
    description: Optional[str] = None
    parameters: Dict[str, Any] = {}
    priority: int = 5
    strategy: Optional[str] = None
    failover_group: Optional[str] = None
    max_retries: int = 3


class TaskAssignmentResponse(BaseModel):
    """Response model for task assignment."""
    task_id: UUID
    agent_id: Optional[UUID]
    assignment_status: str
    assignment_metadata: Dict[str, Any]
    estimated_completion_time: Optional[datetime] = None


class TaskCompletionRequest(BaseModel):
    """Request model for task completion."""
    task_id: UUID
    success: bool
    execution_time_ms: float
    result: Optional[Any] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = {}


class HealthCheckRequest(BaseModel):
    """Request model for health check."""
    agent_id: UUID
    level: str = "basic"
    timeout_seconds: int = 30


class FailoverGroupRequest(BaseModel):
    """Request model for failover group creation."""
    group_id: str
    name: str
    primary_agents: List[UUID]
    backup_agents: List[UUID] = []
    failover_threshold: float = 0.5
    auto_failback: bool = True
    load_balancing_mode: str = "performance_based"


class AlertCreationRequest(BaseModel):
    """Request model for alert creation."""
    agent_id: Optional[UUID]
    metric_name: str
    condition: str
    threshold: float
    severity: str
    message: str
    notification_channels: List[str] = []


# API Router
router = APIRouter(prefix="/production/agents", tags=["production-agents"])


# Agent Management Endpoints

@router.post("/register", response_model=AgentRegistrationResponse)
async def register_agent(
    request: AgentRegistrationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new agent with production-grade features."""
    try:
        # Create mock agent object (in production, this would be an actual agent instance)
        agent = MockAgent(
            agent_id=request.agent_id,
            agent_type=request.agent_type,
            name=request.name,
            description=request.description,
            capabilities=request.capabilities
        )

        # Register agent with production registry
        agent_id = await production_registry.register_agent(
            agent=agent,
            metadata=request.metadata,
            weight=request.weight,
            max_concurrent_tasks=request.max_concurrent_tasks,
            auto_discover_capabilities=request.auto_discover_capabilities,
            enable_health_monitoring=request.enable_health_monitoring,
            enable_performance_tracking=request.enable_performance_tracking,
            failover_group=request.failover_group
        )

        # Get agent status
        agent_status = await production_registry.get_agent_status(agent_id)

        return AgentRegistrationResponse(
            agent_id=agent_id,
            status="registered",
            message="Agent registered successfully",
            capabilities_discovered=len(agent_status.get("capabilities", [])),
            registration_metadata=agent_status
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{agent_id}")
async def deregister_agent(
    agent_id: UUID = Path(..., description="Agent ID to deregister")
):
    """Deregister an agent with cleanup."""
    try:
        success = await production_registry.deregister_agent(agent_id)

        if success:
            return {"message": f"Agent {agent_id} deregistered successfully"}
        else:
            return {"message": f"Agent {agent_id} not found or has active tasks"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{agent_id}/status")
async def get_agent_status(
    agent_id: UUID = Path(..., description="Agent ID")
):
    """Get comprehensive agent status."""
    try:
        status = await production_registry.get_agent_status(agent_id)
        return JSONResponse(content=status)

    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found: {str(e)}")


@router.get("/list")
async def list_agents(
    status: Optional[str] = Query(None, description="Filter by registration status"),
    agent_type: Optional[str] = Query(None, description="Filter by agent type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=1000, description="Items per page")
):
    """List agents with filtering and pagination."""
    try:
        # Get agent registrations from enhanced registry
        if status:
            status_filter = RegistrationStatus(status)
            registrations = await production_registry._enhanced_registry.list_agents_enhanced(
                status_filter=status_filter,
                agent_type_filter=agent_type
            )
        else:
            registrations = await production_registry._enhanced_registry.list_agents_enhanced(
                agent_type_filter=agent_type
            )

        # Apply pagination
        start = (page - 1) * limit
        end = start + limit
        paginated_registrations = registrations[start:end]

        return {
            "agents": [reg.to_dict() for reg in paginated_registrations],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": len(registrations),
                "pages": (len(registrations) + limit - 1) // limit
            }
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Task Management Endpoints

@router.post("/tasks/assign", response_model=TaskAssignmentResponse)
async def assign_task(
    request: TaskAssignmentRequest,
    db: AsyncSession = Depends(get_db)
):
    """Assign a task to the best available agent."""
    try:
        # Create task object
        task_type = TaskType(request.task_type)
        task = MockTask(
            task_id=request.task_id,
            task_type=task_type,
            task_name=request.task_name,
            description=request.description,
            parameters=request.parameters,
            priority=request.priority
        )

        # Convert strategy string to enum
        strategy = None
        if request.strategy:
            strategy = LoadBalancingStrategy(request.strategy)

        # Assign task
        selected_agent, metadata = await production_registry.assign_task(
            task=task,
            strategy=strategy,
            failover_group=request.failover_group,
            priority=request.priority
        )

        return TaskAssignmentResponse(
            task_id=request.task_id,
            agent_id=selected_agent,
            assignment_status="assigned" if selected_agent else "failed",
            assignment_metadata=metadata,
            estimated_completion_time=datetime.utcnow() + timedelta(minutes=30)  # Estimate
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: UUID = Path(..., description="Task ID"),
    request: TaskCompletionRequest = Body(...)
):
    """Complete a task execution and update tracking systems."""
    try:
        # Get agent ID from metadata or request
        agent_id = request.metadata.get("agent_id") if request.metadata else None

        if not agent_id:
            raise HTTPException(
                status_code=400,
                detail="Agent ID required in metadata"
            )

        await production_registry.complete_task(
            agent_id=UUID(str(agent_id)),
            task_id=task_id,
            success=request.success,
            execution_time_ms=request.execution_time_ms,
            result=request.result,
            error_message=request.error_message,
            metadata=request.metadata
        )

        return {"message": f"Task {task_id} completion recorded"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tasks/active")
async def get_active_tasks(
    agent_id: Optional[UUID] = Query(None, description="Filter by agent ID")
):
    """Get list of active tasks."""
    try:
        # This would integrate with task storage/tracking system
        # For now, return a placeholder response
        active_tasks = await production_registry._enhanced_registry.list_agents_enhanced()

        tasks_with_load = []
        for reg in active_tasks:
            if reg.current_tasks > 0:
                if not agent_id or reg.agent_id == agent_id:
                    tasks_with_load.append({
                        "agent_id": str(reg.agent_id),
                        "agent_name": reg.name,
                        "active_tasks": reg.current_tasks,
                        "max_tasks": reg.max_concurrent_tasks,
                        "load_percentage": (reg.current_tasks / reg.max_concurrent_tasks) * 100
                    })

        return {"active_tasks": tasks_with_load}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Health Monitoring Endpoints

@router.post("/health/check")
async def perform_health_check(
    request: HealthCheckRequest
):
    """Perform health check on a specific agent."""
    try:
        level = HealthCheckLevel(request.level)
        health_result = await production_registry._health_monitor.check_agent_health(
            request.agent_id, level
        )

        return JSONResponse(content=health_result.to_dict())

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health/overview")
async def get_health_overview():
    """Get system-wide health overview."""
    try:
        overview = await production_registry._health_monitor.get_system_health_overview()
        return JSONResponse(content=overview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{agent_id}/health/history")
async def get_health_history(
    agent_id: UUID = Path(..., description="Agent ID"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history to retrieve")
):
    """Get health history for a specific agent."""
    try:
        history = await production_registry._health_monitor.get_agent_health_history(
            agent_id, hours
        )
        return {"agent_id": str(agent_id), "history": history, "period_hours": hours}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Capability Discovery Endpoints

@router.get("/{agent_id}/capabilities")
async def get_agent_capabilities(
    agent_id: UUID = Path(..., description="Agent ID")
):
    """Get capabilities for a specific agent."""
    try:
        profile = await production_registry._capability_discovery.get_agent_capability_profile(agent_id)

        if not profile:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} capabilities not found")

        return JSONResponse(content=profile.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/match")
async def find_agents_for_task(
    task_id: UUID,
    task_type: str,
    task_name: str,
    description: Optional[str] = None,
    algorithm: str = "hybrid",
    top_k: int = Query(5, ge=1, le=50, description="Number of top matches to return")
):
    """Find best agents for a task based on capabilities."""
    try:
        # Create task object
        task_type_enum = TaskType(task_type)
        task = MockTask(
            task_id=task_id,
            task_type=task_type_enum,
            task_name=task_name,
            description=description,
            parameters={}
        )

        matching_algorithm = MatchingAlgorithm(algorithm)
        matches = await production_registry._capability_discovery.match_task_to_agents(
            task, matching_algorithm, top_k
        )

        return {
            "task_id": str(task_id),
            "algorithm": algorithm,
            "matches": [match.__dict__ for match in matches]
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/capabilities/experts")
async def get_capability_experts(
    capability: str = Query(..., description="Capability name"),
    skill_level: Optional[str] = Query(None, description="Minimum skill level"),
    max_results: int = Query(10, ge=1, le=100, description="Maximum results")
):
    """Find agents expert in a specific capability."""
    try:
        min_skill_level = SkillLevel(skill_level) if skill_level else None
        experts = await production_registry._capability_discovery.find_capability_experts(
            capability, min_skill_level, max_results
        )

        return {
            "capability": capability,
            "min_skill_level": skill_level,
            "experts": [
                {"agent_id": str(agent_id), "expertise_score": score}
                for agent_id, score in experts
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{agent_id}/recommendations")
async def get_skill_development_recommendations(
    agent_id: UUID = Path(..., description="Agent ID")
):
    """Get skill development recommendations for an agent."""
    try:
        recommendations = await production_registry._capability_discovery.recommend_skill_development(agent_id)
        return {"agent_id": str(agent_id), "recommendations": recommendations}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Performance Analytics Endpoints

@router.get("/{agent_id}/metrics")
async def get_agent_metrics(
    agent_id: UUID = Path(..., description="Agent ID"),
    metric_names: Optional[List[str]] = Query(None, description="Specific metrics to retrieve"),
    start_time: Optional[datetime] = Query(None, description="Start time for query"),
    end_time: Optional[datetime] = Query(None, description="End time for query"),
    aggregations: Optional[List[str]] = Query(None, description="Aggregations to compute")
):
    """Get performance metrics for a specific agent."""
    try:
        metrics_data = await production_registry._performance_analytics.get_agent_metrics(
            agent_id, metric_names, start_time, end_time, aggregations
        )

        return {
            "agent_id": str(agent_id),
            "period": {
                "start": start_time.isoformat() if start_time else None,
                "end": end_time.isoformat() if end_time else None
            },
            "metrics": {
                name: [agg.to_dict() for agg in aggs]
                for name, aggs in metrics_data.items()
            }
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/performance/overview")
async def get_performance_overview():
    """Get system-wide performance overview."""
    try:
        overview = await production_registry._performance_analytics.get_system_performance_overview()
        return JSONResponse(content=overview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/generate")
async def generate_performance_report(
    agent_id: Optional[UUID] = Query(None, description="Agent ID (optional for system-wide report)"),
    report_type: str = Query("summary", description="Report type"),
    period_hours: int = Query(24, ge=1, le=168, description="Time period in hours")
):
    """Generate comprehensive performance report."""
    try:
        report = await production_registry._performance_analytics.create_performance_report(
            agent_id, report_type, period_hours
        )

        return JSONResponse(content=report.to_dict())

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/alerts/create")
async def create_performance_alert(
    request: AlertCreationRequest
):
    """Create a new performance alert."""
    try:
        severity = AlertSeverity(request.severity)
        alert_id = await production_registry._performance_analytics.create_alert(
            agent_id=request.agent_id,
            metric_name=request.metric_name,
            condition=request.condition,
            threshold=request.threshold,
            severity=severity,
            message=request.message,
            notification_channels=request.notification_channels
        )

        return {"alert_id": alert_id, "message": "Alert created successfully"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/performance/trends")
async def get_performance_trends(
    agent_id: Optional[UUID] = Query(None, description="Agent ID"),
    metric_name: Optional[str] = Query(None, description="Specific metric name"),
    hours: int = Query(24, ge=1, le=168, description="Time period in hours")
):
    """Get performance trends analysis."""
    try:
        trends = await production_registry._performance_analytics.get_performance_trends(
            agent_id, metric_name, hours
        )

        return JSONResponse(content=trends)

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Failover Management Endpoints

@router.post("/failover/groups")
async def create_failover_group(
    request: FailoverGroupRequest
):
    """Create a new failover group."""
    try:
        load_balancing_mode = LoadBalancingMode(request.load_balancing_mode)
        failover_manager = production_registry._failover_manager

        # Configure load balancer and circuit breaker if needed
        # This would use actual configuration classes

        group = await failover_manager.create_failover_group(
            group_id=request.group_id,
            name=request.name,
            primary_agents=request.primary_agents,
            backup_agents=request.backup_agents,
            failover_threshold=request.failover_threshold,
            auto_failback=request.auto_failback
        )

        return {"message": f"Failover group {request.group_id} created successfully"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/failover/groups")
async def list_failover_groups():
    """List all failover groups."""
    try:
        groups = {}
        failover_manager = production_registry._failover_manager

        for group_id, group in failover_manager._failover_groups.items():
            groups[group_id] = {
                "name": group.name,
                "state": group.state,
                "primary_agents": len(group.primary_endpoints),
                "backup_agents": len(group.backup_endpoints),
                "failover_threshold": group.failover_threshold,
                "auto_failback": group.auto_failback
            }

        return {"failover_groups": groups}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/failover/groups/{group_id}/status")
async def get_failover_group_status(
    group_id: str = Path(..., description="Failover group ID")
):
    """Get status of a specific failover group."""
    try:
        status = await production_registry._failover_manager.get_failover_status(group_id)
        return JSONResponse(content=status)

    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failover group {group_id} not found: {str(e)}")


@router.post("/failover/groups/{group_id}/trigger")
async def trigger_manual_failover(
    group_id: str = Path(..., description="Failover group ID"),
    reason: str = Query(..., description="Reason for failover"),
    affected_agents: Optional[List[UUID]] = Query(None, description="Specific agents to failover")
):
    """Trigger manual failover for a group."""
    try:
        await production_registry._failover_manager.trigger_manual_failover(
            group_id=group_id,
            reason=reason,
            affected_agents=affected_agents
        )

        return {"message": f"Manual failover triggered for group {group_id}"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/failover/maintenance/schedule")
async def schedule_maintenance_window(
    group_id: str = Query(..., description="Failover group ID"),
    start_time: datetime = Query(..., description="Maintenance window start time"),
    end_time: datetime = Query(..., description="Maintenance window end time"),
    affected_agents: List[UUID] = Query(..., description="Agents under maintenance"),
    description: str = Query(..., description="Maintenance description")
):
    """Schedule a maintenance window."""
    try:
        await production_registry._failover_manager.schedule_maintenance_window(
            group_id=group_id,
            start_time=start_time,
            end_time=end_time,
            affected_agents=affected_agents,
            description=description
        )

        return {"message": f"Maintenance window scheduled for group {group_id}"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# System Overview and Reporting

@router.get("/overview")
async def get_system_overview():
    """Get comprehensive system overview."""
    try:
        overview = await production_registry.get_system_overview()
        return JSONResponse(content=overview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/comprehensive")
async def generate_comprehensive_report(
    agent_id: Optional[UUID] = Query(None, description="Agent ID (optional for system-wide)"),
    report_type: str = Query("comprehensive", description="Report type"),
    period_hours: int = Query(24, ge=1, le=168, description="Time period in hours")
):
    """Generate comprehensive system report."""
    try:
        report = await production_registry.create_comprehensive_report(
            agent_id, report_type, period_hours
        )

        return JSONResponse(content=report)

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Mock Classes (for API testing)
# In production, these would be actual agent and task classes

class MockAgent:
    """Mock agent class for API testing."""
    def __init__(self, agent_id, agent_type, name, description, capabilities):
        from app.agents.base import Capability

        self.id = agent_id or uuid4()
        self.agent_type = agent_type
        self.name = name
        self.description = description
        self.capabilities = [
            Capability(
                name=cap,
                description=f"Mock capability: {cap}",
                supported_task_types=[TaskType.CUSTOM]
            )
            for cap in capabilities
        ]


class MockTask:
    """Mock task class for API testing."""
    def __init__(self, task_id, task_type, task_name, description, parameters, priority):
        self.id = task_id
        self.type = task_type
        self.name = task_name
        self.description = description
        self.parameters = parameters
        self.priority = priority