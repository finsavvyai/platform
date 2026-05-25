"""
Extended Document and Knowledge Management Models for UPM.Plus
"""

from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

# Import existing Document model
from app.models.document import Document


class KnowledgeChunk:
    """Knowledge chunk model for storing text chunks and embeddings"""
    
    __tablename__ = "knowledge_base"
    
    def __init__(self, id: str, document_id: str, chunk_text: str, chunk_index: int, 
                 embedding_id: str = None, metadata: dict = None, created_at: datetime = None):
        self.id = id
        self.document_id = document_id
        self.chunk_text = chunk_text
        self.chunk_index = chunk_index
        self.embedding_id = embedding_id
        self.metadata = metadata or {}
        self.created_at = created_at or datetime.utcnow()
    
    def __repr__(self):
        return f"<KnowledgeChunk(id={self.id}, document_id={self.document_id}, chunk_index={self.chunk_index})>"


class DocumentProcessingJob:
    """Model for tracking document processing jobs"""
    
    __tablename__ = "document_processing_jobs"
    
    def __init__(self, id: str, document_id: str, status: str = "pending", 
                 progress: int = 0, chunks_processed: int = 0, total_chunks: int = 0,
                 error_message: str = None, started_at: datetime = None, completed_at: datetime = None):
        self.id = id
        self.document_id = document_id
        self.status = status
        self.progress = progress
        self.chunks_processed = chunks_processed
        self.total_chunks = total_chunks
        self.error_message = error_message
        self.started_at = started_at or datetime.utcnow()
        self.completed_at = completed_at
    
    def __repr__(self):
        return f"<DocumentProcessingJob(id={self.id}, document_id={self.document_id}, status={self.status})>"


class DocumentTag:
    """Model for document tags"""
    
    __tablename__ = "document_tags"
    
    def __init__(self, id: str, document_id: str, tag: str, created_at: datetime = None):
        self.id = id
        self.document_id = document_id
        self.tag = tag
        self.created_at = created_at or datetime.utcnow()
    
    def __repr__(self):
        return f"<DocumentTag(id={self.id}, document_id={self.document_id}, tag={self.tag})>"


class SearchHistory:
    """Model for tracking user search history"""
    
    __tablename__ = "search_history"
    
    def __init__(self, id: str, user_id: str, query: str, filters: dict = None, 
                 results_count: int = 0, created_at: datetime = None):
        self.id = id
        self.user_id = user_id
        self.query = query
        self.filters = filters or {}
        self.results_count = results_count
        self.created_at = created_at or datetime.utcnow()
    
    def __repr__(self):
        return f"<SearchHistory(id={self.id}, user_id={self.user_id}, query={self.query[:50]}...)"


# SQL schemas for Cloudflare D1
KNOWLEDGE_BASE_SCHEMA = """
CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding_id TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_document_id ON knowledge_base(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunk_index ON knowledge_base(chunk_index);
"""

DOCUMENT_PROCESSING_JOBS_SCHEMA = """
CREATE TABLE IF NOT EXISTS document_processing_jobs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    chunks_processed INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_document_id ON document_processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_status ON document_processing_jobs(status);
"""

DOCUMENT_TAGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS document_tags (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
"""

SEARCH_HISTORY_SCHEMA = """
CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    query TEXT NOT NULL,
    filters TEXT,
    results_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);
"""

# Complete schema for knowledge management
KNOWLEDGE_MANAGEMENT_SCHEMA = f"""
{KNOWLEDGE_BASE_SCHEMA}
{DOCUMENT_PROCESSING_JOBS_SCHEMA}
{DOCUMENT_TAGS_SCHEMA}
{SEARCH_HISTORY_SCHEMA}
"""
