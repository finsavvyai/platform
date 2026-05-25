"""
API Gateway Database Models

This module defines the database models for the API gateway system including:
- API keys with scoped permissions
- Rate limit configurations
- Usage tracking and analytics
- Gateway configurations and policies
- WebSocket connection management

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text, Index, Float, JSON, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, joinedload
from sqlalchemy.sql import func
from sqlalchemy.ext.hybrid import hybrid_property
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from enum import Enum
import logging

from app.core.database import Base

logger = logging.getLogger(__name__)


class APIKeyScope(str, Enum):
    """API key permission scopes"""
    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    ADMIN = "admin"
    WORKFLOW_EXECUTE = "workflow_execute"
    DOCUMENT_ACCESS = "document_access"
    AGENT_CONTROL = "agent_control"
    INFRASTRUCTURE_MANAGE = "infrastructure_manage"
    SYSTEM_MONITOR = "system_monitor"


class APIKeyStatus(str, Enum):
    """API key status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    REVOKED = "revoked"


class RateLimitType(str, Enum):
    """Rate limit types"""
    PER_KEY = "per_key"
    PER_USER = "per_user"
    PER_ORGANIZATION = "per_organization"
    PER_IP = "per_ip"
    GLOBAL = "global"


class APIKey(Base):
    """
    Enterprise API Key model with comprehensive security and management features
    """

    __tablename__ = "api_keys"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    key_id = Column(String(100), unique=True, nullable=False, index=True)  # Human-readable key ID
    key_hash = Column(String(255), unique=True, nullable=False, index=True)  # Hashed API key
    key_prefix = Column(String(20), nullable=False, index=True)  # First few characters for identification

    # Key ownership and organization
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)

    # Key details and permissions
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    scope = Column(String(50), nullable=False)  # APIKeyScope enum
    permissions = Column(ARRAY(String), default=list)  # Specific permissions
    allowed_endpoints = Column(ARRAY(String), default=list)  # Endpoint restrictions
    denied_endpoints = Column(ARRAY(String), default=list)  # Explicitly denied endpoints

    # Rate limiting and quotas
    rate_limit_per_minute = Column(Integer, default=1000)
    rate_limit_per_hour = Column(Integer, default=50000)
    rate_limit_per_day = Column(Integer, default=1000000)
    quota_bytes_per_month = Column(BigInteger, nullable=True)  # Data transfer quota

    # Key lifecycle and security
    status = Column(String(20), default=APIKeyStatus.ACTIVE)  # APIKeyStatus enum
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    last_used_ip = Column(String(45), nullable=True)  # IPv6 compatible
    usage_count = Column(BigInteger, default=0)

    # Security restrictions
    allowed_ip_addresses = Column(ARRAY(String), default=list)  # IP whitelist
    allowed_origins = Column(ARRAY(String), default=list)  # CORS origins
    require_mfa = Column(Boolean, default=False)
    enforce_rate_limits = Column(Boolean, default=True)

    # Metadata and audit
    metadata = Column(JSONB, default=dict)
    tags = Column(ARRAY(String), default=list)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    revoke_reason = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="api_keys", foreign_keys=[user_id])
    organization = relationship("Organization", back_populates="api_keys", foreign_keys=[organization_id])
    creator = relationship("User", foreign_keys=[created_by])
    revoker = relationship("User", foreign_keys=[revoked_by])
    usage_logs = relationship("APIUsageLog", back_populates="api_key", cascade="all, delete-orphan")

    # Indexes and constraints
    __table_args__ = (
        Index('idx_api_key_user_status', 'user_id', 'status'),
        Index('idx_api_key_org_status', 'organization_id', 'status'),
        Index('idx_api_key_scope_status', 'scope', 'status'),
        Index('idx_api_key_expires', 'expires_at', 'status'),
        Index('idx_api_key_last_used', 'last_used_at'),
        Index('idx_api_key_prefix_hash', 'key_prefix', 'key_hash'),
    )

    def __repr__(self):
        return f"<APIKey(id={self.id}, key_id={self.key_id}, scope={self.scope}, status={self.status})>"

    @hybrid_property
    def is_active(self) -> bool:
        """Check if API key is currently active"""
        return (
            self.status == APIKeyStatus.ACTIVE and
            (self.expires_at is None or self.expires_at > datetime.utcnow())
        )

    @is_active.expression
    def is_active(cls):
        return and_(
            cls.status == APIKeyStatus.ACTIVE,
            or_(cls.expires_at.is_(None), cls.expires_at > func.now())
        )

    @property
    def days_until_expiry(self) -> Optional[int]:
        """Get days until key expires"""
        if not self.expires_at:
            return None
        delta = self.expires_at - datetime.utcnow()
        return max(0, delta.days)

    def check_rate_limit(self, limit_type: RateLimitType, period: str) -> int:
        """Get rate limit for specific type and period"""
        limits = {
            RateLimitType.PER_KEY: {
                "minute": self.rate_limit_per_minute,
                "hour": self.rate_limit_per_hour,
                "day": self.rate_limit_per_day,
            }
        }
        return limits.get(limit_type, {}).get(period, 0)

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert API key to dictionary"""
        data = {
            'id': str(self.id),
            'key_id': self.key_id,
            'key_prefix': self.key_prefix,
            'user_id': str(self.user_id),
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'name': self.name,
            'description': self.description,
            'scope': self.scope,
            'permissions': self.permissions,
            'allowed_endpoints': self.allowed_endpoints,
            'denied_endpoints': self.denied_endpoints,
            'rate_limit_per_minute': self.rate_limit_per_minute,
            'rate_limit_per_hour': self.rate_limit_per_hour,
            'rate_limit_per_day': self.rate_limit_per_day,
            'quota_bytes_per_month': self.quota_bytes_per_month,
            'status': self.status,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'last_used_ip': self.last_used_ip,
            'usage_count': self.usage_count,
            'allowed_ip_addresses': self.allowed_ip_addresses,
            'allowed_origins': self.allowed_origins,
            'require_mfa': self.require_mfa,
            'enforce_rate_limits': self.enforce_rate_limits,
            'metadata': self.metadata,
            'tags': self.tags,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'revoked_at': self.revoked_at.isoformat() if self.revoked_at else None,
            'revoke_reason': self.revoke_reason,
            'is_active': self.is_active,
            'days_until_expiry': self.days_until_expiry,
        }

        if include_sensitive:
            data['key_hash'] = self.key_hash
            data['created_by'] = str(self.created_by) if self.created_by else None
            data['revoked_by'] = str(self.revoked_by) if self.revoked_by else None

        return data


class APIUsageLog(Base):
    """
    API usage tracking and analytics model
    """

    __tablename__ = "api_usage_logs"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_id = Column(String(100), unique=True, nullable=False, index=True)  # Correlation ID

    # API key and user identification
    api_key_id = Column(UUID(as_uuid=True), ForeignKey("api_keys.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)

    # Request details
    method = Column(String(10), nullable=False, index=True)
    endpoint = Column(String(500), nullable=False, index=True)
    path = Column(String(1000), nullable=False)
    query_params = Column(JSONB, nullable=True)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=False, index=True)
    origin = Column(String(500), nullable=True)

    # Response details
    status_code = Column(Integer, nullable=False, index=True)
    response_size_bytes = Column(BigInteger, nullable=True)
    response_time_ms = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)

    # Rate limiting and throttling
    rate_limited = Column(Boolean, default=False, nullable=False)
    rate_limit_type = Column(String(50), nullable=True)  # RateLimitType enum
    rate_limit_remaining = Column(Integer, nullable=True)

    # Timestamps
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Request/Response metadata
    request_metadata = Column(JSONB, default=dict)
    response_metadata = Column(JSONB, default=dict)
    performance_metadata = Column(JSONB, default=dict)

    # Relationships
    api_key = relationship("APIKey", back_populates="usage_logs")
    user = relationship("User")
    organization = relationship("Organization")

    # Indexes for performance and analytics
    __table_args__ = (
        Index('idx_usage_api_key_timestamp', 'api_key_id', 'timestamp'),
        Index('idx_usage_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_usage_org_timestamp', 'organization_id', 'timestamp'),
        Index('idx_usage_endpoint_timestamp', 'endpoint', 'timestamp'),
        Index('idx_usage_status_timestamp', 'status_code', 'timestamp'),
        Index('idx_usage_method_timestamp', 'method', 'timestamp'),
        Index('idx_usage_ip_timestamp', 'ip_address', 'timestamp'),
        Index('idx_usage_rate_limited', 'rate_limited', 'timestamp'),
    )

    def __repr__(self):
        return f"<APIUsageLog(id={self.id}, endpoint={self.endpoint}, status={self.status_code}, timestamp={self.timestamp})>"

    def to_dict(self) -> dict:
        """Convert usage log to dictionary"""
        return {
            'id': str(self.id),
            'request_id': self.request_id,
            'api_key_id': str(self.api_key_id),
            'user_id': str(self.user_id),
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'method': self.method,
            'endpoint': self.endpoint,
            'path': self.path,
            'query_params': self.query_params,
            'user_agent': self.user_agent,
            'ip_address': self.ip_address,
            'origin': self.origin,
            'status_code': self.status_code,
            'response_size_bytes': self.response_size_bytes,
            'response_time_ms': self.response_time_ms,
            'error_message': self.error_message,
            'rate_limited': self.rate_limited,
            'rate_limit_type': self.rate_limit_type,
            'rate_limit_remaining': self.rate_limit_remaining,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'request_metadata': self.request_metadata,
            'response_metadata': self.response_metadata,
            'performance_metadata': self.performance_metadata,
        }


class GatewayConfiguration(Base):
    """
    Gateway configuration and policies model
    """

    __tablename__ = "gateway_configurations"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(200), unique=True, nullable=False, index=True)
    version = Column(String(20), default="1.0", nullable=False)
    environment = Column(String(50), nullable=False, index=True)  # dev, staging, prod

    # Configuration data
    config_data = Column(JSONB, nullable=False, default=dict)
    policies = Column(JSONB, nullable=False, default=dict)
    rate_limit_policies = Column(JSONB, nullable=False, default=dict)
    security_policies = Column(JSONB, nullable=False, default=dict)
    transformation_rules = Column(JSONB, nullable=False, default=dict)

    # Configuration lifecycle
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    priority = Column(Integer, default=100, nullable=False)  # Higher priority overrides lower

    # Metadata and audit
    description = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    creator = relationship("User")

    # Indexes
    __table_args__ = (
        Index('idx_gateway_config_env_active', 'environment', 'is_active'),
        Index('idx_gateway_config_priority', 'priority', 'is_active'),
        Index('idx_gateway_config_default', 'is_default', 'environment'),
    )

    def __repr__(self):
        return f"<GatewayConfiguration(id={self.id}, name={self.name}, env={self.environment}, active={self.is_active})>"

    def to_dict(self) -> dict:
        """Convert configuration to dictionary"""
        return {
            'id': str(self.id),
            'name': self.name,
            'version': self.version,
            'environment': self.environment,
            'config_data': self.config_data,
            'policies': self.policies,
            'rate_limit_policies': self.rate_limit_policies,
            'security_policies': self.security_policies,
            'transformation_rules': self.transformation_rules,
            'is_active': self.is_active,
            'is_default': self.is_default,
            'priority': self.priority,
            'description': self.description,
            'tags': self.tags,
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'applied_at': self.applied_at.isoformat() if self.applied_at else None,
        }


class WebSocketConnection(Base):
    """
    WebSocket connection tracking model
    """

    __tablename__ = "websocket_connections"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    connection_id = Column(String(100), unique=True, nullable=False, index=True)

    # Authentication and authorization
    api_key_id = Column(UUID(as_uuid=True), ForeignKey("api_keys.id"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)

    # Connection details
    endpoint = Column(String(500), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False, index=True)
    user_agent = Column(String(500), nullable=True)
    origin = Column(String(500), nullable=True)

    # Connection lifecycle
    connected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    disconnected_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    message_count = Column(BigInteger, default=0)
    bytes_sent = Column(BigInteger, default=0)
    bytes_received = Column(BigInteger, default=0)

    # Connection status
    is_active = Column(Boolean, default=True, nullable=False)
    disconnect_reason = Column(String(200), nullable=True)
    disconnect_code = Column(Integer, nullable=True)

    # Security and rate limiting
    rate_limited = Column(Boolean, default=False, nullable=False)
    security_violations = Column(Integer, default=0)

    # Metadata
    metadata = Column(JSONB, default=dict)
    tags = Column(ARRAY(String), default=list)

    # Relationships
    api_key = relationship("APIKey")
    user = relationship("User")
    organization = relationship("Organization")

    # Indexes
    __table_args__ = (
        Index('idx_ws_user_active', 'user_id', 'is_active'),
        Index('idx_ws_api_key_active', 'api_key_id', 'is_active'),
        Index('idx_ws_endpoint_active', 'endpoint', 'is_active'),
        Index('idx_ws_connected_at', 'connected_at'),
        Index('idx_ws_last_activity', 'last_activity_at', 'is_active'),
    )

    def __repr__(self):
        return f"<WebSocketConnection(id={self.id}, endpoint={self.endpoint}, active={self.is_active})>"

    @hybrid_property
    def duration_seconds(self) -> Optional[float]:
        """Get connection duration in seconds"""
        end_time = self.disconnected_at or datetime.utcnow()
        if self.connected_at:
            return (end_time - self.connected_at).total_seconds()
        return None

    def to_dict(self) -> dict:
        """Convert WebSocket connection to dictionary"""
        return {
            'id': str(self.id),
            'connection_id': self.connection_id,
            'api_key_id': str(self.api_key_id) if self.api_key_id else None,
            'user_id': str(self.user_id),
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'endpoint': self.endpoint,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'origin': self.origin,
            'connected_at': self.connected_at.isoformat() if self.connected_at else None,
            'disconnected_at': self.disconnected_at.isoformat() if self.disconnected_at else None,
            'last_activity_at': self.last_activity_at.isoformat() if self.last_activity_at else None,
            'message_count': self.message_count,
            'bytes_sent': self.bytes_sent,
            'bytes_received': self.bytes_received,
            'is_active': self.is_active,
            'disconnect_reason': self.disconnect_reason,
            'disconnect_code': self.disconnect_code,
            'rate_limited': self.rate_limited,
            'security_violations': self.security_violations,
            'metadata': self.metadata,
            'tags': self.tags,
            'duration_seconds': self.duration_seconds,
        }