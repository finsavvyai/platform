"""
Ansible Schemas
Pydantic models for Ansible automation and infrastructure management
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator
from uuid import UUID

# Base schemas
class AnsiblePlaybookBase(BaseModel):
    """Base Ansible playbook schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=1000)
    content: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1, max_length=100)
    tags: List[str] = Field(default_factory=list)
    variables_schema: Optional[Dict[str, Any]] = None

class AnsiblePlaybookCreate(AnsiblePlaybookBase):
    """Ansible playbook creation schema"""
    pass

class AnsiblePlaybookUpdate(BaseModel):
    """Ansible playbook update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    tags: Optional[List[str]] = None
    variables_schema: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class AnsiblePlaybookResponse(BaseModel):
    """Ansible playbook response schema"""
    id: UUID
    name: str
    description: str
    content: str  # Be careful with sensitive data
    category: str
    tags: List[str]
    variables_schema: Optional[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True

# Inventory schemas
class AnsibleInventoryBase(BaseModel):
    """Base Ansible inventory schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=1000)
    inventory_type: str = Field(..., regex="^(static|dynamic|hybrid)$")
    content: Optional[str] = None
    script_content: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None

    @validator('content')
    def validate_static_inventory(cls, v, values):
        if values.get('inventory_type') == 'static' and not v:
            raise ValueError('Static inventory must have content')
        return v

    @validator('script_content')
    def validate_dynamic_inventory(cls, v, values):
        if values.get('inventory_type') == 'dynamic' and not v:
            raise ValueError('Dynamic inventory must have script content')
        return v

class AnsibleInventoryCreate(AnsibleInventoryBase):
    """Ansible inventory creation schema"""
    pass

class AnsibleInventoryUpdate(BaseModel):
    """Ansible inventory update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    inventory_type: Optional[str] = Field(None, regex="^(static|dynamic|hybrid)$")
    content: Optional[str] = None
    script_content: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class AnsibleInventoryResponse(BaseModel):
    """Ansible inventory response schema"""
    id: UUID
    name: str
    description: str
    inventory_type: str
    content: Optional[str]
    script_content: Optional[str]
    variables: Optional[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True

# Execution schemas
class AnsibleExecutionRequest(BaseModel):
    """Ansible execution request schema"""
    inventory_id: Optional[UUID] = None
    extra_vars: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    skip_tags: Optional[List[str]] = None
    limit: Optional[str] = None
    forks: Optional[int] = Field(10, ge=1, le=100)
    timeout: Optional[int] = Field(3600, ge=60, le=86400)

    @validator('forks')
    def validate_forks(cls, v):
        if v is not None and (v < 1 or v > 100):
            raise ValueError('Forks must be between 1 and 100')
        return v

class AnsibleExecutionResponse(BaseModel):
    """Ansible execution response schema"""
    execution_id: str
    status: str
    return_code: Optional[int]
    stdout: Optional[str]
    stderr: Optional[str]
    execution_time: Optional[float]
    stats: Optional[Dict[str, Any]]
    host_results: Optional[Dict[str, Any]]
    error_message: Optional[str]

class AnsibleExecutionStatus(BaseModel):
    """Ansible execution status schema"""
    id: UUID
    playbook_id: UUID
    inventory_id: Optional[UUID]
    status: str
    return_code: Optional[int]
    execution_time: Optional[float]
    stats: Optional[Dict[str, Any]]
    host_results: Optional[Dict[str, Any]]
    error_message: Optional[str]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

# Template schemas
class PlaybookTemplate(BaseModel):
    """Playbook template schema"""
    name: str
    description: str
    categories: List[str]
    variables: Dict[str, Any]

class PlaybookTemplateResponse(BaseModel):
    """Playbook template library response"""
    templates: Dict[str, PlaybookTemplate]

# Host and task schemas
class AnsibleHostResult(BaseModel):
    """Ansible host execution result"""
    host: str
    status: str
    tasks: List[Dict[str, Any]]
    changed: bool
    failed: bool
    unreachable: bool
    skipped: bool

class AnsibleTaskResult(BaseModel):
    """Ansible task execution result"""
    name: str
    status: str
    changed: bool
    failed: bool
    skipped: bool
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration: Optional[float]
    output: Optional[str]
    error: Optional[str]

# Statistics and analytics schemas
class AnsibleExecutionStats(BaseModel):
    """Ansible execution statistics"""
    ok: int = 0
    changed: int = 0
    unreachables: int = 0
    failed: int = 0
    skipped: int = 0
    rescued: int = 0
    ignored: int = 0

class AnsiblePerformanceMetrics(BaseModel):
    """Ansible performance metrics"""
    total_executions: int
    successful_executions: int
    failed_executions: int
    success_rate: float
    average_execution_time: float
    total_execution_time: float
    most_used_playbooks: List[Dict[str, Any]]
    execution_trends: List[Dict[str, Any]]

# Validation schemas
class PlaybookValidationRequest(BaseModel):
    """Playbook validation request"""
    content: str
    validate_syntax: bool = True
    validate_variables: bool = True
    check_mode: bool = False

class PlaybookValidationResponse(BaseModel):
    """Playbook validation response"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    parsed_tasks: List[Dict[str, Any]] = []
    required_variables: List[str] = []
    estimated_duration: Optional[float] = None

class InventoryValidationRequest(BaseModel):
    """Inventory validation request"""
    content: Optional[str] = None
    script_content: Optional[str] = None
    inventory_type: str = Field(..., regex="^(static|dynamic|hybrid)$")

class InventoryValidationResponse(BaseModel):
    """Inventory validation response"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    host_count: int = 0
    group_count: int = 0
    hosts: List[str] = []
    groups: List[str] = []

# Rollback schemas
class RollbackExecutionRequest(BaseModel):
    """Rollback execution request"""
    execution_id: UUID
    dry_run: bool = False
    force: bool = False

class RollbackExecutionResponse(BaseModel):
    """Rollback execution response"""
    success: bool
    rollback_execution_id: Optional[UUID]
    message: str
    warnings: List[str] = []

# Scheduling schemas
class ScheduledExecutionCreate(BaseModel):
    """Scheduled execution creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=1000)
    playbook_id: UUID
    inventory_id: Optional[UUID] = None
    schedule: str = Field(..., description="Cron expression")
    extra_vars: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    skip_tags: Optional[List[str]] = None
    limit: Optional[str] = None
    forks: Optional[int] = Field(10, ge=1, le=100)
    timeout: Optional[int] = Field(3600, ge=60, le=86400)
    is_active: bool = True
    timezone: str = Field("UTC", description="Timezone for schedule")

    @validator('schedule')
    def validate_cron_expression(cls, v):
        # Basic validation - would use croniter or similar in production
        parts = v.split()
        if len(parts) != 5:
            raise ValueError('Invalid cron expression')
        return v

class ScheduledExecutionResponse(BaseModel):
    """Scheduled execution response schema"""
    id: UUID
    name: str
    description: str
    playbook_id: UUID
    inventory_id: Optional[UUID]
    schedule: str
    extra_vars: Optional[Dict[str, Any]]
    tags: Optional[List[str]]
    skip_tags: Optional[List[str]]
    limit: Optional[str]
    forks: Optional[int]
    timeout: Optional[int]
    is_active: bool
    timezone: str
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]
    updated_by: Optional[UUID]

    class Config:
        from_attributes = True

# Bulk operation schemas
class BulkExecutionRequest(BaseModel):
    """Bulk execution request schema"""
    playbook_ids: List[UUID] = Field(..., min_items=1, max_items=50)
    inventory_id: Optional[UUID] = None
    extra_vars: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    skip_tags: Optional[List[str]] = None
    limit: Optional[str] = None
    forks: Optional[int] = Field(10, ge=1, le=100)
    timeout: Optional[int] = Field(3600, ge=60, le=86400)
    parallel: bool = False

class BulkExecutionResponse(BaseModel):
    """Bulk execution response schema"""
    total_requested: int
    successful: int
    failed: int
    execution_ids: List[UUID]
    errors: List[str]

# Configuration schemas
class AnsibleConfigurationUpdate(BaseModel):
    """Ansible configuration update schema"""
    ansible_path: Optional[str] = None
    ansible_playbook_path: Optional[str] = None
    playbooks_dir: Optional[str] = None
    inventory_dir: Optional[str] = None
    roles_dir: Optional[str] = None
    default_forks: Optional[int] = Field(None, ge=1, le=100)
    default_timeout: Optional[int] = Field(None, ge=60, le=86400)
    enable_logging: Optional[bool] = None
    log_level: Optional[str] = Field(None, regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

class AnsibleConfigurationResponse(BaseModel):
    """Ansible configuration response schema"""
    ansible_path: str
    ansible_playbook_path: str
    playbooks_dir: str
    inventory_dir: str
    roles_dir: str
    default_forks: int
    default_timeout: int
    enable_logging: bool
    log_level: str
    version: Optional[str]
    available_modules: List[str]

# Integration schemas
class CloudProviderConfig(BaseModel):
    """Cloud provider configuration for Ansible"""
    provider: str = Field(..., regex="^(aws|azure|gcp|digitalocean|linode)$")
    region: Optional[str] = None
    credentials: Dict[str, Any]
    additional_config: Optional[Dict[str, Any]] = None

class CloudInventoryResponse(BaseModel):
    """Cloud inventory response"""
    provider: str
    region: Optional[str]
    host_count: int
    hosts: List[Dict[str, Any]]
    groups: Dict[str, List[str]]
    last_sync: datetime

# Webhook schemas
class WebhookConfiguration(BaseModel):
    """Webhook configuration for Ansible events"""
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., regex=r'^https?://')
    events: List[str] = Field(..., description="Events to trigger webhook")
    secret: Optional[str] = None
    active: bool = True
    retry_count: int = Field(3, ge=0, le=10)
    timeout: int = Field(30, ge=5, le=300)

class WebhookResponse(BaseModel):
    """Webhook response schema"""
    id: UUID
    name: str
    url: str
    events: List[str]
    active: bool
    retry_count: int
    timeout: int
    last_triggered: Optional[datetime]
    trigger_count: int
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]

    class Config:
        from_attributes = True

# Export/Import schemas
class ExportPlaybooksRequest(BaseModel):
    """Export playbooks request"""
    playbook_ids: Optional[List[UUID]] = None
    category: Optional[str] = None
    include_content: bool = True
    include_metadata: bool = True
    format: str = Field("yaml", regex="^(yaml|json)$")

class ImportPlaybooksRequest(BaseModel):
    """Import playbooks request"""
    playbooks: List[Dict[str, Any]]
    overwrite_existing: bool = False
    validate_before_import: bool = True
    category_prefix: Optional[str] = None