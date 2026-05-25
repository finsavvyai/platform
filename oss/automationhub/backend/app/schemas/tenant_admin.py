"""
Tenant Administration Schemas
Pydantic models for tenant management and administration
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, EmailStr, validator
from uuid import UUID

# Base schemas
class TenantBase(BaseModel):
    """Base tenant schema"""
    name: str = Field(..., min_length=2, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    email: EmailStr
    subdomain: Optional[str] = Field(None, min_length=3, max_length=63)
    custom_domain: Optional[str] = Field(None, max_length=255)
    tier: str = Field("starter", regex="^(starter|professional|enterprise)$")
    plan: str = Field("starter", regex="^(starter|professional|enterprise)$")
    industry: Optional[str] = Field(None, max_length=100)
    company_size: Optional[str] = Field(None, regex="^(startup|small|medium|large|enterprise)$")
    billing_email: Optional[EmailStr] = None
    technical_contact_email: Optional[EmailStr] = None
    auto_renew_enabled: bool = True

class TenantCreate(TenantBase):
    """Tenant creation schema"""
    slug: str = Field(..., min_length=3, max_length=63, regex="^[a-z0-9]+(-[a-z0-9]+)*$")
    max_users: Optional[int] = Field(10, ge=1, le=1000)
    max_workflows: Optional[int] = Field(25, ge=1, le=10000)
    storage_quota_gb: Optional[int] = Field(10, ge=1, le=10000)
    description: Optional[str] = Field(None, max_length=1000)

    @validator('subdomain')
    def validate_subdomain(cls, v):
        if v:
            import re
            if not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', v):
                raise ValueError('Subdomain must contain only lowercase letters, numbers, and hyphens')
        return v

class TenantUpdate(BaseModel):
    """Tenant update schema"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    subdomain: Optional[str] = Field(None, min_length=3, max_length=63)
    custom_domain: Optional[str] = Field(None, max_length=255)
    tier: Optional[str] = Field(None, regex="^(starter|professional|enterprise)$")
    plan: Optional[str] = Field(None, regex="^(starter|professional|enterprise)$")
    industry: Optional[str] = Field(None, max_length=100)
    company_size: Optional[str] = Field(None, regex="^(startup|small|medium|large|enterprise)$")
    max_users: Optional[int] = Field(None, ge=1, le=1000)
    max_workflows: Optional[int] = Field(None, ge=1, le=10000)
    storage_quota_gb: Optional[int] = Field(None, ge=1, le=10000)
    billing_email: Optional[EmailStr] = None
    technical_contact_email: Optional[EmailStr] = None
    billing_address: Optional[Dict[str, Any]] = None
    auto_renew_enabled: Optional[bool] = None
    billing_issues: Optional[bool] = None

class TenantResponse(BaseModel):
    """Tenant response schema"""
    id: UUID
    slug: str
    name: str
    display_name: Optional[str]
    email: str
    subdomain: Optional[str]
    custom_domain: Optional[str]
    status: str
    tier: str
    plan: str
    industry: Optional[str]
    company_size: Optional[str]
    max_users: int
    max_workflows: int
    storage_quota_gb: int
    current_user_count: int
    current_monthly_cost: Optional[Decimal]
    billing_email: Optional[str]
    technical_contact_email: Optional[str]
    billing_address: Optional[Dict[str, Any]]
    auto_renew_enabled: bool
    billing_issues: Optional[bool]
    suspension_reason: Optional[str]
    suspended_at: Optional[datetime]
    suspended_by: Optional[UUID]
    deleted_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True

class TenantListResponse(BaseModel):
    """Paginated tenant list response"""
    tenants: List[TenantResponse]
    pagination: Dict[str, Any]

# User management schemas
class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, max_length=100)
    roles: List[str] = Field(default=["user"])
    permissions: List[str] = Field(default=[])
    is_active: bool = True
    is_verified: bool = False
    is_superuser: bool = False

class UserCreate(UserBase):
    """User creation schema"""
    password: Optional[str] = Field(None, min_length=8)

class UserUpdate(BaseModel):
    """User update schema"""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, max_length=100)
    roles: Optional[List[str]] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_superuser: Optional[bool] = None

class UserResponse(BaseModel):
    """User response schema"""
    id: UUID
    tenant_id: UUID
    email: str
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    department: Optional[str]
    title: Optional[str]
    roles: List[str]
    permissions: List[str]
    is_active: bool
    is_verified: bool
    is_superuser: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    """Paginated user list response"""
    users: List[UserResponse]
    pagination: Dict[str, Any]

# Metrics and monitoring schemas
class UserMetrics(BaseModel):
    """User metrics schema"""
    total: int
    active: int
    new_this_period: int

class StorageMetrics(BaseModel):
    """Storage metrics schema"""
    used_gb: float
    quota_gb: int
    usage_percentage: float
    file_count: Optional[int] = None

class APIMetrics(BaseModel):
    """API metrics schema"""
    requests: int
    errors: int
    average_response_time: float
    success_rate: float

class WorkflowMetrics(BaseModel):
    """Workflow metrics schema"""
    total: int
    successful: int
    failed: int
    average_duration: float
    success_rate: float

class BillingMetrics(BaseModel):
    """Billing metrics schema"""
    current_month_cost: float
    plan: str
    tier: str
    projected_annual_cost: float

class QuotaMetrics(BaseModel):
    """Quota metrics schema"""
    users_used: int
    users_limit: int
    workflows_used: int
    workflows_limit: int
    storage_used_gb: float
    storage_limit_gb: int

class TenantMetricsResponse(BaseModel):
    """Comprehensive tenant metrics response"""
    tenant_id: str
    period: Dict[str, str]
    users: UserMetrics
    storage: StorageMetrics
    api: APIMetrics
    workflows: WorkflowMetrics
    billing: BillingMetrics
    quotas: QuotaMetrics

# Health and status schemas
class TenantHealthResponse(BaseModel):
    """Tenant health response"""
    tenant_id: str
    status: str
    overall_health: str
    checks: Dict[str, bool]
    last_activity: Optional[str]
    created_at: str
    updated_at: Optional[str]

class BillingInfoResponse(BaseModel):
    """Billing information response"""
    tenant_id: str
    plan: str
    tier: str
    monthly_cost: float
    billing_email: Optional[str]
    billing_address: Optional[Dict[str, Any]]
    payment_method: str
    current_period: Dict[str, str]
    usage: Dict[str, Any]
    billing_issues: Optional[bool]
    auto_renew_enabled: bool
    next_billing_date: str

# Bulk operations schemas
class BulkTenantUpdateRequest(BaseModel):
    """Bulk tenant update request"""
    tenant_ids: List[UUID] = Field(..., min_items=1, max_items=100)
    updates: TenantUpdate

class BulkOperationResponse(BaseModel):
    """Bulk operation response"""
    total_requested: int
    successful: int
    failed: int
    errors: List[str]

# Tenant event schemas
class TenantEventCreate(BaseModel):
    """Tenant event creation schema"""
    event_type: str
    event_data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class TenantEventResponse(BaseModel):
    """Tenant event response"""
    id: UUID
    tenant_id: UUID
    event_type: str
    event_data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    created_by: Optional[UUID]

    class Config:
        from_attributes = True

# Analytics schemas
class TenantAnalyticsResponse(BaseModel):
    """Tenant analytics response"""
    tenant_id: str
    period: Dict[str, str]
    user_analytics: Dict[str, Any]
    workflow_analytics: Dict[str, Any]
    api_analytics: Dict[str, Any]
    storage_analytics: Dict[str, Any]
    performance_analytics: Dict[str, Any]

# Subscription management schemas
class SubscriptionUpdate(BaseModel):
    """Subscription update schema"""
    plan: str = Field(..., regex="^(starter|professional|enterprise)$")
    tier: Optional[str] = Field(None, regex="^(starter|professional|enterprise)$")
    billing_cycle: str = Field("monthly", regex="^(monthly|annually)$")
    payment_method_id: Optional[str] = None
    promotion_code: Optional[str] = None

class SubscriptionResponse(BaseModel):
    """Subscription response"""
    tenant_id: str
    plan: str
    tier: str
    status: str
    billing_cycle: str
    current_period_start: str
    current_period_end: str
    next_billing_date: str
    monthly_cost: float
    annual_cost: float
    is_active: bool
    auto_renew: bool
    payment_method: Optional[str]
    promotion: Optional[Dict[str, Any]]

# Usage report schemas
class UsageReportRequest(BaseModel):
    """Usage report request"""
    start_date: str
    end_date: str
    include_details: bool = False
    format: str = Field("json", regex="^(json|csv|pdf)$")

class UsageReportResponse(BaseModel):
    """Usage report response"""
    tenant_id: str
    period: Dict[str, str]
    summary: Dict[str, Any]
    breakdown: Dict[str, Any]
    export_url: Optional[str]
    generated_at: str