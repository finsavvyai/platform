"""
AI-Powered Workflow Orchestration Service
Intelligently coordinates and optimizes multi-step automation workflows
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from app.services.llm_service import llm_service, LLMRequest, ModelSize, PromptTemplate

logger = logging.getLogger(__name__)


class WorkflowStatus(Enum):
    """Workflow execution status"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class TaskStatus(Enum):
    """Individual task status"""
    WAITING = "waiting"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


class TaskType(Enum):
    """Types of workflow tasks"""
    CODE_GENERATION = "code_generation"
    INFRASTRUCTURE_DEPLOYMENT = "infrastructure_deployment"
    MONITORING_SETUP = "monitoring_setup"
    DATA_PROCESSING = "data_processing"
    API_CALL = "api_call"
    CONDITION = "condition"
    LOOP = "loop"
    PARALLEL = "parallel"
    CUSTOM = "custom"


class ExecutionStrategy(Enum):
    """Workflow execution strategies"""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    ADAPTIVE = "adaptive"
    PRIORITY_BASED = "priority_based"
    RESOURCE_OPTIMIZED = "resource_optimized"


class RetryStrategy(Enum):
    """Task retry strategies"""
    NONE = "none"
    FIXED_DELAY = "fixed_delay"
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"
    ADAPTIVE = "adaptive"


@dataclass
class TaskDefinition:
    """Definition of a workflow task"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    type: TaskType = TaskType.CUSTOM
    description: str = ""
    config: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[UUID] = field(default_factory=list)
    conditions: List[str] = field(default_factory=list)
    timeout_seconds: int = 300
    retry_strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF
    max_retries: int = 3
    priority: int = 100
    tags: List[str] = field(default_factory=list)
    resources: Dict[str, Any] = field(default_factory=dict)
    enabled: bool = True


@dataclass
class TaskExecution:
    """Runtime execution state of a task"""
    task_id: UUID = None
    workflow_id: UUID = None
    status: TaskStatus = TaskStatus.WAITING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    retry_count: int = 0
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    logs: List[str] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowDefinition:
    """Definition of a complete workflow"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    description: str = ""
    version: str = "1.0.0"
    tasks: List[TaskDefinition] = field(default_factory=list)
    execution_strategy: ExecutionStrategy = ExecutionStrategy.ADAPTIVE
    timeout_seconds: int = 3600
    max_parallel_tasks: int = 5
    auto_retry: bool = True
    notifications: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""
    tags: List[str] = field(default_factory=list)


@dataclass
class WorkflowExecution:
    """Runtime execution state of a workflow"""
    id: UUID = field(default_factory=uuid4)
    workflow_id: UUID = None
    status: WorkflowStatus = WorkflowStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    task_executions: List[TaskExecution] = field(default_factory=list)
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    context: Dict[str, Any] = field(default_factory=dict)
    logs: List[str] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowTemplate:
    """Reusable workflow template"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    description: str = ""
    category: str = ""
    workflow_definition: WorkflowDefinition = None
    parameters: List[Dict[str, Any]] = field(default_factory=list)
    use_count: int = 0
    rating: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""
    public: bool = False


class WorkflowOrchestrationService:
    """
    AI-Powered Workflow Orchestration Service that intelligently coordinates
    and optimizes multi-step automation workflows
    """

    def __init__(self):
        self.workflows: Dict[UUID, WorkflowDefinition] = {}
        self.executions: Dict[UUID, WorkflowExecution] = {}
        self.templates: Dict[UUID, WorkflowTemplate] = {}
        self.active_executions: Set[UUID] = set()
        self.task_registry: Dict[str, callable] = {}
        self.execution_queue: asyncio.Queue = asyncio.Queue()
        self.workers_running = False

        # Initialize built-in task handlers
        self._register_built_in_tasks()

    def _register_built_in_tasks(self):
        """Register built-in task handlers"""
        self.task_registry.update({
            TaskType.CODE_GENERATION.value: self._execute_code_generation_task,
            TaskType.INFRASTRUCTURE_DEPLOYMENT.value: self._execute_deployment_task,
            TaskType.MONITORING_SETUP.value: self._execute_monitoring_task,
            TaskType.DATA_PROCESSING.value: self._execute_data_processing_task,
            TaskType.API_CALL.value: self._execute_api_call_task,
            TaskType.CONDITION.value: self._execute_condition_task,
            TaskType.LOOP.value: self._execute_loop_task,
            TaskType.PARALLEL.value: self._execute_parallel_task,
        })

    async def create_workflow(self, definition: WorkflowDefinition) -> Dict[str, Any]:
        """Create a new workflow definition"""
        try:
            logger.info(f"Creating workflow: {definition.name}")

            # Validate workflow definition
            validation_result = await self._validate_workflow_definition(definition)
            if not validation_result["valid"]:
                return {
                    "status": "failed",
                    "error": f"Workflow validation failed: {validation_result['errors']}"
                }

            # AI-powered workflow optimization
            optimized_definition = await self._optimize_workflow_definition(definition)

            # Store workflow
            self.workflows[optimized_definition.id] = optimized_definition

            logger.info(f"Workflow created successfully: {optimized_definition.id}")
            return {
                "status": "success",
                "workflow_id": str(optimized_definition.id),
                "workflow": optimized_definition
            }

        except Exception as e:
            logger.error(f"Failed to create workflow: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def execute_workflow(self, workflow_id: UUID, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute a workflow"""
        try:
            logger.info(f"Starting workflow execution: {workflow_id}")

            if workflow_id not in self.workflows:
                return {
                    "status": "failed",
                    "error": f"Workflow {workflow_id} not found"
                }

            workflow_definition = self.workflows[workflow_id]

            # Create execution instance
            execution = WorkflowExecution(
                workflow_id=workflow_id,
                status=WorkflowStatus.RUNNING,
                started_at=datetime.now(),
                context=context or {}
            )

            # Initialize task executions
            for task_def in workflow_definition.tasks:
                task_execution = TaskExecution(
                    task_id=task_def.id,
                    workflow_id=workflow_id,
                    status=TaskStatus.WAITING
                )
                execution.task_executions.append(task_execution)

            # Store execution
            self.executions[execution.id] = execution
            self.active_executions.add(execution.id)

            # Start execution workers if not running
            if not self.workers_running:
                asyncio.create_task(self._start_execution_workers())

            # Add to execution queue
            await self.execution_queue.put(execution.id)

            logger.info(f"Workflow execution started: {execution.id}")
            return {
                "status": "started",
                "execution_id": str(execution.id),
                "workflow_id": str(workflow_id)
            }

        except Exception as e:
            logger.error(f"Failed to start workflow execution: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def get_execution_status(self, execution_id: UUID) -> Dict[str, Any]:
        """Get workflow execution status"""
        try:
            if execution_id not in self.executions:
                return {
                    "status": "not_found",
                    "error": f"Execution {execution_id} not found"
                }

            execution = self.executions[execution_id]

            # Calculate progress
            total_tasks = len(execution.task_executions)
            completed_tasks = len([t for t in execution.task_executions if t.status == TaskStatus.COMPLETED])
            progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

            return {
                "status": "success",
                "execution_id": str(execution_id),
                "workflow_status": execution.status.value,
                "progress_percent": round(progress, 2),
                "started_at": execution.started_at.isoformat() if execution.started_at else None,
                "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                "duration_seconds": execution.duration_seconds,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "failed_tasks": len([t for t in execution.task_executions if t.status == TaskStatus.FAILED]),
                "task_statuses": [
                    {
                        "task_id": str(t.task_id),
                        "status": t.status.value,
                        "duration": t.duration_seconds,
                        "error": t.error_message
                    }
                    for t in execution.task_executions
                ]
            }

        except Exception as e:
            logger.error(f"Failed to get execution status: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def pause_workflow(self, execution_id: UUID) -> Dict[str, Any]:
        """Pause workflow execution"""
        try:
            if execution_id not in self.executions:
                return {
                    "status": "not_found",
                    "error": f"Execution {execution_id} not found"
                }

            execution = self.executions[execution_id]
            if execution.status != WorkflowStatus.RUNNING:
                return {
                    "status": "failed",
                    "error": f"Cannot pause workflow in {execution.status.value} state"
                }

            execution.status = WorkflowStatus.PAUSED

            logger.info(f"Workflow execution paused: {execution_id}")
            return {
                "status": "success",
                "execution_id": str(execution_id),
                "workflow_status": execution.status.value
            }

        except Exception as e:
            logger.error(f"Failed to pause workflow: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def resume_workflow(self, execution_id: UUID) -> Dict[str, Any]:
        """Resume paused workflow execution"""
        try:
            if execution_id not in self.executions:
                return {
                    "status": "not_found",
                    "error": f"Execution {execution_id} not found"
                }

            execution = self.executions[execution_id]
            if execution.status != WorkflowStatus.PAUSED:
                return {
                    "status": "failed",
                    "error": f"Cannot resume workflow in {execution.status.value} state"
                }

            execution.status = WorkflowStatus.RUNNING

            # Re-add to execution queue
            await self.execution_queue.put(execution_id)

            logger.info(f"Workflow execution resumed: {execution_id}")
            return {
                "status": "success",
                "execution_id": str(execution_id),
                "workflow_status": execution.status.value
            }

        except Exception as e:
            logger.error(f"Failed to resume workflow: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def cancel_workflow(self, execution_id: UUID) -> Dict[str, Any]:
        """Cancel workflow execution"""
        try:
            if execution_id not in self.executions:
                return {
                    "status": "not_found",
                    "error": f"Execution {execution_id} not found"
                }

            execution = self.executions[execution_id]
            execution.status = WorkflowStatus.CANCELLED
            execution.completed_at = datetime.now()

            if execution.started_at:
                execution.duration_seconds = (execution.completed_at - execution.started_at).total_seconds()

            # Remove from active executions
            self.active_executions.discard(execution_id)

            logger.info(f"Workflow execution cancelled: {execution_id}")
            return {
                "status": "success",
                "execution_id": str(execution_id),
                "workflow_status": execution.status.value
            }

        except Exception as e:
            logger.error(f"Failed to cancel workflow: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def create_template(self, template: WorkflowTemplate) -> Dict[str, Any]:
        """Create a reusable workflow template"""
        try:
            logger.info(f"Creating workflow template: {template.name}")

            # Validate template
            if not template.workflow_definition:
                return {
                    "status": "failed",
                    "error": "Template must include a workflow definition"
                }

            # Store template
            self.templates[template.id] = template

            logger.info(f"Workflow template created: {template.id}")
            return {
                "status": "success",
                "template_id": str(template.id),
                "template": template
            }

        except Exception as e:
            logger.error(f"Failed to create template: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def list_templates(self, category: str = None, public_only: bool = False) -> Dict[str, Any]:
        """List available workflow templates"""
        try:
            templates = []

            for template in self.templates.values():
                if category and template.category != category:
                    continue
                if public_only and not template.public:
                    continue

                templates.append({
                    "id": str(template.id),
                    "name": template.name,
                    "description": template.description,
                    "category": template.category,
                    "use_count": template.use_count,
                    "rating": template.rating,
                    "created_at": template.created_at.isoformat(),
                    "public": template.public
                })

            return {
                "status": "success",
                "templates": templates,
                "total": len(templates)
            }

        except Exception as e:
            logger.error(f"Failed to list templates: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def create_workflow_from_template(
        self, template_id: UUID, parameters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create workflow from template"""
        try:
            if template_id not in self.templates:
                return {
                    "status": "failed",
                    "error": f"Template {template_id} not found"
                }

            template = self.templates[template_id]

            # Clone workflow definition
            workflow_def = WorkflowDefinition(
                name=f"{template.name} - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                description=template.workflow_definition.description,
                tasks=template.workflow_definition.tasks.copy(),
                execution_strategy=template.workflow_definition.execution_strategy,
                timeout_seconds=template.workflow_definition.timeout_seconds,
                max_parallel_tasks=template.workflow_definition.max_parallel_tasks,
                auto_retry=template.workflow_definition.auto_retry,
                metadata=template.workflow_definition.metadata.copy()
            )

            # Apply parameters if provided
            if parameters:
                workflow_def = await self._apply_template_parameters(workflow_def, parameters)

            # Create workflow
            result = await self.create_workflow(workflow_def)

            if result["status"] == "success":
                # Increment template use count
                template.use_count += 1

            return result

        except Exception as e:
            logger.error(f"Failed to create workflow from template: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def get_workflow_analytics(self, workflow_id: UUID = None, days: int = 30) -> Dict[str, Any]:
        """Get workflow execution analytics"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            # Filter executions by date and workflow
            relevant_executions = []
            for execution in self.executions.values():
                if execution.started_at and execution.started_at >= start_date:
                    if workflow_id is None or execution.workflow_id == workflow_id:
                        relevant_executions.append(execution)

            # Calculate analytics
            total_executions = len(relevant_executions)
            successful_executions = len([e for e in relevant_executions if e.status == WorkflowStatus.COMPLETED])
            failed_executions = len([e for e in relevant_executions if e.status == WorkflowStatus.FAILED])

            success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0

            # Average execution time
            completed_executions = [e for e in relevant_executions if e.duration_seconds is not None]
            avg_execution_time = (
                sum(e.duration_seconds for e in completed_executions) / len(completed_executions)
                if completed_executions else 0
            )

            # Most common failure reasons
            failure_reasons = {}
            for execution in relevant_executions:
                if execution.status == WorkflowStatus.FAILED and execution.error_message:
                    reason = execution.error_message[:100]  # First 100 chars
                    failure_reasons[reason] = failure_reasons.get(reason, 0) + 1

            return {
                "status": "success",
                "analytics": {
                    "period_days": days,
                    "total_executions": total_executions,
                    "successful_executions": successful_executions,
                    "failed_executions": failed_executions,
                    "success_rate_percent": round(success_rate, 2),
                    "average_execution_time_seconds": round(avg_execution_time, 2),
                    "most_common_failures": sorted(
                        failure_reasons.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:5]
                }
            }

        except Exception as e:
            logger.error(f"Failed to get workflow analytics: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def ai_optimize_workflow(self, workflow_id: UUID) -> Dict[str, Any]:
        """Use AI to optimize workflow performance"""
        try:
            if workflow_id not in self.workflows:
                return {
                    "status": "failed",
                    "error": f"Workflow {workflow_id} not found"
                }

            workflow = self.workflows[workflow_id]

            # Get execution history for analysis
            executions = [e for e in self.executions.values() if e.workflow_id == workflow_id]

            # Prepare data for AI analysis
            analysis_data = {
                "workflow_definition": workflow,
                "execution_history": executions,
                "performance_metrics": await self._calculate_performance_metrics(executions)
            }

            # AI-powered optimization suggestions
            optimization_prompt = PromptTemplate(
                name="workflow_optimization",
                description="Analyze workflow performance and provide optimization recommendations",
                template="""
                Analyze the workflow definition and execution history to provide optimization recommendations.

                Workflow: {workflow_name}
                Tasks: {task_count}
                Average Execution Time: {avg_time}s
                Success Rate: {success_rate}%

                Common Issues:
                {common_issues}

                Provide specific recommendations for:
                1. Task parallelization opportunities
                2. Dependency optimization
                3. Resource allocation improvements
                4. Error handling enhancements
                5. Performance bottlenecks

                Format as JSON with actionable recommendations.
                """,
                required_vars=["workflow_name", "task_count", "avg_time", "success_rate", "common_issues"]
            )

            llm_request = LLMRequest(
                prompt=optimization_prompt.template,
                template_vars={
                    "workflow_name": workflow.name,
                    "task_count": len(workflow.tasks),
                    "avg_time": analysis_data["performance_metrics"].get("avg_execution_time", 0),
                    "success_rate": analysis_data["performance_metrics"].get("success_rate", 0),
                    "common_issues": str(analysis_data["performance_metrics"].get("common_failures", []))
                },
                model_size=ModelSize.LARGE,
                temperature=0.3,
                max_tokens=2000
            )

            ai_response = await llm_service.process_request(llm_request)

            try:
                optimization_suggestions = json.loads(ai_response.content)
            except json.JSONDecodeError:
                optimization_suggestions = {"suggestions": ai_response.content}

            return {
                "status": "success",
                "workflow_id": str(workflow_id),
                "optimization_suggestions": optimization_suggestions,
                "performance_metrics": analysis_data["performance_metrics"]
            }

        except Exception as e:
            logger.error(f"Failed to optimize workflow: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    async def health_check(self) -> Dict[str, Any]:
        """Service health check"""
        try:
            return {
                "service_name": "workflow_orchestration",
                "status": "healthy",
                "active_workflows": len(self.active_executions),
                "total_workflows": len(self.workflows),
                "total_executions": len(self.executions),
                "templates_available": len(self.templates),
                "workers_running": self.workers_running,
                "queue_size": self.execution_queue.qsize(),
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {
                "service_name": "workflow_orchestration",
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    # Private helper methods

    async def _validate_workflow_definition(self, definition: WorkflowDefinition) -> Dict[str, Any]:
        """Validate workflow definition"""
        errors = []

        if not definition.name:
            errors.append("Workflow name is required")

        if not definition.tasks:
            errors.append("Workflow must have at least one task")

        # Validate task dependencies
        task_ids = {task.id for task in definition.tasks}
        for task in definition.tasks:
            for dep_id in task.dependencies:
                if dep_id not in task_ids:
                    errors.append(f"Task {task.name} depends on non-existent task {dep_id}")

        # Check for circular dependencies
        if self._has_circular_dependencies(definition.tasks):
            errors.append("Circular dependencies detected in workflow")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def _has_circular_dependencies(self, tasks: List[TaskDefinition]) -> bool:
        """Check for circular dependencies in task list"""
        # Implementation of circular dependency detection
        # Using topological sort approach
        task_deps = {task.id: set(task.dependencies) for task in tasks}
        visited = set()
        rec_stack = set()

        def has_cycle(task_id):
            if task_id in rec_stack:
                return True
            if task_id in visited:
                return False

            visited.add(task_id)
            rec_stack.add(task_id)

            for dep_id in task_deps.get(task_id, set()):
                if has_cycle(dep_id):
                    return True

            rec_stack.remove(task_id)
            return False

        for task_id in task_deps:
            if task_id not in visited:
                if has_cycle(task_id):
                    return True

        return False

    async def _optimize_workflow_definition(self, definition: WorkflowDefinition) -> WorkflowDefinition:
        """AI-powered workflow definition optimization"""
        try:
            # AI optimization logic would go here
            # For now, return the original definition
            return definition
        except Exception as e:
            logger.warning(f"Workflow optimization failed, using original: {str(e)}")
            return definition

    async def _start_execution_workers(self):
        """Start workflow execution workers"""
        if self.workers_running:
            return

        self.workers_running = True

        # Start multiple workers for parallel execution
        workers = []
        for i in range(3):  # 3 worker tasks
            worker = asyncio.create_task(self._execution_worker(f"worker-{i}"))
            workers.append(worker)

        logger.info("Workflow execution workers started")

    async def _execution_worker(self, worker_name: str):
        """Worker that processes workflow executions"""
        logger.info(f"Starting execution worker: {worker_name}")

        while self.workers_running:
            try:
                # Get execution from queue with timeout
                execution_id = await asyncio.wait_for(
                    self.execution_queue.get(),
                    timeout=1.0
                )

                await self._process_workflow_execution(execution_id)

            except asyncio.TimeoutError:
                # No work available, continue
                continue
            except Exception as e:
                logger.error(f"Worker {worker_name} error: {str(e)}")

    async def _process_workflow_execution(self, execution_id: UUID):
        """Process a single workflow execution"""
        try:
            if execution_id not in self.executions:
                return

            execution = self.executions[execution_id]
            workflow = self.workflows[execution.workflow_id]

            logger.info(f"Processing workflow execution: {execution_id}")

            # Execute workflow based on strategy
            if workflow.execution_strategy == ExecutionStrategy.SEQUENTIAL:
                await self._execute_sequential_workflow(execution, workflow)
            elif workflow.execution_strategy == ExecutionStrategy.PARALLEL:
                await self._execute_parallel_workflow(execution, workflow)
            elif workflow.execution_strategy == ExecutionStrategy.ADAPTIVE:
                await self._execute_adaptive_workflow(execution, workflow)
            else:
                await self._execute_sequential_workflow(execution, workflow)

            # Update execution status
            if execution.status == WorkflowStatus.RUNNING:
                all_completed = all(
                    t.status in [TaskStatus.COMPLETED, TaskStatus.SKIPPED]
                    for t in execution.task_executions
                )
                any_failed = any(
                    t.status == TaskStatus.FAILED
                    for t in execution.task_executions
                )

                if any_failed:
                    execution.status = WorkflowStatus.FAILED
                elif all_completed:
                    execution.status = WorkflowStatus.COMPLETED

                execution.completed_at = datetime.now()
                if execution.started_at:
                    execution.duration_seconds = (execution.completed_at - execution.started_at).total_seconds()

            # Remove from active executions
            self.active_executions.discard(execution_id)

            logger.info(f"Workflow execution completed: {execution_id} - {execution.status.value}")

        except Exception as e:
            logger.error(f"Failed to process workflow execution {execution_id}: {str(e)}")
            if execution_id in self.executions:
                execution = self.executions[execution_id]
                execution.status = WorkflowStatus.FAILED
                execution.error_message = str(e)
                execution.completed_at = datetime.now()
                self.active_executions.discard(execution_id)

    async def _execute_sequential_workflow(self, execution: WorkflowExecution, workflow: WorkflowDefinition):
        """Execute workflow tasks sequentially"""
        for task_def in workflow.tasks:
            if execution.status != WorkflowStatus.RUNNING:
                break

            task_exec = next((t for t in execution.task_executions if t.task_id == task_def.id), None)
            if not task_exec:
                continue

            # Check dependencies
            if not await self._check_task_dependencies(task_def, execution):
                task_exec.status = TaskStatus.WAITING
                continue

            # Execute task
            await self._execute_task(task_def, task_exec, execution)

    async def _execute_parallel_workflow(self, execution: WorkflowExecution, workflow: WorkflowDefinition):
        """Execute workflow tasks in parallel where possible"""
        tasks_to_run = []

        for task_def in workflow.tasks:
            if execution.status != WorkflowStatus.RUNNING:
                break

            task_exec = next((t for t in execution.task_executions if t.task_id == task_def.id), None)
            if not task_exec:
                continue

            # Check dependencies
            if await self._check_task_dependencies(task_def, execution):
                tasks_to_run.append((task_def, task_exec))

        # Execute ready tasks in parallel
        if tasks_to_run:
            await asyncio.gather(
                *[self._execute_task(task_def, task_exec, execution)
                  for task_def, task_exec in tasks_to_run],
                return_exceptions=True
            )

    async def _execute_adaptive_workflow(self, execution: WorkflowExecution, workflow: WorkflowDefinition):
        """Execute workflow with adaptive strategy"""
        # Start with parallel execution of ready tasks
        await self._execute_parallel_workflow(execution, workflow)

    async def _check_task_dependencies(self, task_def: TaskDefinition, execution: WorkflowExecution) -> bool:
        """Check if task dependencies are satisfied"""
        for dep_id in task_def.dependencies:
            dep_exec = next((t for t in execution.task_executions if t.task_id == dep_id), None)
            if not dep_exec or dep_exec.status != TaskStatus.COMPLETED:
                return False
        return True

    async def _execute_task(self, task_def: TaskDefinition, task_exec: TaskExecution, execution: WorkflowExecution):
        """Execute a single task"""
        try:
            logger.info(f"Executing task: {task_def.name}")

            task_exec.status = TaskStatus.RUNNING
            task_exec.started_at = datetime.now()

            # Get task handler
            handler = self.task_registry.get(task_def.type.value)
            if not handler:
                raise ValueError(f"No handler registered for task type: {task_def.type.value}")

            # Execute task with timeout
            result = await asyncio.wait_for(
                handler(task_def, execution.context),
                timeout=task_def.timeout_seconds
            )

            task_exec.status = TaskStatus.COMPLETED
            task_exec.result = result
            task_exec.completed_at = datetime.now()

            if task_exec.started_at:
                task_exec.duration_seconds = (task_exec.completed_at - task_exec.started_at).total_seconds()

            logger.info(f"Task completed: {task_def.name}")

        except asyncio.TimeoutError:
            task_exec.status = TaskStatus.FAILED
            task_exec.error_message = f"Task timed out after {task_def.timeout_seconds} seconds"
            logger.error(f"Task timed out: {task_def.name}")

        except Exception as e:
            task_exec.status = TaskStatus.FAILED
            task_exec.error_message = str(e)
            logger.error(f"Task failed: {task_def.name} - {str(e)}")

            # Handle retry logic
            if task_exec.retry_count < task_def.max_retries:
                await self._retry_task(task_def, task_exec, execution)

    async def _retry_task(self, task_def: TaskDefinition, task_exec: TaskExecution, execution: WorkflowExecution):
        """Retry a failed task"""
        task_exec.retry_count += 1
        task_exec.status = TaskStatus.RETRYING

        # Calculate retry delay based on strategy
        delay = self._calculate_retry_delay(task_def.retry_strategy, task_exec.retry_count)

        logger.info(f"Retrying task {task_def.name} in {delay} seconds (attempt {task_exec.retry_count})")

        await asyncio.sleep(delay)
        await self._execute_task(task_def, task_exec, execution)

    def _calculate_retry_delay(self, strategy: RetryStrategy, attempt: int) -> float:
        """Calculate retry delay based on strategy"""
        if strategy == RetryStrategy.FIXED_DELAY:
            return 5.0
        elif strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            return min(30.0, 2 ** attempt)
        elif strategy == RetryStrategy.LINEAR_BACKOFF:
            return min(30.0, attempt * 2)
        else:
            return 5.0

    # Built-in task handlers

    async def _execute_code_generation_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute code generation task"""
        # Integration with code generation service would go here
        return {"status": "completed", "generated_code": "# Generated code here"}

    async def _execute_deployment_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute infrastructure deployment task"""
        # Integration with deployment service would go here
        return {"status": "completed", "deployment_id": str(uuid4())}

    async def _execute_monitoring_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute monitoring setup task"""
        # Integration with monitoring service would go here
        return {"status": "completed", "monitoring_id": str(uuid4())}

    async def _execute_data_processing_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute data processing task"""
        # Custom data processing logic would go here
        return {"status": "completed", "processed_records": 100}

    async def _execute_api_call_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute API call task"""
        # HTTP API call logic would go here
        return {"status": "completed", "response_code": 200}

    async def _execute_condition_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute conditional logic task"""
        # Conditional evaluation logic would go here
        return {"status": "completed", "condition_result": True}

    async def _execute_loop_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute loop task"""
        # Loop execution logic would go here
        return {"status": "completed", "iterations": 5}

    async def _execute_parallel_task(self, task_def: TaskDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute parallel task container"""
        # Parallel task coordination logic would go here
        return {"status": "completed", "parallel_results": []}

    async def _apply_template_parameters(
        self, workflow_def: WorkflowDefinition, parameters: Dict[str, Any]
    ) -> WorkflowDefinition:
        """Apply template parameters to workflow definition"""
        # Parameter substitution logic would go here
        return workflow_def

    async def _calculate_performance_metrics(self, executions: List[WorkflowExecution]) -> Dict[str, Any]:
        """Calculate performance metrics from execution history"""
        if not executions:
            return {}

        total = len(executions)
        successful = len([e for e in executions if e.status == WorkflowStatus.COMPLETED])

        success_rate = (successful / total * 100) if total > 0 else 0

        completed_executions = [e for e in executions if e.duration_seconds is not None]
        avg_execution_time = (
            sum(e.duration_seconds for e in completed_executions) / len(completed_executions)
            if completed_executions else 0
        )

        common_failures = {}
        for execution in executions:
            if execution.status == WorkflowStatus.FAILED and execution.error_message:
                reason = execution.error_message[:50]
                common_failures[reason] = common_failures.get(reason, 0) + 1

        return {
            "total_executions": total,
            "success_rate": success_rate,
            "avg_execution_time": avg_execution_time,
            "common_failures": list(common_failures.items())
        }


# Global service instance
workflow_orchestration_service = WorkflowOrchestrationService()
