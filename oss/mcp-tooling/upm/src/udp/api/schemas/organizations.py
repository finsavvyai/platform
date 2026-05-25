from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, constr


slug_str = constr(regex=r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", min_length=1, max_length=100)


class OrganizationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: constr(min_length=1, max_length=200)
    slug: slug_str
    domain: Optional[constr(max_length=255)] = None
    industry: Optional[constr(max_length=100)] = None
    size: Optional[constr(max_length=50)] = None
    country: Optional[constr(max_length=2)] = None
    compliance_frameworks: List[str] = Field(default_factory=list)
    allowed_licenses: List[str] = Field(default_factory=list)
    blocked_licenses: List[str] = Field(default_factory=list)
    max_vulnerability_score: float = 7.0
    auto_update_enabled: bool = False
    require_approval: bool = True
    notification_emails: List[str] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    country: Optional[str] = None
    compliance_frameworks: List[str] = []
    allowed_licenses: List[str] = []
    blocked_licenses: List[str] = []
    max_vulnerability_score: float
    auto_update_enabled: bool
    require_approval: bool
    notification_emails: List[str]
    settings: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    is_deleted: bool


class OrganizationListResponse(BaseModel):
    organizations: List[OrganizationResponse]
    total: int
    skip: int
    limit: int


class OrganizationSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")

    # Allow arbitrary settings keys/values; no predefined fields
    # The model exists to enforce object and not array/primitive


class SettingsUpdateResponse(BaseModel):
    status: str
    organization: OrganizationResponse


class OrganizationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[constr(min_length=1, max_length=200)] = None
    slug: Optional[slug_str] = None
    domain: Optional[constr(max_length=255)] = None
    industry: Optional[constr(max_length=100)] = None
    size: Optional[constr(max_length=50)] = None
    country: Optional[constr(max_length=2)] = None
    compliance_frameworks: Optional[List[str]] = None
    allowed_licenses: Optional[List[str]] = None
    blocked_licenses: Optional[List[str]] = None
    max_vulnerability_score: Optional[float] = None
    auto_update_enabled: Optional[bool] = None
    require_approval: Optional[bool] = None
    notification_emails: Optional[List[str]] = None
