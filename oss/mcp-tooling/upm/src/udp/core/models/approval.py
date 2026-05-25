"""
Database models for approval workflows.

SQLAlchemy models for human-in-the-loop approval workflows with
multi-level approvals, escalations, and comprehensive audit trails.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    UUID,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class ApprovalWorkflow(Base):
    """
    Main approval workflow table.

    Stores approval workflow instances with comprehensive tracking,
    SLA management, and audit capabilities.
    """

    __tablename__ = "approval_workflows"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Organization and project context
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False, index=True
    )
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )

    # Workflow identification
    workflow_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="human_approval"
    )
    request_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Request details
    request_data: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )

    # Requester information
    requester_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False, index=True
    )
    requester_role: Mapped[str] = mapped_column(String(100), nullable=False)

    # Workflow status and progression
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending", index=True
    )
    current_step: Mapped[str] = mapped_column(
        String(100), nullable=False, default="initialize"
    )

    # Approval configuration
    approval_requirements: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    approval_workflow: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    current_approvers: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    approver_roles: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=[])

    # Stakeholder management
    stakeholder_hierarchy: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    stakeholder_responses: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )

    # SLA and escalation management
    sla_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    sla_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="on_time", index=True
    )
    escalation_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    escalation_policies: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    escalation_history: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=[]
    )

    # Decision outcomes
    final_decision: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, index=True
    )
    decision_rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decision_confidence: Mapped[Optional[float]] = mapped_column(Integer, nullable=True)

    # Audit and metadata
    audit_trail: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=[]
    )
    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default={}
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # Tracking fields
    created_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    approval_requirements_rel = relationship(
        "ApprovalRequirement", back_populates="workflow", cascade="all, delete-orphan"
    )
    approval_responses_rel = relationship(
        "ApprovalResponse", back_populates="workflow", cascade="all, delete-orphan"
    )
    audit_logs = relationship(
        "ApprovalAuditLog", back_populates="workflow", cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_approval_workflow_org_status", "organization_id", "status"),
        Index("idx_approval_workflow_requester", "requester_id", "status"),
        Index("idx_approval_workflow_created", "created_at"),
        Index("idx_approval_workflow_sla", "sla_deadline", "sla_status"),
        Index("idx_approval_workflow_type_status", "request_type", "status"),
        CheckConstraint(
            "status IN ('pending', 'in_progress', 'waiting_for_approval', "
            "'approved', 'rejected', 'completed', 'failed', 'cancelled')",
            name="check_approval_workflow_status",
        ),
        CheckConstraint(
            "sla_status IN ('on_time', 'at_risk', 'overdue')", name="check_sla_status"
        ),
        CheckConstraint(
            "escalation_level >= 0", name="check_escalation_level_positive"
        ),
    )


class ApprovalRequirement(Base):
    """
    Individual approval requirements within a workflow.

    Tracks each approval requirement with its status, deadline,
    and escalation information.
    """

    __tablename__ = "approval_requirements"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Workflow reference
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("approval_workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Approver information
    approver_role: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    approver_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    approver_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )

    # Approval details
    approval_type: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100, index=True
    )

    # Status tracking
    approval_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending", index=True
    )
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Deadline and SLA
    deadline: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    # Escalation tracking
    escalation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_escalated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    escalation_policy: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    stakeholder_hierarchy: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=[]
    )

    # Conditions and context
    context: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default={})
    dependencies: Mapped[List[uuid.UUID]] = mapped_column(
        JSONB, nullable=False, default=[]
    )
    auto_approval_conditions: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )
    rejection_conditions: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )

    # Metadata
    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default={}
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    workflow = relationship(
        "ApprovalWorkflow", back_populates="approval_requirements_rel"
    )
    responses = relationship(
        "ApprovalResponse", back_populates="requirement", cascade="all, delete-orphan"
    )

    # Indexes and constraints
    __table_args__ = (
        Index(
            "idx_approval_requirement_workflow_status", "workflow_id", "approval_status"
        ),
        Index(
            "idx_approval_requirement_role_status", "approver_role", "approval_status"
        ),
        Index("idx_approval_requirement_deadline", "deadline"),
        Index("idx_approval_requirement_priority", "priority"),
        CheckConstraint(
            "approval_status IN ('pending', 'approved', 'rejected', 'conditional', "
            "'delegated', 'escalated', 'expired', 'cancelled')",
            name="check_approval_requirement_status",
        ),
        CheckConstraint(
            "escalation_count >= 0", name="check_escalation_count_positive"
        ),
    )


class ApprovalResponse(Base):
    """
    Individual approval responses.

    Stores stakeholder responses with validation, conditions,
    and comprehensive audit information.
    """

    __tablename__ = "approval_responses"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Reference to requirement
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("approval_requirements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("approval_workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Approver information
    approver_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False, index=True
    )
    approver_email: Mapped[str] = mapped_column(String(255), nullable=False)
    approver_role: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Response details
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    conditions: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=[])

    # Assessment information
    risk_assessment: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )
    alternative_suggestions: Mapped[List[str]] = mapped_column(
        JSONB, nullable=False, default=[]
    )
    confidence_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Security and audit
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    digital_signature: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Response timestamp
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    # Metadata
    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default={}
    )

    # Relationships
    requirement = relationship("ApprovalRequirement", back_populates="responses")
    workflow = relationship("ApprovalWorkflow", back_populates="approval_responses_rel")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_approval_response_requirement", "requirement_id", "status"),
        Index("idx_approval_response_approver", "approver_id", "responded_at"),
        Index("idx_approval_response_workflow", "workflow_id", "status"),
        Index("idx_approval_response_timestamp", "responded_at"),
        CheckConstraint(
            "status IN ('approved', 'rejected', 'conditional', 'delegated', 'escalated')",
            name="check_approval_response_status",
        ),
        CheckConstraint(
            "confidence_level IN ('low', 'medium', 'high') OR confidence_level IS NULL",
            name="check_confidence_level",
        ),
    )


class ApprovalAuditLog(Base):
    """
    Comprehensive audit log for approval workflows.

    Tracks all events, decisions, and changes for compliance
    and security auditing requirements.
    """

    __tablename__ = "approval_audit_logs"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Workflow reference
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("approval_workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Event information
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    # Event details
    event_data: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )

    # Actor information
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    actor_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    actor_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Change tracking
    previous_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )
    new_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # Security and compliance
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Additional metadata
    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default={}
    )

    # Relationships
    workflow = relationship("ApprovalWorkflow", back_populates="audit_logs")

    # Indexes
    __table_args__ = (
        Index("idx_approval_audit_workflow_event", "workflow_id", "event_type"),
        Index("idx_approval_audit_timestamp", "event_timestamp"),
        Index("idx_approval_audit_actor", "actor_id", "event_timestamp"),
        Index("idx_approval_audit_event_type", "event_type", "event_timestamp"),
    )


class ApprovalTemplate(Base):
    """
    Approval workflow templates.

    Defines reusable approval templates for different request types
    and organizational policies.
    """

    __tablename__ = "approval_templates"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Template identification
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Organization scope
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False, index=True
    )
    is_global: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )

    # Template configuration
    approval_stages: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    stakeholder_configuration: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    escalation_policies: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    sla_configuration: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )

    # Conditions and rules
    auto_approval_conditions: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    routing_rules: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    validation_rules: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )

    # Template metadata
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0")
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
    )
    tags: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=[])

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Creator information
    created_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Indexes
    __table_args__ = (
        Index("idx_approval_template_org_type", "organization_id", "request_type"),
        Index("idx_approval_template_active", "is_active", "request_type"),
        Index("idx_approval_template_name", "name"),
    )
