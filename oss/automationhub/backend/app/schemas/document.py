"""
Document schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class DocumentBase(BaseModel):
    """Base document schema"""
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []


class DocumentCreate(DocumentBase):
    """Document creation schema"""
    source: Optional[str] = None
    source_url: Optional[str] = None
    metadata: Dict[str, Any] = {}
    is_public: bool = False


class DocumentUpdate(BaseModel):
    """Document update schema"""
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None


class DocumentResponse(DocumentBase):
    """Document response schema"""
    id: uuid.UUID
    owner_id: uuid.UUID
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    metadata: Dict[str, Any]
    source: Optional[str] = None
    source_url: Optional[str] = None
    processing_status: str
    processing_error: Optional[str] = None
    is_public: bool
    access_permissions: List[Dict[str, Any]]
    created_at: datetime
    updated_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True