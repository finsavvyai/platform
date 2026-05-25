"""
Cloudflare Schemas
Pydantic models for Cloudflare integration and management
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator
from uuid import UUID

# Provider schemas
class CloudflareProviderBase(BaseModel):
    """Base Cloudflare provider schema"""
    name: str = Field(..., min_length=1, max_length=255)
    region: Optional[str] = Field(None, max_length=100)
    account_id: Optional[str] = Field(None, max_length=50)
    configuration: Optional[Dict[str, Any]] = None

class CloudflareCredentialsCreate(BaseModel):
    """Cloudflare credentials creation schema"""
    api_token: str = Field(..., min_length=32, max_length=500, description="Cloudflare API token")
    email: Optional[str] = Field(None, max_length=255, description="Account email (for legacy API key auth)")
    api_key: Optional[str] = Field(None, max_length=100, description="Global API key (for legacy auth)")

class CloudflareProviderCreate(CloudflareProviderBase):
    """Cloudflare provider creation schema"""
    api_token: str = Field(..., min_length=32, max_length=500, description="Cloudflare API token")
    email: Optional[str] = Field(None, max_length=255, description="Account email (for legacy API key auth)")
    api_key: Optional[str] = Field(None, max_length=100, description="Global API key (for legacy auth)")

class CloudflareProviderUpdate(BaseModel):
    """Cloudflare provider update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    region: Optional[str] = Field(None, max_length=100)
    account_id: Optional[str] = Field(None, max_length=50)
    configuration: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class CloudflareProviderResponse(BaseModel):
    """Cloudflare provider response schema"""
    id: UUID
    name: str
    provider_type: str
    region: Optional[str]
    endpoint: Optional[str]
    credentials: Optional[Dict[str, Any]]  # Encrypted
    configuration: Optional[Dict[str, Any]]
    capabilities: List[str]
    is_active: bool
    is_connected: bool
    last_verified: Optional[datetime]
    verification_error: Optional[str]
    resource_count: int
    last_sync: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# Zone schemas
class CloudflareZoneBase(BaseModel):
    """Base Cloudflare zone schema"""
    name: str = Field(..., min_length=1, max_length=253)
    account_id: Optional[str] = Field(None, max_length=50)
    jump_start: bool = Field(False, description="Use jump start for quick setup")
    organization_id: Optional[str] = Field(None, max_length=50)

class CloudflareZoneCreate(CloudflareZoneBase):
    """Cloudflare zone creation schema"""
    pass

class CloudflareZoneResponse(BaseModel):
    """Cloudflare zone response schema"""
    id: str
    name: str
    status: str
    account_id: str
    account_name: str
    name_servers: List[str]
    plan: Dict[str, Any]
    permissions: List[str]
    paused: bool
    type: str
    development_mode: bool
    meta: Dict[str, Any]
    created_at: datetime
    modified_at: datetime
    activated_on: datetime

class CloudflareZoneListResponse(BaseModel):
    """Cloudflare zone list response schema"""
    zones: List[CloudflareZoneResponse]
    pagination: Dict[str, Any]

# DNS Record schemas
class CloudflareDNSRecordBase(BaseModel):
    """Base DNS record schema"""
    type: str = Field(..., pattern=r'^[A-Z]+$')
    name: str = Field(..., max_length=255)
    content: str = Field(..., min_length=1, max_length=65535)
    ttl: int = Field(1, ge=60, le=86400, description="Time to live in seconds")
    proxied: bool = Field(False)
    priority: Optional[int] = Field(None, ge=0, le=65535, description="Priority for SRV/MX records")
    comment: Optional[str] = Field(None, max_length=255)
    tags: Optional[List[str]] = None

class CloudflareDNSRecordCreate(CloudflareDNSRecordBase):
    """DNS record creation schema"""
    pass

class CloudflareDNSRecordResponse(BaseModel):
    """DNS record response schema"""
    id: str
    zone_id: str
    zone_name: str
    name: str
    type: str
    content: str
    proxiable: bool
    proxied: bool
    ttl: int
    priority: Optional[int]
    comment: Optional[str]
    tags: List[str]
    created_on: datetime
    modified_on: datetime

class CloudflareDNSRecordListResponse(BaseModel):
    """DNS record list response schema"""
    records: List[CloudflareDNSRecordResponse]
    pagination: Dict[str, Any]

# Worker schemas
class CloudflareWorkerBinding(BaseModel):
    """Cloudflare Worker binding schema"""
    type: str
    name: str
    class_name: Optional[str] = None
    script_name: Optional[str] = None

class CloudflareWorkerKVNamespaceBinding(BaseModel):
    """Cloudflare Worker KV namespace binding schema"""
    type: str = "kv_namespace"
    name: str
    id: str

class CloudflareWorkerR2BucketBinding(BaseModel):
    """Cloudflare Worker R2 bucket binding schema"""
    type: str = "r2_bucket"
    bucket_name: str

class CloudflareWorkerDeploy(BaseModel):
    """Cloudflare Worker deployment schema"""
    script_name: str = Field(..., min_length=1, max_length=64)
    script_content: str = Field(..., min_length=1)
    bindings: Optional[List[CloudflareWorkerBinding]] = None
    kv_namespace_bindings: Optional[List[CloudflareWorkerKVNamespaceBinding]] = None
    r2_bucket_bindings: Optional[List[CloudflareWorkerR2BucketBinding]] = None
    environment: str = Field("production", pattern="^(development|staging|production)$")
    compatibility_date: str = Field("2023-10-30")

class CloudflareWorkerResponse(BaseModel):
    """Cloudflare Worker response schema"""
    id: str
    script_name: str
    size: int
    modified_on: datetime
    created_on: datetime
    usage_model: str
    placement: Dict[str, Any]
    compatibility_date: str
    compatibility_flags: List[str]
    logpush: bool
    tail_consumers: List[str]

# R2 Storage schemas
class CloudflareR2BucketCreate(BaseModel):
    """R2 bucket creation schema"""
    name: str = Field(..., min_length=3, max_length=63, pattern=r'^[a-z0-9][a-z0-9.-]*[a-z0-9]$')
    region: str = Field("auto", pattern=r'^(auto|wnam|eunam|apac-1)$')

class CloudflareR2BucketResponse(BaseModel):
    """R2 bucket response schema"""
    id: str
    name: str
    creation_date: str
    location: str

# Tunnel schemas
class CloudflareTunnelCreate(BaseModel):
    """Cloudflare Tunnel creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    secret: Optional[str] = Field(None, min_length=32, max_length=255)
    destination: str = Field(..., min_length=1)
    proto: str = Field("http", pattern=r'^(http|https|tcp|udp)$')

class CloudflareTunnelResponse(BaseModel):
    """Cloudflare Tunnel response schema"""
    id: str
    name: str
    uuid: str
    created_at: datetime
    deleted_at: Optional[datetime]
    conn_id: str
    secret: str  # This should be masked in responses
    origin_config: Dict[str, Any]
    status: str
    remote_config: Dict[str, Any]
    client_version: str
    features: List[str]

# Cache Purge schemas
class CloudflareCachePurgeRequest(BaseModel):
    """Cloudflare cache purge request schema"""
    files: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    hosts: Optional[List[str]] = None
    purge_everything: bool = Field(False)

class CloudflareCachePurgeResponse(BaseModel):
    """Cloudflare cache purge response schema"""
    id: str
    files: List[str]
    tags: List[str]
    hosts: List[str]
    purge_everything: bool

# Analytics schemas
class CloudflareAnalyticsResponse(BaseModel):
    """Cloudflare analytics response schema"""
    data: Dict[str, Any]
    period: Optional[Dict[str, str]] = None

# Security schemas
class CloudflareAccessApplication(BaseModel):
    """Cloudflare Access application schema"""
    name: str = Field(..., min_length=1, max_length=255)
    domain: str = Field(..., min_length=1, max_length=253)
    session_duration: str = Field("24h", description="Session duration (e.g., '24h', '8h')")
    logo_url: Optional[str] = None

class CloudflareAccessPolicy(BaseModel):
    """Cloudflare Access policy schema"""
    name: str = Field(..., min_length=1, max_length=255)
    decision: str = Field(..., pattern=r'^(allow|deny|non_identity)$')
    require: Optional[List[Dict[str, Any]]] None
    group: Optional[List[str]] = None
    app_id: Optional[str] = None

# Image schemas
class CloudflareImageVariant(BaseModel):
    """Cloudflare Image variant schema"""
    name: str
    width: Optional[int] = None
    height: Optional[int] = None
    fit: str = Field("scale-down", pattern=r'^(scale-down|scale-fit|crop|pad|contain)$")
    format: str = Field("webp", pattern=r'^(webp|avif|jpeg|png|gif|auto)$")
    quality: Optional[int] = Field(80, ge=1, le=100)

class CloudflareImageUpload(BaseModel):
    """Cloudflare Image upload schema"""
    name: Optional[str] = None
    file: str = Field(..., description="File path or URL")
    require_signed_urls: bool = Field(False)
    metadata: Optional[Dict[str, Any]] = None
    variants: Optional[List[CloudflareImageVariant]] = None

# Stream schemas
class CloudflareStreamCreate(BaseModel):
    """Cloudflare Stream creation schema"""
    uid: str = Field(..., min_length=1, max_length=64)
    max_duration_seconds: int = Field(3600, ge=1, le=43200)
    require_signed_urls: bool = Field(False)
    allowed_origins: Optional[List[str]] = None
    watermark: Optional[Dict[str, Any]] = None

class CloudflareStreamResponse(BaseModel):
    """Cloudflare Stream response schema"""
    uid: str
    preview: str
    thumbnail: str
    allowed_origins: List[str]
    require_signed_urls: bool
    max_duration_seconds: int
    created: Optional[datetime]
    modified: Optional[datetime]
    size: int
    status: str
    upload: Optional[Dict[str, Any]]
    meta: Optional[Dict[str, Any]]

# Domain validation schemas
class CloudflareDomainValidationCreate(BaseModel):
    """Cloudflare domain validation creation schema"""
    domain: str = Field(..., min_length=1, max_length=253)
    method: str = Field(..., pattern=r'^(txt|cname|http|email)$')
    validation_records: List[Dict[str, Any]]

class CloudflareDomainValidationResponse(BaseModel):
    """Cloudflare domain validation response schema"""
    id: str
    domain: str
    method: str
    validation_records: List[Dict[str, Any]]
    status: str
    verification_key: str
    created_at: datetime
    expires_at: Optional[datetime]

# Page Rule schemas
class CloudflarePageRuleTarget(BaseModel):
    """Cloudflare Page Rule target schema"""
    target: str
    constraint: Dict[str, Any]

class CloudflarePageRuleAction(BaseModel):
    """Cloudflare Page Rule action schema"""
    id: str
    value: str
    disabled: Optional[bool] = False

class CloudflarePageRuleCreate(BaseModel):
    """Cloudflare Page Rule creation schema"""
    targets: List[CloudflarePageRuleTarget]
    actions: List[CloudflarePageRuleAction]
    status: str = Field("active", pattern=r'^(active|disabled)$')
    priority: int = Field(1, ge=1, le=100)

class CloudflarePageRuleResponse(BaseModel):
    """Cloudflare Page Rule response schema"""
    id: str
    targets: List[CloudflarePageRuleTarget]
    actions: List[CloudflarePageRuleAction]
    priority: int
    status: str
    created_on: Optional[datetime]
    modified_on: Optional[datetime]

# Monitoring schemas
class CloudflareHealthCheck(BaseModel):
    """Cloudflare health check schema"""
    type: str = Field(..., pattern=r'^(http|tcp)$')
    description: str = Field(..., max_length=255)
    path: Optional[str] = None
    expected_response_codes: List[int] = [200, 201, 202, 204]
    expected_body: Optional[str] = None
    method: str = Field("GET", pattern=r'^(GET|POST|PUT|DELETE|HEAD)$')
    timeout: int = Field(10, ge=1, le=60)
    retries: int = Field(1, ge=1, le=5)
    interval: int = Field=60, ge=10, le=3600)
    check_regions: List[str] = ["WWA", "NAM", "EUE", "SAM"]

class CloudflareMonitorResponse(BaseModel):
    """Cloudflare monitor response schema"""
    id: str
    modified: str

# Configuration schemas
class CloudflareConfigurationUpdate(BaseModel):
    """Cloudflare configuration update schema"""
    preferred_ip_version: Optional[str] = Field(None, pattern=r'^(ipv4|ipv6|auto)$')
    minimum_tls_version: Optional[str] = Field(None, pattern=r'^(1\.0|1\.1|1\.2|1\.3)$')
    ciphers: Optional[List[str]] = None
    certificate_status: Optional[str] = Field(None, pattern=r'^(active|disabled)$')
    automatic_https_rewrites: Optional[bool] = None
    opportunistic_encryption: Optional[bool] = None
    tls_1_3: Optional[str] = Field(None, pattern=r'^(on|off)$')
    hsts: Optional[Dict[str, Any]] = None

# Bulk operation schemas
class CloudflareBulkOperationRequest(BaseModel):
    """Cloudflare bulk operation request schema"""
    operation_type: str = Field(..., pattern="^(create|update|delete|purge)$")
    resource_type: str = Field(..., pattern="^(dns_records|cache|workers|tunnels)$")
    resources: List[Dict[str, Any]]
    provider_ids: List[UUID]

class CloudflareBulkOperationResponse(BaseModel):
    """Cloudflare bulk operation response schema"""
    operation_id: str
    status: str
    total_requested: int
    successful: int
    failed: int
    errors: List[str]
    results: List[Dict[str, Any]]

# Export/Import schemas
class CloudflareExportRequest(BaseModel):
    """Cloudflare export request schema"""
    format: str = Field("json", pattern="^(json|yaml|csv)$")
    include_credentials: bool = Field(False)
    resource_types: List[str]

class CloudflareImportRequest(BaseModel):
    """Cloudflare import request schema"""
    data: Dict[str, Any]
    overwrite_existing: bool = Field(False)
    validate_before_import: bool = Field(True)

# Webhook schemas
class CloudflareWebhookConfiguration(BaseModel):
    """Cloudflare webhook configuration schema"""
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., pattern=r'^https?://')
    events: List[str]
    secret: Optional[str] = Field(None, min_length=32, max_length=255)
    active: bool = Field(True)
    retry_count: int = Field(3, ge=0, le=10)
    timeout: int = Field(30, ge=5, le=300)

class CloudflareWebhookResponse(BaseModel):
    """Cloudflare webhook response schema"""
    id: str
    name: str
    url: str
    events: List[str]
    secret: Optional[str]
    active: bool
    retry_count: int
    timeout: int
    last_triggered: Optional[datetime]
    trigger_count: int
    created_at: datetime
    updated_at: Optional[datetime]

# Rate limiting schemas
class CloudflareRateLimitConfig(BaseModel):
    """Cloudflare rate limiting configuration schema"""
    rate_limiting: Dict[str, int]
    advanced_rate_limiting_rules: Optional[List[Dict[str, Any]] = None

class CloudflareRateLimitRule(BaseModel):
    """Cloudflare rate limiting rule schema"""
    id: str
    action: str = Field(..., pattern="^(block|challenge|js_challenge|simulate|whitelist)$")
    match: Dict[str, Any]
    response: Optional[Dict[str, Any]] = None
    ratelimit: Optional[Dict[str, int]] = None
    disabled: Optional[bool] = None
    description: Optional[str] = None