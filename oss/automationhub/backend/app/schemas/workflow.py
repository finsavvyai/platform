"""
Workflow schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class WorkflowBase(BaseModel):
    """Base workflow schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []


class WorkflowCreate(WorkflowBase):
    """Workflow creation schema"""
    nodes: List[Dict[str, Any]] = []
    connections: List[Dict[str, Any]] = []
    variables: Dict[str, Any] = {}
    triggers: List[Dict[str, Any]] = []
    is_template: bool = False
    is_public: bool = False


class WorkflowUpdate(BaseModel):
    """Workflow update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    connections: Optional[List[Dict[str, Any]]] = None
    variables: Optional[Dict[str, Any]] = None
    triggers: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class WorkflowResponse(WorkflowBase):
    """Workflow response schema"""
    id: uuid.UUID
    owner_id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    nodes: List[Dict[str, Any]]
    connections: List[Dict[str, Any]]
    variables: Dict[str, Any]
    triggers: List[Dict[str, Any]]
    status: str
    version: int
    is_template: bool
    is_public: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_executed: Optional[datetime] = None
    
    class Config:
        from_attributes = True