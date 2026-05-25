"""
Task Queue API Endpoints
Provides REST API access to multi-agent task execution system
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field

from app.services.task_queue import (
    task_queue,
    Task,
    Agent,
    TaskResult,
    TaskStatus,
    TaskPriority,
    AgentType
)

router = APIRouter()

class TaskSubmissionRequest(BaseModel):
    """Request model for task submission"""
    name: str
    description: str
    agent_type: AgentType
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    max_retries: int = 3
    timeout: int = 300
    dependencies: List[str] = Field(default_factory=list)
    callback_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AgentRegistrationRequest(BaseModel):
    """Request model for agent registration"""
    type: AgentType
    name: str
    description: str
    capabilities: List[str] = Field(default_factory=list)
    max_concurrent_tasks: int = 1
    metadata: Dict[str, Any] = Field(default_factory=dict)

class BatchTaskRequest(BaseModel):
    """Request model for batch task submission"""
    tasks: List[TaskSubmissionRequest]
    execute_parallel: bool = True

class WorkflowRequest(BaseModel):
    """Request model for workflow execution"""
    name: str
    description: str
    steps: List[TaskSubmissionRequest]
    parallel_execution: bool = False

@router.post("/tasks", response_model=Dict[str, str])
async def submit_task(request: TaskSubmissionRequest):
    """
    Submit a task for execution by available agents

    Accepts task definition and queues it for execution by appropriate agent type.
    Returns task ID for tracking progress.
    """
    try:
        # Create task from request
        task = Task(
            name=request.name,
            description=request.description,
            agent_type=request.agent_type,
            payload=request.payload,
            priority=request.priority,
            max_retries=request.max_retries,
            timeout=request.timeout,
            dependencies=request.dependencies,
            callback_url=request.callback_url,
            scheduled_at=request.scheduled_at,
            metadata=request.metadata
        )

        # Submit to queue
        task_id = await task_queue.submit_task(task)

        return {
            "task_id": task_id,
            "status": "submitted",
            "message": f"Task '{request.name}' submitted successfully"
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit task: {str(e)}"
        )

@router.post("/tasks/batch", response_model=Dict[str, Any])
async def submit_batch_tasks(request: BatchTaskRequest):
    """
    Submit multiple tasks for execution

    Processes multiple tasks either sequentially or in parallel
    depending on the execution mode specified.
    """
    try:
        task_ids = []
        errors = []

        for i, task_request in enumerate(request.tasks):
            try:
                task = Task(
                    name=task_request.name,
                    description=task_request.description,
                    agent_type=task_request.agent_type,
                    payload=task_request.payload,
                    priority=task_request.priority,
                    max_retries=task_request.max_retries,
                    timeout=task_request.timeout,
                    dependencies=task_request.dependencies,
                    callback_url=task_request.callback_url,
                    scheduled_at=task_request.scheduled_at,
                    metadata=task_request.metadata
                )

                task_id = await task_queue.submit_task(task)
                task_ids.append(task_id)

            except Exception as e:
                errors.append({
                    "task_index": i,
                    "task_name": task_request.name,
                    "error": str(e)
                })

        return {
            "submitted_tasks": len(task_ids),
            "task_ids": task_ids,
            "errors": errors,
            "parallel_execution": request.execute_parallel
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch task submission failed: {str(e)}"
        )

@router.post("/workflows", response_model=Dict[str, Any])
async def execute_workflow(request: WorkflowRequest):
    """
    Execute a workflow consisting of multiple connected tasks

    Creates task dependencies based on workflow step order and executes
    them either sequentially or in parallel as specified.
    """
    try:
        task_ids = []
        previous_task_id = None

        for i, step in enumerate(request.steps):
            # Set dependencies for sequential execution
            dependencies = []
            if not request.parallel_execution and previous_task_id:
                dependencies = [previous_task_id]

            task = Task(
                name=f"{request.name} - Step {i+1}: {step.name}",
                description=step.description,
                agent_type=step.agent_type,
                payload=step.payload,
                priority=step.priority,
                max_retries=step.max_retries,
                timeout=step.timeout,
                dependencies=dependencies,
                callback_url=step.callback_url,
                metadata={
                    **step.metadata,
                    "workflow_name": request.name,
                    "step_number": i + 1,
                    "total_steps": len(request.steps)
                }
            )

            task_id = await task_queue.submit_task(task)
            task_ids.append(task_id)
            previous_task_id = task_id

        return {
            "workflow_name": request.name,
            "total_steps": len(task_ids),
            "task_ids": task_ids,
            "parallel_execution": request.parallel_execution,
            "status": "submitted"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Workflow execution failed: {str(e)}"
        )

@router.get("/tasks/{task_id}", response_model=TaskResult)
async def get_task_status(task_id: str):
    """
    Get current status and result of a specific task

    Returns detailed information about task execution including
    current status, results (if completed), and error information.
    """
    try:
        result = await task_queue.get_task_status(task_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task status: {str(e)}"
        )

@router.post("/tasks/{task_id}/execute")
async def execute_task(task_id: str, background_tasks: BackgroundTasks):
    """
    Manually trigger execution of a specific task

    Forces immediate execution of a pending task if suitable
    agent is available.
    """
    try:
        # Execute in background
        background_tasks.add_task(task_queue.execute_task, task_id)

        return {
            "task_id": task_id,
            "status": "execution_triggered",
            "message": "Task execution started"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute task: {str(e)}"
        )

@router.delete("/tasks/{task_id}")
async def cancel_task(task_id: str):
    """
    Cancel a pending or running task

    Attempts to cancel task execution. Running tasks may take time
    to respond to cancellation depending on current operation.
    """
    try:
        success = await task_queue.cancel_task(task_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel task {task_id} - may be completed or not found"
            )

        return {
            "task_id": task_id,
            "status": "cancelled",
            "message": "Task cancellation initiated"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel task: {str(e)}"
        )

@router.post("/agents", response_model=Dict[str, str])
async def register_agent(request: AgentRegistrationRequest):
    """
    Register a new agent with the task queue system

    Adds agent to available worker pool for task execution.
    Agent will be considered for task assignment based on type and availability.
    """
    try:
        agent = Agent(
            type=request.type,
            name=request.name,
            description=request.description,
            capabilities=request.capabilities,
            max_concurrent_tasks=request.max_concurrent_tasks,
            metadata=request.metadata
        )

        success = await task_queue.register_agent(agent)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register agent"
            )

        return {
            "agent_id": agent.id,
            "status": "registered",
            "message": f"Agent '{request.name}' registered successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent registration failed: {str(e)}"
        )

@router.get("/agents", response_model=List[Dict[str, Any]])
async def list_agents():
    """
    List all registered agents and their current status

    Returns information about all agents including their current
    workload, capabilities, and availability.
    """
    try:
        agents = await task_queue.get_agent_status()
        return agents

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list agents: {str(e)}"
        )

@router.get("/queue/stats", response_model=Dict[str, Any])
async def get_queue_statistics():
    """
    Get comprehensive task queue statistics

    Provides overview of queue performance, task distribution,
    and system health metrics.
    """
    try:
        stats = await task_queue.get_queue_stats()
        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get queue statistics: {str(e)}"
        )

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    Health check for task queue service

    Verifies service status, Redis connectivity, and agent availability.
    """
    try:
        health = await task_queue.health_check()
        return health

    except Exception as e:
        return {
            "service": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Convenience endpoints for common task types

@router.post("/tasks/llm", response_model=Dict[str, str])
async def submit_llm_task(
    prompt: str,
    template_name: Optional[str] = None,
    template_vars: Optional[Dict[str, Any]] = None,
    model_size: str = "medium",
    priority: TaskPriority = TaskPriority.NORMAL
):
    """
    Submit an LLM task with simplified interface

    Convenient endpoint for submitting common LLM generation tasks
    without needing to construct full task definition.
    """
    try:
        task = Task(
            name="LLM Generation Task",
            description=f"Generate completion for: {prompt[:100]}...",
            agent_type=AgentType.LLM_AGENT,
            payload={
                "prompt": prompt,
                "template_name": template_name,
                "template_vars": template_vars or {},
                "model_size": model_size,
                "use_cache": True
            },
            priority=priority
        )

        task_id = await task_queue.submit_task(task)

        return {
            "task_id": task_id,
            "status": "submitted",
            "type": "llm_generation"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM task submission failed: {str(e)}"
        )

@router.post("/tasks/code", response_model=Dict[str, str])
async def submit_code_task(
    description: str,
    code_type: str = "python",
    complexity: str = "intermediate",
    requirements: List[str] = None,
    priority: TaskPriority = TaskPriority.NORMAL
):
    """
    Submit a code generation task with simplified interface

    Convenient endpoint for code generation tasks without needing
    to construct full task definition.
    """
    try:
        task = Task(
            name="Code Generation Task",
            description=f"Generate {code_type} code: {description}",
            agent_type=AgentType.CODE_AGENT,
            payload={
                "description": description,
                "code_type": code_type,
                "complexity": complexity,
                "requirements": requirements or []
            },
            priority=priority
        )

        task_id = await task_queue.submit_task(task)

        return {
            "task_id": task_id,
            "status": "submitted",
            "type": "code_generation"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code task submission failed: {str(e)}"
        )

@router.post("/tasks/analysis", response_model=Dict[str, str])
async def submit_analysis_task(
    analysis_type: str,
    data_description: str,
    data_points: int = 0,
    priority: TaskPriority = TaskPriority.NORMAL
):
    """
    Submit a data analysis task with simplified interface

    Convenient endpoint for analysis tasks without needing
    to construct full task definition.
    """
    try:
        task = Task(
            name="Data Analysis Task",
            description=f"{analysis_type} analysis: {data_description}",
            agent_type=AgentType.ANALYSIS_AGENT,
            payload={
                "type": analysis_type,
                "description": data_description,
                "data_points": data_points
            },
            priority=priority
        )

        task_id = await task_queue.submit_task(task)

        return {
            "task_id": task_id,
            "status": "submitted",
            "type": "data_analysis"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis task submission failed: {str(e)}"
        )