"""
Agent model
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Agent(Base):
    """Agent model"""
    
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # Agent configuration
    agent_type = Column(String, nullable=False)  # browser, infrastructure, conversational, etc.
    capabilities = Column(JSON, default=list)
    llm_config = Column(JSON, default=dict)
    tools = Column(JSON, default=list)
    
    # Memory and learning
    memory_config = Column(JSON, default=dict)
    knowledge_base = Column(JSON, default=dict)
    
    # Performance metrics
    performance_metrics = Column(JSON, default=dict)
    success_rate = Column(Integer, default=0)
    average_execution_time = Column(Integer, default=0)
    
    # Status
    status = Column(String, default="inactive")  # inactive, active, busy, error
    is_enabled = Column(Boolean, default=True)
    
    # Configuration
    settings = Column(JSON, default=dict)
    environment_variables = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_active = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    tasks = relationship("Task", back_populates="agent")
    node_executions = relationship("app.models.workflow.NodeExecution", back_populates="agent")
    
    def __repr__(self):
        return f"<Agent(id={self.id}, name={self.name}, type={self.agent_type})>"