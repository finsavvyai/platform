"""
Document repository implementations for the RAG service.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document, DocumentChunk, DocumentStatus
from app.repositories.base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    """Repository for Document operations."""

    def __init__(self):
        super().__init__(Document)

    async def get_by_tenant(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Document]:
        """Get documents for a specific tenant with optional filters."""
        query = select(self.model).where(
            and_(
                self.model.tenant_id == tenant_id,
                self.model.is_deleted == False,
            )
        )

        # Apply filters
        if filters:
            if "content_type" in filters:
                query = query.where(self.model.content_type == filters["content_type"])

            if "extraction_status" in filters:
                query = query.where(
                    self.model.extraction_status == filters["extraction_status"]
                )

            if "processing_status" in filters:
                query = query.where(
                    self.model.processing_status == filters["processing_status"]
                )

            if "dlp_status" in filters:
                query = query.where(self.model.dlp_status == filters["dlp_status"])

            if "access_level" in filters:
                query = query.where(self.model.access_level == filters["access_level"])

            if "classification" in filters:
                query = query.where(
                    self.model.classification == filters["classification"]
                )

            if "language" in filters:
                query = query.where(self.model.language == filters["language"])

            if "tags" in filters and filters["tags"]:
                # Filter for documents that contain all specified tags
                for tag in filters["tags"]:
                    query = query.where(self.model.tags.contains([tag]))

            if "created_by" in filters:
                query = query.where(self.model.created_by == filters["created_by"])

            if "search" in filters and filters["search"]:
                search_term = f"%{filters['search']}%"
                query = query.where(
                    or_(
                        self.model.original_filename.ilike(search_term),
                        self.model.filename.ilike(search_term),
                    )
                )

            if "created_after" in filters:
                query = query.where(self.model.created_at >= filters["created_after"])

            if "created_before" in filters:
                query = query.where(self.model.created_at <= filters["created_before"])

        # Add ordering and pagination
        query = query.order_by(desc(self.model.created_at))
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_by_checksum(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        checksum: str,
    ) -> Optional[Document]:
        """Get a document by checksum within a tenant."""
        query = select(self.model).where(
            and_(
                self.model.tenant_id == tenant_id,
                self.model.checksum == checksum,
                self.model.is_deleted == False,
            )
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_content_hash(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        content_hash: str,
    ) -> Optional[Document]:
        """Get a document by content hash within a tenant."""
        query = select(self.model).where(
            and_(
                self.model.tenant_id == tenant_id,
                self.model.content_hash == content_hash,
                self.model.is_deleted == False,
            )
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_status(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        status: DocumentStatus,
        status_type: str = "processing",
        limit: int = 100,
    ) -> List[Document]:
        """Get documents by processing status."""
        status_field = getattr(self.model, f"{status_type}_status")

        query = (
            select(self.model)
            .where(
                and_(
                    self.model.tenant_id == tenant_id,
                    status_field == status,
                    self.model.is_deleted == False,
                )
            )
            .order_by(self.model.created_at)
            .limit(limit)
        )

        result = await db.execute(query)
        return result.scalars().all()

    async def get_pending_processing(
        self,
        db: AsyncSession,
        tenant_id: Optional[uuid.UUID] = None,
        limit: int = 50,
    ) -> List[Document]:
        """Get documents pending processing."""
        query = select(self.model).where(
            and_(
                self.model.processing_status == DocumentStatus.PENDING,
                self.model.is_deleted == False,
            )
        )

        if tenant_id:
            query = query.where(self.model.tenant_id == tenant_id)

        query = query.order_by(self.model.created_at).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_pending_dlp(
        self,
        db: AsyncSession,
        tenant_id: Optional[uuid.UUID] = None,
        limit: int = 50,
    ) -> List[Document]:
        """Get documents pending DLP scanning."""
        query = select(self.model).where(
            and_(
                self.model.dlp_status == DocumentStatus.PENDING,
                self.model.extraction_status == DocumentStatus.COMPLETED,
                self.model.is_deleted == False,
            )
        )

        if tenant_id:
            query = query.where(self.model.tenant_id == tenant_id)

        query = query.order_by(self.model.created_at).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def update_status(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        status: DocumentStatus,
        status_type: str = "processing",
        processing_duration_ms: Optional[int] = None,
    ) -> Optional[Document]:
        """Update document processing status."""
        status_field = getattr(self.model, f"{status_type}_status")

        update_values = {status_field: status}

        if processing_duration_ms is not None and status_type == "processing":
            update_values["processing_duration_ms"] = processing_duration_ms

        # If all processing steps are complete, update overall status
        if status == DocumentStatus.COMPLETED:
            query = select(self.model).where(self.model.id == document_id)
            result = await db.execute(query)
            document = result.scalar_one_or_none()

            if document:
                if (
                    document.extraction_status == DocumentStatus.COMPLETED
                    and document.dlp_status == DocumentStatus.COMPLETED
                ):
                    update_values["processing_status"] = DocumentStatus.COMPLETED
        elif status == DocumentStatus.FAILED:
            update_values["processing_status"] = DocumentStatus.FAILED

        # Execute update
        query = (
            update(self.model)
            .where(self.model.id == document_id)
            .values(**update_values)
            .returning(self.model)
        )

        result = await db.execute(query)
        await db.commit()

        return result.scalar_one_or_none()

    async def get_storage_stats(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """Get storage statistics for a tenant."""
        # Get total document count and size
        query = select(
            func.count(self.model.id).label("document_count"),
            func.sum(self.model.file_size).label("total_size_bytes"),
        ).where(
            and_(
                self.model.tenant_id == tenant_id,
                self.model.is_deleted == False,
            )
        )

        result = await db.execute(query)
        row = result.first()

        return {
            "document_count": row.document_count or 0,
            "total_size_bytes": row.total_size_bytes or 0,
            "total_size_gb": (row.total_size_bytes or 0) / (1024 * 1024 * 1024),
        }

    async def get_processing_stats(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """Get processing statistics for a tenant."""
        # Get counts by status
        query = (
            select(
                self.model.processing_status,
                func.count(self.model.id).label("count"),
            )
            .where(
                and_(
                    self.model.tenant_id == tenant_id,
                    self.model.is_deleted == False,
                )
            )
            .group_by(self.model.processing_status)
        )

        result = await db.execute(query)
        status_counts = {row.processing_status: row.count for row in result}

        total_documents = sum(status_counts.values())
        completed_documents = status_counts.get(DocumentStatus.COMPLETED, 0)
        failed_documents = status_counts.get(DocumentStatus.FAILED, 0)
        processing_documents = status_counts.get(DocumentStatus.PROCESSING, 0)
        pending_documents = status_counts.get(DocumentStatus.PENDING, 0)

        return {
            "total_documents": total_documents,
            "completed_documents": completed_documents,
            "failed_documents": failed_documents,
            "processing_documents": processing_documents,
            "pending_documents": pending_documents,
            "completion_rate": (
                (completed_documents / total_documents * 100)
                if total_documents > 0
                else 0
            ),
            "failure_rate": (
                (failed_documents / total_documents * 100) if total_documents > 0 else 0
            ),
        }

    async def search_documents(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        search_query: str,
        limit: int = 20,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Document]:
        """Search documents by content and metadata."""
        query = select(self.model).where(
            and_(
                self.model.tenant_id == tenant_id,
                self.model.is_deleted == False,
                or_(
                    self.model.original_filename.ilike(f"%{search_query}%"),
                    self.model.filename.ilike(f"%{search_query}%"),
                ),
            )
        )

        # Apply additional filters
        if filters:
            if "access_level" in filters:
                query = query.where(self.model.access_level == filters["access_level"])

            if "classification" in filters:
                query = query.where(
                    self.model.classification == filters["classification"]
                )

            if "tags" in filters and filters["tags"]:
                for tag in filters["tags"]:
                    query = query.where(self.model.tags.contains([tag]))

        query = query.order_by(desc(self.model.created_at)).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_with_chunks(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
    ) -> Optional[Document]:
        """Get a document with its chunks loaded."""
        query = (
            select(self.model)
            .options(selectinload(self.model.chunks))
            .where(
                and_(
                    self.model.id == document_id,
                    self.model.is_deleted == False,
                )
            )
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()


class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    """Repository for DocumentChunk operations."""

    def __init__(self):
        super().__init__(DocumentChunk)

    async def get_by_document(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        skip: int = 0,
        limit: int = 1000,
        order_by: str = "chunk_index",
    ) -> List[DocumentChunk]:
        """Get chunks for a specific document."""
        order_column = getattr(self.model, order_by, self.model.chunk_index)

        query = (
            select(self.model)
            .where(self.model.document_id == document_id)
            .order_by(order_column)
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(query)
        return result.scalars().all()

    async def get_by_tenant(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        skip: int = 0,
        limit: int = 1000,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[DocumentChunk]:
        """Get chunks for a specific tenant with optional filters."""
        query = select(self.model).where(self.model.tenant_id == tenant_id)

        # Apply filters
        if filters:
            if "chunk_type" in filters:
                query = query.where(self.model.chunk_type == filters["chunk_type"])

            if "embedding_status" in filters:
                query = query.where(
                    self.model.embedding_status == filters["embedding_status"]
                )

            if "embedding_model" in filters:
                query = query.where(
                    self.model.embedding_model == filters["embedding_model"]
                )

            if "language" in filters:
                query = query.where(self.model.language == filters["language"])

            if "min_token_count" in filters:
                query = query.where(
                    self.model.token_count >= filters["min_token_count"]
                )

            if "max_token_count" in filters:
                query = query.where(
                    self.model.token_count <= filters["max_token_count"]
                )

            if "search" in filters and filters["search"]:
                search_term = f"%{filters['search']}%"
                query = query.where(self.model.content.ilike(search_term))

        # Add ordering and pagination
        query = query.order_by(self.model.chunk_index).offset(skip).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_pending_embedding(
        self,
        db: AsyncSession,
        tenant_id: Optional[uuid.UUID] = None,
        limit: int = 100,
    ) -> List[DocumentChunk]:
        """Get chunks pending embedding generation."""
        query = select(self.model).where(
            self.model.embedding_status == DocumentStatus.PENDING
        )

        if tenant_id:
            query = query.where(self.model.tenant_id == tenant_id)

        query = query.order_by(self.model.created_at).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def update_embedding(
        self,
        db: AsyncSession,
        chunk_id: uuid.UUID,
        embedding: List[float],
        embedding_model: str,
        embedding_dimensions: int,
        processing_time_ms: Optional[int] = None,
    ) -> Optional[DocumentChunk]:
        """Update chunk with embedding information."""
        update_values = {
            "embedding": embedding,
            "embedding_model": embedding_model,
            "embedding_dimensions": embedding_dimensions,
            "embedding_status": DocumentStatus.COMPLETED,
        }

        if processing_time_ms is not None:
            update_values["processing_time_ms"] = processing_time_ms

        query = (
            update(self.model)
            .where(self.model.id == chunk_id)
            .values(**update_values)
            .returning(self.model)
        )

        result = await db.execute(query)
        await db.commit()

        return result.scalar_one_or_none()

    async def mark_embedding_failed(
        self,
        db: AsyncSession,
        chunk_id: uuid.UUID,
        error_message: Optional[str] = None,
    ) -> Optional[DocumentChunk]:
        """Mark chunk embedding as failed."""
        update_values = {
            "embedding_status": DocumentStatus.FAILED,
        }

        if error_message:
            # Store error message in metadata
            query = select(self.model).where(self.model.id == chunk_id)
            result = await db.execute(query)
            chunk = result.scalar_one_or_none()

            if chunk:
                chunk.metadata["embedding_error"] = error_message
                update_values["metadata"] = chunk.metadata

        query = (
            update(self.model)
            .where(self.model.id == chunk_id)
            .values(**update_values)
            .returning(self.model)
        )

        result = await db.execute(query)
        await db.commit()

        return result.scalar_one_or_none()

    async def get_chunk_count(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
    ) -> int:
        """Get total number of chunks for a document."""
        query = select(func.count(self.model.id)).where(
            self.model.document_id == document_id
        )

        result = await db.execute(query)
        return result.scalar() or 0

    async def get_embedding_stats(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """Get embedding statistics for a tenant."""
        # Get counts by status
        query = (
            select(
                self.model.embedding_status,
                func.count(self.model.id).label("count"),
            )
            .where(self.model.tenant_id == tenant_id)
            .group_by(self.model.embedding_status)
        )

        result = await db.execute(query)
        status_counts = {row.embedding_status: row.count for row in result}

        total_chunks = sum(status_counts.values())
        completed_chunks = status_counts.get(DocumentStatus.COMPLETED, 0)
        failed_chunks = status_counts.get(DocumentStatus.FAILED, 0)
        pending_chunks = status_counts.get(DocumentStatus.PENDING, 0)
        processing_chunks = status_counts.get(DocumentStatus.PROCESSING, 0)

        return {
            "total_chunks": total_chunks,
            "completed_chunks": completed_chunks,
            "failed_chunks": failed_chunks,
            "pending_chunks": pending_chunks,
            "processing_chunks": processing_chunks,
            "completion_rate": (
                (completed_chunks / total_chunks * 100) if total_chunks > 0 else 0
            ),
            "failure_rate": (
                (failed_chunks / total_chunks * 100) if total_chunks > 0 else 0
            ),
        }

    async def search_chunks(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        search_query: str,
        limit: int = 20,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[DocumentChunk]:
        """Search chunks by content."""
        query = select(self.model).where(
            and_(
                self.model.tenant_id == tenant_id,
                self.model.content.ilike(f"%{search_query}%"),
            )
        )

        # Apply additional filters
        if filters:
            if "chunk_type" in filters:
                query = query.where(self.model.chunk_type == filters["chunk_type"])

            if "language" in filters:
                query = query.where(self.model.language == filters["language"])

        query = query.order_by(desc(self.model.created_at)).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def delete_by_document(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
    ) -> int:
        """Delete all chunks for a document."""
        query = select(self.model).where(self.model.document_id == document_id)
        result = await db.execute(query)
        chunks = result.scalars().all()

        for chunk in chunks:
            await db.delete(chunk)

        await db.commit()
        return len(chunks)

    async def get_chunks_for_vector_search(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        limit: int = 100,
    ) -> List[DocumentChunk]:
        """Get chunks that have embeddings and are ready for vector search."""
        query = (
            select(self.model)
            .where(
                and_(
                    self.model.tenant_id == tenant_id,
                    self.model.embedding_status == DocumentStatus.COMPLETED,
                    self.model.embedding.is_not(None),
                )
            )
            .order_by(self.model.created_at)
            .limit(limit)
        )

        result = await db.execute(query)
        return result.scalars().all()
