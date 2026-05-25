"""
Common schema utilities and base models

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

from typing import Generic, TypeVar, List, Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime

T = TypeVar('T')


class BaseResponse(BaseModel):
    """Base response model with common fields"""
    success: bool = True
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseResponse):
    """Error response model"""
    success: bool = False
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class BulkOperationRequest(BaseModel):
    """Request model for bulk operations"""
    items: List[Any]
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)


class BulkOperationResponse(BaseModel):
    """Response model for bulk operations"""
    total: int
    successful: int
    failed: int
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class SearchRequest(BaseModel):
    """Search request model"""
    query: Optional[str] = None
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    sort_by: Optional[str] = None
    sort_order: Optional[str] = Field(default="asc", regex="^(asc|desc)$")


class ExportRequest(BaseModel):
    """Export request model"""
    format: str = Field(default="json", regex="^(json|csv|xlsx)$")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    fields: Optional[List[str]] = None