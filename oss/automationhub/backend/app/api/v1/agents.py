"""
API endpoints for agent management and task execution.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field

from app.agents.base import Task, TaskType, ExecutionContext, TaskStatus
from app.agents.browser_agent import BrowserAgent
from app.agents.registry import agent_registry
from app.services.task_executor import task_executor, TaskPriority
from app.services.browser_automation import browser_automation_service, BrowserWorkflow
from app.core.auth import get_current_user
from app.core.database import get_db_session

router = APIRouter()


# Request/Response Models
class TaskRequest(BaseModel):
    """Request model for task creation."""
    type: TaskType
    name: str
    description: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=3, ge=1, le=5)
    timeout_seconds: Optional[int] = None


class TaskResponse(BaseModel):
    """Response model for task information."""
    id: UUID
    type: TaskType
    name: str
    status: TaskStatus
    created_at: datetime
    assigned_agent_id: Optional[UUID] = None


class AgentResponse(BaseModel):
    """Response model for agent information."""
    id: UUID
    name: str
    type: str
    status: str
    capabilities: List[str]
    performance_metrics: Dict[str, Any]


class BrowserWorkflowRequest(BaseModel):
    """Request model for browser workflow creation."""
    name: str
    description: Optional[str] = None
    target_url: Optional[str] = None
    actions: Optional[List[Dict[str, Any]]] = None
    variables: Dict[str, Any] = Field(default_factory=dict)


class BrowserWorkflowResponse(BaseModel):
    """Response model for browser workflow execution."""
    workflow_id: UUID
    success: bool
    execution_time_ms: int
    results: List[Any]
    errors: List[str]
    screenshots: List[str]


# Agent Management Endpoints
@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(current_user: dict = Depends(get_current_user)):
    """List all registered agents."""
    try:
        agents = []
        for agent_id, agent in task_executor.agent_pool.items():
            agent_info = AgentResponse(
                id=agent.id,
                name=agent.name,
                type=agent.__class__.__name__,
                status=agent.status.value,
                capabilities=[cap.name for cap in agent.capabilities],
                performance_metrics=agent.performance_metrics.dict()
            )
            agents.append(agent_info)
        
        return agents
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list agents: {str(e)}")


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: UUID, current_user: dict = Depends(get_current_user)):
    """Get specific agent information."""
    try:
        agent = task_executor.agent_pool.get(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return AgentResponse(
            id=agent.id,
            name=agent.name,
            type=agent.__class__.__name__,
            status=agent.status.value,
            capabilities=[cap.name for cap in agent.capabilities],
            performance_metrics=agent.performance_metrics.dict()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent: {str(e)}")


@router.post("/agents/{agent_id}/health-check")
async def agent_health_check(agent_id: UUID, current_user: dict = Depends(get_current_user)):
    """Perform health check on specific agent."""
    try:
        agent = task_executor.agent_pool.get(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        health_status = await agent.health_check()
        return health_status
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


# Task Management Endpoints
@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    task_request: TaskRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create and submit a new task for execution."""
    try:
        # Create task
        task = Task(
            type=task_request.type,
            name=task_request.name,
            description=task_request.description,
            parameters=task_request.parameters,
            timeout_seconds=task_request.timeout_seconds
        )
        
        # Submit to task executor
        priority = TaskPriority(task_request.priority)
        task_id = await task_executor.submit_task(task, priority)
        
        return TaskResponse(
            id=task.id,
            type=task.type,
            name=task.name,
            status=TaskStatus.PENDING,
            created_at=task.created_at
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")


@router.get("/tasks/{task_id}/status")
async def get_task_status(task_id: UUID, current_user: dict = Depends(get_current_user)):
    """Get task execution status."""
    try:
        # This would typically query the database for task status
        # For now, return a placeholder response
        return {
            "task_id": task_id,
            "status": "pending",
            "message": "Task status tracking not fully implemented"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")


@router.get("/system/status")
async def get_system_status(current_user: dict = Depends(get_current_user)):
    """Get overall system status."""
    try:
        status = await task_executor.get_system_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system status: {str(e)}")


# Browser Automation Endpoints
@router.post("/browser/workflow/create", response_model=Dict[str, Any])
async def create_browser_workflow(
    workflow_request: BrowserWorkflowRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a browser automation workflow from description."""
    try:
        if workflow_request.actions:
            # Create workflow from provided actions
            from app.services.browser_automation import BrowserAction
            actions = [BrowserAction(**action) for action in workflow_request.actions]
            
            workflow = BrowserWorkflow(
                name=workflow_request.name,
                description=workflow_request.description,
                actions=actions,
                variables=workflow_request.variables
            )
        else:
            # Create workflow from description using AI
            workflow = await browser_automation_service.create_workflow_from_description(
                description=workflow_request.description or workflow_request.name,
                target_url=workflow_request.target_url
            )
        
        # Validate workflow
        validation = await browser_automation_service.validate_workflow(workflow)
        
        return {
            "workflow_id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "actions_count": len(workflow.actions),
            "variables": workflow.variables,
            "validation": validation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create workflow: {str(e)}")


@router.post("/browser/workflow/{workflow_id}/execute", response_model=BrowserWorkflowResponse)
async def execute_browser_workflow(
    workflow_id: UUID,
    variables: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(get_current_user)
):
    """Execute a browser automation workflow."""
    try:
        # This would typically fetch workflow from database
        # For now, create a simple workflow for demonstration
        from app.services.browser_automation import BrowserAction
        
        demo_workflow = BrowserWorkflow(
            id=workflow_id,
            name="Demo Workflow",
            description="Demonstration workflow",
            actions=[
                BrowserAction(
                    action_type="navigate",
                    url=variables.get("url", "https://example.com") if variables else "https://example.com"
                ),
                BrowserAction(
                    action_type="screenshot",
                    options={"type": "png", "full_page": True}
                )
            ]
        )
        
        # Execute workflow
        result = await browser_automation_service.execute_workflow(
            demo_workflow,
            variable_overrides=variables
        )
        
        return BrowserWorkflowResponse(
            workflow_id=result.workflow_id,
            success=result.success,
            execution_time_ms=result.execution_time_ms,
            results=result.results,
            errors=result.errors,
            screenshots=result.screenshots
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute workflow: {str(e)}")


@router.post("/browser/scrape", response_model=Dict[str, Any])
async def scrape_website(
    url: str,
    selectors: List[str],
    wait_selector: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Scrape data from a website."""
    try:
        result = await browser_automation_service.scrape_website(
            url=url,
            selectors=selectors,
            wait_selector=wait_selector
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scrape website: {str(e)}")


@router.post("/browser/form/fill", response_model=Dict[str, Any])
async def fill_form(
    form_url: str,
    form_data: Dict[str, str],
    submit_selector: str = "button[type='submit']",
    current_user: dict = Depends(get_current_user)
):
    """Fill and submit a web form."""
    try:
        result = await browser_automation_service.fill_form(
            form_url=form_url,
            form_data=form_data,
            submit_selector=submit_selector
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fill form: {str(e)}")


@router.get("/browser/templates", response_model=List[Dict[str, Any]])
async def get_workflow_templates(current_user: dict = Depends(get_current_user)):
    """Get available browser workflow templates."""
    try:
        templates = browser_automation_service.get_available_templates()
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get templates: {str(e)}")


@router.post("/browser/template/{template_name}/execute", response_model=BrowserWorkflowResponse)
async def execute_template_workflow(
    template_name: str,
    variables: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Execute a predefined workflow template."""
    try:
        result = await browser_automation_service.execute_template_workflow(
            template_name=template_name,
            variables=variables
        )
        
        return BrowserWorkflowResponse(
            workflow_id=result.workflow_id,
            success=result.success,
            execution_time_ms=result.execution_time_ms,
            results=result.results,
            errors=result.errors,
            screenshots=result.screenshots
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute template: {str(e)}")


# Website Monitoring Endpoints
@router.post("/browser/monitor/start")
async def start_website_monitoring(
    url: str,
    selector: str,
    check_interval_seconds: int = 300,
    current_user: dict = Depends(get_current_user)
):
    """Start monitoring a website for changes."""
    try:
        result = await browser_automation_service.monitor_website_changes(
            url=url,
            selector=selector,
            check_interval_seconds=check_interval_seconds
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start monitoring: {str(e)}")


@router.get("/browser/monitor/check")
async def check_website_changes(
    url: str,
    selector: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if monitored website has changes."""
    try:
        result = await browser_automation_service.check_website_changes(
            url=url,
            selector=selector
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check changes: {str(e)}")


# Initialize agents on startup
@router.on_event("startup")
async def initialize_agents():
    """Initialize default agents on startup."""
    try:
        # Start task executor
        await task_executor.start()
        
        # Create and register browser agent
        browser_agent = BrowserAgent()
        await task_executor.register_agent(browser_agent)
        
        # Register with agent registry
        await agent_registry.register_agent(browser_agent)
        
        print("Agents initialized successfully")
    except Exception as e:
        print(f"Failed to initialize agents: {e}")


@router.on_event("shutdown")
async def cleanup_agents():
    """Cleanup agents on shutdown."""
    try:
        # Stop task executor
        await task_executor.stop()
        
        # Cleanup browser automation service
        await browser_automation_service.cleanup()
        
        print("Agents cleanup completed")
    except Exception as e:
        print(f"Failed to cleanup agents: {e}")
