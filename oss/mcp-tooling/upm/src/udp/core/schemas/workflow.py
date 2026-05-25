"""
Workflow management schemas for Universal Dependency Platform.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class WorkflowStatus(str, Enum):
    """Workflow status enumeration."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionStatus(str, Enum):
    """Workflow execution status enumeration."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class WorkflowType(str, Enum):
    """Workflow type enumeration."""

    DEPENDENCY_ANALYSIS = "dependency_analysis"
    SECURITY_SCAN = "security_scan"
    COMPATIBILITY_CHECK = "compatibility_check"
    LICENSE_COMPLIANCE = "license_compliance"
    APPROVAL_FLOW = "approval_flow"
    DEPLOYMENT = "deployment"


class WorkflowBase(BaseModel):
    """Base workflow schema."""

    name: str = Field(..., description="Workflow name")
    description: Optional[str] = Field(None, description="Workflow description")
    workflow_type: WorkflowType = Field(..., description="Workflow type")
    definition: dict[str, Any] = Field(..., description="Workflow definition")
    is_active: bool = Field(True, description="Whether workflow is active")
    timeout_minutes: int = Field(60, description="Timeout in minutes")


class WorkflowCreate(WorkflowBase):
    """Workflow creation schema."""

    tags: Optional[list[str]] = Field(None, description="Workflow tags")


class WorkflowUpdate(BaseModel):
    """Workflow update schema."""

    name: Optional[str] = Field(None, description="Workflow name")
    description: Optional[str] = Field(None, description="Workflow description")
    definition: Optional[dict[str, Any]] = Field(
        None, description="Workflow definition"
    )
    is_active: Optional[bool] = Field(None, description="Whether workflow is active")
    timeout_minutes: Optional[int] = Field(None, description="Timeout in minutes")
    tags: Optional[list[str]] = Field(None, description="Workflow tags")


class WorkflowResponse(WorkflowBase):
    """Workflow response schema."""

    id: str = Field(..., description="Workflow ID")
    created_by: str = Field(..., description="Creator user ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    tags: Optional[list[str]] = Field(None, description="Workflow tags")
    status: WorkflowStatus = Field(..., description="Workflow status")

    class Config:
        from_attributes = True


class WorkflowExecutionBase(BaseModel):
    """Base workflow execution schema."""

    input_data: dict[str, Any] = Field(..., description="Input data for execution")
    context: Optional[dict[str, Any]] = Field(None, description="Execution context")


class WorkflowExecutionCreate(WorkflowExecutionBase):
    """Workflow execution creation schema."""

    priority: int = Field(0, description="Execution priority (higher = more important)")


class WorkflowExecutionResponse(WorkflowExecutionBase):
    """Workflow execution response schema."""

    id: str = Field(..., description="Execution ID")
    workflow_id: str = Field(..., description="Workflow ID")
    status: ExecutionStatus = Field(..., description="Execution status")
    started_by: str = Field(..., description="User who started execution")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    result: Optional[dict[str, Any]] = Field(None, description="Execution result")
    error: Optional[str] = Field(None, description="Error message if failed")
    execution_logs: list[str] = Field(
        default_factory=list, description="Execution logs"
    )
    progress: float = Field(0.0, description="Progress percentage (0-100)")

    class Config:
        from_attributes = True


class WorkflowStep(BaseModel):
    """Workflow step schema."""

    id: str = Field(..., description="Step ID")
    name: str = Field(..., description="Step name")
    type: str = Field(..., description="Step type")
    configuration: dict[str, Any] = Field(..., description="Step configuration")
    dependencies: list[str] = Field(
        default_factory=list, description="Step dependencies"
    )
    retry_count: int = Field(0, description="Number of retries")
    timeout_seconds: int = Field(300, description="Step timeout")


class WorkflowExecutionStep(BaseModel):
    """Workflow execution step schema."""

    step_id: str = Field(..., description="Step ID")
    execution_id: str = Field(..., description="Execution ID")
    status: ExecutionStatus = Field(..., description="Step status")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    result: Optional[dict[str, Any]] = Field(None, description="Step result")
    error: Optional[str] = Field(None, description="Error message if failed")
    logs: list[str] = Field(default_factory=list, description="Step logs")


class WorkflowApproval(BaseModel):
    """Workflow approval schema."""

    id: str = Field(..., description="Approval ID")
    execution_id: str = Field(..., description="Execution ID")
    approver_id: str = Field(..., description="Approver user ID")
    status: str = Field(..., description="Approval status (pending/approved/rejected)")
    comment: Optional[str] = Field(None, description="Approval comment")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")


class WorkflowTemplate(BaseModel):
    """Workflow template schema."""

    name: str = Field(..., description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    workflow_type: WorkflowType = Field(..., description="Workflow type")
    template_definition: dict[str, Any] = Field(..., description="Template definition")
    parameters: dict[str, Any] = Field(..., description="Template parameters")
    version: str = Field("1.0.0", description="Template version")
    tags: Optional[list[str]] = Field(None, description="Template tags")
