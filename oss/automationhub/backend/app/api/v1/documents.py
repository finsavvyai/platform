"""
Document Management API Endpoints for UPM.Plus Knowledge Management
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
import os
import uuid
from pathlib import Path
import json
from datetime import datetime

from app.core.config import settings
from app.core.cloudflare_d1 import get_d1_session
from app.services.knowledge_models import KnowledgeChunk, DocumentProcessingJob, DocumentTag, SearchHistory
from app.models.document import Document
from app.models.user import User
from app.services.document_processor import get_document_processor
from app.api.deps import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/documents", response_model=List[Dict[str, Any]])
async def get_documents(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get all documents for the current user"""
    try:
        async with get_d1_session() as session:
            result = await session.execute(
                f"""
                SELECT id, title, content, metadata, file_path, file_size, mime_type,
                       is_active, created_at, updated_at, embedding_status,
                       (SELECT COUNT(*) FROM knowledge_base WHERE document_id = d.id) as chunk_count
                FROM documents d
                WHERE owner_id = :user_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :skip
                """,
                {"user_id": current_user.id, "limit": limit, "skip": skip}
            )
            
            documents = []
            for row in result:
                documents.append({
                    "id": row[0],
                    "title": row[1],
                    "content": row[2],
                    "metadata": json.loads(row[3]) if row[3] else {},
                    "file_path": row[4],
                    "file_size": row[5],
                    "mime_type": row[6],
                    "is_active": bool(row[7]),
                    "created_at": row[8],
                    "updated_at": row[9],
                    "embedding_status": row[10],
                    "chunk_count": row[11] or 0
                })
            
            return documents
            
    except Exception as e:
        logger.error(f"Failed to get documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve documents")


@router.get("/documents/{document_id}", response_model=Dict[str, Any])
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific document"""
    try:
        async with get_d1_session() as session:
            result = await session.execute(
                f"""
                SELECT id, title, content, metadata, file_path, file_size, mime_type,
                       is_active, created_at, updated_at, embedding_status,
                       (SELECT COUNT(*) FROM knowledge_base WHERE document_id = d.id) as chunk_count
                FROM documents d
                WHERE id = :doc_id AND owner_id = :user_id
                """,
                {"doc_id": document_id, "user_id": current_user.id}
            )
            
            row = result.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Document not found")
            
            return {
                "id": row[0],
                "title": row[1],
                "content": row[2],
                "metadata": json.loads(row[3]) if row[3] else {},
                "file_path": row[4],
                "file_size": row[5],
                "mime_type": row[6],
                "is_active": bool(row[7]),
                "created_at": row[8],
                "updated_at": row[9],
                "embedding_status": row[10],
                "chunk_count": row[11] or 0
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document")


@router.post("/documents", response_model=Dict[str, Any])
async def create_document(
    title: str,
    content: str,
    metadata: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Create a new text document"""
    try:
        # Parse metadata and tags
        doc_metadata = json.loads(metadata) if metadata else {}
        if tags:
            doc_metadata["tags"] = json.loads(tags)
        
        async with get_d1_session() as session:
            document = Document(
                id=str(uuid.uuid4()),
                title=title,
                content=content,
                metadata=doc_metadata,
                owner_id=current_user.id,
                is_active=True,
                embedding_status="pending",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            session.add(document)
            await session.commit()
            
            logger.info(f"Created document {document.id} for user {current_user.id}")
            
            return {
                "id": document.id,
                "title": document.title,
                "content": document.content,
                "metadata": document.metadata,
                "embedding_status": document.embedding_status,
                "created_at": document.created_at.isoformat(),
                "updated_at": document.updated_at.isoformat()
            }
            
    except Exception as e:
        logger.error(f"Failed to create document: {e}")
        raise HTTPException(status_code=500, detail="Failed to create document")


@router.put("/documents/{document_id}", response_model=Dict[str, Any])
async def update_document(
    document_id: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
    metadata: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    """Update a document"""
    try:
        async with get_d1_session() as session:
            # Check if document exists and belongs to user
            result = await session.execute(
                "SELECT id FROM documents WHERE id = :doc_id AND owner_id = :user_id",
                {"doc_id": document_id, "user_id": current_user.id}
            )
            
            if not result.fetchone():
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Prepare update data
            update_data = {
                "updated_at": datetime.utcnow()
            }
            
            if title is not None:
                update_data["title"] = title
            if content is not None:
                update_data["content"] = content
                update_data["embedding_status"] = "pending"  # Reprocess if content changed
            if metadata is not None:
                update_data["metadata"] = json.loads(metadata)
            if is_active is not None:
                update_data["is_active"] = is_active
            
            # Update document
            await session.execute(
                f"""
                UPDATE documents 
                SET {', '.join([f"{k} = :{k}" for k in update_data.keys()])}
                WHERE id = :doc_id
                """,
                {**update_data, "doc_id": document_id}
            )
            
            await session.commit()
            
            # Get updated document
            updated_doc = await get_document(document_id, current_user)
            
            logger.info(f"Updated document {document_id}")
            
            return updated_doc
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update document")


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a document"""
    try:
        async with get_d1_session() as session:
            # Check if document exists and belongs to user
            result = await session.execute(
                "SELECT id FROM documents WHERE id = :doc_id AND owner_id = :user_id",
                {"doc_id": document_id, "user_id": current_user.id}
            )
            
            if not result.fetchone():
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Delete chunks first
            processor = await get_document_processor()
            await processor.delete_document_chunks(document_id)
            
            # Delete document
            await session.execute(
                "DELETE FROM documents WHERE id = :doc_id",
                {"doc_id": document_id}
            )
            
            await session.commit()
            
            logger.info(f"Deleted document {document_id}")
            
            return {"message": "Document deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")


@router.post("/documents/upload", response_model=Dict[str, Any])
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[str] = None,
    metadata: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Upload a file document"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Check file size (50MB limit)
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if file_size > 50 * 1024 * 1024:  # 50MB
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        
        # Reset file pointer
        await file.seek(0)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix.lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Create upload directory
        upload_dir = Path(settings.UPLOAD_DIR) / "documents" / str(current_user.id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = upload_dir / unique_filename
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # Prepare metadata
        doc_metadata = json.loads(metadata) if metadata else {}
        if tags:
            doc_metadata["tags"] = json.loads(tags)
        if description:
            doc_metadata["description"] = description
        
        doc_metadata.update({
            "original_filename": file.filename,
            "file_size": file_size,
            "mime_type": file.content_type or "application/octet-stream",
            "upload_date": datetime.utcnow().isoformat()
        })
        
        # Create document record
        async with get_d1_session() as session:
            document = Document(
                id=str(uuid.uuid4()),
                title=title or file.filename,
                content="",  # Will be extracted during processing
                metadata=doc_metadata,
                owner_id=current_user.id,
                file_path=str(file_path),
                file_size=file_size,
                mime_type=file.content_type,
                is_active=True,
                embedding_status="pending",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            session.add(document)
            await session.commit()
            
            # Schedule background processing
            background_tasks.add_task(process_document_background, document.id)
            
            logger.info(f"Uploaded document {document.id} from file {file.filename}")
            
            return {
                "id": document.id,
                "title": document.title,
                "metadata": document.metadata,
                "file_size": document.file_size,
                "mime_type": document.mime_type,
                "embedding_status": document.embedding_status,
                "created_at": document.created_at.isoformat()
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload document: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload document")


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download a document file"""
    try:
        async with get_d1_session() as session:
            result = await session.execute(
                "SELECT title, file_path, mime_type FROM documents WHERE id = :doc_id AND owner_id = :user_id",
                {"doc_id": document_id, "user_id": current_user.id}
            )
            
            row = result.fetchone()
            if not row or not row[1]:
                raise HTTPException(status_code=404, detail="Document file not found")
            
            title, file_path, mime_type = row
            
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="File not found on disk")
            
            # Stream file
            async def file_sender():
                async with aiofiles.open(file_path, 'rb') as f:
                    while chunk := await f.read(8192):
                        yield chunk
            
            filename = title if title.endswith(Path(file_path).suffix) else f"{title}{Path(file_path).suffix}"
            
            return StreamingResponse(
                file_sender(),
                media_type=mime_type or "application/octet-stream",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to download document")


@router.post("/documents/{document_id}/process", response_model=Dict[str, Any])
async def process_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Start processing a document"""
    try:
        async with get_d1_session() as session:
            # Check if document exists and belongs to user
            result = await session.execute(
                "SELECT id FROM documents WHERE id = :doc_id AND owner_id = :user_id",
                {"doc_id": document_id, "user_id": current_user.id}
            )
            
            if not result.fetchone():
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Schedule background processing
            background_tasks.add_task(process_document_background, document_id)
            
            logger.info(f"Started processing document {document_id}")
            
            return {
                "document_id": document_id,
                "status": "processing_started",
                "message": "Document processing started"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start document processing: {e}")
        raise HTTPException(status_code=500, detail="Failed to start processing")


@router.get("/documents/{document_id}/processing-status", response_model=Dict[str, Any])
async def get_processing_status(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get document processing status"""
    try:
        processor = await get_document_processor()
        status = await processor.get_processing_status(document_id)
        
        if status.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="Document not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get processing status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get processing status")


@router.get("/documents/{document_id}/chunks", response_model=List[Dict[str, Any]])
async def get_document_chunks(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all chunks for a document"""
    try:
        async with get_d1_session() as session:
            # Check if document belongs to user
            result = await session.execute(
                "SELECT id FROM documents WHERE id = :doc_id AND owner_id = :user_id",
                {"doc_id": document_id, "user_id": current_user.id}
            )
            
            if not result.fetchone():
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Get chunks
            result = await session.execute(
                """
                SELECT id, chunk_text, chunk_index, embedding_id, metadata, created_at
                FROM knowledge_base
                WHERE document_id = :doc_id
                ORDER BY chunk_index
                """,
                {"doc_id": document_id}
            )
            
            chunks = []
            for row in result:
                chunks.append({
                    "id": row[0],
                    "document_id": document_id,
                    "chunk_text": row[1],
                    "chunk_index": row[2],
                    "embedding_id": row[3],
                    "metadata": json.loads(row[4]) if row[4] else {},
                    "created_at": row[5]
                })
            
            return chunks
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document chunks: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chunks")


@router.post("/knowledge/search", response_model=List[Dict[str, Any]])
async def search_knowledge_base(
    query: str,
    limit: int = 10,
    filters: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Search the knowledge base"""
    try:
        # Parse filters
        search_filters = json.loads(filters) if filters else {}
        
        # Add user filter to ensure only user's documents are searched
        search_filters["user_id"] = current_user.id
        
        processor = await get_document_processor()
        results = await processor.search_documents(query, limit=limit, filters=search_filters)
        
        return results
        
    except Exception as e:
        logger.error(f"Knowledge search failed: {e}")
        raise HTTPException(status_code=500, detail="Search failed")


async def process_document_background(document_id: str):
    """Background task to process a document"""
    try:
        processor = await get_document_processor()
        result = await processor.process_document(document_id)
        
        if result["success"]:
            logger.info(f"Background processing completed for document {document_id}")
        else:
            logger.error(f"Background processing failed for document {document_id}: {result.get('error')}")
            
    except Exception as e:
        logger.error(f"Background processing error for document {document_id}: {e}")
