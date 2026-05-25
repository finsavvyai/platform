"""
Database models for SDLC.ai DLP Service.

This module defines all database models for the DLP scanning pipeline,
including tenants, policies, rules, patterns, violations, and audit logs.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional, Union

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class Tenant(Base):
    """Multi-tenant configuration model."""

    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # DLP Configuration
    dlp_config = Column(JSON, default=dict)

    # Relationships
    dlp_policies = relationship(
        "DLPPolicy", back_populates="tenant", cascade="all, delete-orphan"
    )
    dlp_violations = relationship(
        "DLPViolation", back_populates="tenant", cascade="all, delete-orphan"
    )
    custom_patterns = relationship(
        "CustomPattern", back_populates="tenant", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Tenant(id={self.id}, name={self.name}, slug={self.slug})>"


class DLPPolicy(Base):
    """DLP policy configuration model."""

    __tablename__ = "dlp_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    version = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=100)

    # Policy Configuration
    config = Column(JSON, nullable=False, default=dict)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String(255))

    # Relationships
    tenant = relationship("Tenant", back_populates="dlp_policies")
    dlp_rules = relationship(
        "DLPRule", back_populates="policy", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "version", name="unique_policy_version"),
    )

    def __repr__(self):
        return f"<DLPPolicy(id={self.id}, name={self.name}, version={self.version})>"


class DLPRule(Base):
    """DLP rule configuration model."""

    __tablename__ = "dlp_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(
        UUID(as_uuid=True), ForeignKey("dlp_policies.id"), nullable=False
    )
    name = Column(String(255), nullable=False)
    description = Column(Text)
    rule_type = Column(String(50), nullable=False)  # regex, ml, presidio, composite

    # Rule Configuration
    conditions = Column(JSON, nullable=False, default=dict)
    actions = Column(JSON, nullable=False, default=dict)

    # Rule Properties
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=100)
    confidence_threshold = Column(Numeric(3, 2), default=Decimal("0.80"))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String(255))

    # Relationships
    policy = relationship("DLPPolicy", back_populates="dlp_rules")

    def __repr__(self):
        return f"<DLPRule(id={self.id}, name={self.name}, type={self.rule_type})>"


class RegexPattern(Base):
    """Regex pattern configuration model."""

    __tablename__ = "regex_patterns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)
    category = Column(String(100), nullable=False)
    subcategory = Column(String(100))

    # Pattern Configuration
    pattern = Column(Text, nullable=False)
    flags = Column(JSON, default=dict)  # regex flags
    confidence = Column(Numeric(3, 2), default=Decimal("0.90"))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String(255))

    # Relationships
    rule_patterns = relationship("RulePattern", back_populates="pattern")

    def __repr__(self):
        return (
            f"<RegexPattern(id={self.id}, name={self.name}, category={self.category})>"
        )


class CustomPattern(Base):
    """Tenant-specific custom patterns."""

    __tablename__ = "custom_patterns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100), nullable=False)

    # Pattern Configuration
    pattern = Column(Text, nullable=False)
    flags = Column(JSON, default=dict)
    confidence = Column(Numeric(3, 2), default=Decimal("0.90"))

    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String(255))

    # Relationships
    tenant = relationship("Tenant", back_populates="custom_patterns")

    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="unique_tenant_pattern"),
    )

    def __repr__(self):
        return (
            f"<CustomPattern(id={self.id}, name={self.name}, tenant={self.tenant_id})>"
        )


class RulePattern(Base):
    """Association table for rules and patterns."""

    __tablename__ = "rule_patterns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("dlp_rules.id"), nullable=False)
    pattern_id = Column(
        UUID(as_uuid=True), ForeignKey("regex_patterns.id"), nullable=False
    )

    # Configuration
    weight = Column(Numeric(3, 2), default=Decimal("1.0"))
    is_required = Column(Boolean, default=False)

    # Relationships
    pattern = relationship("RegexPattern", back_populates="rule_patterns")

    def __repr__(self):
        return f"<RulePattern(rule_id={self.rule_id}, pattern_id={self.pattern_id})>"


class ViolationSeverity(str, Enum):
    """Violation severity levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ViolationStatus(str, Enum):
    """Violation status values."""

    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    IGNORED = "IGNORED"


class DLPViolation(Base):
    """DLP violation record model."""

    __tablename__ = "dlp_violations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    scan_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Violation Details
    rule_id = Column(UUID(as_uuid=True), ForeignKey("dlp_rules.id"))
    violation_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)
    confidence = Column(Numeric(3, 2), nullable=False)

    # Location Information
    content_type = Column(String(100))
    content_path = Column(String(1000))
    line_number = Column(Integer)
    column_number = Column(Integer)
    context = Column(Text)

    # Violation Data
    detected_value = Column(Text)
    entity_type = Column(String(100))
    pattern_name = Column(String(255))

    # Metadata
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Status Management
    status = Column(String(20), default=ViolationStatus.OPEN)
    assigned_to = Column(String(255))
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)

    # Relationships
    tenant = relationship("Tenant", back_populates="dlp_violations")
    rule = relationship("DLPRule")

    def __repr__(self):
        return f"<DLPViolation(id={self.id}, type={self.violation_type}, severity={self.severity})>"


class DLPS(Base):
    """DLP scan record model."""

    __tablename__ = "dlp_scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    scan_id = Column(String(100), unique=True, nullable=False, index=True)

    # Scan Details
    content_type = Column(String(100))
    content_size_bytes = Column(Integer)
    content_path = Column(String(1000))

    # Scan Configuration
    policies_applied = Column(JSON, default=list)
    rules_applied = Column(JSON, default=list)

    # Scan Results
    total_violations = Column(Integer, default=0)
    violations_by_severity = Column(JSON, default=dict)
    violations_by_type = Column(JSON, default=dict)
    risk_score = Column(Numeric(5, 2))

    # Performance Metrics
    scan_duration_ms = Column(Integer)
    processing_time_ms = Column(Integer)

    # Status
    status = Column(
        String(20), default="COMPLETED"
    )  # PENDING, RUNNING, COMPLETED, FAILED

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))
    metadata = Column(JSON, default=dict)

    def __repr__(self):
        return f"<DLPS(id={self.id}, scan_id={self.scan_id}, status={self.status})>"


class AuditLog(Base):
    """Audit log for compliance and monitoring."""

    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))

    # Event Details
    event_type = Column(String(100), nullable=False)
    event_category = Column(String(100), nullable=False)
    event_action = Column(String(100), nullable=False)

    # Event Data
    resource_type = Column(String(100))
    resource_id = Column(String(255))
    user_id = Column(String(255))
    user_email = Column(String(255))

    # Event Details
    description = Column(Text)
    details = Column(JSON, default=dict)

    # Request Information
    ip_address = Column(String(45))
    user_agent = Column(Text)
    request_id = Column(String(100))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<AuditLog(id={self.id}, event_type={self.event_type}, user={self.user_id})>"


class PerformanceMetrics(Base):
    """Performance metrics for monitoring and optimization."""

    __tablename__ = "performance_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))

    # Metric Details
    metric_name = Column(String(100), nullable=False)
    metric_type = Column(String(50), nullable=False)  # counter, gauge, histogram

    # Metric Values
    value = Column(Numeric(15, 4), nullable=False)
    unit = Column(String(20))

    # Context
    context = Column(JSON, default=dict)

    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<PerformanceMetrics(id={self.id}, name={self.metric_name}, value={self.value})>"


class MLModel(Base):
    """ML model configuration and metadata."""

    __tablename__ = "ml_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    version = Column(String(50), nullable=False)
    model_type = Column(String(50), nullable=False)  # classification, regression, ner

    # Model Configuration
    model_path = Column(String(500))
    config = Column(JSON, default=dict)

    # Performance Metrics
    accuracy = Column(Numeric(3, 2))
    precision = Column(Numeric(3, 2))
    recall = Column(Numeric(3, 2))
    f1_score = Column(Numeric(3, 2))

    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String(255))

    def __repr__(self):
        return f"<MLModel(id={self.id}, name={self.name}, version={self.version})>"


# Redaction System Models


class RedactionPolicy(Base):
    """Redaction policy configuration model."""

    __tablename__ = "redaction_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    policy_id = Column(String(100), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Policy Configuration
    entity_types = Column(
        JSON, nullable=False, default=list
    )  # List of entity types to redact
    masking_strategies = Column(
        JSON, nullable=False, default=dict
    )  # Entity type -> masking strategy
    redaction_level = Column(
        String(20), nullable=False, default="STANDARD"
    )  # MINIMAL, STANDARD, COMPREHENSIVE
    custom_rules = Column(JSON, nullable=False, default=list)  # Custom redaction rules
    preserve_format = Column(Boolean, default=True)
    quality_threshold = Column(Numeric(3, 2), default=Decimal("0.80"))

    # Policy Management
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String(255))

    def __repr__(self):
        return f"<RedactionPolicy(id={self.id}, name={self.name}, level={self.redaction_level})>"


class RedactionLog(Base):
    """Redaction audit log model."""

    __tablename__ = "redaction_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audit_log_id = Column(String(100), nullable=False, unique=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id = Column(String(255))

    # Redaction Details
    policy_id = Column(String(100), nullable=False)
    policy_name = Column(String(255), nullable=False)
    original_content_hash = Column(String(64), nullable=False, index=True)
    redacted_content = Column(Text, nullable=False)
    entities_found = Column(JSON, nullable=False, default=list)
    tokens_created = Column(Integer, default=0)
    quality_score = Column(Numeric(3, 2), nullable=False)

    # Performance Metrics
    processing_time_ms = Column(Integer)
    processing_timestamp = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Metadata
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<RedactionLog(id={self.id}, audit_id={self.audit_log_id}, tenant={self.tenant_id})>"


class RedactionToken(Base):
    """Token storage for reversible redaction."""

    __tablename__ = "redaction_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_id = Column(String(64), nullable=False, unique=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    audit_log_id = Column(String(100), nullable=False, index=True)

    # Token Details
    entity_type = Column(String(100), nullable=False)
    original_value = Column(Text, nullable=False)  # Encrypted
    token_value = Column(String(50), nullable=False, index=True)

    # Access Control
    access_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(255))

    def __repr__(self):
        return f"<RedactionToken(id={self.id}, type={self.entity_type}, token={self.token_value})>"


class RedactionQualityMetrics(Base):
    """Redaction quality monitoring model."""

    __tablename__ = "redaction_quality_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    audit_log_id = Column(String(100), nullable=False, index=True)

    # Quality Metrics
    quality_score = Column(Numeric(3, 2), nullable=False)
    entity_coverage_rate = Column(
        Numeric(5, 4), nullable=False
    )  # Percentage of entities redacted
    false_positive_rate = Column(Numeric(5, 4), default=Decimal("0.00"))
    false_negative_rate = Column(Numeric(5, 4), default=Decimal("0.00"))
    format_preservation_score = Column(Numeric(3, 2), nullable=False)

    # Validation Results
    validation_passed = Column(Boolean, nullable=False)
    validation_errors = Column(JSON, default=list)
    manual_review_required = Column(Boolean, default=False)
    review_status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED

    # Performance Metrics
    processing_time_ms = Column(Integer)
    throughput_entities_per_sec = Column(Numeric(10, 2))

    # Metadata
    metrics_version = Column(String(10), default="1.0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True))
    reviewed_by = Column(String(255))

    def __repr__(self):
        return f"<RedactionQualityMetrics(id={self.id}, score={self.quality_score}, passed={self.validation_passed})>"
