"""
Tenant Model for Multi-Tenant Architecture
Provides complete data isolation and tenant management capabilities
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import re

from app.core.database import Base

def _tenant_table_args():
    from app.core.config import settings
    # SQLite does not support schema; use plain table name
    if settings.DATABASE_URL and "sqlite" in settings.DATABASE_URL.lower():
        return {'comment': 'Multi-tenant organization registry'}
    return {'schema': 'public', 'comment': 'Multi-tenant organization registry'}

class Tenant(Base):
    """
    Tenant model representing a multi-tenant organization
    Implements complete data isolation and resource management
    """
    __tablename__ = "tenants"
    __table_args__ = _tenant_table_args()

    # Primary Keys
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True, comment="URL-friendly tenant identifier")

    # Basic Information
    name = Column(String(255), nullable=False, comment="Legal organization name")
    display_name = Column(String(255), nullable=False, comment="Display name for UI")
    description = Column(Text, nullable=True, comment="Organization description")

    # Contact Information
    email = Column(String(255), nullable=False, comment="Primary contact email")
    phone = Column(String(50), nullable=True, comment="Contact phone number")
    website = Column(String(500), nullable=True, comment="Organization website")

    # Address Information
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)

    # Business Information
    industry = Column(String(100), nullable=True)
    company_size = Column(String(50), nullable=True)  # small, medium, large, enterprise
    revenue_tier = Column(String(50), nullable=True)  # startup, growth, mature

    # Configuration
    domain = Column(String(255), unique=True, nullable=True, comment="Custom domain for white-labeling")
    subdomain = Column(String(100), unique=True, nullable=False, comment="Subdomain for access")

    # Status and Metadata
    status = Column(String(20), nullable=False, default='active', comment="active, suspended, trial, cancelled")
    tier = Column(String(50), nullable=False, default='basic', comment="Subscription tier")
    plan = Column(String(50), nullable=False, default='starter', comment="Subscription plan")

    # Resource Limits
    max_users = Column(Integer, nullable=False, default=10, comment="Maximum allowed users")
    max_storage_gb = Column(Integer, nullable=False, default=10, comment="Maximum storage in GB")
    max_api_calls_per_month = Column(Integer, nullable=False, default=10000, comment="API rate limit")
    max_workflows = Column(Integer, nullable=False, default=50, comment="Maximum workflows")
    max_agents = Column(Integer, nullable=False, default=5, comment="Maximum AI agents")

    # Usage Tracking
    current_users = Column(Integer, nullable=False, default=0, comment="Current user count")
    current_storage_gb = Column(Integer, nullable=False, default=0, comment="Current storage usage")
    current_api_calls_month = Column(Integer, nullable=False, default=0, comment="Current month API calls")
    current_workflows = Column(Integer, nullable=False, default=0, comment="Current workflow count")
    current_agents = Column(Integer, nullable=False, default=0, comment="Current agent count")

    # Billing Information
    billing_email = Column(String(255), nullable=True)
    billing_address = Column(JSON, nullable=True, comment="Billing address as JSON")
    payment_method = Column(String(50), nullable=True, comment="credit_card, invoice, etc.")
    billing_cycle = Column(String(20), nullable=False, default='monthly', comment="monthly, annual")

    # Configuration and Preferences
    settings = Column(JSON, nullable=True, default=dict, comment="Tenant-specific settings")
    preferences = Column(JSON, nullable=True, default=dict, comment="User preferences")
    integrations = Column(JSON, nullable=True, default=dict, comment="Third-party integrations")

    # Security Settings
    two_factor_required = Column(Boolean, nullable=False, default=False)
    session_timeout_minutes = Column(Integer, nullable=False, default=480)
    password_policy = Column(JSON, nullable=True, comment="Password requirements")
    allowed_ips = Column(JSON, nullable=True, comment="Whitelisted IP addresses")

    # Feature Flags
    features = Column(JSON, nullable=True, default=dict, comment="Enabled features")
    beta_features = Column(JSON, nullable=True, default=dict, comment="Beta feature access")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True, comment="Trial period end")
    subscription_starts_at = Column(DateTime(timezone=True), nullable=True)
    subscription_ends_at = Column(DateTime(timezone=True), nullable=True)

    # Audit Information
    created_by = Column(UUID(as_uuid=True), nullable=True, comment="User who created tenant")
    updated_by = Column(UUID(as_uuid=True), nullable=True, comment="User who last updated")
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships (only users have tenant_id on User; APIKey/Webhook/AuditLog may be in gateway)
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    branding = relationship("app.models.branding.TenantBrand", back_populates="tenant", uselist=True, cascade="all, delete-orphan")

    # Validations
    @validates('email')
    def validate_email(self, key, email):
        if not email or '@' not in email:
            raise ValueError('Invalid email address')
        return email.lower()

    @validates('slug')
    def validate_slug(self, key, slug):
        if not slug:
            raise ValueError('Slug is required')
        if not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', slug):
            raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        if len(slug) < 3 or len(slug) > 50:
            raise ValueError('Slug must be between 3 and 50 characters')
        return slug

    @validates('subdomain')
    def validate_subdomain(self, key, subdomain):
        if not subdomain:
            raise ValueError('Subdomain is required')
        if not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', subdomain):
            raise ValueError('Subdomain must contain only lowercase letters, numbers, and hyphens')
        if len(subdomain) < 3 or len(subdomain) > 100:
            raise ValueError('Subdomain must be between 3 and 100 characters')
        return subdomain

    @validates('status')
    def validate_status(self, key, status):
        valid_statuses = ['active', 'suspended', 'trial', 'cancelled', 'pending']
        if status not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return status

    @validates('tier')
    def validate_tier(self, key, tier):
        valid_tiers = ['basic', 'professional', 'enterprise', 'custom']
        if tier not in valid_tiers:
            raise ValueError(f'Tier must be one of: {valid_tiers}')
        return tier

    @validates('company_size')
    def validate_company_size(self, key, size):
        if size:
            valid_sizes = ['startup', 'small', 'medium', 'large', 'enterprise']
            if size not in valid_sizes:
                raise ValueError(f'Company size must be one of: {valid_sizes}')
        return size

    # Properties and Methods
    @property
    def is_active(self) -> bool:
        """Check if tenant is active and not suspended"""
        return self.status == 'active'

    @property
    def is_trial(self) -> bool:
        """Check if tenant is in trial period"""
        return self.status == 'trial' and self.trial_ends_at and self.trial_ends_at > datetime.now(timezone.utc)

    @property
    def trial_days_remaining(self) -> Optional[int]:
        """Get remaining trial days"""
        if not self.trial_ends_at:
            return None
        remaining = self.trial_ends_at - datetime.now(timezone.utc)
        return max(0, remaining.days)

    @property
    def storage_usage_percentage(self) -> float:
        """Calculate storage usage percentage"""
        if self.max_storage_gb == 0:
            return 0.0
        return (self.current_storage_gb / self.max_storage_gb) * 100

    @property
    def user_usage_percentage(self) -> float:
        """Calculate user usage percentage"""
        if self.max_users == 0:
            return 0.0
        return (self.current_users / self.max_users) * 100

    @property
    def api_usage_percentage(self) -> float:
        """Calculate API usage percentage"""
        if self.max_api_calls_per_month == 0:
            return 0.0
        return (self.current_api_calls_month / self.max_api_calls_per_month) * 100

    @property
    def is_over_limits(self) -> Dict[str, bool]:
        """Check if tenant is over any resource limits"""
        return {
            'users': self.current_users >= self.max_users,
            'storage': self.current_storage_gb >= self.max_storage_gb,
            'api_calls': self.current_api_calls_month >= self.max_api_calls_per_month,
            'workflows': self.current_workflows >= self.max_workflows,
            'agents': self.current_agents >= self.max_agents
        }

    @property
    def subscription_status(self) -> str:
        """Get subscription status"""
        now = datetime.now(timezone.utc)

        if self.status == 'trial':
            if self.trial_ends_at and self.trial_ends_at > now:
                return 'trial_active'
            else:
                return 'trial_expired'
        elif self.status == 'active':
            if self.subscription_ends_at and self.subscription_ends_at <= now:
                return 'expired'
            return 'active'
        elif self.status == 'suspended':
            return 'suspended'
        elif self.status == 'cancelled':
            return 'cancelled'
        else:
            return 'unknown'

    def get_full_domain(self, base_domain: str = "upm.plus") -> str:
        """Get full domain for tenant"""
        if self.domain:
            return self.domain
        return f"{self.subdomain}.{base_domain}"

    def can_create_user(self) -> bool:
        """Check if tenant can create more users"""
        return self.current_users < self.max_users and self.is_active

    def can_use_storage(self, additional_gb: int) -> bool:
        """Check if tenant can use additional storage"""
        return (self.current_storage_gb + additional_gb) <= self.max_storage_gb and self.is_active

    def can_make_api_call(self) -> bool:
        """Check if tenant can make API call"""
        return (self.current_api_calls_month < self.max_api_calls_per_month) and self.is_active

    def has_feature(self, feature_name: str) -> bool:
        """Check if tenant has access to specific feature"""
        if not self.features:
            return False
        return self.features.get(feature_name, False)

    def has_beta_feature(self, feature_name: str) -> bool:
        """Check if tenant has access to beta feature"""
        if not self.beta_features:
            return False
        return self.beta_features.get(feature_name, False)

    def update_usage(self, **kwargs) -> None:
        """Update usage metrics"""
        for key, value in kwargs.items():
            if hasattr(self, f'current_{key}'):
                setattr(self, f'current_{key}', value)
        self.last_activity_at = datetime.now(timezone.utc)

    def increment_usage(self, metric: str, amount: int = 1) -> None:
        """Increment usage metric"""
        attr_name = f'current_{metric}'
        if hasattr(self, attr_name):
            current = getattr(self, attr_name) or 0
            setattr(self, attr_name, current + amount)
        self.last_activity_at = datetime.now(timezone.utc)

    def decrement_usage(self, metric: str, amount: int = 1) -> None:
        """Decrement usage metric"""
        attr_name = f'current_{metric}'
        if hasattr(self, attr_name):
            current = getattr(self, attr_name) or 0
            setattr(self, attr_name, max(0, current - amount))
        self.last_activity_at = datetime.now(timezone.utc)

    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """Convert tenant to dictionary"""
        result = {
            'id': str(self.id),
            'slug': self.slug,
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'email': self.email,
            'website': self.website,
            'domain': self.domain,
            'subdomain': self.subdomain,
            'status': self.status,
            'tier': self.tier,
            'plan': self.plan,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'subscription_status': self.subscription_status,
            'is_active': self.is_active,
            'is_trial': self.is_trial,
            'trial_days_remaining': self.trial_days_remaining,
            'usage_percentages': {
                'storage': self.storage_usage_percentage,
                'users': self.user_usage_percentage,
                'api_calls': self.api_usage_percentage
            },
            'is_over_limits': self.is_over_limits
        }

        if include_sensitive:
            result.update({
                'max_users': self.max_users,
                'max_storage_gb': self.max_storage_gb,
                'max_api_calls_per_month': self.max_api_calls_per_month,
                'max_workflows': self.max_workflows,
                'max_agents': self.max_agents,
                'current_users': self.current_users,
                'current_storage_gb': self.current_storage_gb,
                'current_api_calls_month': self.current_api_calls_month,
                'current_workflows': self.current_workflows,
                'current_agents': self.current_agents,
                'settings': self.settings,
                'features': self.features,
                'billing_email': self.billing_email,
                'billing_cycle': self.billing_cycle
            })

        return result

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, slug={self.slug}, name={self.name}, status={self.status})>"

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"


class TenantConfiguration(Base):
    """
    Tenant-specific configuration for advanced settings
    """
    __tablename__ = "tenant_configurations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    category = Column(String(100), nullable=False)  # security, integrations, ui, etc.
    key = Column(String(255), nullable=False)
    value = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)
    is_encrypted = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Unique constraint; no schema for SQLite
    __table_args__ = (
        UniqueConstraint('tenant_id', 'category', 'key', name='uq_tenant_config'),
        {**_tenant_table_args(), 'comment': 'Advanced tenant configurations'}
    )


class TenantUsageLog(Base):
    """
    Daily usage tracking for billing and analytics
    """
    __tablename__ = "tenant_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)  # Date (no time)

    # Usage Metrics
    users_count = Column(Integer, nullable=False, default=0)
    storage_gb = Column(Integer, nullable=False, default=0)
    api_calls = Column(Integer, nullable=False, default=0)
    workflows_count = Column(Integer, nullable=False, default=0)
    agents_count = Column(Integer, nullable=False, default=0)

    # Performance Metrics
    avg_response_time_ms = Column(Integer, nullable=True)
    error_rate_percentage = Column(Integer, nullable=True)
    uptime_percentage = Column(Integer, nullable=True)

    # Cost Metrics
    estimated_cost_usd = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Unique constraint; no schema for SQLite
    __table_args__ = (
        UniqueConstraint('tenant_id', 'date', name='uq_tenant_usage_date'),
        {**_tenant_table_args(), 'comment': 'Daily tenant usage tracking'}
    )