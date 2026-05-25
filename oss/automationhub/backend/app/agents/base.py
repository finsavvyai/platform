"""
Base UPMAgent class and core agent system implementation.

This module provides the foundational agent framework for UPM.Plus,
implementing the multi-agent collaboration patterns from the design specification.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Task execution status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentStatus(str, Enum):
    """Agent status enumeration."""
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"


class HealthStatus(str, Enum):
    """Agent health status enumeration."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class TaskType(str, Enum):
    """Task type enumeration."""
    BROWSER_AUTOMATION = "browser_automation"
    INFRASTRUCTURE = "infrastructure"
    CONVERSATION = "conversation"
    DATA_PROCESSING = "data_processing"
    WORKFLOW = "workflow"
    CUSTOM = "custom"


class ExecutionStep(BaseModel):
    """Individual execution step within a task."""
    step_id: UUID = Field(default_factory=uuid4)
    action: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


class TaskResult(BaseModel):
    """Result of task execution."""
    task_id: UUID
    status: TaskStatus
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_steps: List[ExecutionStep] = Field(default_factory=list)
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Task(BaseModel):
    """Task definition for agent execution."""
    id: UUID = Field(default_factory=uuid4)
    type: TaskType
    name: str
    description: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    dependencies: List[UUID] = Field(default_factory=list)
    priority: int = Field(default=5, ge=1, le=10)  # 1=highest, 10=lowest
    timeout_seconds: Optional[int] = None
    retry_count: int = Field(default=0, ge=0)
    max_retries: int = Field(default=3, ge=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    assigned_agent_id: Optional[UUID] = None


class ExecutionContext(BaseModel):
    """Context information for task execution."""
    user_id: Optional[UUID] = None
    organization_id: Optional[UUID] = None
    workflow_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    environment: Dict[str, Any] = Field(default_factory=dict)
    security_context: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Capability(BaseModel):
    """Agent capability definition."""
    name: str
    description: str
    version: str = "1.0.0"
    parameters: Dict[str, Any] = Field(default_factory=dict)
    required_tools: List[str] = Field(default_factory=list)
    supported_task_types: List[TaskType] = Field(default_factory=list)


class PerformanceMetrics(BaseModel):
    """Agent performance metrics."""
    tasks_completed: int = 0
    tasks_failed: int = 0
    average_execution_time_ms: float = 0.0
    success_rate: float = 0.0
    last_activity: Optional[datetime] = None
    uptime_seconds: int = 0


class LLMConfig(BaseModel):
    """LLM configuration for agents."""
    provider: str = "openai"
    model: str = "gpt-4"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    additional_params: Dict[str, Any] = Field(default_factory=dict)


class ConversationMemory(BaseModel):
    """Agent conversation memory."""
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)
    max_messages: int = Field(default=100, ge=1)
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict[str, Any]] = None):
        """Add a message to conversation memory."""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        self.messages.append(message)
        
        # Trim messages if exceeding max_messages
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages:]
    
    def get_recent_messages(self, count: int = 10) -> List[Dict[str, Any]]:
        """Get recent messages from memory."""
        return self.messages[-count:] if count > 0 else self.messages


class ToolRegistry:
    """Registry for agent tools and capabilities."""
    
    def __init__(self):
        self._tools: Dict[str, Any] = {}
    
    def register_tool(self, name: str, tool: Any):
        """Register a tool with the agent."""
        self._tools[name] = tool
    
    def get_tool(self, name: str) -> Optional[Any]:
        """Get a registered tool by name."""
        return self._tools.get(name)
    
    def list_tools(self) -> List[str]:
        """List all registered tool names."""
        return list(self._tools.keys())
    
    def has_tool(self, name: str) -> bool:
        """Check if a tool is registered."""
        return name in self._tools


class CollaborationResult(BaseModel):
    """Result of agent collaboration."""
    collaboration_id: UUID = Field(default_factory=uuid4)
    participating_agents: List[UUID]
    objective: str
    result: Optional[Any] = None
    success: bool = False
    error: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    agent_contributions: Dict[UUID, Any] = Field(default_factory=dict)


class UPMAgent(ABC):
    """
    Base class for all UPM.Plus agents.
    
    Implements the core agent interface with capability management,
    task execution, collaboration, and learning capabilities.
    """
    
    def __init__(
        self,
        agent_id: Optional[UUID] = None,
        name: str = "UPMAgent",
        capabilities: Optional[List[Capability]] = None,
        llm_config: Optional[LLMConfig] = None,
        agent_type: Optional[str] = None
    ):
        self.id = agent_id or uuid4()
        self.name = name
        self.capabilities = capabilities or []
        self.llm_config = llm_config or LLMConfig()
        self.memory = ConversationMemory()
        self.tools = ToolRegistry()
        self.status = AgentStatus.IDLE
        self.performance_metrics = PerformanceMetrics()
        self.logger = logging.getLogger(f"{self.__class__.__name__}[{self.id}]")
        
        # Set agent type - use provided type or infer from class name
        if agent_type:
            self._agent_type = agent_type.lower()
        else:
            # Infer type from class name
            class_name = self.__class__.__name__.lower()
            if "browser" in class_name:
                self._agent_type = "browser"
            elif "conversational" in class_name or "conversation" in class_name:
                self._agent_type = "conversational"
            elif "infrastructure" in class_name:
                self._agent_type = "infrastructure"
            elif "data" in class_name:
                self._agent_type = "data"
            else:
                self._agent_type = "custom"
        
        # Initialize agent
        self._initialize()
    
    @property
    def type(self) -> str:
        """Get the agent type."""
        return self._agent_type
    
    def _initialize(self):
        """Initialize the agent with default tools and capabilities."""
        self.logger.info(f"Initializing agent {self.name} with ID {self.id}")
        self._register_default_tools()
        self._setup_capabilities()
    
    def _register_default_tools(self):
        """Register default tools available to all agents."""
        # This will be extended by specialized agents
        pass
    
    def _setup_capabilities(self):
        """Setup agent capabilities."""
        # This will be extended by specialized agents
        pass
    
    @abstractmethod
    async def execute_task(self, task: Task, context: ExecutionContext) -> TaskResult:
        """
        Execute a task with full context and error handling.
        
        Args:
            task: The task to execute
            context: Execution context with user, organization, and environment info
            
        Returns:
            TaskResult with execution details and results
        """
        pass
    
    async def can_handle_task(self, task: Task) -> bool:
        """
        Check if this agent can handle the given task.
        
        Args:
            task: The task to check
            
        Returns:
            True if the agent can handle the task, False otherwise
        """
        # Check if agent supports the task type
        for capability in self.capabilities:
            if task.type in capability.supported_task_types:
                return True
        return False
    
    async def collaborate(
        self, 
        other_agents: List['UPMAgent'], 
        objective: str,
        context: Optional[ExecutionContext] = None
    ) -> CollaborationResult:
        """
        Collaborate with other agents on complex objectives.
        
        Args:
            other_agents: List of other agents to collaborate with
            objective: The collaborative objective
            context: Optional execution context
            
        Returns:
            CollaborationResult with collaboration details and results
        """
        collaboration_id = uuid4()
        started_at = datetime.utcnow()
        
        self.logger.info(f"Starting collaboration {collaboration_id} with {len(other_agents)} agents")
        
        try:
            # This is a basic collaboration pattern
            # Specialized agents can override this for more complex collaboration
            participating_agents = [self.id] + [agent.id for agent in other_agents]
            
            # Simple coordination: each agent contributes based on their capabilities
            agent_contributions = {}
            
            # Self contribution
            self_contribution = await self._contribute_to_collaboration(objective, context)
            agent_contributions[self.id] = self_contribution
            
            # Other agents' contributions
            for agent in other_agents:
                try:
                    contribution = await agent._contribute_to_collaboration(objective, context)
                    agent_contributions[agent.id] = contribution
                except Exception as e:
                    self.logger.error(f"Agent {agent.id} failed to contribute: {e}")
                    agent_contributions[agent.id] = {"error": str(e)}
            
            # Aggregate results (basic implementation)
            result = self._aggregate_collaboration_results(agent_contributions)
            
            return CollaborationResult(
                collaboration_id=collaboration_id,
                participating_agents=participating_agents,
                objective=objective,
                result=result,
                success=True,
                started_at=started_at,
                completed_at=datetime.utcnow(),
                agent_contributions=agent_contributions
            )
            
        except Exception as e:
            self.logger.error(f"Collaboration {collaboration_id} failed: {e}")
            return CollaborationResult(
                collaboration_id=collaboration_id,
                participating_agents=[self.id] + [agent.id for agent in other_agents],
                objective=objective,
                success=False,
                error=str(e),
                started_at=started_at,
                completed_at=datetime.utcnow(),
                agent_contributions={}
            )
    
    async def _contribute_to_collaboration(
        self, 
        objective: str, 
        context: Optional[ExecutionContext] = None
    ) -> Dict[str, Any]:
        """
        Contribute to a collaborative effort.
        
        Args:
            objective: The collaborative objective
            context: Optional execution context
            
        Returns:
            Dictionary containing the agent's contribution
        """
        # Default implementation - specialized agents should override
        return {
            "agent_id": self.id,
            "agent_name": self.name,
            "capabilities": [cap.name for cap in self.capabilities],
            "contribution": f"Agent {self.name} acknowledges objective: {objective}"
        }
    
    def _aggregate_collaboration_results(self, contributions: Dict[UUID, Any]) -> Dict[str, Any]:
        """
        Aggregate collaboration results from all participating agents.
        
        Args:
            contributions: Dictionary of agent contributions
            
        Returns:
            Aggregated result
        """
        return {
            "total_agents": len(contributions),
            "successful_contributions": len([c for c in contributions.values() if "error" not in c]),
            "contributions": contributions
        }
    
    def learn_from_execution(self, execution_log: List[ExecutionStep]) -> None:
        """
        Learn and adapt from execution patterns.
        
        Args:
            execution_log: List of execution steps to learn from
        """
        self.logger.info(f"Learning from {len(execution_log)} execution steps")
        
        # Update performance metrics
        self.performance_metrics.last_activity = datetime.utcnow()
        
        # Basic learning implementation - can be extended by specialized agents
        for step in execution_log:
            if step.error:
                self.logger.warning(f"Learning from error in step {step.action}: {step.error}")
            else:
                self.logger.debug(f"Successful step: {step.action}")
    
    def update_performance_metrics(self, task_result: TaskResult):
        """
        Update agent performance metrics based on task execution.
        
        Args:
            task_result: The result of task execution
        """
        if task_result.status == TaskStatus.COMPLETED:
            self.performance_metrics.tasks_completed += 1
        elif task_result.status == TaskStatus.FAILED:
            self.performance_metrics.tasks_failed += 1
        
        # Update success rate
        total_tasks = self.performance_metrics.tasks_completed + self.performance_metrics.tasks_failed
        if total_tasks > 0:
            self.performance_metrics.success_rate = self.performance_metrics.tasks_completed / total_tasks
        
        # Update average execution time
        if task_result.duration_ms:
            current_avg = self.performance_metrics.average_execution_time_ms
            if current_avg == 0:
                self.performance_metrics.average_execution_time_ms = task_result.duration_ms
            else:
                # Simple moving average
                self.performance_metrics.average_execution_time_ms = (current_avg + task_result.duration_ms) / 2
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get current agent status and metrics.
        
        Returns:
            Dictionary containing agent status information
        """
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "capabilities": [cap.dict() for cap in self.capabilities],
            "performance_metrics": self.performance_metrics.dict(),
            "tools": self.tools.list_tools(),
            "memory_size": len(self.memory.messages)
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform agent health check.
        
        Returns:
            Dictionary containing health status
        """
        try:
            # Basic health checks
            health_status = {
                "agent_id": self.id,
                "agent_name": self.name,
                "status": self.status,
                "healthy": True,
                "last_activity": self.performance_metrics.last_activity,
                "uptime_seconds": self.performance_metrics.uptime_seconds,
                "checks": {
                    "memory": len(self.memory.messages) < self.memory.max_messages,
                    "tools": len(self.tools.list_tools()) > 0,
                    "capabilities": len(self.capabilities) > 0
                }
            }
            
            # Check if any health checks failed
            if not all(health_status["checks"].values()):
                health_status["healthy"] = False
                self.status = AgentStatus.ERROR
            
            return health_status
            
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            self.status = AgentStatus.ERROR
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "status": self.status,
                "healthy": False,
                "error": str(e)
            }
    
    def __str__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id}, name={self.name}, status={self.status})"
    
    def __repr__(self) -> str:
        return self.__str__()