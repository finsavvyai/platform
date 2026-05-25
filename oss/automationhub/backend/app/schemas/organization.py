"""
Organization schemas
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class OrganizationBase(BaseModel):
    """Base organization schema"""
    name: str = Field(..., min_length=1, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    """Organization creation schema"""
    subscription_plan: str = Field(default="free", pattern="^(free|pro|enterprise)$")
    billing_email: Optional[EmailStr] = None
    settings: Dict[str, Any] = Field(default_factory=dict)
    security_settings: Dict[str, Any] = Field(default_factory=dict)
    compliance_requirements: List[str] = Field(default_factory=list)


class OrganizationUpdate(BaseModel):
    """Organization update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    subscription_plan: Optional[str] = Field(None, pattern="^(free|pro|enterprise)$")
    billing_email: Optional[EmailStr] = None
    settings: Optional[Dict[str, Any]] = None
    security_settings: Optional[Dict[str, Any]] = None
    compliance_requirements: Optional[List[str]] = None
    is_active: Optional[bool] = None


class OrganizationResponse(OrganizationBase):
    """Organization response schema"""
    id: UUID
    subscription_plan: str
    billing_email: Optional[str] = None
    settings: Dict[str, Any]
    security_settings: Dict[str, Any]
    compliance_requirements: List[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


