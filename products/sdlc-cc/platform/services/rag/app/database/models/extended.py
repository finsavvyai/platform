"""
Additional SQLAlchemy models for the RAG service.

This module contains the remaining models including policy evaluations,
API keys, audit logs, and token usage tracking.
"""

import datetime
import enum
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    CheckConstraint,
    Float,
    JSON,
    BigInteger,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.expression import text

from .base import (
    Base,
    UUIDMixin,
    TimestampMixin,
    TenantMixin,
    SoftDeleteMixin,
    UserRole,
    AuditAction,
    DocumentStatus,
)


class PolicyEvaluation(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """Policy evaluation results."""

    __tablename__ = "policy_evaluations"

    policy_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    input_data = Column(JSON, nullable=False)
    result = Column(Boolean, nullable=False, index=True)
    explanation = Column(Text)
    duration_ms = Column(Integer)
    metadata = Column(JSON, nullable=False, default=dict)

    # Relationships
    tenant = relationship("Tenant")
    policy = relationship("Policy", back_populates="policy_evaluations")
    user = relationship("User", back_populates="policy_evaluations")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("duration_ms >= 0", name="chk_eval_duration_ms"),
        Index("idx_policy_evaluations_policy_result", "policy_id", "result"),
        Index("idx_policy_evaluations_user_created", "user_id", "created_at"),
        Index("idx_policy_evaluations_tenant_created", "tenant_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<PolicyEvaluation(id={self.id}, policy_id={self.policy_id}, result={self.result})>"

    def is_allow(self) -> bool:
        """Check if evaluation result is allow."""
        return self.result

    def is_deny(self) -> bool:
        """Check if evaluation result is deny."""
        return not self.result

    def get_performance_score(self) -> float:
        """Get performance score based on duration."""
        if self.duration_ms is None:
            return 0.0
        # Lower duration is better, normalize to 0-100 scale
        # Assume 1000ms as baseline for score calculation
        return max(0.0, 100.0 - (self.duration_ms / 10.0))


class APIKey(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """API key management."""

    __tablename__ = "api_keys"

    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True, index=True)
    key_prefix = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), index=True)
    last_used = Column(DateTime(timezone=True), index=True)
    usage_count = Column(Integer, default=0, nullable=False)
    max_usage = Column(Integer)
    permissions = Column(JSON, nullable=False, default=list)
    rate_limit = Column(Integer, default=1000, nullable=False)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    metadata = Column(JSON, nullable=False, default=dict)

    # Relationships
    tenant = relationship("Tenant")
    creator = relationship("User")
    token_usage = relationship(
        "TokenUsage", back_populates="api_key", cascade="all, delete-orphan"
    )

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("usage_count >= 0", name="chk_api_usage_count"),
        CheckConstraint("max_usage > 0", name="chk_api_max_usage"),
        CheckConstraint("rate_limit >= 0", name="chk_api_rate_limit"),
        UniqueConstraint("tenant_id", "name", name="uq_api_key_tenant_name"),
        Index("idx_api_keys_prefix_active", "key_prefix", "is_active"),
        Index("idx_api_keys_tenant_active", "tenant_id", "is_active"),
        Index("idx_api_keys_expires_active", "expires_at", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<APIKey(id={self.id}, name={self.name}, prefix={self.key_prefix}, active={self.is_active})>"

    def is_expired(self) -> bool:
        """Check if API key is expired."""
        if self.expires_at is None:
            return False
        return datetime.datetime.utcnow() > self.expires_at

    def is_usage_exceeded(self) -> bool:
        """Check if API key has exceeded its usage limit."""
        if self.max_usage is None or self.max_usage <= 0:
            return False
        return self.usage_count >= self.max_usage

    def is_valid(self) -> bool:
        """Check if API key is currently valid."""
        return self.is_active and not self.is_expired() and not self.is_usage_exceeded()

    def update_last_usage(self) -> None:
        """Update last used timestamp and increment usage count."""
        self.last_used = datetime.datetime.utcnow()
        self.usage_count += 1

    def revoke(self) -> None:
        """Revoke the API key."""
        self.is_active = False

    def renew(self, duration: datetime.timedelta) -> None:
        """Extend API key expiration."""
        if self.expires_at is None:
            self.expires_at = datetime.datetime.utcnow() + duration
        else:
            self.expires_at += duration
        self.is_active = True

    def has_permission(self, permission: str) -> bool:
        """Check if API key has specific permission."""
        return permission in self.permissions

    def get_usage_percentage(self) -> float:
        """Get usage percentage based on max usage."""
        if self.max_usage is None or self.max_usage <= 0:
            return 0.0
        return (self.usage_count / self.max_usage) * 100.0


class TokenUsage(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """API token usage tracking."""

    __tablename__ = "token_usage"

    api_key_id = Column(
        UUID(as_uuid=True),
        ForeignKey("api_keys.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    tokens_used = Column(Integer, nullable=False)
    cost_usd = Column(Numeric(10, 4), nullable=False)
    model = Column(String(100), nullable=False, index=True)
    operation = Column(String(100), nullable=False, index=True)
    duration_ms = Column(Integer, nullable=False)
    request_id = Column(UUID(as_uuid=True), index=True)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    metadata = Column(JSON, nullable=False, default=dict)

    # Relationships
    tenant = relationship("Tenant")
    api_key = relationship("APIKey", back_populates="token_usage")
    user = relationship("User", back_populates="token_usage")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("tokens_used > 0", name="chk_tokens_used"),
        CheckConstraint("cost_usd >= 0", name="chk_cost_usd"),
        CheckConstraint("duration_ms >= 0", name="chk_duration_ms"),
        Index("idx_token_usage_api_key_created", "api_key_id", "created_at"),
        Index("idx_token_usage_user_created", "user_id", "created_at"),
        Index("idx_token_usage_model_created", "model", "created_at"),
        Index("idx_token_usage_operation_created", "operation", "created_at"),
        Index("idx_token_usage_request_id", "request_id"),
    )

    def __repr__(self) -> str:
        return f"<TokenUsage(id={self.id}, api_key_id={self.api_key_id}, tokens={self.tokens_used}, cost={self.cost_usd})>"

    def get_cost_per_token(self) -> float:
        """Calculate cost per token."""
        if self.tokens_used == 0:
            return 0.0
        return float(self.cost_usd) / self.tokens_used

    def get_tokens_per_second(self) -> float:
        """Calculate tokens per second."""
        if self.duration_ms is None or self.duration_ms == 0:
            return 0.0
        return (self.tokens_used * 1000.0) / self.duration_ms

    def is_high_cost(self, threshold: float = 0.10) -> bool:
        """Check if usage cost exceeds threshold."""
        return float(self.cost_usd) > threshold

    def is_slow(self, threshold_ms: int = 5000) -> bool:
        """Check if operation was slow."""
        return self.duration_ms > threshold_ms


class DocumentAccessLog(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """Document access logging."""

    __tablename__ = "document_access_log"

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action = Column(Enum(AuditAction), nullable=False, index=True)
    access_level = Column(String(50), nullable=False)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    success = Column(Boolean, default=True, nullable=False, index=True)
    reason = Column(Text)
    request_id = Column(UUID(as_uuid=True), index=True)
    session_id = Column(UUID(as_uuid=True), index=True)
    metadata = Column(JSON, nullable=False, default=dict)

    # Relationships
    tenant = relationship("Tenant")
    document = relationship("Document", back_populates="access_logs")
    user = relationship("User", back_populates="document_access_logs")

    # Constraints and indexes
    __table_args__ = (
        Index("idx_document_access_document_action", "document_id", "action"),
        Index("idx_document_access_user_action", "user_id", "action"),
        Index("idx_document_access_success_created", "success", "created_at"),
        Index("idx_document_access_request_id", "request_id"),
        Index("idx_document_access_session_id", "session_id"),
    )

    def __repr__(self) -> str:
        return f"<DocumentAccessLog(id={self.id}, document_id={self.document_id}, action={self.action}, success={self.success})>"

    def is_access_granted(self) -> bool:
        """Check if access was granted."""
        return self.success

    def is_access_denied(self) -> bool:
        """Check if access was denied."""
        return not self.success

    def is_sensitive_action(self) -> bool:
        """Check if action is sensitive."""
        sensitive_actions = [AuditAction.DELETE, AuditAction.UPDATE]
        return self.action in sensitive_actions

    def get_risk_score(self) -> int:
        """Calculate risk score for the access."""
        score = 0

        # Action risk
        if self.action == AuditAction.DELETE:
            score += 30
        elif self.action == AuditAction.UPDATE:
            score += 20
        elif self.action == AuditAction.READ:
            score += 10

        # Success risk (failed accesses are riskier)
        if not self.success:
            score += 15

        # Time-based risk (access outside business hours)
        access_hour = self.created_at.hour
        if access_hour < 9 or access_hour > 17:
            score += 10

        return min(score, 100)  # Cap at 100


class AuditLog(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """Comprehensive audit trail."""

    __tablename__ = "audit_logs"

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action = Column(Enum(AuditAction), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(UUID(as_uuid=True), index=True)
    details = Column(JSON, nullable=False, default=dict)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    session_id = Column(UUID(as_uuid=True), index=True)
    request_id = Column(UUID(as_uuid=True), index=True)
    response_status = Column(Integer, index=True)
    processing_time_ms = Column(Integer)
    metadata = Column(JSON, nullable=False, default=dict)
    compliance_tags = Column(JSON, nullable=False, default=list)

    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            "response_status >= 100 AND response_status <= 599",
            name="chk_response_status",
        ),
        CheckConstraint("processing_time_ms >= 0", name="chk_processing_time_ms"),
        Index("idx_audit_logs_user_action", "user_id", "action"),
        Index("idx_audit_logs_resource", "resource_type", "resource_id"),
        Index("idx_audit_logs_action_created", "action", "created_at"),
        Index("idx_audit_logs_status_created", "response_status", "created_at"),
        Index("idx_audit_logs_request_id", "request_id"),
        Index("idx_audit_logs_session_id", "session_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action={self.action}, resource={self.resource_type}, user_id={self.user_id})>"

    def is_success(self) -> bool:
        """Check if operation was successful."""
        if self.response_status is None:
            return True
        return 200 <= self.response_status < 300

    def is_error(self) -> bool:
        """Check if operation resulted in an error."""
        return not self.is_success()

    def is_client_error(self) -> bool:
        """Check if operation resulted in client error."""
        return self.response_status is not None and 400 <= self.response_status < 500

    def is_server_error(self) -> bool:
        """Check if operation resulted in server error."""
        return self.response_status is not None and 500 <= self.response_status < 600

    def is_sensitive_action(self) -> bool:
        """Check if action is sensitive."""
        sensitive_actions = [
            AuditAction.CREATE,
            AuditAction.UPDATE,
            AuditAction.DELETE,
            AuditAction.LOGIN,
            AuditAction.ACCESS_DENIED,
        ]
        return self.action in sensitive_actions

    def get_severity_level(self) -> str:
        """Get severity level based on action and status."""
        if self.action == AuditAction.ACCESS_DENIED:
            return "high"
        elif self.action in [AuditAction.DELETE, AuditAction.UPDATE]:
            return "medium"
        elif self.is_server_error():
            return "medium"
        elif self.action in [AuditAction.READ]:
            return "low"
        else:
            return "info"

    def get_performance_impact(self) -> str:
        """Get performance impact based on processing time."""
        if self.processing_time_ms is None:
            return "unknown"
        elif self.processing_time_ms > 5000:
            return "high"
        elif self.processing_time_ms > 1000:
            return "medium"
        else:
            return "low"

    def has_compliance_tag(self, tag: str) -> bool:
        """Check if audit log has specific compliance tag."""
        return tag in self.compliance_tags

    def add_compliance_tag(self, tag: str) -> None:
        """Add a compliance tag."""
        if tag not in self.compliance_tags:
            self.compliance_tags.append(tag)


# Materialized View Models (for querying purposes)
class TenantStatistics(Base):
    """Materialized view for tenant statistics."""

    __tablename__ = "tenant_statistics"

    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False)
    subscription_tier = Column(String(50), nullable=False)
    tenant_created_at = Column(DateTime(timezone=True), nullable=False)
    total_users = Column(BigInteger, nullable=False)
    active_users = Column(BigInteger, nullable=False)
    total_documents = Column(BigInteger, nullable=False)
    processed_documents = Column(BigInteger, nullable=False)
    total_storage_bytes = Column(BigInteger, nullable=False)
    total_tokens = Column(BigInteger, nullable=False)
    total_tokens_consumed = Column(BigInteger, nullable=False)
    total_cost_usd = Column(Numeric(15, 2), nullable=False)
    dlp_scanned_documents = Column(BigInteger, nullable=False)
    avg_dlp_risk_score = Column(Float)
    active_policies = Column(BigInteger, nullable=False)
    active_enabled_policies = Column(BigInteger, nullable=False)
    last_user_activity = Column(DateTime(timezone=True))
    active_sessions = Column(BigInteger, nullable=False)

    # Indexes
    __table_args__ = (
        Index("idx_tenant_stats_status", "status"),
        Index("idx_tenant_stats_subscription", "subscription_tier"),
        Index("idx_tenant_stats_created", "tenant_created_at"),
        Index("idx_tenant_stats_activity", "last_user_activity"),
    )

    def __repr__(self) -> str:
        return f"<TenantStatistics(id={self.id}, name={self.name}, users={self.total_users}, docs={self.total_documents})>"

    def get_user_activity_rate(self) -> float:
        """Calculate user activity rate."""
        if self.total_users == 0:
            return 0.0
        return (self.active_users / self.total_users) * 100.0

    def get_document_processing_rate(self) -> float:
        """Calculate document processing rate."""
        if self.total_documents == 0:
            return 0.0
        return (self.processed_documents / self.total_documents) * 100.0

    def get_average_cost_per_token(self) -> float:
        """Calculate average cost per token."""
        if self.total_tokens_consumed == 0:
            return 0.0
        return float(self.total_cost_usd) / self.total_tokens_consumed

    def is_high_usage_tenant(self) -> bool:
        """Check if tenant has high usage."""
        return (
            self.total_tokens_consumed > 1000000  # 1M tokens
            or self.total_storage_bytes > 10 * 1024 * 1024 * 1024
        )  # 10GB


class DocumentProcessingQueue(Base):
    """View for document processing queue monitoring."""

    __tablename__ = "document_processing_queue"

    id = Column(UUID(as_uuid=True), primary_key=True)
    document_id = Column(UUID(as_uuid=True), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    job_type = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    progress = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True))
    retry_count = Column(Integer, nullable=False)
    max_retries = Column(Integer, nullable=False)
    filename = Column(String(1000), nullable=False)
    content_type = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    tenant_name = Column(String(255), nullable=False)
    created_by_email = Column(String(255), nullable=False)
    queue_status = Column(String(100), nullable=False)
    wait_time_seconds = Column(Float, nullable=False)

    # Indexes
    __table_args__ = (
        Index("idx_processing_queue_status", "status"),
        Index("idx_processing_queue_tenant", "tenant_id"),
        Index("idx_processing_queue_created", "created_at"),
        Index("idx_processing_queue_job_type", "job_type"),
    )

    def __repr__(self) -> str:
        return f"<DocumentProcessingQueue(id={self.id}, status={self.status}, progress={self.progress})>"

    def is_waiting(self) -> bool:
        """Check if job is waiting in queue."""
        return self.status == "pending" and self.started_at is None

    def is_processing(self) -> bool:
        """Check if job is currently processing."""
        return self.status == "processing"

    def is_failed(self) -> bool:
        """Check if job has failed."""
        return self.status == "failed"

    def is_completed(self) -> bool:
        """Check if job is completed."""
        return self.status == "completed"

    def can_retry(self) -> bool:
        """Check if job can be retried."""
        return self.retry_count < self.max_retries and self.is_failed()

    def get_retry_progress(self) -> float:
        """Get retry progress as percentage."""
        if self.max_retries == 0:
            return 0.0
        return (self.retry_count / self.max_retries) * 100.0

    def is_long_waiting(self, threshold_minutes: int = 30) -> bool:
        """Check if job has been waiting too long."""
        if not self.is_waiting():
            return False
        wait_time = datetime.datetime.utcnow() - self.created_at
        return wait_time.total_seconds() > (threshold_minutes * 60)

    def get_queue_position_score(self) -> float:
        """Calculate queue position priority score."""
        score = 0.0

        # Newer jobs get higher priority (newer creation time)
        age_hours = (
            datetime.datetime.utcnow() - self.created_at
        ).total_seconds() / 3600
        score += min(age_hours * 2, 20)  # Max 20 points for age

        # Failed jobs get priority boost
        if self.is_failed():
            score += 10

        # Large files get lower priority
        if self.file_size > 50 * 1024 * 1024:  # 50MB
            score -= 5

        # Retry progress affects priority
        retry_penalty = self.get_retry_progress() * 0.1
        score -= retry_penalty

        return max(score, 0.0)
