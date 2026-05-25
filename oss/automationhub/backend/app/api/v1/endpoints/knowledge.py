"""
Knowledge Management API endpoints.

Provides document upload, processing, semantic search, and RAG-powered
knowledge retrieval for the UPM.Plus conversational AI system.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from pydantic import BaseModel, Field

from app.services.knowledge_management import (
    knowledge_service,
    ProcessedDocument,
    KnowledgeQuery,
    KnowledgeResult
)
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


class DocumentUploadResponse(BaseModel):
    """Response model for document upload."""
    document_id: UUID
    filename: str
    status: str
    message: str


class DocumentResponse(BaseModel):
    """Response model for document information."""
    id: UUID
    filename: str
    content_type: str
    file_size: int
    processing_status: str
    processing_error: Optional[str]
    chunk_count: int
    metadata: Dict[str, Any]
    tags: List[str]
    created_at: datetime
    updated_at: datetime


class KnowledgeQueryRequest(BaseModel):
    """Request model for knowledge queries."""
    query: str
    max_results: int = Field(default=10, ge=1, le=50)
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    filters: Dict[str, Any] = Field(default_factory=dict)
    include_summary: bool = True
    include_suggestions: bool = True


class DocumentUpdateRequest(BaseModel):
    """Request model for updating document metadata."""
    metadata: Dict[str, Any] = Field(default_factory=dict)
    tags: Optional[List[str]] = None


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    metadata: str = Form("{}"),
    tags: str = Form("[]"),
    current_user: User = Depends(get_current_user)
):
    """Upload and process a document."""
    try:
        import json

        # Parse metadata and tags
        try:
            parsed_metadata = json.loads(metadata)
            parsed_tags = json.loads(tags)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in metadata or tags: {e}")

        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # Check file size (10MB limit)
        max_size = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()

        if len(file_content) > max_size:
            raise HTTPException(status_code=413, detail="File too large (max 10MB)")

        # Add user metadata
        parsed_metadata.update({
            "uploaded_by": str(current_user.id),
            "upload_timestamp": datetime.utcnow().isoformat()
        })

        # Upload document
        document_id = await knowledge_service.upload_document(
            file_content=file_content,
            filename=file.filename,
            content_type=file.content_type,
            user_id=current_user.id,
            metadata=parsed_metadata
        )

        return DocumentUploadResponse(
            document_id=document_id,
            filename=file.filename,
            status="processing",
            message="Document uploaded successfully and is being processed"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload document: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    status: Optional[str] = Query(None, description="Filter by processing status"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of documents to return"),
    current_user: User = Depends(get_current_user)
):
    """List user's documents."""
    try:
        documents = await knowledge_service.list_documents(
            user_id=current_user.id,
            status=status,
            limit=limit
        )

        return [
            DocumentResponse(
                id=doc.id,
                filename=doc.filename,
                content_type=doc.content_type,
                file_size=doc.file_size,
                processing_status=doc.processing_status,
                processing_error=doc.processing_error,
                chunk_count=len(doc.chunks),
                metadata=doc.metadata,
                tags=doc.tags,
                created_at=doc.created_at,
                updated_at=doc.updated_at
            )
            for doc in documents
        ]

    except Exception as e:
        logger.error(f"Failed to list documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve documents")


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get document by ID."""
    try:
        document = await knowledge_service.get_document(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Check permissions
        if document.user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        return DocumentResponse(
            id=document.id,
            filename=document.filename,
            content_type=document.content_type,
            file_size=document.file_size,
            processing_status=document.processing_status,
            processing_error=document.processing_error,
            chunk_count=len(document.chunks),
            metadata=document.metadata,
            tags=document.tags,
            created_at=document.created_at,
            updated_at=document.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document")


@router.put("/documents/{document_id}", response_model=Dict[str, str])
async def update_document(
    document_id: UUID,
    request: DocumentUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update document metadata and tags."""
    try:
        document = await knowledge_service.get_document(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Check permissions
        if document.user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        success = await knowledge_service.update_document_metadata(
            document_id=document_id,
            metadata=request.metadata,
            tags=request.tags
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update document")

        return {"status": "updated", "message": "Document updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update document: {e}")
        raise HTTPException(status_code=500, detail="Failed to update document")


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Delete document and its chunks."""
    try:
        document = await knowledge_service.get_document(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Check permissions
        if document.user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        success = await knowledge_service.delete_document(document_id)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete document")

        return {"status": "deleted", "message": "Document deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")


@router.post("/search", response_model=KnowledgeResult)
async def search_knowledge(
    request: KnowledgeQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """Search the knowledge base with semantic search."""
    try:
        # Add user filter to restrict to user's documents
        user_filters = request.filters.copy()
        user_filters["user_id"] = str(current_user.id)

        query = KnowledgeQuery(
            query=request.query,
            max_results=request.max_results,
            similarity_threshold=request.similarity_threshold,
            user_id=current_user.id,
            filters=user_filters
        )

        result = await knowledge_service.query_knowledge(query)

        # Optionally filter out summary/suggestions based on request
        if not request.include_summary:
            result.summary = None
        if not request.include_suggestions:
            result.suggested_questions = []

        return result

    except Exception as e:
        logger.error(f"Knowledge search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/search/suggestions")
async def get_search_suggestions(
    query: str = Query(..., min_length=1, description="Partial query for suggestions"),
    limit: int = Query(5, ge=1, le=10, description="Maximum number of suggestions"),
    current_user: User = Depends(get_current_user)
):
    """Get search suggestions based on user's knowledge base."""
    try:
        # Get user's documents for suggestion context
        documents = await knowledge_service.list_documents(
            user_id=current_user.id,
            status="completed",
            limit=10
        )

        # Generate suggestions based on document metadata
        suggestions = []
        query_lower = query.lower()

        # Look for matching topics, filenames, and metadata
        for doc in documents:
            # Check filename
            if query_lower in doc.filename.lower():
                suggestions.append(f"Search in {doc.filename}")

            # Check AI-extracted topics
            if "key_topics" in doc.metadata:
                for topic in doc.metadata["key_topics"]:
                    if isinstance(topic, str) and query_lower in topic.lower():
                        suggestions.append(f"Find information about {topic}")

            # Check metadata values
            for key, value in doc.metadata.items():
                if isinstance(value, str) and query_lower in value.lower():
                    suggestions.append(f"Search for {value}")

        # Remove duplicates and limit
        unique_suggestions = list(set(suggestions))[:limit]

        # Add generic suggestions if not enough specific ones
        if len(unique_suggestions) < limit:
            generic_suggestions = [
                f"What is {query}?",
                f"How does {query} work?",
                f"Explain {query}",
                f"Find examples of {query}",
                f"Show me documents about {query}"
            ]

            for suggestion in generic_suggestions:
                if len(unique_suggestions) >= limit:
                    break
                if suggestion not in unique_suggestions:
                    unique_suggestions.append(suggestion)

        return {"suggestions": unique_suggestions[:limit]}

    except Exception as e:
        logger.error(f"Failed to get search suggestions: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate suggestions")


@router.get("/stats")
async def get_knowledge_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get knowledge base statistics for the current user."""
    try:
        stats = await knowledge_service.get_statistics(user_id=current_user.id)
        return stats

    except Exception as e:
        logger.error(f"Failed to get knowledge statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


@router.get("/health")
async def knowledge_health_check():
    """Check knowledge management service health."""
    try:
        # Check vector store health
        vector_health = await knowledge_service.vector_store.health_check()

        # Get basic statistics
        stats = await knowledge_service.get_statistics()

        return {
            "status": "healthy" if vector_health else "degraded",
            "vector_store": "connected" if vector_health else "disconnected",
            "total_documents": stats.get("documents", {}).get("total", 0),
            "total_chunks": stats.get("chunks", {}).get("total", 0),
            "vector_db_chunks": stats.get("chunks", {}).get("in_vector_db", 0)
        }

    except Exception as e:
        logger.error(f"Knowledge health check failed: {e}")
        raise HTTPException(status_code=503, detail="Knowledge service unhealthy")


@router.post("/documents/{document_id}/reprocess")
async def reprocess_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Reprocess a document (useful for failed or outdated processing)."""
    try:
        document = await knowledge_service.get_document(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Check permissions
        if document.user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        # For now, just mark as processing - in a full implementation,
        # would trigger reprocessing with the original file content
        document.processing_status = "processing"
        document.processing_error = None
        document.updated_at = datetime.utcnow()

        return {
            "status": "processing",
            "message": "Document reprocessing initiated"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reprocess document: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate reprocessing")


@router.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: UUID,
    include_chunks: bool = Query(False, description="Include individual chunks"),
    current_user: User = Depends(get_current_user)
):
    """Get document content and optionally its chunks."""
    try:
        document = await knowledge_service.get_document(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Check permissions
        if document.user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        response = {
            "document_id": document.id,
            "filename": document.filename,
            "original_content": document.original_content,
            "processed_content": document.processed_content,
            "processing_status": document.processing_status
        }

        if include_chunks:
            response["chunks"] = [
                {
                    "id": chunk.id,
                    "content": chunk.content,
                    "chunk_index": chunk.chunk_index,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                    "metadata": chunk.metadata
                }
                for chunk in document.chunks
            ]

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document content: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document content")