"""
Multi-Cloud Infrastructure Models
SQLAlchemy models for multi-cloud provider and resource management
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, JSON, ForeignKey, BigInteger, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.declarative import declarative_base

from app.core.database import Base


class MultiCloudProvider(Base):
    """Multi-cloud provider configuration model"""
    __tablename__ = "multi_cloud_providers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    provider_type = Column(String(20), nullable=False, index=True)  # aws, azure, gcp, cloudflare
    description = Column(Text, nullable=True)

    # Provider configuration
    credentials = Column(JSON, nullable=False)  # Encrypted credentials
    configuration = Column(JSON, nullable=True)  # Provider-specific configuration
    region = Column(String(50), nullable=True)  # Default region
    environment = Column(String(20), nullable=False, server_default="production")  # production, staging, development

    # Provider capabilities
    supported_services = Column(JSON, nullable=True, default=list)  # List of supported services
    quotas = Column(JSON, nullable=True, default=dict)  # Resource quotas and limits

    # Connection and status
    is_active = Column(Boolean, nullable=False, server_default="true", index=True)
    is_connected = Column(Boolean, nullable=False, server_default="false", index=True)
    last_connection_test = Column(DateTime(timezone=True), nullable=True)
    connection_error = Column(Text, nullable=True)

    # Health and monitoring
    health_status = Column(String(20), nullable=False, server_default="unknown")  # healthy, unhealthy, unknown
    last_health_check = Column(DateTime(timezone=True), nullable=True)
    health_check_interval = Column(Integer, nullable=True, server_default="300")  # seconds

    # Cost tracking
    cost_tracking_enabled = Column(Boolean, nullable=False, server_default="true")
    budget_alerts = Column(JSON, nullable=True, default=dict)  # Budget alert configuration
    cost_center = Column(String(100), nullable=True)  # Cost center for chargeback

    # Security settings
    security_policy_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloud_security_policies.id"), nullable=True)
    encryption_at_rest = Column(Boolean, nullable=False, server_default="true")
    encryption_in_transit = Column(Boolean, nullable=False, server_default="true")
    access_logging = Column(Boolean, nullable=False, server_default="true")

    # Metadata
    tags = Column(JSON, nullable=True, default=dict)  # Provider-level tags
    extra_metadata = Column(JSON, nullable=True, default=dict)  # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    resources = relationship("CloudResource", back_populates="provider", cascade="all, delete-orphan")
    deployments = relationship("CloudDeployment", back_populates="provider", cascade="all, delete-orphan")
    cost_trackers = relationship("CloudCostTracker", back_populates="provider", cascade="all, delete-orphan")
    security_policy = relationship("CloudSecurityPolicy", back_populates="providers")

    @validates('provider_type')
    def validate_provider_type(self, key, value):
        valid_types = ['aws', 'azure', 'gcp', 'cloudflare']
        if value.lower() not in valid_types:
            raise ValueError(f'Provider type must be one of: {valid_types}')
        return value.lower()

    @validates('environment')
    def validate_environment(self, key, value):
        valid_environments = ['production', 'staging', 'development', 'testing']
        if value.lower() not in valid_environments:
            raise ValueError(f'Environment must be one of: {valid_environments}')
        return value.lower()

    @validates('health_status')
    def validate_health_status(self, key, value):
        valid_statuses = ['healthy', 'unhealthy', 'unknown']
        if value not in valid_statuses:
            raise ValueError(f'Health status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<MultiCloudProvider(id={self.id}, name='{self.name}', type='{self.provider_type}')>"


class CloudResource(Base):
    """Cloud resource model for tracking deployed resources"""
    __tablename__ = "cloud_resources"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("multi_cloud_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    deployment_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloud_deployments.id"), nullable=True, index=True)

    # Resource identification
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # compute, storage, network, database, etc.
    category = Column(String(50), nullable=True, index=True)  # iaas, paas, saas
    provider_resource_id = Column(String(500), nullable=False, index=True)  # Native provider resource ID

    # Resource configuration
    configuration = Column(JSON, nullable=False)  # Complete resource configuration
    provider_specific_data = Column(JSON, nullable=True, default=dict)  # Provider-specific data
    tags = Column(JSON, nullable=True, default=dict)  # Resource tags

    # Resource status and health
    status = Column(String(20), nullable=False, index=True, server_default="active")  # active, inactive, error, deleting
    health_status = Column(String(20), nullable=False, server_default="unknown")  # healthy, unhealthy, unknown
    last_health_check = Column(DateTime(timezone=True), nullable=True)

    # Resource metrics
    metrics = Column(JSON, nullable=True, default=dict)  # Latest metrics snapshot
    cost_monthly = Column(Numeric(10, 2), nullable=True)  # Estimated monthly cost
    performance_metrics = Column(JSON, nullable=True, default=dict)  # Performance metrics

    # Dependencies and relationships
    depends_on = Column(JSON, nullable=True, default=list)  # List of resource IDs this depends on
    dependents = Column(JSON, nullable=True, default=list)  # List of resource IDs that depend on this

    # Backup and disaster recovery
    backup_enabled = Column(Boolean, nullable=False, server_default="false")
    backup_retention_days = Column(Integer, nullable=True)
    last_backup_at = Column(DateTime(timezone=True), nullable=True)

    # Security and compliance
    security_level = Column(String(20), nullable=False, server_default="standard")  # basic, standard, high
    compliance_tags = Column(JSON, nullable=True, default=list)  # Compliance frameworks (SOX, GDPR, etc.)
    security_issues = Column(JSON, nullable=True, default=list)  # Security scan results

    # Lifecycle management
    auto_scaling_enabled = Column(Boolean, nullable=False, server_default="false")
    auto_scaling_config = Column(JSON, nullable=True, default=dict)
    lifecycle_policy = Column(JSON, nullable=True, default=dict)  # Auto-delete, schedule, etc.

    # Monitoring and alerting
    monitoring_enabled = Column(Boolean, nullable=False, server_default="true")
    alert_config = Column(JSON, nullable=True, default=dict)  # Alert configuration
    last_alert_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete timestamp
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    provider = relationship("MultiCloudProvider", back_populates="resources")
    deployment = relationship("CloudDeployment", back_populates="resources_obj")

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['active', 'inactive', 'error', 'creating', 'updating', 'deleting', 'deleted']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    @validates('health_status')
    def validate_health_status(self, key, value):
        valid_statuses = ['healthy', 'unhealthy', 'unknown']
        if value not in valid_statuses:
            raise ValueError(f'Health status must be one of: {valid_statuses}')
        return value

    @validates('security_level')
    def validate_security_level(self, key, value):
        valid_levels = ['basic', 'standard', 'high']
        if value not in valid_levels:
            raise ValueError(f'Security level must be one of: {valid_levels}')
        return value

    @validates('category')
    def validate_category(self, key, value):
        if value:
            valid_categories = ['iaas', 'paas', 'saas', 'serverless', 'container']
            if value.lower() not in valid_categories:
                raise ValueError(f'Category must be one of: {valid_categories}')
        return value

    def __repr__(self):
        return f"<CloudResource(id={self.id}, name='{self.name}', type='{self.type}', provider_id='{self.provider_id}')>"


class CloudDeployment(Base):
    """Cloud deployment model for orchestrated multi-resource deployments"""
    __tablename__ = "cloud_deployments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("multi_cloud_providers.id", ondelete="CASCADE"), nullable=False, index=True)

    # Deployment identification
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    deployment_type = Column(String(50), nullable=False, server_default="infrastructure")  # infrastructure, application, migration

    # Deployment configuration
    resources = Column(JSON, nullable=False)  # List of resources to deploy
    dependencies = Column(JSON, nullable=True, default=dict)  # Resource dependencies
    deployment_order = Column(JSON, nullable=True, default=list)  # Calculated deployment order

    # Deployment status and tracking
    status = Column(String(20), nullable=False, index=True, server_default="pending")  # pending, in_progress, success, failed, rolling_back
    current_step = Column(Integer, nullable=False, server_default="0")
    total_steps = Column(Integer, nullable=False, server_default="0")
    progress_percentage = Column(Float, nullable=False, server_default="0.0")

    # Deployment configuration
    deployment_config = Column(JSON, nullable=True, default=dict)  # Deployment-specific configuration
    environment = Column(String(20), nullable=False, server_default="production")
    region = Column(String(50), nullable=True)

    # Rollback configuration
    rollback_enabled = Column(Boolean, nullable=False, server_default="true")
    rollback_plan = Column(JSON, nullable=True, default=dict)  # Rollback steps
    rollback_reason = Column(Text, nullable=True)  # Reason for rollback

    # Cost and duration estimates
    estimated_cost = Column(Numeric(10, 2), nullable=True)
    actual_cost = Column(Numeric(10, 2), nullable=True)
    estimated_duration_minutes = Column(Integer, nullable=True)
    actual_duration_minutes = Column(Integer, nullable=True)

    # Approval workflow
    approval_required = Column(Boolean, nullable=False, server_default="false")
    approved_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_notes = Column(Text, nullable=True)

    # Deployment results
    deployment_results = Column(JSON, nullable=True, default=list)  # Individual resource deployment results
    error_details = Column(JSON, nullable=True, default=dict)  # Error details if failed
    success_resources = Column(JSON, nullable=True, default=list)  # List of successfully deployed resources
    failed_resources = Column(JSON, nullable=True, default=list)  # List of failed resources

    # Monitoring and validation
    validation_enabled = Column(Boolean, nullable=False, server_default="true")
    validation_rules = Column(JSON, nullable=True, default=list)  # Post-deployment validation rules
    health_checks = Column(JSON, nullable=True, default=list)  # Health check configurations

    # Notifications
    notification_config = Column(JSON, nullable=True, default=dict)  # Notification settings
    notification_sent = Column(Boolean, nullable=False, server_default="false")

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    provider = relationship("MultiCloudProvider", back_populates="deployments")
    resources_obj = relationship("CloudResource", back_populates="deployment")

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['pending', 'in_progress', 'success', 'failed', 'rolling_back', 'rolled_back', 'cancelled']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    @validates('deployment_type')
    def validate_deployment_type(self, key, value):
        valid_types = ['infrastructure', 'application', 'migration', 'update', 'rollback']
        if value not in valid_types:
            raise ValueError(f'Deployment type must be one of: {valid_types}')
        return value

    def __repr__(self):
        return f"<CloudDeployment(id={self.id}, name='{self.name}', status='{self.status}')>"


class CloudCostTracker(Base):
    """Cloud cost tracking and budgeting model"""
    __tablename__ = "cloud_cost_trackers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("multi_cloud_providers.id", ondelete="CASCADE"), nullable=False, index=True)

    # Cost tracking period
    date = Column(DateTime(timezone=True), nullable=False, index=True)  # Cost period date
    currency = Column(String(3), nullable=False, server_default="USD")  # ISO currency code

    # Cost breakdown
    cost_amount = Column(Numeric(15, 4), nullable=False, server_default="0.0000")  # Total cost for period
    forecast_amount = Column(Numeric(15, 4), nullable=True)  # Forecasted cost
    usage_amount = Column(Numeric(15, 4), nullable=False, server_default="0.0000")  # Actual usage-based cost
    fixed_amount = Column(Numeric(15, 4), nullable=False, server_default="0.0000")  # Fixed cost components

    # Cost by service category
    compute_cost = Column(Numeric(12, 4), nullable=False, server_default="0.0000")
    storage_cost = Column(Numeric(12, 4), nullable=False, server_default="0.0000")
    network_cost = Column(Numeric(12, 4), nullable=False, server_default="0.0000")
    database_cost = Column(Numeric(12, 4), nullable=False, server_default="0.0000")
    serverless_cost = Column(Numeric(12, 4), nullable=False, server_default="0.0000")
    other_cost = Column(Numeric(12, 4), nullable=False, server_default="0.0000")

    # Cost by resource
    resource_costs = Column(JSON, nullable=True, default=dict)  # Cost breakdown by resource

    # Budget tracking
    budget_amount = Column(Numeric(15, 4), nullable=True)  # Budget for period
    budget_usage_percentage = Column(Float, nullable=True)  # Percentage of budget used
    budget_alert_threshold = Column(Float, nullable=False, server_default="80.0")  # Alert threshold percentage
    budget_alert_sent = Column(Boolean, nullable=False, server_default="false")

    # Usage metrics
    compute_hours = Column(Numeric(10, 2), nullable=False, server_default="0.00")  # Compute hours used
    storage_gb = Column(Numeric(10, 2), nullable=False, server_default="0.00")  # Storage GB used
    data_transfer_gb = Column(Numeric(10, 2), nullable=False, server_default="0.00")  # Data transfer GB
    requests_count = Column(BigInteger, nullable=False, server_default="0")  # API/request count

    # Cost optimization
    optimization_suggestions = Column(JSON, nullable=True, default=list)  # Cost optimization suggestions
    potential_savings = Column(Numeric(12, 4), nullable=True)  # Potential monthly savings
    implemented_optimizations = Column(JSON, nullable=True, default=list)  # Implemented optimizations

    # Metadata
    cost_center = Column(String(100), nullable=True)  # Cost center for chargeback
    project_code = Column(String(100), nullable=True)  # Project or initiative code
    tags = Column(JSON, nullable=True, default=dict)  # Cost allocation tags

    # Data source and quality
    data_source = Column(String(50), nullable=False, server_default="api")  # api, csv, manual
    last_updated = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    data_quality_score = Column(Float, nullable=True)  # Data quality confidence score

    # Relationships
    provider = relationship("MultiCloudProvider", back_populates="cost_trackers")

    def __repr__(self):
        return f"<CloudCostTracker(id={self.id}, date='{self.date}', amount={self.cost_amount})>"


class CloudSecurityPolicy(Base):
    """Cloud security policy and compliance model"""
    __tablename__ = "cloud_security_policies"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Policy identification
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    policy_type = Column(String(50), nullable=False)  # network, access, encryption, compliance
    category = Column(String(50), nullable=True)  # security, compliance, governance

    # Policy configuration
    rules = Column(JSON, nullable=False)  # Security rules and requirements
    exceptions = Column(JSON, nullable=True, default=list)  # Policy exceptions
    remediation_actions = Column(JSON, nullable=True, default=list)  # Auto-remediation actions

    # Compliance frameworks
    compliance_frameworks = Column(JSON, nullable=True, default=list)  # SOX, GDPR, HIPAA, PCI-DSS, etc.
    compliance_status = Column(String(20), nullable=False, server_default="non_compliant")  # compliant, non_compliant, partial
    last_compliance_check = Column(DateTime(timezone=True), nullable=True)

    # Policy enforcement
    enforcement_mode = Column(String(20), nullable=False, server_default="monitor")  # monitor, enforce, disabled
    auto_remediation_enabled = Column(Boolean, nullable=False, server_default="false")
    violation_alerts_enabled = Column(Boolean, nullable=False, server_default="true")

    # Risk assessment
    risk_level = Column(String(20), nullable=False, server_default="medium")  # low, medium, high, critical
    risk_score = Column(Float, nullable=True)  # Calculated risk score
    risk_factors = Column(JSON, nullable=True, default=list)  # Identified risk factors

    # Policy effectiveness
    violations_count = Column(Integer, nullable=False, server_default="0")
    remediations_count = Column(Integer, nullable=False, server_default="0")
    effectiveness_score = Column(Float, nullable=True)  # Policy effectiveness score

    # Review and approval
    reviewer_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    next_review_date = Column(DateTime(timezone=True), nullable=True)

    # Policy versioning
    version = Column(String(20), nullable=False, server_default="1.0")
    parent_policy_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloud_security_policies.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    providers = relationship("MultiCloudProvider", back_populates="security_policy")
    parent_policy = relationship("CloudSecurityPolicy", remote_side=[id])

    @validates('policy_type')
    def validate_policy_type(self, key, value):
        valid_types = ['network', 'access', 'encryption', 'compliance', 'identity', 'data', 'logging']
        if value not in valid_types:
            raise ValueError(f'Policy type must be one of: {valid_types}')
        return value

    @validates('enforcement_mode')
    def validate_enforcement_mode(self, key, value):
        valid_modes = ['monitor', 'enforce', 'disabled']
        if value not in valid_modes:
            raise ValueError(f'Enforcement mode must be one of: {valid_modes}')
        return value

    @validates('risk_level')
    def validate_risk_level(self, key, value):
        valid_levels = ['low', 'medium', 'high', 'critical']
        if value not in valid_levels:
            raise ValueError(f'Risk level must be one of: {valid_levels}')
        return value

    @validates('compliance_status')
    def validate_compliance_status(self, key, value):
        valid_statuses = ['compliant', 'non_compliant', 'partial', 'unknown']
        if value not in valid_statuses:
            raise ValueError(f'Compliance status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<CloudSecurityPolicy(id={self.id}, name='{self.name}', type='{self.policy_type}')>"


class CloudResourceGroup(Base):
    """Resource group for organizing cloud resources"""
    __tablename__ = "cloud_resource_groups"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Group identification
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    group_type = Column(String(50), nullable=False, server_default="custom")  # application, environment, project, custom

    # Group configuration
    resource_ids = Column(JSON, nullable=False, default=list)  # List of resource IDs in the group
    tags = Column(JSON, nullable=True, default=dict)  # Group-level tags
    extra_metadata = Column(JSON, nullable=True, default=dict)  # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)

    # Group policies
    security_policy_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloud_security_policies.id"), nullable=True)
    cost_budget = Column(Numeric(12, 2), nullable=True)  # Group-level budget
    access_control = Column(JSON, nullable=True, default=dict)  # Group access control rules

    # Monitoring and alerting
    monitoring_enabled = Column(Boolean, nullable=False, server_default="true")
    alert_config = Column(JSON, nullable=True, default=dict)

    # Lifecycle management
    auto_cleanup = Column(Boolean, nullable=False, server_default="false")
    cleanup_after_days = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<CloudResourceGroup(id={self.id}, name='{self.name}', resource_count={len(self.resource_ids)})>"


class CloudTemplate(Base):
    """Infrastructure as Code templates for multi-cloud deployments"""
    __tablename__ = "cloud_templates"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Template identification
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    template_type = Column(String(50), nullable=False)  # terraform, cloudformation, arm, bicep, custom
    category = Column(String(50), nullable=True)  # web_app, database, vpc, monitoring, etc.

    # Template content
    template_content = Column(Text, nullable=False)  # Template code/content
    variables = Column(JSON, nullable=True, default=dict)  # Template variables/parameters
    outputs = Column(JSON, nullable=True, default=dict)  # Expected outputs

    # Supported providers
    supported_providers = Column(JSON, nullable=True, default=list)  # List of supported provider types
    provider_mappings = Column(JSON, nullable=True, default=dict)  # Provider-specific mappings

    # Template metadata
    version = Column(String(20), nullable=False, server_default="1.0")
    author = Column(String(255), nullable=True)
    documentation_url = Column(String(500), nullable=True)
    repository_url = Column(String(500), nullable=True)

    # Usage tracking
    usage_count = Column(Integer, nullable=False, server_default="0")
    last_used = Column(DateTime(timezone=True), nullable=True)
    rating = Column(Float, nullable=True)  # User rating 1-5
    user_reviews = Column(JSON, nullable=True, default=list)

    # Validation and testing
    validation_status = Column(String(20), nullable=False, server_default="pending")  # pending, validated, failed
    test_results = Column(JSON, nullable=True, default=dict)  # Automated test results
    security_scan_results = Column(JSON, nullable=True, default=dict)  # Security scan results

    # Template lifecycle
    is_public = Column(Boolean, nullable=False, server_default="false")  # Public template gallery
    is_active = Column(Boolean, nullable=False, server_default="true")
    deprecated = Column(Boolean, nullable=False, server_default="false")
    deprecation_date = Column(DateTime(timezone=True), nullable=True)

    # Dependencies
    dependencies = Column(JSON, nullable=True, default=list)  # Required modules/plugins
    resource_requirements = Column(JSON, nullable=True, default=dict)  # Resource requirements

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    @validates('template_type')
    def validate_template_type(self, key, value):
        valid_types = ['terraform', 'cloudformation', 'arm', 'bicep', 'custom', 'ansible', 'kubernetes']
        if value not in valid_types:
            raise ValueError(f'Template type must be one of: {valid_types}')
        return value

    @validates('validation_status')
    def validate_validation_status(self, key, value):
        valid_statuses = ['pending', 'validated', 'failed', 'deprecated']
        if value not in valid_statuses:
            raise ValueError(f'Validation status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<CloudTemplate(id={self.id}, name='{self.name}', type='{self.template_type}')>"