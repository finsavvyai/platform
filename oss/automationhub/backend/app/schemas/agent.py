"""
Agent schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class AgentBase(BaseModel):
    """Base agent schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    agent_type: str = Field(..., description="Type of agent (browser, infrastructure, conversational, etc.)")


class AgentCreate(AgentBase):
    """Agent creation schema"""
    capabilities: List[str] = []
    llm_config: Dict[str, Any] = {}
    tools: List[str] = []
    memory_config: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}
    environment_variables: Dict[str, str] = {}
    is_enabled: bool = True


class AgentUpdate(BaseModel):
    """Agent update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    capabilities: Optional[List[str]] = None
    llm_config: Optional[Dict[str, Any]] = None
    tools: Optional[List[str]] = None
    memory_config: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    environment_variables: Optional[Dict[str, str]] = None
    is_enabled: Optional[bool] = None
    status: Optional[str] = None


class AgentResponse(AgentBase):
    """Agent response schema"""
    id: uuid.UUID
    capabilities: List[str]
    llm_config: Dict[str, Any]
    tools: List[str]
    memory_config: Dict[str, Any]
    knowledge_base: Dict[str, Any]
    performance_metrics: Dict[str, Any]
    success_rate: int
    average_execution_time: int
    status: str
    is_enabled: bool
    settings: Dict[str, Any]
    environment_variables: Dict[str, str]
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_active: Optional[datetime] = None
    
    class Config:
        from_attributes = True