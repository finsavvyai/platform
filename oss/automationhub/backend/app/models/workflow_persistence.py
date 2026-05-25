"""
Enhanced Workflow Persistence Models

This module provides comprehensive workflow persistence models with support for:
- Enterprise-grade workflow execution tracking
- Comprehensive audit trails and compliance
- Advanced versioning and migration capabilities
- Performance optimization and scalability
- Failure recovery and retry mechanisms
"""

from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Integer, ForeignKey, Float, 
    Enum as SQLEnum, Index, CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from enum import Enum
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
import hashlib
import json

from app.core.database import Base, JSONType


# SQLite compatibility: Use JSON instead of ARRAY for SQLite
def get_array_type():
    """Get appropriate array type based on database dialect"""
    from app.core.config import settings
    if settings.DATABASE_URL and "sqlite" in settings.DATABASE_URL.lower():
        return JSONType
    else:
        try:
            return ARRAY(String)
        except:
            return JSONType

# Export array type for models to use
ArrayType = get_array_type()


class WorkflowStatus(str, Enum):
    """Enhanced workflow lifecycle status."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"
    MIGRATING = "migrating"


class ExecutionStatus(str, Enum):
    """Enhanced workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    RETRYING = "retrying"
    PAUSED = "paused"
    RECOVERING = "recovering"


class NodeStatus(str, Enum):
    """Enhanced individual node execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    RETRYING = "retrying"


class AuditEventType(str, Enum):
    """Audit event types for compliance tracking."""
    WORKFLOW_CREATED = "workflow_created"
    WORKFLOW_UPDATED = "workflow_updated"
    WORKFLOW_DELETED = "workflow_deleted"
    WORKFLOW_ACTIVATED = "workflow_activated"
    WORKFLOW_DEACTIVATED = "workflow_deactivated"
    EXECUTION_STARTED = "execution_started"
    EXECUTION_COMPLETED = "execution_completed"
    EXECUTION_FAILED = "execution_failed"
    EXECUTION_CANCELLED = "execution_cancelled"
    EXECUTION_PAUSED = "execution_paused"
    EXECUTION_RESUMED = "execution_resumed"
    NODE_STARTED = "node_started"
    NODE_COMPLETED = "node_completed"
    NODE_FAILED = "node_failed"
    NODE_RETRIED = "node_retried"
    DATA_ACCESSED = "data_accessed"
    PERMISSION_CHANGED = "permission_changed"
    VERSION_CREATED = "version_created"
    MIGRATION_STARTED = "migration_started"
    MIGRATION_COMPLETED = "migration_completed"


class WorkflowDefinition(Base):
    """Enhanced workflow definition with comprehensive persistence."""
    __tablename__ = "workflow_definitions_v2"

    # Core identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    
    # Versioning system
    version = Column(Integer, default=1, nullable=False)
    parent_version_id = Column(UUID(as_uuid=True), ForeignKey("workflow_definitions_v2.id"))
    is_active = Column(Boolean, default=True, index=True)
    
    # Definition storage with enhanced structure
    nodes = Column(JSONType, nullable=False, default=list)
    connections = Column(JSONType, nullable=False, default=list)
    variables = Column(JSONType, default=dict)
    settings = Column(JSONType, default=dict)
    
    # Enhanced metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=False)
    
    # Status and lifecycle
    status = Column(SQLEnum(WorkflowStatus), default=WorkflowStatus.DRAFT, index=True)
    is_template = Column(Boolean, default=False, index=True)
    is_public = Column(Boolean, default=False)
    
    # Performance tracking
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    avg_execution_time_ms = Column(Float, default=0.0)
    
    # Categorization and organization
    tags = Column(ArrayType, default=list)
    category = Column(String(100), index=True)
    priority = Column(Integer, default=5)
    
    # Security and compliance
    encryption_enabled = Column(Boolean, default=False)
    compliance_tags = Column(ArrayType, default=list)
    access_control = Column(JSONType, default=dict)
    
    # Soft deletion
    deleted_at = Column(DateTime(timezone=True))
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Relationships (use fully qualified names to avoid clash with app.models.workflow)
    created_by_user = relationship("app.models.user.User", foreign_keys=[created_by])
    deleted_by_user = relationship("app.models.user.User", foreign_keys=[deleted_by])
    parent_version = relationship("app.models.workflow_persistence.WorkflowDefinition", remote_side=[id])
    child_versions = relationship("app.models.workflow_persistence.WorkflowDefinition", back_populates="parent_version")
    executions = relationship("app.models.workflow_persistence.WorkflowExecution", back_populates="workflow_definition")
    
    # Indexes for performance optimization
    __table_args__ = (
        Index('idx_workflow_owner_status', 'created_by', 'status'),
        Index('idx_workflow_created_at', 'created_at'),
        Index('idx_workflow_execution_count', 'execution_count'),
        Index('idx_workflow_success_rate', 'success_rate'),
        Index('idx_workflow_category_priority', 'category', 'priority'),
        Index('idx_workflow_version_chain', 'parent_version_id', 'version'),
        CheckConstraint('priority >= 1 AND priority <= 10', name='check_priority_range'),
        CheckConstraint('success_rate >= 0.0 AND success_rate <= 100.0', name='check_success_rate_range'),
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
    
    def update_performance_metrics(self, execution_time_ms: float, success: bool):
        """Update workflow performance metrics."""
        self.execution_count += 1
        
        if success:
            self.success_count += 1
        else:
            self.failure_count += 1
            
        # Update success rate
        self.success_rate = (self.success_count / self.execution_count) * 100.0
        
        # Update average execution time
        if self.execution_count == 1:
            self.avg_execution_time_ms = execution_time_ms
        else:
            total_time = self.avg_execution_time_ms * (self.execution_count - 1) + execution_time_ms
            self.avg_execution_time_ms = total_time / self.execution_count
    
    def soft_delete(self, deleted_by_user_id: uuid.UUID):
        """Perform soft deletion."""
        self.deleted_at = datetime.utcnow()
        self.deleted_by = deleted_by_user_id
        self.is_active = False
    
    def __repr__(self):
        return f"<WorkflowDefinition(id={self.id}, name={self.name}, version={self.version})>"


class WorkflowExecution(Base):
    """Comprehensive workflow execution tracking."""
    __tablename__ = "workflow_executions_v2"

    # Core identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflow_definitions_v2.id"), nullable=False, index=True)
    workflow_version = Column(Integer, nullable=False)
    
    # Execution state management
    status = Column(SQLEnum(ExecutionStatus), default=ExecutionStatus.PENDING, index=True)
    progress_percentage = Column(Float, default=0.0)
    current_nodes = Column(JSONType, default=list)
    completed_nodes = Column(JSONType, default=list)
    failed_nodes = Column(JSONType, default=list)
    
    # Data management
    input_data = Column(JSONType, default=dict)
    output_data = Column(JSONType)
    execution_context = Column(JSONType, default=dict)
    
    # Timing and performance
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    paused_at = Column(DateTime(timezone=True))
    resumed_at = Column(DateTime(timezone=True))
    execution_time_ms = Column(Float)
    
    # Error handling and recovery
    error_message = Column(Text)
    error_details = Column(JSONType)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime(timezone=True))
    
    # User and session tracking
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    session_id = Column(String(255), index=True)
    
    # Resource and performance tracking
    resource_usage = Column(JSONType, default=dict)
    performance_metrics = Column(JSONType, default=dict)
    
    # Audit and compliance
    audit_log = Column(JSONType, default=list)
    compliance_data = Column(JSONType, default=dict)
    
    # External integrations
    external_trigger_data = Column(JSONType, default=dict)
    webhook_responses = Column(JSONType, default=list)
    
    # Relationships (fully qualified to avoid clash with app.models.workflow)
    workflow_definition = relationship("app.models.workflow_persistence.WorkflowDefinition", back_populates="executions")
    started_by_user = relationship("app.models.user.User")
    node_executions = relationship("app.models.workflow_persistence.NodeExecution", back_populates="workflow_execution", cascade="all, delete-orphan")
    audit_records = relationship("app.models.workflow_persistence.ExecutionAuditLog", back_populates="execution", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_execution_workflow_status', 'workflow_id', 'status'),
        Index('idx_execution_started_at', 'started_at'),
        Index('idx_execution_user_status', 'started_by', 'status'),
        Index('idx_execution_session', 'session_id'),
        Index('idx_execution_retry', 'next_retry_at'),
        CheckConstraint('progress_percentage >= 0.0 AND progress_percentage <= 100.0', name='check_progress_range'),
    )
    
    def calculate_progress(self) -> float:
        """Calculate execution progress based on completed nodes."""
        if not self.workflow_definition or not self.workflow_definition.nodes:
            return 0.0
            
        total_nodes = len(self.workflow_definition.nodes)
        completed_count = len(self.completed_nodes or [])
        
        return min((completed_count / total_nodes) * 100.0, 100.0)
    
    def add_audit_event(self, event_type: AuditEventType, details: Dict[str, Any], user_id: Optional[uuid.UUID] = None):
        """Add event to execution audit log."""
        audit_event = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type.value,
            "details": details,
            "user_id": str(user_id) if user_id else None
        }
        
        if not self.audit_log:
            self.audit_log = []
        self.audit_log.append(audit_event)
    
    def is_running(self) -> bool:
        """Check if execution is currently active."""
        return self.status in [ExecutionStatus.RUNNING, ExecutionStatus.RETRYING, ExecutionStatus.RECOVERING]
    
    def is_finished(self) -> bool:
        """Check if execution has completed."""
        return self.status in [
            ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, 
            ExecutionStatus.CANCELLED, ExecutionStatus.TIMEOUT
        ]
    
    def can_be_paused(self) -> bool:
        """Check if execution can be paused."""
        return self.status in [ExecutionStatus.RUNNING, ExecutionStatus.WAITING]
    
    def can_be_resumed(self) -> bool:
        """Check if execution can be resumed."""
        return self.status == ExecutionStatus.PAUSED
    
    def __repr__(self):
        return f"<WorkflowExecution(id={self.id}, workflow_id={self.workflow_id}, status={self.status})>"


class NodeExecution(Base):
    """Individual node execution tracking with comprehensive details."""
    __tablename__ = "node_executions_v2"

    # Core identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions_v2.id"), nullable=False, index=True)
    node_id = Column(String(255), nullable=False)
    node_type = Column(String(100), nullable=False)
    node_name = Column(String(255))
    
    # Execution state
    status = Column(SQLEnum(NodeStatus), default=NodeStatus.PENDING, index=True)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    execution_time_ms = Column(Float)
    
    # Data handling
    input_data = Column(JSONType)
    output_data = Column(JSONType)
    result_storage_ref = Column(String(500))  # Reference to object storage for large results
    
    # Error handling
    error_message = Column(Text)
    error_details = Column(JSONType)
    retry_count = Column(Integer, default=0)
    
    # Performance and resource tracking
    resource_usage = Column(JSONType, default=dict)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"))
    
    # Execution metadata
    execution_log = Column(JSONType, default=list)
    dependencies_met = Column(JSONType, default=list)
    conditions_evaluated = Column(JSONType, default=dict)
    
    # Relationships (fully qualified to avoid clash with app.models.workflow)
    workflow_execution = relationship("app.models.workflow_persistence.WorkflowExecution", back_populates="node_executions")
    agent = relationship("app.models.agent.Agent")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_node_execution_lookup', 'execution_id', 'node_id'),
        Index('idx_node_execution_status', 'status', 'started_at'),
        Index('idx_node_execution_agent', 'agent_id'),
        Index('idx_node_execution_timing', 'started_at', 'completed_at'),
    )
    
    def add_log_entry(self, level: str, message: str, details: Optional[Dict[str, Any]] = None):
        """Add entry to execution log."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message,
            "details": details or {}
        }
        
        if not self.execution_log:
            self.execution_log = []
        self.execution_log.append(log_entry)
    
    def calculate_execution_time(self) -> Optional[float]:
        """Calculate execution time in milliseconds."""
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return delta.total_seconds() * 1000
        return None
    
    def __repr__(self):
        return f"<NodeExecution(id={self.id}, node_id={self.node_id}, status={self.status})>"


class ExecutionAuditLog(Base):
    """Immutable audit trail for compliance and security."""
    __tablename__ = "execution_audit_logs"

    # Core identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions_v2.id"), nullable=False, index=True)
    
    # Event details
    event_type = Column(SQLEnum(AuditEventType), nullable=False, index=True)
    event_timestamp = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    
    # User and context
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    session_id = Column(String(255))
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(String(500))
    
    # Event data
    node_id = Column(String(255))
    event_data = Column(JSONType, nullable=False)
    before_state = Column(JSONType)
    after_state = Column(JSONType)
    
    # Integrity verification
    checksum = Column(String(64), nullable=False)  # SHA-256 hash for integrity
    
    # Compliance metadata
    compliance_tags = Column(ArrayType, default=list)
    retention_until = Column(DateTime(timezone=True))
    
    # Relationships (fully qualified to avoid clash with app.models.workflow)
    execution = relationship("app.models.workflow_persistence.WorkflowExecution", back_populates="audit_records")
    user = relationship("app.models.user.User")
    
    # Indexes for audit queries
    __table_args__ = (
        Index('idx_audit_execution_event', 'execution_id', 'event_type'),
        Index('idx_audit_timestamp', 'event_timestamp'),
        Index('idx_audit_user_time', 'user_id', 'event_timestamp'),
        Index('idx_audit_node_event', 'node_id', 'event_type'),
    )
    
    def __init__(self, **kwargs):
        """Initialize audit record with integrity checksum."""
        super().__init__(**kwargs)
        self._calculate_checksum()
    
    def _calculate_checksum(self):
        """Calculate integrity checksum for the audit record."""
        # Create a deterministic string representation
        data_to_hash = {
            "execution_id": str(self.execution_id),
            "event_type": self.event_type.value if self.event_type else None,
            "event_timestamp": self.event_timestamp.isoformat() if self.event_timestamp else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "node_id": self.node_id,
            "event_data": self.event_data
        }
        
        # Create SHA-256 hash
        hash_string = json.dumps(data_to_hash, sort_keys=True, default=str)
        self.checksum = hashlib.sha256(hash_string.encode()).hexdigest()
    
    def verify_integrity(self) -> bool:
        """Verify the integrity of the audit record."""
        original_checksum = self.checksum
        self._calculate_checksum()
        return original_checksum == self.checksum
    
    def __repr__(self):
        return f"<ExecutionAuditLog(id={self.id}, event_type={self.event_type}, timestamp={self.event_timestamp})>"


class WorkflowVersion(Base):
    """Workflow version management and migration tracking."""
    __tablename__ = "workflow_versions"

    # Core identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflow_definitions_v2.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    
    # Version metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    description = Column(Text)
    change_summary = Column(JSONType, default=dict)
    
    # Version relationships
    parent_version_id = Column(UUID(as_uuid=True), ForeignKey("workflow_versions.id"))
    is_active = Column(Boolean, default=True)
    is_deprecated = Column(Boolean, default=False)
    
    # Migration tracking
    migration_status = Column(String(50), default="stable")  # stable, migrating, deprecated
    migration_path = Column(JSONType, default=list)  # Migration instructions
    compatibility_info = Column(JSONType, default=dict)
    
    # Change tracking
    changes = Column(JSONType, default=dict)  # Detailed change information
    breaking_changes = Column(JSONType, default=list)
    migration_notes = Column(Text)
    
    # Relationships
    workflow = relationship("app.models.workflow_persistence.WorkflowDefinition")
    created_by_user = relationship("app.models.user.User")
    parent_version = relationship("app.models.workflow_persistence.WorkflowVersion", remote_side=[id])
    child_versions = relationship("app.models.workflow_persistence.WorkflowVersion", back_populates="parent_version")
    
    # Indexes
    __table_args__ = (
        Index('idx_version_workflow_number', 'workflow_id', 'version_number'),
        Index('idx_version_created_at', 'created_at'),
        Index('idx_version_active', 'is_active'),
        UniqueConstraint('workflow_id', 'version_number', name='uq_workflow_version'),
    )
    
    def __repr__(self):
        return f"<WorkflowVersion(id={self.id}, workflow_id={self.workflow_id}, version={self.version_number})>"