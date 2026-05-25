"""
Multi-Cloud Schemas
Pydantic schemas for multi-cloud infrastructure management
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any, Union, Literal
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator, root_validator


# Enums
class CloudProviderType(str, Enum):
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"
    CLOUDFLARE = "cloudflare"


class ResourceType(str, Enum):
    COMPUTE = "compute"
    STORAGE = "storage"
    NETWORK = "network"
    DATABASE = "database"
    SERVERLESS = "serverless"
    CONTAINER = "container"
    DNS = "dns"
    CDN = "cdn"
    SECURITY = "security"
    MONITORING = "monitoring"


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"


class ResourceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    CREATING = "creating"
    UPDATING = "updating"
    DELETING = "deleting"
    DELETED = "deleted"


class SecurityLevel(str, Enum):
    BASIC = "basic"
    STANDARD = "standard"
    HIGH = "high"


class Environment(str, Enum):
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"
    TESTING = "testing"


# Provider Schemas
class MultiCloudProviderCreate(BaseModel):
    """Schema for creating a multi-cloud provider"""
    name: str = Field(..., min_length=1, max_length=255)
    provider_type: CloudProviderType
    description: Optional[str] = Field(None, max_length=1000)
    credentials: Dict[str, Any] = Field(..., description="Provider credentials (encrypted)")
    configuration: Optional[Dict[str, Any]] = Field(default_factory=dict)
    region: Optional[str] = Field(None, max_length=50)
    environment: Environment = Environment.PRODUCTION
    supported_services: Optional[List[str]] = Field(default_factory=list)
    quotas: Optional[Dict[str, Any]] = Field(default_factory=dict)
    cost_tracking_enabled: bool = True
    budget_alerts: Optional[Dict[str, Any]] = Field(default_factory=dict)
    cost_center: Optional[str] = Field(None, max_length=100)
    security_policy_id: Optional[UUID] = None
    encryption_at_rest: bool = True
    encryption_in_transit: bool = True
    access_logging: bool = True
    tags: Optional[Dict[str, str]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Provider name cannot be empty')
        return v.strip()

    @validator('credentials')
    def validate_credentials(cls, v, values):
        if not v:
            raise ValueError('Credentials are required')

        provider_type = values.get('provider_type')
        if provider_type == CloudProviderType.AWS:
            required_fields = ['access_key_id', 'secret_access_key', 'region']
        elif provider_type == CloudProviderType.AZURE:
            required_fields = ['subscription_id', 'tenant_id', 'client_id', 'client_secret']
        elif provider_type == CloudProviderType.GCP:
            required_fields = ['project_id', 'service_account_key_path']
        elif provider_type == CloudProviderType.CLOUDFLARE:
            required_fields = ['api_token', 'email']
        else:
            return v

        for field in required_fields:
            if field not in v:
                raise ValueError(f'Missing required credential field: {field}')

        return v


class MultiCloudProviderUpdate(BaseModel):
    """Schema for updating a multi-cloud provider"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    credentials: Optional[Dict[str, Any]] = Field(None, description="Updated credentials (encrypted)")
    configuration: Optional[Dict[str, Any]] = None
    region: Optional[str] = Field(None, max_length=50)
    environment: Optional[Environment] = None
    supported_services: Optional[List[str]] = None
    quotas: Optional[Dict[str, Any]] = None
    cost_tracking_enabled: Optional[bool] = None
    budget_alerts: Optional[Dict[str, Any]] = None
    cost_center: Optional[str] = Field(None, max_length=100)
    security_policy_id: Optional[UUID] = None
    encryption_at_rest: Optional[bool] = None
    encryption_in_transit: Optional[bool] = None
    access_logging: Optional[bool] = None
    tags: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class MultiCloudProviderResponse(BaseModel):
    """Schema for multi-cloud provider response"""
    id: UUID
    tenant_id: UUID
    name: str
    provider_type: CloudProviderType
    description: Optional[str]
    region: Optional[str]
    environment: Environment
    is_active: bool
    is_connected: bool
    last_connection_test: Optional[datetime]
    connection_error: Optional[str]
    health_status: str
    last_health_check: Optional[datetime]
    cost_tracking_enabled: bool
    supported_services: List[str]
    tags: Dict[str, str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True


# Resource Schemas
class CloudResourceCreate(BaseModel):
    """Schema for creating a cloud resource"""
    name: str = Field(..., min_length=1, max_length=255)
    type: ResourceType
    provider_id: UUID
    deployment_id: Optional[UUID] = None
    category: Optional[str] = Field(None, pattern="^(iaas|paas|saas|serverless|container)$")
    configuration: Dict[str, Any] = Field(..., description="Complete resource configuration")
    tags: Optional[Dict[str, str]] = Field(default_factory=dict)
    backup_enabled: bool = False
    backup_retention_days: Optional[int] = Field(None, ge=1, le=3650)
    security_level: SecurityLevel = SecurityLevel.STANDARD
    compliance_tags: Optional[List[str]] = Field(default_factory=list)
    auto_scaling_enabled: bool = False
    auto_scaling_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    monitoring_enabled: bool = True
    alert_config: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Resource name cannot be empty')
        # Check for valid resource name patterns
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Resource name can only contain letters, numbers, hyphens, and underscores')
        return v.strip()

    @validator('configuration')
    def validate_configuration(cls, v, values):
        if not v:
            raise ValueError('Configuration is required')

        resource_type = values.get('type')
        if resource_type:
            # Add type-specific validation
            if resource_type == ResourceType.COMPUTE:
                required_fields = ['instance_type', 'image_id']
            elif resource_type == ResourceType.STORAGE:
                required_fields = ['storage_type', 'size_gb']
            elif resource_type == ResourceType.NETWORK:
                required_fields = ['network_type']
            elif resource_type == ResourceType.DATABASE:
                required_fields = ['engine', 'instance_class']
            else:
                required_fields = []

            for field in required_fields:
                if field not in v:
                    raise ValueError(f'Missing required configuration field for {resource_type}: {field}')

        return v


class CloudResourceUpdate(BaseModel):
    """Schema for updating a cloud resource"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    configuration: Optional[Dict[str, Any]] = None
    tags: Optional[Dict[str, str]] = None
    backup_enabled: Optional[bool] = None
    backup_retention_days: Optional[int] = Field(None, ge=1, le=3650)
    security_level: Optional[SecurityLevel] = None
    compliance_tags: Optional[List[str]] = None
    auto_scaling_enabled: Optional[bool] = None
    auto_scaling_config: Optional[Dict[str, Any]] = None
    monitoring_enabled: Optional[bool] = None
    alert_config: Optional[Dict[str, Any]] = None
    status: Optional[ResourceStatus] = None


class CloudResourceResponse(BaseModel):
    """Schema for cloud resource response"""
    id: UUID
    tenant_id: UUID
    provider_id: UUID
    deployment_id: Optional[UUID]
    name: str
    type: ResourceType
    category: Optional[str]
    provider_resource_id: str
    configuration: Dict[str, Any]
    provider_specific_data: Dict[str, Any]
    tags: Dict[str, str]
    status: ResourceStatus
    health_status: str
    last_health_check: Optional[datetime]
    metrics: Dict[str, Any]
    cost_monthly: Optional[float]
    backup_enabled: bool
    backup_retention_days: Optional[int]
    security_level: SecurityLevel
    compliance_tags: List[str]
    auto_scaling_enabled: bool
    monitoring_enabled: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True


# Deployment Schemas
class CloudDeploymentCreate(BaseModel):
    """Schema for creating a cloud deployment"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    provider_id: UUID
    deployment_type: str = Field("infrastructure", pattern="^(infrastructure|application|migration|update|rollback)$")
    resources: List[Dict[str, Any]] = Field(..., description="List of resources to deploy")
    dependencies: Optional[Dict[str, List[str]]] = Field(default_factory=dict)
    deployment_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    environment: Environment = Environment.PRODUCTION
    region: Optional[str] = Field(None, max_length=50)
    rollback_enabled: bool = True
    rollback_plan: Optional[Dict[str, Any]] = Field(default_factory=dict)
    approval_required: bool = False
    validation_enabled: bool = True
    validation_rules: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    notification_config: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Deployment name cannot be empty')
        return v.strip()

    @validator('resources')
    def validate_resources(cls, v):
        if not v:
            raise ValueError('At least one resource must be specified')

        for resource in v:
            if 'name' not in resource:
                raise ValueError('All resources must have a name')
            if 'provider_id' not in resource:
                raise ValueError('All resources must have a provider_id')
            if 'type' not in resource:
                raise ValueError('All resources must have a type')
            if 'configuration' not in resource:
                raise ValueError('All resources must have configuration')

        return v


class CloudDeploymentUpdate(BaseModel):
    """Schema for updating a cloud deployment"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    resources: Optional[List[Dict[str, Any]]] = None
    dependencies: Optional[Dict[str, List[str]]] = None
    deployment_config: Optional[Dict[str, Any]] = None
    rollback_enabled: Optional[bool] = None
    rollback_plan: Optional[Dict[str, Any]] = None
    approval_required: Optional[bool] = None
    validation_enabled: Optional[bool] = None
    validation_rules: Optional[List[Dict[str, Any]]] = None
    notification_config: Optional[Dict[str, Any]] = None


class CloudDeploymentResponse(BaseModel):
    """Schema for cloud deployment response"""
    id: UUID
    tenant_id: UUID
    provider_id: UUID
    name: str
    description: Optional[str]
    deployment_type: str
    resources: List[Dict[str, Any]]
    dependencies: Dict[str, List[str]]
    deployment_order: List[str]
    status: DeploymentStatus
    current_step: int
    total_steps: int
    progress_percentage: float
    deployment_config: Dict[str, Any]
    environment: Environment
    region: Optional[str]
    rollback_enabled: bool
    estimated_cost: Optional[float]
    actual_cost: Optional[float]
    estimated_duration_minutes: Optional[int]
    actual_duration_minutes: Optional[int]
    approval_required: bool
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    deployment_results: List[Dict[str, Any]]
    success_resources: List[str]
    failed_resources: List[str]
    error_details: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True


# Cost Tracking Schemas
class CloudCostTrackerCreate(BaseModel):
    """Schema for creating cost tracking entry"""
    provider_id: UUID
    date: date
    currency: str = Field("USD", pattern="^[A-Z]{3}$")
    cost_amount: float = Field(..., ge=0)
    forecast_amount: Optional[float] = Field(None, ge=0)
    usage_amount: float = Field(0, ge=0)
    fixed_amount: float = Field(0, ge=0)
    compute_cost: float = Field(0, ge=0)
    storage_cost: float = Field(0, ge=0)
    network_cost: float = Field(0, ge=0)
    database_cost: float = Field(0, ge=0)
    serverless_cost: float = Field(0, ge=0)
    other_cost: float = Field(0, ge=0)
    resource_costs: Optional[Dict[str, float]] = Field(default_factory=dict)
    budget_amount: Optional[float] = Field(None, ge=0)
    budget_alert_threshold: float = Field(80.0, ge=0, le=200)
    compute_hours: float = Field(0, ge=0)
    storage_gb: float = Field(0, ge=0)
    data_transfer_gb: float = Field(0, ge=0)
    requests_count: int = Field(0, ge=0)
    cost_center: Optional[str] = Field(None, max_length=100)
    project_code: Optional[str] = Field(None, max_length=100)
    tags: Optional[Dict[str, str]] = Field(default_factory=dict)


class CloudCostTrackerResponse(BaseModel):
    """Schema for cost tracking response"""
    id: UUID
    tenant_id: UUID
    provider_id: UUID
    date: date
    currency: str
    cost_amount: float
    forecast_amount: Optional[float]
    usage_amount: float
    fixed_amount: float
    compute_cost: float
    storage_cost: float
    network_cost: float
    database_cost: float
    serverless_cost: float
    other_cost: float
    resource_costs: Dict[str, float]
    budget_amount: Optional[float]
    budget_usage_percentage: Optional[float]
    budget_alert_threshold: float
    budget_alert_sent: bool
    compute_hours: float
    storage_gb: float
    data_transfer_gb: float
    requests_count: int
    optimization_suggestions: List[Dict[str, Any]]
    potential_savings: Optional[float]
    cost_center: Optional[str]
    project_code: Optional[str]
    tags: Dict[str, str]
    last_updated: datetime

    class Config:
        from_attributes = True


# Security Policy Schemas
class CloudSecurityPolicyCreate(BaseModel):
    """Schema for creating a security policy"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    policy_type: str = Field(..., pattern="^(network|access|encryption|compliance|identity|data|logging)$")
    category: Optional[str] = Field(None, pattern="^(security|compliance|governance)$")
    rules: List[Dict[str, Any]] = Field(..., description="Security rules and requirements")
    exceptions: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    remediation_actions: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    compliance_frameworks: Optional[List[str]] = Field(default_factory=list)
    enforcement_mode: str = Field("monitor", pattern="^(monitor|enforce|disabled)$")
    auto_remediation_enabled: bool = False
    violation_alerts_enabled: bool = True
    risk_level: str = Field("medium", pattern="^(low|medium|high|critical)$")
    reviewer_id: Optional[UUID] = None
    next_review_date: Optional[datetime] = None
    version: str = Field("1.0", max_length=20)
    parent_policy_id: Optional[UUID] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Policy name cannot be empty')
        return v.strip()

    @validator('rules')
    def validate_rules(cls, v):
        if not v:
            raise ValueError('At least one rule must be specified')

        for rule in v:
            if 'name' not in rule:
                raise ValueError('All rules must have a name')
            if 'condition' not in rule:
                raise ValueError('All rules must have a condition')
            if 'action' not in rule:
                raise ValueError('All rules must have an action')

        return v


class CloudSecurityPolicyUpdate(BaseModel):
    """Schema for updating a security policy"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    rules: Optional[List[Dict[str, Any]]] = None
    exceptions: Optional[List[Dict[str, Any]]] = None
    remediation_actions: Optional[List[Dict[str, Any]]] = None
    compliance_frameworks: Optional[List[str]] = None
    enforcement_mode: Optional[str] = Field(None, pattern="^(monitor|enforce|disabled)$")
    auto_remediation_enabled: Optional[bool] = None
    violation_alerts_enabled: Optional[bool] = None
    risk_level: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    reviewer_id: Optional[UUID] = None
    next_review_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class CloudSecurityPolicyResponse(BaseModel):
    """Schema for security policy response"""
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    policy_type: str
    category: Optional[str]
    rules: List[Dict[str, Any]]
    exceptions: List[Dict[str, Any]]
    remediation_actions: List[Dict[str, Any]]
    compliance_frameworks: List[str]
    compliance_status: str
    last_compliance_check: Optional[datetime]
    enforcement_mode: str
    auto_remediation_enabled: bool
    violation_alerts_enabled: bool
    risk_level: str
    risk_score: Optional[float]
    risk_factors: List[str]
    violations_count: int
    remediations_count: int
    effectiveness_score: Optional[float]
    reviewer_id: Optional[UUID]
    approved_at: Optional[datetime]
    next_review_date: Optional[datetime]
    version: str
    parent_policy_id: Optional[UUID]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True


# Template Schemas
class CloudTemplateCreate(BaseModel):
    """Schema for creating a cloud template"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    template_type: str = Field(..., pattern="^(terraform|cloudformation|arm|bicep|custom|ansible|kubernetes)$")
    category: Optional[str] = Field(None, max_length=50)
    template_content: str = Field(..., description="Template code/content")
    variables: Optional[Dict[str, Any]] = Field(default_factory=dict)
    outputs: Optional[Dict[str, Any]] = Field(default_factory=dict)
    supported_providers: Optional[List[str]] = Field(default_factory=list)
    provider_mappings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    version: str = Field("1.0", max_length=20)
    author: Optional[str] = Field(None, max_length=255)
    documentation_url: Optional[str] = Field(None, max_length=500)
    repository_url: Optional[str] = Field(None, max_length=500)
    dependencies: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    resource_requirements: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_public: bool = False

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Template name cannot be empty')
        return v.strip()

    @validator('template_content')
    def validate_template_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Template content cannot be empty')
        return v


class CloudTemplateUpdate(BaseModel):
    """Schema for updating a cloud template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    template_content: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    outputs: Optional[Dict[str, Any]] = None
    supported_providers: Optional[List[str]] = None
    provider_mappings: Optional[Dict[str, Any]] = None
    version: Optional[str] = Field(None, max_length=20)
    author: Optional[str] = Field(None, max_length=255)
    documentation_url: Optional[str] = Field(None, max_length=500)
    repository_url: Optional[str] = Field(None, max_length=500)
    dependencies: Optional[List[Dict[str, Any]]] = None
    resource_requirements: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None


class CloudTemplateResponse(BaseModel):
    """Schema for cloud template response"""
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    template_type: str
    category: Optional[str]
    version: str
    author: Optional[str]
    documentation_url: Optional[str]
    repository_url: Optional[str]
    usage_count: int
    last_used: Optional[datetime]
    rating: Optional[float]
    validation_status: str
    test_results: Dict[str, Any]
    security_scan_results: Dict[str, Any]
    is_public: bool
    is_active: bool
    deprecated: bool
    deprecation_date: Optional[datetime]
    supported_providers: List[str]
    variables: Dict[str, Any]
    outputs: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True


# Resource Group Schemas
class CloudResourceGroupCreate(BaseModel):
    """Schema for creating a resource group"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    group_type: str = Field("custom", pattern="^(application|environment|project|custom)$")
    resource_ids: List[UUID] = Field(..., description="List of resource IDs in the group")
    tags: Optional[Dict[str, str]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    security_policy_id: Optional[UUID] = None
    cost_budget: Optional[float] = Field(None, ge=0)
    access_control: Optional[Dict[str, Any]] = Field(default_factory=dict)
    monitoring_enabled: bool = True
    alert_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    auto_cleanup: bool = False
    cleanup_after_days: Optional[int] = Field(None, ge=1, le=3650)

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Resource group name cannot be empty')
        return v.strip()

    @validator('resource_ids')
    def validate_resource_ids(cls, v):
        if not v:
            raise ValueError('At least one resource ID must be specified')
        return v


class CloudResourceGroupUpdate(BaseModel):
    """Schema for updating a resource group"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    resource_ids: Optional[List[UUID]] = None
    tags: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None
    security_policy_id: Optional[UUID] = None
    cost_budget: Optional[float] = Field(None, ge=0)
    access_control: Optional[Dict[str, Any]] = None
    monitoring_enabled: Optional[bool] = None
    alert_config: Optional[Dict[str, Any]] = None
    auto_cleanup: Optional[bool] = None
    cleanup_after_days: Optional[int] = Field(None, ge=1, le=3650)


class CloudResourceGroupResponse(BaseModel):
    """Schema for resource group response"""
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    group_type: str
    resource_ids: List[UUID]
    tags: Dict[str, str]
    metadata: Dict[str, Any]
    security_policy_id: Optional[UUID]
    cost_budget: Optional[float]
    access_control: Dict[str, Any]
    monitoring_enabled: bool
    alert_config: Dict[str, Any]
    auto_cleanup: bool
    cleanup_after_days: Optional[int]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True


# Analytics and Metrics Schemas
class ResourceMetricsRequest(BaseModel):
    """Schema for requesting resource metrics"""
    resource_id: UUID
    time_range: str = Field("1h", pattern=r'^\d+[hmwd]$')  # 1h, 24h, 7d, etc.
    metrics: Optional[List[str]] = None


class ResourceMetricsResponse(BaseModel):
    """Schema for resource metrics response"""
    provider: str
    resource_id: UUID
    time_range: str
    start_time: datetime
    end_time: datetime
    metrics: Dict[str, List[Dict[str, Any]]]


class CostTrackingRequest(BaseModel):
    """Schema for cost tracking request"""
    tenant_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None
    time_range: str = Field("30d", pattern=r'^\d+[dmw]$')  # 30d, 12m, etc.


class CostTrackingResponse(BaseModel):
    """Schema for cost tracking response"""
    total_cost: float
    time_range: str
    start_date: str
    end_date: str
    costs_by_provider: Dict[str, float]
    costs_by_type: Dict[str, float]
    daily_costs: Dict[str, float]
    currency: str


class OptimizationRecommendation(BaseModel):
    """Schema for optimization recommendation"""
    resource_id: UUID
    resource_name: str
    recommendation_type: str  # cost, performance, security
    priority: str  # low, medium, high, critical
    title: str
    description: str
    estimated_savings: Optional[float]
    implementation_complexity: str  # low, medium, high
    implementation_steps: List[str]
    risk_factors: List[str]


class OptimizationAnalysisResponse(BaseModel):
    """Schema for optimization analysis response"""
    tenant_id: UUID
    analysis_type: str
    total_recommendations: int
    potential_monthly_savings: float
    recommendations_by_priority: Dict[str, int]
    recommendations_by_type: Dict[str, int]
    recommendations: List[OptimizationRecommendation]


# Health Check Schemas
class ProviderHealthCheck(BaseModel):
    """Schema for provider health check"""
    provider_id: UUID
    status: str
    last_check: datetime
    response_time_ms: Optional[float]
    error_message: Optional[str]
    metrics: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    """Schema for health check response"""
    overall_status: str
    total_providers: int
    healthy_providers: int
    unhealthy_providers: int
    provider_checks: List[ProviderHealthCheck]
    timestamp: datetime