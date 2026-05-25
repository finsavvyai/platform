"""
Workflow model for Universal Dependency Platform.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, String, Text, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class Workflow(BaseModel):
    """Workflow model."""

    __tablename__ = "workflows"

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    workflow_type = Column(String(50), nullable=False)
    definition = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    timeout_minutes = Column(String(10), default="60", nullable=False)
    tags = Column(JSON, nullable=True)
    status = Column(String(20), default="pending", nullable=False)

    # Foreign keys
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    created_by_user = relationship("User", back_populates="workflows")
    executions = relationship("WorkflowExecution", back_populates="workflow")
    steps = relationship("WorkflowStep", back_populates="workflow")


class WorkflowExecution(BaseModel):
    """Workflow execution model."""

    __tablename__ = "workflow_executions"

    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    input_data = Column(JSON, nullable=False)
    context = Column(JSON, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    execution_logs = Column(JSON, nullable=False)
    progress = Column(Float, default=0.0, nullable=False)
    priority = Column(String(10), default="0", nullable=False)

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    started_by_user = relationship("User", back_populates="workflow_executions")
    steps = relationship("WorkflowExecutionStep", back_populates="execution")
    approvals = relationship("WorkflowApproval", back_populates="execution")


class WorkflowStep(BaseModel):
    """Workflow step model."""

    __tablename__ = "workflow_steps"

    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    name = Column(String(255), nullable=False)
    step_type = Column(String(100), nullable=False)
    configuration = Column(JSON, nullable=False)
    dependencies = Column(JSON, nullable=True)
    retry_count = Column(String(10), default="0", nullable=False)
    timeout_seconds = Column(String(10), default="300", nullable=False)

    # Relationships
    workflow = relationship("Workflow", back_populates="steps")
    executions = relationship("WorkflowExecutionStep", back_populates="step")


class WorkflowExecutionStep(BaseModel):
    """Workflow execution step model."""

    __tablename__ = "workflow_execution_steps"

    step_id = Column(
        UUID(as_uuid=True), ForeignKey("workflow_steps.id"), nullable=False
    )
    execution_id = Column(
        UUID(as_uuid=True), ForeignKey("workflow_executions.id"), nullable=False
    )
    status = Column(String(20), default="pending", nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    logs = Column(JSON, nullable=False)

    # Relationships
    step = relationship("WorkflowStep", back_populates="executions")
    execution = relationship("WorkflowExecution", back_populates="steps")


class WorkflowApproval(BaseModel):
    """Workflow approval model."""

    __tablename__ = "workflow_approvals"

    execution_id = Column(
        UUID(as_uuid=True), ForeignKey("workflow_executions.id"), nullable=False
    )
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    comment = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    execution = relationship("WorkflowExecution", back_populates="approvals")
    approver = relationship("User")
