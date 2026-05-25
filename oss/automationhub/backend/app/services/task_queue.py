"""
Task Queue Service - Multi-Agent Task Execution
Implements task queue system for coordinating multiple agents
"""

import asyncio
import logging
import uuid
from typing import Dict, List, Optional, Any, Callable, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import json
import traceback

from pydantic import BaseModel, Field
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

class TaskStatus(str, Enum):
    """Task execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRY = "retry"

class TaskPriority(str, Enum):
    """Task priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

class AgentType(str, Enum):
    """Types of agents available"""
    LLM_AGENT = "llm_agent"
    CODE_AGENT = "code_agent"
    BROWSER_AGENT = "browser_agent"
    WORKFLOW_AGENT = "workflow_agent"
    ANALYSIS_AGENT = "analysis_agent"
    GENERIC_AGENT = "generic_agent"

@dataclass
class TaskResult:
    """Task execution result"""
    task_id: str
    status: TaskStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time: float = 0.0
    agent_id: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

class Task(BaseModel):
    """Task definition"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    agent_type: AgentType
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    max_retries: int = 3
    timeout: int = 300  # 5 minutes
    dependencies: List[str] = Field(default_factory=list)  # Task IDs this task depends on
    callback_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    scheduled_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class Agent(BaseModel):
    """Agent definition"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: AgentType
    name: str
    description: str
    capabilities: List[str] = Field(default_factory=list)
    max_concurrent_tasks: int = 1
    current_tasks: int = 0
    status: str = "idle"  # idle, busy, offline
    last_heartbeat: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class TaskExecutionContext(BaseModel):
    """Context for task execution"""
    task: Task
    agent: Agent
    attempt: int = 1
    start_time: datetime = Field(default_factory=datetime.now)
    shared_data: Dict[str, Any] = Field(default_factory=dict)

class TaskQueue:
    """
    Task queue system for multi-agent coordination
    Provides task distribution, execution tracking, and result aggregation
    """

    def __init__(self):
        self.redis_client = None
        self.agents: Dict[str, Agent] = {}
        self.task_handlers: Dict[AgentType, Callable] = {}
        self.running_tasks: Dict[str, TaskExecutionContext] = {}
        self.task_results: Dict[str, TaskResult] = {}

        # Initialize Redis for task persistence
        self._initialize_redis()
        self._register_default_handlers()

    def _initialize_redis(self):
        """Initialize Redis client for task persistence"""
        try:
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/1')
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Redis task queue initialized successfully")
        except Exception as e:
            logger.warning(f"Redis task queue initialization failed: {e}")
            self.redis_client = None

    def _register_default_handlers(self):
        """Register default task handlers for each agent type"""
        self.task_handlers = {
            AgentType.LLM_AGENT: self._handle_llm_task,
            AgentType.CODE_AGENT: self._handle_code_task,
            AgentType.BROWSER_AGENT: self._handle_browser_task,
            AgentType.WORKFLOW_AGENT: self._handle_workflow_task,
            AgentType.ANALYSIS_AGENT: self._handle_analysis_task,
            AgentType.GENERIC_AGENT: self._handle_generic_task
        }

    async def register_agent(self, agent: Agent) -> bool:
        """Register a new agent with the task queue"""
        try:
            self.agents[agent.id] = agent

            # Persist to Redis if available
            if self.redis_client:
                self.redis_client.hset(
                    "agents",
                    agent.id,
                    json.dumps(agent.model_dump(), default=str)
                )

            logger.info(f"Agent registered: {agent.name} ({agent.type})")
            return True

        except Exception as e:
            logger.error(f"Failed to register agent {agent.name}: {e}")
            return False

    async def submit_task(self, task: Task) -> str:
        """Submit a task to the queue"""
        try:
            # Validate dependencies
            if not await self._validate_dependencies(task.dependencies):
                raise ValueError("Invalid task dependencies")

            # Store task
            self.task_results[task.id] = TaskResult(
                task_id=task.id,
                status=TaskStatus.PENDING
            )

            # Persist to Redis if available
            if self.redis_client:
                self.redis_client.lpush(
                    f"task_queue_{task.priority.value}",
                    json.dumps(task.model_dump(), default=str)
                )
                self.redis_client.hset(
                    "task_results",
                    task.id,
                    json.dumps(asdict(self.task_results[task.id]), default=str)
                )

            logger.info(f"Task submitted: {task.name} ({task.id})")

            # Try to execute immediately if agent is available
            await self._try_execute_pending_tasks()

            return task.id

        except Exception as e:
            logger.error(f"Failed to submit task {task.name}: {e}")
            raise

    async def execute_task(self, task_id: str) -> TaskResult:
        """Execute a specific task"""
        if task_id not in self.task_results:
            raise ValueError(f"Task {task_id} not found")

        # Find suitable agent
        task_data = await self._get_task_from_queue(task_id)
        if not task_data:
            raise ValueError(f"Task {task_id} data not found")

        task = Task(**task_data)
        agent = await self._find_suitable_agent(task.agent_type)

        if not agent:
            self.task_results[task_id].status = TaskStatus.FAILED
            self.task_results[task_id].error = "No suitable agent available"
            return self.task_results[task_id]

        # Execute task
        return await self._execute_task_with_agent(task, agent)

    async def _execute_task_with_agent(self, task: Task, agent: Agent) -> TaskResult:
        """Execute task with specific agent"""
        context = TaskExecutionContext(task=task, agent=agent)
        self.running_tasks[task.id] = context

        try:
            # Update task status
            self.task_results[task.id].status = TaskStatus.RUNNING

            # Mark agent as busy
            agent.current_tasks += 1
            agent.status = "busy"

            # Execute task handler
            start_time = datetime.now()
            handler = self.task_handlers.get(task.agent_type, self._handle_generic_task)

            result = await asyncio.wait_for(
                handler(context),
                timeout=task.timeout
            )

            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()

            # Update result
            self.task_results[task.id].status = TaskStatus.COMPLETED
            self.task_results[task.id].result = result
            self.task_results[task.id].execution_time = execution_time
            self.task_results[task.id].agent_id = agent.id

            logger.info(f"Task completed: {task.name} in {execution_time:.2f}s")

        except asyncio.TimeoutError:
            self.task_results[task.id].status = TaskStatus.FAILED
            self.task_results[task.id].error = f"Task timeout after {task.timeout}s"
            logger.error(f"Task timeout: {task.name}")

        except Exception as e:
            self.task_results[task.id].status = TaskStatus.FAILED
            self.task_results[task.id].error = str(e)
            self.task_results[task.id].metadata["traceback"] = traceback.format_exc()
            logger.error(f"Task failed: {task.name} - {e}")

        finally:
            # Clean up
            agent.current_tasks = max(0, agent.current_tasks - 1)
            if agent.current_tasks == 0:
                agent.status = "idle"

            if task.id in self.running_tasks:
                del self.running_tasks[task.id]

            # Persist result
            if self.redis_client:
                self.redis_client.hset(
                    "task_results",
                    task.id,
                    json.dumps(asdict(self.task_results[task.id]), default=str)
                )

        return self.task_results[task.id]

    async def _try_execute_pending_tasks(self):
        """Try to execute pending tasks with available agents"""
        try:
            if not self.redis_client:
                return

            # Process tasks by priority
            for priority in [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.NORMAL, TaskPriority.LOW]:
                queue_key = f"task_queue_{priority.value}"

                # Get pending tasks
                task_data = self.redis_client.rpop(queue_key)
                if task_data:
                    task_dict = json.loads(task_data)
                    task = Task(**task_dict)

                    # Check if dependencies are met
                    if await self._dependencies_met(task.dependencies):
                        # Find suitable agent
                        agent = await self._find_suitable_agent(task.agent_type)
                        if agent:
                            # Execute in background
                            asyncio.create_task(self._execute_task_with_agent(task, agent))
                        else:
                            # Put back in queue
                            self.redis_client.lpush(queue_key, task_data)

        except Exception as e:
            logger.error(f"Error processing pending tasks: {e}")

    async def _find_suitable_agent(self, agent_type: AgentType) -> Optional[Agent]:
        """Find available agent of specified type"""
        for agent in self.agents.values():
            if (agent.type == agent_type and
                agent.status in ["idle", "busy"] and
                agent.current_tasks < agent.max_concurrent_tasks):
                return agent
        return None

    async def _validate_dependencies(self, dependencies: List[str]) -> bool:
        """Validate that all dependencies exist"""
        for dep_id in dependencies:
            if dep_id not in self.task_results:
                return False
        return True

    async def _dependencies_met(self, dependencies: List[str]) -> bool:
        """Check if all dependencies are completed"""
        for dep_id in dependencies:
            if (dep_id not in self.task_results or
                self.task_results[dep_id].status != TaskStatus.COMPLETED):
                return False
        return True

    async def _get_task_from_queue(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task data from storage"""
        # This is a simplified implementation
        # In a real system, you'd search through the queues
        return None

    # Task Handlers
    async def _handle_llm_task(self, context: TaskExecutionContext) -> Dict[str, Any]:
        """Handle LLM agent tasks"""
        # Import here to avoid circular imports
        from app.services.llm_service import llm_service, LLMRequest

        task = context.task
        payload = task.payload

        # Create LLM request from task payload
        llm_request = LLMRequest(
            prompt=payload.get("prompt", ""),
            template_name=payload.get("template_name"),
            template_vars=payload.get("template_vars", {}),
            model_size=payload.get("model_size", "medium"),
            temperature=payload.get("temperature"),
            max_tokens=payload.get("max_tokens"),
            use_cache=payload.get("use_cache", True)
        )

        # Execute LLM request
        response = await llm_service.generate_completion(llm_request)

        return {
            "content": response.content,
            "model": response.model,
            "tokens_used": response.tokens_used,
            "cost_estimate": response.cost_estimate,
            "processing_time": response.processing_time,
            "cached": response.cached
        }

    async def _handle_code_task(self, context: TaskExecutionContext) -> Dict[str, Any]:
        """Handle code generation tasks"""
        from app.services.code_generation import code_generation_service

        task = context.task
        payload = task.payload

        # Generate code based on task requirements
        result = await code_generation_service.generate_code(
            description=payload.get("description", ""),
            code_type=payload.get("code_type", "python"),
            complexity=payload.get("complexity", "intermediate"),
            requirements=payload.get("requirements", [])
        )

        return {
            "generated_code": result.get("code", ""),
            "language": result.get("language", ""),
            "dependencies": result.get("dependencies", []),
            "description": result.get("description", "")
        }

    async def _handle_browser_task(self, context: TaskExecutionContext) -> Dict[str, Any]:
        """Handle browser automation tasks"""
        # Placeholder for browser automation
        task = context.task
        payload = task.payload

        return {
            "action": payload.get("action", "navigate"),
            "url": payload.get("url", ""),
            "status": "simulated",
            "message": "Browser task executed (simulated)"
        }

    async def _handle_workflow_task(self, context: TaskExecutionContext) -> Dict[str, Any]:
        """Handle workflow orchestration tasks"""
        task = context.task
        payload = task.payload

        # Simulate workflow execution
        steps = payload.get("steps", [])
        results = []

        for i, step in enumerate(steps):
            results.append({
                "step": i + 1,
                "action": step.get("action", "unknown"),
                "status": "completed",
                "duration": 0.1
            })

        return {
            "workflow_name": payload.get("name", "unnamed"),
            "steps_executed": len(results),
            "results": results,
            "total_duration": sum(r["duration"] for r in results)
        }

    async def _handle_analysis_task(self, context: TaskExecutionContext) -> Dict[str, Any]:
        """Handle data analysis tasks"""
        task = context.task
        payload = task.payload

        return {
            "analysis_type": payload.get("type", "general"),
            "data_points": payload.get("data_points", 0),
            "insights": ["Analysis completed", "Data processed successfully"],
            "confidence": 0.85
        }

    async def _handle_generic_task(self, context: TaskExecutionContext) -> Dict[str, Any]:
        """Handle generic tasks"""
        task = context.task

        return {
            "task_id": task.id,
            "task_name": task.name,
            "status": "completed",
            "message": "Generic task executed successfully"
        }

    # Status and Monitoring Methods
    async def get_task_status(self, task_id: str) -> Optional[TaskResult]:
        """Get current task status"""
        return self.task_results.get(task_id)

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending or running task"""
        try:
            if task_id in self.task_results:
                result = self.task_results[task_id]
                if result.status in [TaskStatus.PENDING, TaskStatus.RUNNING]:
                    result.status = TaskStatus.CANCELLED

                    # Remove from running tasks
                    if task_id in self.running_tasks:
                        # In a real implementation, you'd need to interrupt the task
                        del self.running_tasks[task_id]

                    logger.info(f"Task cancelled: {task_id}")
                    return True

            return False

        except Exception as e:
            logger.error(f"Failed to cancel task {task_id}: {e}")
            return False

    async def get_agent_status(self) -> List[Dict[str, Any]]:
        """Get status of all registered agents"""
        return [
            {
                "id": agent.id,
                "name": agent.name,
                "type": agent.type.value,
                "status": agent.status,
                "current_tasks": agent.current_tasks,
                "max_concurrent": agent.max_concurrent_tasks,
                "capabilities": agent.capabilities,
                "last_heartbeat": agent.last_heartbeat.isoformat()
            }
            for agent in self.agents.values()
        ]

    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get task queue statistics"""
        stats = {
            "total_agents": len(self.agents),
            "running_tasks": len(self.running_tasks),
            "completed_tasks": len([r for r in self.task_results.values() if r.status == TaskStatus.COMPLETED]),
            "failed_tasks": len([r for r in self.task_results.values() if r.status == TaskStatus.FAILED]),
            "pending_tasks": 0,
            "queue_by_priority": {}
        }

        # Get queue lengths from Redis
        if self.redis_client:
            for priority in TaskPriority:
                queue_key = f"task_queue_{priority.value}"
                queue_length = self.redis_client.llen(queue_key)
                stats["queue_by_priority"][priority.value] = queue_length
                stats["pending_tasks"] += queue_length

        return stats

    async def health_check(self) -> Dict[str, Any]:
        """Health check for task queue service"""
        return {
            "service": "healthy",
            "redis_available": self.redis_client is not None,
            "total_agents": len(self.agents),
            "active_agents": len([a for a in self.agents.values() if a.status != "offline"]),
            "running_tasks": len(self.running_tasks),
            "timestamp": datetime.now().isoformat()
        }

# Global task queue instance
task_queue = TaskQueue()