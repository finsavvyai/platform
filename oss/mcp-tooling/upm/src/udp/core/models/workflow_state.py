"""
Workflow state models for Universal Dependency Platform.

Defines SQLAlchemy models for workflow state persistence, caching,
and audit trail management across Redis and PostgreSQL.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Set
from uuid import uuid4, UUID

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    JSON,
    Text,
    ForeignKey,
    Index,
    Float,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, ARRAY
from sqlalchemy.orm import relationship

from ..database import Base


class WorkflowStateModel(Base):
    """Workflow state persistence model."""

    __tablename__ = "workflow_states"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    workflow_id = Column(
        String(100), nullable=False, index=True
    )  # Thread ID from LangGraph
    workflow_type = Column(String(50), nullable=False, index=True)
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    execution_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_executions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # State information
    status = Column(
        String(20), nullable=False, index=True, default="pending"
    )  # pending, running, completed, failed, cancelled, paused
    step = Column(
        String(100), nullable=False, index=True, default="start"
    )  # Current workflow step
    step_status = Column(JSON, default=dict, nullable=False)  # Status of all steps

    # State data
    state_data = Column(JSON, nullable=False)  # Complete workflow state
    configuration = Column(JSON, default=dict, nullable=False)  # Workflow configuration
    results = Column(JSON, default=dict, nullable=False)  # Accumulated results
    errors = Column(JSON, default=list, nullable=False)  # Accumulated errors

    # Metadata
    state_metadata = Column(JSON, default=dict, nullable=False)  # Additional metadata
    created_at = Column(DateTime(timezone=True), server_default="now()", nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default="now()", nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Cache expiration

    # Relationships
    project = relationship("ProjectModel", back_populates="workflow_states")
    execution = relationship("WorkflowExecution", back_populates="states")
    checkpoints = relationship(
        "WorkflowCheckpointModel",
        back_populates="workflow_state",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("ix_workflow_states_workflow_id", "workflow_id"),
        Index("ix_workflow_states_execution", "execution_id"),
        Index("ix_workflow_states_status", "status"),
        Index("ix_workflow_states_step", "step"),
        Index("ix_workflow_states_project", "project_id"),
        Index("ix_workflow_states_workflow_type", "workflow_type"),
        Index("ix_workflow_states_created", "created_at"),
        Index("ix_workflow_states_expires", "expires_at"),
    )


class WorkflowCheckpointModel(Base):
    """Workflow checkpoint model for state snapshots."""

    __tablename__ = "workflow_checkpoints"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    workflow_state_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_states.id", ondelete="CASCADE"),
        nullable=False,
    )
    checkpoint_id = Column(
        String(100), nullable=False, index=True
    )  # LangGraph checkpoint ID
    step = Column(String(100), nullable=False)
    state_snapshot = Column(JSON, nullable=False)  # Complete state snapshot

    # Checkpoint metadata
    thread_id = Column(String(100), nullable=False)
    task_id = Column(String(100), nullable=True)
    parent_ts = Column(String(100), nullable=True)
    config_values = Column(JSON, default=dict, nullable=False)

    # Timing information
    created_at = Column(DateTime(timezone=True), server_default="now()", nullable=False)

    # Relationships
    workflow_state = relationship("WorkflowStateModel", back_populates="checkpoints")

    # Indexes
    __table_args__ = (
        Index("ix_workflow_checkpoints_workflow_state", "workflow_state_id"),
        Index("ix_workflow_checkpoints_checkpoint_id", "checkpoint_id"),
        Index("ix_workflow_checkpoints_step", "step"),
        Index("ix_workflow_checkpoints_thread_id", "thread_id"),
        Index("ix_workflow_checkpoints_task_id", "task_id"),
    )


class WorkflowEventModel(Base):
    """Workflow event model for audit trail."""

    __tablename__ = "workflow_events"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    workflow_id = Column(String(100), nullable=False, index=True)
    workflow_type = Column(String(50), nullable=False, index=True)
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    execution_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_executions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Event information
    event_type = Column(
        String(50), nullable=False, index=True
    )  # step_start, step_complete, error, retry, cancel
    step = Column(String(100), nullable=True, index=True)
    event_data = Column(JSON, default=dict, nullable=False)  # Event-specific data

    # Timing
    timestamp = Column(DateTime(timezone=True), server_default="now()", nullable=False)
    duration_ms = Column(Integer, nullable=True)  # Event duration in milliseconds

    # User and context
    user_id = Column(String(100), nullable=True, index=True)
    context = Column(JSON, default=dict, nullable=False)  # Additional context

    # Relationships
    project = relationship("ProjectModel")
    execution = relationship("WorkflowExecution")

    # Indexes
    __table_args__ = (
        Index("ix_workflow_events_workflow_id", "workflow_id"),
        Index("ix_workflow_events_execution", "execution_id"),
        Index("ix_workflow_events_event_type", "event_type"),
        Index("ix_workflow_events_step", "step"),
        Index("ix_workflow_events_timestamp", "timestamp"),
        Index("ix_workflow_events_user", "user_id"),
        Index("ix_workflow_events_project", "project_id"),
    )


class WorkflowCacheModel(Base):
    """Workflow cache model for Redis-backed caching."""

    __tablename__ = "workflow_cache"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    cache_key = Column(String(255), nullable=False, unique=True, index=True)
    workflow_id = Column(String(100), nullable=False, index=True)

    # Cache data
    cache_data = Column(JSON, nullable=False)
    cache_type = Column(
        String(50), nullable=False, index=True
    )  # state, result, checkpoint, config
    ttl_seconds = Column(
        Integer, nullable=False, default=3600
    )  # Time to live in seconds

    # Metadata
    tags = Column(JSON, default=list, nullable=False)  # Cache tags for invalidation
    priority = Column(Integer, default=0, nullable=False)  # Cache priority for eviction

    # Timing
    created_at = Column(DateTime(timezone=True), server_default="now()", nullable=False)
    accessed_at = Column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)

    # Indexes
    __table_args__ = (
        Index("ix_workflow_cache_key", "cache_key"),
        Index("ix_workflow_cache_workflow", "workflow_id"),
        Index("ix_workflow_cache_type", "cache_type"),
        Index("ix_workflow_cache_expires", "expires_at"),
        Index("ix_workflow_cache_priority", "priority"),
        Index("ix_workflow_cache_accessed", "accessed_at"),
    )


class WorkflowRetryModel(Base):
    """Workflow retry tracking model."""

    __tablename__ = "workflow_retries"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    workflow_id = Column(String(100), nullable=False, index=True)
    execution_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_executions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Retry information
    retry_attempt = Column(Integer, nullable=False, default=1)
    max_retries = Column(Integer, nullable=False, default=3)
    retry_delay = Column(Float, nullable=False, default=1.0)  # Delay in seconds
    backoff_factor = Column(Float, nullable=False, default=2.0)

    # Error information
    error_message = Column(Text, nullable=False)
    error_type = Column(
        String(100), nullable=True, index=True
    )  # timeout, validation, dependency, etc.
    error_details = Column(JSON, default=dict, nullable=False)

    # State snapshot at time of error
    state_snapshot = Column(JSON, nullable=True)

    # Timing
    retry_at = Column(DateTime(timezone=True), server_default="now()", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default="now()", nullable=False)

    # Relationships
    execution = relationship("WorkflowExecution")

    # Indexes
    __table_args__ = (
        Index("ix_workflow_retries_workflow", "workflow_id"),
        Index("ix_workflow_retries_execution", "execution_id"),
        Index("ix_workflow_retries_attempt", "retry_attempt"),
        Index("ix_workflow_retries_error_type", "error_type"),
        Index("ix_workflow_retries_retry_at", "retry_at"),
    )


class WorkflowLockModel(Base):
    """Workflow lock model for preventing concurrent execution."""

    __tablename__ = "workflow_locks"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    lock_key = Column(String(255), nullable=False, unique=True, index=True)
    workflow_id = Column(String(100), nullable=False, index=True)

    # Lock information
    lock_type = Column(
        String(50), nullable=False, index=True
    )  # execution, state_update, checkpoint
    owner_id = Column(String(100), nullable=False, index=True)  # Process or thread ID
    acquired_at = Column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)

    # Lock data
    lock_data = Column(JSON, default=dict, nullable=False)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default="now()", nullable=False)

    # Indexes
    __table_args__ = (
        Index("ix_workflow_locks_lock_key", "lock_key"),
        Index("ix_workflow_locks_workflow", "workflow_id"),
        Index("ix_workflow_locks_owner", "owner_id"),
        Index("ix_workflow_locks_type", "lock_type"),
        Index("ix_workflow_locks_expires", "expires_at"),
    )


class WorkflowMetricsModel(Base):
    """Workflow metrics and performance model."""

    __tablename__ = "workflow_metrics"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    workflow_id = Column(String(100), nullable=False, index=True)
    workflow_type = Column(String(50), nullable=False, index=True)
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Performance metrics
    total_duration_ms = Column(Integer, nullable=True)  # Total execution time
    step_durations = Column(JSON, default=dict, nullable=False)  # Duration per step
    cpu_usage = Column(Float, nullable=True)  # CPU usage percentage
    memory_usage = Column(Integer, nullable=True)  # Memory usage in MB

    # Count metrics
    steps_executed = Column(Integer, default=0, nullable=False)
    steps_failed = Column(Integer, default=0, nullable=False)
    steps_retried = Column(Integer, default=0, nullable=False)
    checkpoints_created = Column(Integer, default=0, nullable=False)

    # Data metrics
    state_size_bytes = Column(Integer, nullable=True)  # Size of state data
    results_size_bytes = Column(Integer, nullable=True)  # Size of results data

    # Timing information
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    project = relationship("ProjectModel")

    # Indexes
    __table_args__ = (
        Index("ix_workflow_metrics_workflow", "workflow_id"),
        Index("ix_workflow_metrics_type", "workflow_type"),
        Index("ix_workflow_metrics_project", "project_id"),
        Index("ix_workflow_metrics_started", "started_at"),
        Index("ix_workflow_metrics_completed", "completed_at"),
    )
