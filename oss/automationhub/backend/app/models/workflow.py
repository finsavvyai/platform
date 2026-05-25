"""
Enhanced Workflow Models for UPM.Plus

This module provides comprehensive workflow models with support for:
- Enterprise-grade workflow execution with parallel processing
- Advanced dependency resolution and conditional logic
- Comprehensive execution history tracking and audit capabilities
- Production-level error handling and retry mechanisms
- Sophisticated variable scoping and data flow management
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, ForeignKey, Float, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import JSON, Index
from app.core.database import JSONType
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from enum import Enum
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.core.database import Base


class WorkflowStatus(str, Enum):
    """Workflow lifecycle status."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"


class ExecutionStatus(str, Enum):
    """Workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    WAITING = "waiting"  # For human input or external dependencies
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    RETRYING = "retrying"


class NodeStatus(str, Enum):
    """Individual node execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class RetryPolicy(str, Enum):
    """Retry policy types."""
    NONE = "none"
    FIXED = "fixed"  # Fixed delay between retries
    EXPONENTIAL = "exponential"  # Exponential backoff
    LINEAR = "linear"  # Linear backoff


class Workflow(Base):
    """Enhanced workflow model with enterprise features."""

    __tablename__ = "workflows"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Ownership and access control
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    owner = relationship("User", back_populates="workflows")

    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    organization = relationship("Organization", back_populates="workflows")

    # Workflow definition with advanced structure
    nodes = Column(JSONType, default=list)  # Enhanced node definitions with metadata
    connections = Column(JSONType, default=list)  # Enhanced connections with conditions
    variables = Column(JSONType, default=dict)  # Workflow-level variables with types and defaults
    triggers = Column(JSONType, default=list)  # Trigger definitions (webhook, schedule, etc.)

    # Status and versioning
    status = Column(SQLEnum(WorkflowStatus), default=WorkflowStatus.DRAFT, index=True)
    version = Column(Integer, default=1, nullable=False)
    parent_version_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=True)  # For version tracking
    is_template = Column(Boolean, default=False, index=True)
    is_public = Column(Boolean, default=False)

    # Advanced execution settings
    execution_settings = Column(JSONType, default=dict)  # Timeout, parallelism, resource limits
    retry_settings = Column(JSONType, default=dict)  # Global retry policies
    notification_settings = Column(JSONType, default=dict)  # Notification preferences
    security_settings = Column(JSONType, default=dict)  # Access control, encryption

    # Performance and monitoring
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    average_execution_time_ms = Column(Float, default=0.0)
    last_execution_status = Column(SQLEnum(ExecutionStatus), nullable=True)
    last_execution_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata and categorization
    tags = Column(ARRAY(String), default=list)
    category = Column(String(100), nullable=True, index=True)
    priority = Column(Integer, default=5)  # 1-10, where 1 is highest priority

    # Validation and compliance
    is_validated = Column(Boolean, default=False)
    validation_errors = Column(JSONType, default=list)
    compliance_tags = Column(ARRAY(String), default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=False)
    last_executed = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tasks = relationship("Task", back_populates="workflow", cascade="all, delete-orphan")
    executions = relationship("app.models.workflow.WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")
    versions = relationship(
        "app.models.workflow.Workflow",
        foreign_keys=[parent_version_id],
        remote_side=[id],
        backref="child_versions",
    )

    # Indexes for performance
    __table_args__ = (
        Index('idx_workflow_status_owner', 'status', 'owner_id'),
        Index('idx_workflow_org_status', 'organization_id', 'status'),
        Index('idx_workflow_created_at', 'created_at'),
        Index('idx_workflow_last_executed', 'last_executed'),
        Index('idx_workflow_tags', 'tags', postgresql_using='gin'),
    )

    @validates('name')
    def validate_name(self, key, name):
        """Validate workflow name."""
        if not name or len(name.strip()) < 3:
            raise ValueError("Workflow name must be at least 3 characters long")
        if len(name) > 255:
            raise ValueError("Workflow name cannot exceed 255 characters")
        return name.strip()

    @validates('priority')
    def validate_priority(self, key, priority):
        """Validate priority value."""
        if not 1 <= priority <= 10:
            raise ValueError("Priority must be between 1 (highest) and 10 (lowest)")
        return priority

    def update_execution_stats(self, execution_status: ExecutionStatus, execution_time_ms: float):
        """Update workflow execution statistics."""
        self.execution_count += 1
        self.last_execution_status = execution_status
        self.last_execution_at = datetime.utcnow()

        if execution_status == ExecutionStatus.COMPLETED:
            self.success_count += 1
        else:
            self.failure_count += 1

        # Update average execution time
        if self.execution_count == 1:
            self.average_execution_time_ms = execution_time_ms
        else:
            self.average_execution_time_ms = (
                (self.average_execution_time_ms * (self.execution_count - 1) + execution_time_ms) /
                self.execution_count
            )

    def get_success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.execution_count == 0:
            return 0.0
        return (self.success_count / self.execution_count) * 100.0

    def can_execute(self) -> bool:
        """Check if workflow can be executed."""
        return (
            self.status == WorkflowStatus.ACTIVE and
            self.is_validated and
            not self.validation_errors
        )

    def __repr__(self):
        return f"<Workflow(id={self.id}, name={self.name}, status={self.status}, version={self.version})>"


class WorkflowExecution(Base):
    """Workflow execution instance with comprehensive tracking."""

    __tablename__ = "workflow_executions"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False, index=True)
    workflow_version = Column(Integer, nullable=False)

    # Execution tracking
    status = Column(SQLEnum(ExecutionStatus), default=ExecutionStatus.PENDING, index=True)
    progress_percentage = Column(Float, default=0.0)
    current_nodes = Column(JSONType, default=list)  # Currently executing node IDs
    completed_nodes = Column(JSONType, default=list)  # Completed node IDs
    failed_nodes = Column(JSONType, default=list)  # Failed node IDs
    skipped_nodes = Column(JSONType, default=list)  # Skipped node IDs

    # Data and context management
    input_data = Column(JSONType, default=dict)  # Initial input data
    output_data = Column(JSONType, nullable=True)  # Final output data
    execution_context = Column(JSONType, default=dict)  # Runtime context and variables
    node_results = Column(JSONType, default=dict)  # Results from each node

    # Error handling and retry information
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONType, nullable=True)  # Detailed error information
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    # Performance metrics
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    timeout_at = Column(DateTime(timezone=True), nullable=True)
    execution_time_ms = Column(Float, nullable=True)

    # Resource usage tracking
    resource_usage = Column(JSONType, nullable=True)  # CPU, memory, network metrics
    agent_assignments = Column(JSONType, default=dict)  # Which agents executed which nodes

    # User and session information
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    session_id = Column(String(255), nullable=True, index=True)  # For grouping related executions

    # Audit and compliance
    audit_log = Column(JSONType, default=list)  # Comprehensive audit trail
    compliance_flags = Column(JSONType, default=dict)  # Compliance-related flags and data

    # External integrations
    external_triggers = Column(JSONType, default=list)  # External system triggers
    webhooks_fired = Column(JSONType, default=list)  # Webhooks that were triggered

    # Relationships
    workflow = relationship("app.models.workflow.Workflow", back_populates="executions")
    node_executions = relationship("app.models.workflow.NodeExecution", back_populates="workflow_execution", cascade="all, delete-orphan")

    # Indexes for performance
    __table_args__ = (
        Index('idx_execution_workflow_status', 'workflow_id', 'status'),
        Index('idx_execution_started_at', 'started_at'),
        Index('idx_execution_started_by', 'started_by'),
        Index('idx_execution_session', 'session_id'),
    )

    def calculate_progress(self) -> float:
        """Calculate execution progress percentage."""
        if not self.workflow:
            return 0.0

        total_nodes = len(self.workflow.nodes or [])
        if total_nodes == 0:
            return 0.0

        completed_count = len(self.completed_nodes or [])
        return (completed_count / total_nodes) * 100.0

    def is_running(self) -> bool:
        """Check if execution is currently running."""
        return self.status in [ExecutionStatus.RUNNING, ExecutionStatus.RETRYING]

    def is_finished(self) -> bool:
        """Check if execution has finished (successfully or not)."""
        return self.status in [
            ExecutionStatus.COMPLETED,
            ExecutionStatus.FAILED,
            ExecutionStatus.CANCELLED,
            ExecutionStatus.TIMEOUT
        ]

    def add_audit_event(self, event_type: str, details: Dict[str, Any]):
        """Add event to audit log."""
        audit_event = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "details": details,
            "node_id": details.get("node_id"),
            "user_id": details.get("user_id")
        }
        self.audit_log.append(audit_event)

    def __repr__(self):
        return f"<WorkflowExecution(id={self.id}, workflow_id={self.workflow_id}, status={self.status})>"


class NodeExecution(Base):
    """Individual node execution tracking."""

    __tablename__ = "node_executions"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions.id"), nullable=False, index=True)
    node_id = Column(String(255), nullable=False, index=True)  # Node ID from workflow definition
    node_type = Column(String(100), nullable=False)
    node_name = Column(String(255), nullable=False)

    # Execution status and timing
    status = Column(SQLEnum(NodeStatus), default=NodeStatus.PENDING)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    execution_time_ms = Column(Float, nullable=True)

    # Data handling
    input_data = Column(JSONType, nullable=True)  # Input data for this node
    output_data = Column(JSONType, nullable=True)  # Output data from this node
    transformed_data = Column(JSONType, nullable=True)  # Data after transformations

    # Error handling
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONType, nullable=True)
    retry_count = Column(Integer, default=0)

    # Performance metrics
    resource_usage = Column(JSONType, nullable=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    agent_performance = Column(JSONType, nullable=True)  # Agent-specific performance metrics

    # Conditional execution
    condition_result = Column(JSONType, nullable=True)  # Result of condition evaluation
    branch_taken = Column(String(100), nullable=True)  # Which branch was taken

    # Audit trail
    execution_log = Column(JSONType, default=list)  # Step-by-step execution log

    # Relationships
    workflow_execution = relationship("app.models.workflow.WorkflowExecution", back_populates="node_executions")
    agent = relationship("app.models.agent.Agent", back_populates="node_executions")

    # Indexes for performance
    __table_args__ = (
        Index('idx_node_execution_workflow_node', 'workflow_execution_id', 'node_id'),
        Index('idx_node_execution_status', 'status'),
        Index('idx_node_execution_agent', 'agent_id'),
    )

    def add_execution_log_entry(self, level: str, message: str, details: Dict[str, Any] = None):
        """Add entry to execution log."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message,
            "details": details or {}
        }
        self.execution_log.append(log_entry)

    def __repr__(self):
        return f"<NodeExecution(id={self.id}, node_id={self.node_id}, status={self.status})>"