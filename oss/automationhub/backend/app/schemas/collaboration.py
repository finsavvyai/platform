"""
Pydantic schemas for collaboration API requests and responses
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, validator


class CollaborationSessionRequest(BaseModel):
    """Request schema for creating collaboration sessions"""
    name: str = Field(..., min_length=1, max_length=255, description="Session name")
    description: Optional[str] = Field(None, max_length=1000, description="Session description")
    collaboration_type: str = Field(..., description="Type of collaboration (e.g., 'task_delegation', 'consensus', 'workflow')")
    initiator_agent_id: UUID = Field(..., description="ID of the agent initiating the session")
    participating_agents: List[UUID] = Field(..., min_items=1, description="List of participating agent IDs")
    workflow_definition: Optional[Dict[str, Any]] = Field(None, description="Optional workflow definition")
    max_duration_minutes: int = Field(60, ge=1, le=1440, description="Maximum session duration in minutes")
    consensus_threshold: float = Field(0.7, ge=0.0, le=1.0, description="Consensus decision threshold")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    @validator('workflow_definition')
    def validate_workflow_definition(cls, v):
        if v is not None:
            if 'steps' not in v:
                raise ValueError("Workflow definition must contain 'steps' key")
            if not isinstance(v['steps'], list):
                raise ValueError("Workflow steps must be a list")
        return v


class CollaborationSessionResponse(BaseModel):
    """Response schema for collaboration sessions"""
    id: UUID
    name: str
    description: Optional[str]
    collaboration_type: str
    status: str
    initiator_agent_id: UUID
    participating_agents: List[str]
    current_step: int = 0
    total_steps: int = 0
    message_count: Optional[int] = 0
    task_count: Optional[int] = 0
    created_at: datetime
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    final_result: Optional[Dict[str, Any]]
    consensus_result: Optional[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class CollaborationMessageRequest(BaseModel):
    """Request schema for collaboration messages"""
    sender_agent_id: UUID = Field(..., description="ID of the agent sending the message")
    recipient_agent_id: Optional[UUID] = Field(None, description="ID of the recipient agent (null for broadcast)")
    message_type: str = Field(..., description="Type of message (e.g., 'task_delegation', 'status_update', 'result_share')")
    priority: str = Field("normal", description="Message priority (low, normal, high, critical)")
    subject: Optional[str] = Field(None, max_length=255, description="Message subject")
    content: str = Field(..., min_length=1, max_length=10000, description="Message content")
    payload: Optional[Dict[str, Any]] = Field(None, description="Additional structured data")
    parent_message_id: Optional[UUID] = Field(None, description="Parent message ID for threading")
    requires_response: bool = Field(False, description="Whether a response is required")
    response_deadline: Optional[datetime] = Field(None, description="Deadline for response")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    @validator('priority')
    def validate_priority(cls, v):
        allowed_values = ['low', 'normal', 'high', 'critical']
        if v not in allowed_values:
            raise ValueError(f"Priority must be one of: {', '.join(allowed_values)}")
        return v


class CollaborationMessageResponse(BaseModel):
    """Response schema for collaboration messages"""
    id: UUID
    session_id: UUID
    sender_agent_id: UUID
    recipient_agent_id: Optional[UUID]
    message_type: str
    priority: str
    subject: Optional[str]
    content: str
    payload: Optional[Dict[str, Any]]
    thread_id: Optional[UUID]
    parent_message_id: Optional[UUID]
    requires_response: bool
    response_deadline: Optional[datetime]
    sent_at: datetime
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]

    class Config:
        from_attributes = True


class CollaborationTaskRequest(BaseModel):
    """Request schema for collaboration tasks"""
    delegating_agent_id: UUID = Field(..., description="ID of the agent delegating the task")
    task_type: str = Field(..., description="Type of task to be delegated")
    title: str = Field(..., min_length=1, max_length=255, description="Task title")
    description: Optional[str] = Field(None, max_length=1000, description="Task description")
    input_data: Dict[str, Any] = Field(..., description="Input data for the task")
    requirements: Optional[Dict[str, Any]] = Field(None, description="Task requirements")
    constraints: Optional[Dict[str, Any]] = Field(None, description="Task constraints")
    priority: int = Field(5, ge=1, le=10, description="Task priority (1-10)")
    deadline: Optional[datetime] = Field(None, description="Task deadline")

    @validator('priority')
    def validate_priority_range(cls, v):
        if not 1 <= v <= 10:
            raise ValueError("Priority must be between 1 and 10")
        return v


class CollaborationTaskResponse(BaseModel):
    """Response schema for collaboration tasks"""
    id: UUID
    session_id: UUID
    title: str
    description: Optional[str]
    task_type: str
    delegating_agent_id: UUID
    assigned_agent_id: Optional[UUID]
    status: str
    priority: int
    input_data: Optional[Dict[str, Any]]
    requirements: Optional[Dict[str, Any]]
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    success_score: Optional[float]
    created_at: datetime
    assigned_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    deadline: Optional[datetime]

    class Config:
        from_attributes = True


class ConsensusVoteRequest(BaseModel):
    """Request schema for initiating consensus"""
    proposal_id: str = Field(..., min_length=1, max_length=255, description="Unique proposal identifier")
    proposal_data: Dict[str, Any] = Field(..., description="Proposal data and description")
    consensus_threshold: Optional[float] = Field(0.7, ge=0.0, le=1.0, description="Consensus threshold")
    voting_deadline: Optional[datetime] = Field(None, description="Voting deadline")


class ConsensusResponse(BaseModel):
    """Response schema for consensus voting"""
    voting_agent_id: UUID = Field(..., description="ID of the agent voting")
    vote_value: str = Field(..., description="Vote value (approve, reject, abstain, or specific value)")
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence in the vote")
    reasoning: Optional[str] = Field(None, max_length=1000, description="Reasoning for the vote")

    @validator('confidence_score')
    def validate_confidence_score(cls, v):
        if v is not None and not 0.0 <= v <= 1.0:
            raise ValueError("Confidence score must be between 0.0 and 1.0")
        return v


class AgentCapabilityResponse(BaseModel):
    """Response schema for agent capabilities"""
    agent_id: UUID
    name: str
    agent_type: str
    capabilities: List[str]
    status: str
    current_load: float = 0.0
    performance_score: float = 0.0
    last_seen: Optional[datetime]
    metadata: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class CommunicationChannelResponse(BaseModel):
    """Response schema for communication channels"""
    id: UUID
    name: str
    channel_type: str
    description: Optional[str]
    participants: List[str]
    is_persistent: bool
    max_message_size: int
    requires_authentication: bool
    encryption_enabled: bool
    rate_limit_per_minute: int
    message_retention_hours: int
    created_at: datetime
    last_activity: Optional[datetime]

    class Config:
        from_attributes = True


class CollaborationPatternRequest(BaseModel):
    """Request schema for collaboration patterns"""
    name: str = Field(..., min_length=1, max_length=255, description="Pattern name")
    description: Optional[str] = Field(None, max_length=1000, description="Pattern description")
    pattern_type: str = Field(..., description="Pattern type (sequential, parallel, consensus, hierarchical)")
    workflow_definition: Dict[str, Any] = Field(..., description="Workflow definition")
    required_capabilities: List[str] = Field(..., description="Required agent capabilities")
    optimal_agent_count: Optional[int] = Field(None, ge=1, description="Optimal number of agents")
    min_agent_count: int = Field(1, ge=1, description="Minimum number of agents")
    max_agent_count: Optional[int] = Field(None, ge=1, description="Maximum number of agents")


class CollaborationPatternResponse(BaseModel):
    """Response schema for collaboration patterns"""
    id: UUID
    name: str
    description: Optional[str]
    pattern_type: str
    workflow_definition: Dict[str, Any]
    required_capabilities: List[str]
    optimal_agent_count: Optional[int]
    min_agent_count: int
    max_agent_count: Optional[int]
    usage_count: int
    success_rate: float
    average_completion_time_ms: float
    version: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowStepRequest(BaseModel):
    """Request schema for workflow steps"""
    step_type: str = Field(..., description="Step type (task_delegation, consensus, parallel_execution, sequential_execution)")
    description: str = Field(..., description="Step description")
    required_agents: List[UUID] = Field(..., min_items=1, description="Required agent IDs")
    optional_agents: List[UUID] = Field(None, description="Optional agent IDs")
    dependencies: List[str] = Field(None, description="Step dependencies")
    timeout_minutes: int = Field(30, ge=1, description="Step timeout in minutes")
    consensus_threshold: float = Field(0.7, ge=0.0, le=1.0, description="Consensus threshold for this step")
    parameters: Dict[str, Any] = Field(None, description="Additional step parameters")


class TaskCompletionRequest(BaseModel):
    """Request schema for completing tasks"""
    task_id: UUID = Field(..., description="ID of the task being completed")
    agent_id: UUID = Field(..., description="ID of the agent completing the task")
    success: bool = Field(..., description="Whether the task was successful")
    result: Dict[str, Any] = Field(..., description="Task result data")
    execution_time_ms: Optional[float] = Field(None, ge=0.0, description="Execution time in milliseconds")
    error_message: Optional[str] = Field(None, description="Error message if task failed")


class AgentDiscoveryRequest(BaseModel):
    """Request schema for agent discovery"""
    required_capabilities: List[str] = Field(..., min_items=1, description="Required capabilities")
    exclude_agents: Optional[List[UUID]] = Field(None, description="Agents to exclude")
    min_performance_score: float = Field(0.0, ge=0.0, le=1.0, description="Minimum performance score")
    max_agents: int = Field(10, ge=1, le=50, description="Maximum number of agents to return")
    load_balance: bool = Field(True, description="Whether to consider agent load")


class AgentStatusUpdate(BaseModel):
    """Request schema for updating agent status"""
    agent_id: UUID = Field(..., description="Agent ID")
    status: str = Field(..., description="New status")
    current_load: Optional[float] = Field(None, ge=0.0, le=1.0, description="Current load (0.0-1.0)")
    last_seen: Optional[datetime] = Field(None, description="Last seen timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class CollaborationMetricsResponse(BaseModel):
    """Response schema for collaboration metrics"""
    period_hours: int
    since: str
    session_metrics: Optional[Dict[str, Any]]
    message_metrics: Optional[Dict[str, Any]]
    task_metrics: Optional[Dict[str, Any]]
    system_metrics: Dict[str, Any]

    class Config:
        from_attributes = True


class SessionActivityLog(BaseModel):
    """Response schema for session activity logs"""
    timestamp: datetime
    activity_type: str
    agent_id: UUID
    description: str
    details: Optional[Dict[str, Any]]


class CollaborationAnalytics(BaseModel):
    """Response schema for collaboration analytics"""
    total_sessions: int
    active_sessions: int
    completed_sessions: int
    failed_sessions: int
    average_session_duration_minutes: float
    total_messages: int
    total_tasks: int
    successful_tasks: int
    task_success_rate: float
    most_active_agents: List[Dict[str, Any]]
    popular_collaboration_types: List[Dict[str, Any]]
    average_response_time_ms: float


# Utility schemas for validation
class ValidationError(BaseModel):
    """Schema for validation errors"""
    field: str
    message: str
    value: Any


class APIResponse(BaseModel):
    """Base schema for API responses"""
    success: bool
    message: str
    data: Optional[Any] = None
    errors: Optional[List[ValidationError]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PaginatedResponse(BaseModel):
    """Schema for paginated responses"""
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int
    has_next: bool
    has_prev: bool


# Additional specialized schemas
class TaskDelegationRequest(BaseModel):
    """Request schema for specific task delegation"""
    task_id: Optional[UUID] = Field(None, description="Optional task ID (generated if not provided)")
    delegating_agent_id: UUID = Field(..., description="Agent delegating the task")
    task_type: str = Field(..., description="Type of task")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    input_data: Dict[str, Any] = Field(..., description="Task input data")
    requirements: Optional[Dict[str, Any]] = Field(None, description="Task requirements")
    constraints: Optional[Dict[str, Any]] = Field(None, description="Task constraints")
    priority: int = Field(5, ge=1, le=10, description="Task priority")
    deadline: Optional[datetime] = Field(None, description="Task deadline")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class MessageEnvelopeSchema(BaseModel):
    """Schema for message envelopes"""
    message_id: UUID
    sender_id: UUID
    recipient_id: Optional[UUID]
    message_type: str
    priority: str
    subject: Optional[str]
    content: str
    payload: Optional[Dict[str, Any]]
    thread_id: Optional[UUID]
    parent_message_id: Optional[UUID]
    requires_response: bool
    response_deadline: Optional[datetime]
    metadata: Dict[str, Any]
    sent_at: datetime


class WorkflowDefinition(BaseModel):
    """Schema for workflow definitions"""
    name: str
    description: Optional[str]
    steps: List[Dict[str, Any]]
    requirements: Dict[str, Any] = {}
    constraints: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}

    @validator('steps')
    def validate_steps(cls, v):
        if not v:
            raise ValueError("Workflow must contain at least one step")
        for step in v:
            if 'type' not in step:
                raise ValueError("Each step must have a 'type' field")
        return v


class SessionTimeoutRequest(BaseModel):
    """Request schema for session timeout updates"""
    timeout_minutes: int = Field(..., ge=1, le=1440, description="New timeout in minutes")
    reason: Optional[str] = Field(None, description="Reason for timeout update")


class AgentPerformanceMetrics(BaseModel):
    """Schema for agent performance metrics"""
    agent_id: UUID
    tasks_completed: int
    tasks_failed: int
    average_execution_time_ms: float
    success_rate: float
    last_task_completed: Optional[datetime]
    total_work_time_minutes: float
    average_load: float