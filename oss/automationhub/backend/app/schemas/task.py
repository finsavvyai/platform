"""
Task schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class TaskBase(BaseModel):
    """Base task schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: str = Field(..., description="Type of task (browser, infrastructure, llm, etc.)")


class TaskCreate(TaskBase):
    """Task creation schema"""
    workflow_id: uuid.UUID
    agent_id: Optional[uuid.UUID] = None
    parameters: Dict[str, Any] = {}
    dependencies: List[uuid.UUID] = []
    timeout_seconds: int = 300
    max_retries: int = 3


class TaskUpdate(BaseModel):
    """Task update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    dependencies: Optional[List[uuid.UUID]] = None
    status: Optional[str] = None
    timeout_seconds: Optional[int] = None
    max_retries: Optional[int] = None


class TaskResponse(TaskBase):
    """Task response schema"""
    id: uuid.UUID
    workflow_id: uuid.UUID
    agent_id: Optional[uuid.UUID] = None
    parameters: Dict[str, Any]
    dependencies: List[uuid.UUID]
    status: str
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_log: List[Dict[str, Any]]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    timeout_seconds: int
    retry_count: int
    max_retries: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True