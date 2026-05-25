"""
Organization model
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Organization(Base):
    """Organization model"""
    
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    domain = Column(String, unique=True, nullable=True)
    description = Column(String, nullable=True)
    
    # Subscription and billing
    subscription_plan = Column(String, default="free")  # free, pro, enterprise
    billing_email = Column(String, nullable=True)
    
    # Settings and configuration
    settings = Column(JSON, default=dict)
    security_settings = Column(JSON, default=dict)
    compliance_requirements = Column(JSON, default=list)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="organization")
    workflows = relationship("Workflow", back_populates="organization")
    
    def __repr__(self):
        return f"<Organization(id={self.id}, name={self.name})>"