"""
Document model
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Document(Base):
    """Document model"""
    
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    
    # Ownership
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="documents")
    
    # Document metadata
    document_metadata = Column(JSON, default=dict)
    source = Column(String, nullable=True)  # upload, url, api, etc.
    source_url = Column(String, nullable=True)
    
    # Vector embeddings
    embeddings = Column(JSON, nullable=True)
    chunks = Column(JSON, default=list)
    
    # Processing status
    processing_status = Column(String, default="pending")  # pending, processing, completed, failed
    processing_error = Column(Text, nullable=True)
    
    # Access control
    is_public = Column(Boolean, default=False)
    access_permissions = Column(JSON, default=list)
    
    # Tags and categorization
    tags = Column(JSON, default=list)
    category = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<Document(id={self.id}, title={self.title})>"