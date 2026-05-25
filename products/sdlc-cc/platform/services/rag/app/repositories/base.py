"""
Repository pattern implementation for the RAG service.

This module provides generic and specific repository implementations with async support,
proper error handling, and multi-tenant isolation.
"""

import logging
from abc import ABC
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar

from sqlalchemy import select, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from ..database.models import (
    Base,
    Tenant,
    User,
    Document,
    DocumentChunk,
    APIKey,
    AuditLog,
)
from ..schemas import PaginationParams, PaginatedResponse

logger = logging.getLogger(__name__)

# Generic type for repository models
ModelType = TypeVar("ModelType", bound=Base)


class RepositoryException(Exception):
    """Base repository exception."""

    pass


class NotFoundError(RepositoryException):
    """Entity not found error."""

    pass


class DuplicateError(RepositoryException):
    """Duplicate entity error."""

    pass


class ValidationError(RepositoryException):
    """Validation error."""

    pass


class BaseRepository(Generic[ModelType], ABC):
    """Abstract base repository with common CRUD operations."""

    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def create(self, obj_in: Dict[str, Any]) -> ModelType:
        """Create a new entity."""
        try:
            db_obj = self.model(**obj_in)
            self.session.add(db_obj)
            await self.session.flush()
            await self.session.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.session.rollback()
            raise DuplicateError(f"Entity already exists: {e}")
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RepositoryException(f"Failed to create entity: {e}")

    async def get_by_id(self, id: str) -> Optional[ModelType]:
        """Get entity by ID."""
        try:
            stmt = select(self.model).where(self.model.id == id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get entity by ID: {e}")

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        order_desc: bool = False,
    ) -> List[ModelType]:
        """Get multiple entities with filtering and pagination."""
        try:
            stmt = select(self.model)

            # Apply filters
            if filters:
                for key, value in filters.items():
                    if hasattr(self.model, key):
                        stmt = stmt.where(getattr(self.model, key) == value)

            # Apply ordering
            if order_by and hasattr(self.model, order_by):
                order_column = getattr(self.model, order_by)
                if order_desc:
                    stmt = stmt.order_by(order_column.desc())
                else:
                    stmt = stmt.order_by(order_column)

            # Apply pagination
            stmt = stmt.offset(skip).limit(limit)

            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get entities: {e}")

    async def get_paginated(
        self,
        pagination: PaginationParams,
        *,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        order_desc: bool = False,
    ) -> PaginatedResponse[ModelType]:
        """Get paginated results."""
        try:
            # Count total records
            count_stmt = select(func.count(self.model.id))
            if filters:
                for key, value in filters.items():
                    if hasattr(self.model, key):
                        count_stmt = count_stmt.where(getattr(self.model, key) == value)

            total_result = await self.session.execute(count_stmt)
            total = total_result.scalar()

            # Get paginated data
            items = await self.get_multi(
                skip=pagination.offset,
                limit=pagination.limit,
                filters=filters,
                order_by=order_by or "created_at",
                order_desc=order_desc,
            )

            total_pages = (total + pagination.limit - 1) // pagination.limit

            return PaginatedResponse(
                items=items,
                total=total,
                page=pagination.page,
                page_size=pagination.limit,
                total_pages=total_pages,
                has_next=pagination.page < total_pages,
                has_prev=pagination.page > 1,
            )
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get paginated entities: {e}")

    async def update(self, id: str, obj_in: Dict[str, Any]) -> ModelType:
        """Update an entity."""
        try:
            db_obj = await self.get_by_id(id)
            if not db_obj:
                raise NotFoundError(f"Entity with ID {id} not found")

            for field, value in obj_in.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)

            await self.session.flush()
            await self.session.refresh(db_obj)
            return db_obj
        except NotFoundError:
            raise
        except IntegrityError as e:
            await self.session.rollback()
            raise DuplicateError(f"Update would create duplicate: {e}")
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RepositoryException(f"Failed to update entity: {e}")

    async def delete(self, id: str) -> bool:
        """Delete an entity."""
        try:
            db_obj = await self.get_by_id(id)
            if not db_obj:
                return False

            await self.session.delete(db_obj)
            await self.session.flush()
            return True
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RepositoryException(f"Failed to delete entity: {e}")

    async def exists(self, id: str) -> bool:
        """Check if entity exists."""
        try:
            stmt = select(func.count(self.model.id)).where(self.model.id == id)
            result = await self.session.execute(stmt)
            return result.scalar() > 0
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to check entity existence: {e}")

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count entities with optional filters."""
        try:
            stmt = select(func.count(self.model.id))

            if filters:
                for key, value in filters.items():
                    if hasattr(self.model, key):
                        stmt = stmt.where(getattr(self.model, key) == value)

            result = await self.session.execute(stmt)
            return result.scalar()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to count entities: {e}")


class TenantRepository(BaseRepository[Tenant]):
    """Repository for tenant operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(Tenant, session)

    async def get_by_domain(self, domain: str) -> Optional[Tenant]:
        """Get tenant by domain."""
        try:
            stmt = select(Tenant).where(Tenant.domain == domain)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get tenant by domain: {e}")

    async def get_active_tenants(self) -> List[Tenant]:
        """Get all active tenants."""
        try:
            stmt = select(Tenant).where(Tenant.status == "active")
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get active tenants: {e}")

    async def get_tenants_by_subscription(self, tier: str) -> List[Tenant]:
        """Get tenants by subscription tier."""
        try:
            stmt = select(Tenant).where(Tenant.subscription_tier == tier)
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get tenants by subscription: {e}")

    async def update_status(self, id: str, status: str) -> Tenant:
        """Update tenant status."""
        return await self.update(id, {"status": status})

    async def update_config(self, id: str, config: Dict[str, Any]) -> Tenant:
        """Update tenant configuration."""
        return await self.update(id, {"config": config})

    async def update_settings(self, id: str, settings: Dict[str, Any]) -> Tenant:
        """Update tenant settings."""
        return await self.update(id, {"settings": settings})


class UserRepository(BaseRepository[User]):
    """Repository for user operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    async def get_by_email(self, tenant_id: str, email: str) -> Optional[User]:
        """Get user by email within a tenant."""
        try:
            stmt = select(User).where(
                and_(User.tenant_id == tenant_id, User.email == email)
            )
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get user by email: {e}")

    async def get_users_by_tenant(
        self, tenant_id: str, pagination: PaginationParams
    ) -> PaginatedResponse[User]:
        """Get paginated users for a tenant."""
        return await self.get_paginated(
            pagination,
            filters={"tenant_id": tenant_id},
            order_by=pagination.sort_by,
            order_desc=pagination.sort_desc,
        )

    async def get_users_by_role(self, tenant_id: str, role: str) -> List[User]:
        """Get users by role within a tenant."""
        try:
            stmt = select(User).where(
                and_(User.tenant_id == tenant_id, User.role == role)
            )
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get users by role: {e}")

    async def get_active_users(self, tenant_id: str) -> List[User]:
        """Get active users for a tenant."""
        try:
            stmt = select(User).where(
                and_(User.tenant_id == tenant_id, User.is_active)
            )
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get active users: {e}")

    async def update_password(self, id: str, hashed_password: str) -> User:
        """Update user password."""
        return await self.update(id, {"password_hash": hashed_password})

    async def update_last_login(self, id: str) -> User:
        """Update user last login timestamp."""
        return await self.update(id, {"last_login": func.now()})

    async def lock_user(self, id: str, locked_until) -> User:
        """Lock user account."""
        return await self.update(id, {"locked_until": locked_until})

    async def unlock_user(self, id: str) -> User:
        """Unlock user account."""
        return await self.update(id, {"locked_until": None, "failed_login_attempts": 0})

    async def increment_failed_login(self, id: str) -> User:
        """Increment failed login count."""
        try:
            stmt = (
                update(User)
                .where(User.id == id)
                .values(failed_login_attempts=User.failed_login_attempts + 1)
                .returning(User)
            )
            result = await self.session.execute(stmt)
            return result.scalar_one()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to increment failed login: {e}")

    async def verify_email(self, id: str) -> User:
        """Verify user email."""
        return await self.update(id, {"email_verified": True})

    async def enable_mfa(self, id: str, secret: bytes) -> User:
        """Enable multi-factor authentication."""
        return await self.update(id, {"mfa_enabled": True, "mfa_secret": secret})

    async def disable_mfa(self, id: str) -> User:
        """Disable multi-factor authentication."""
        return await self.update(id, {"mfa_enabled": False, "mfa_secret": None})


class DocumentRepository(BaseRepository[Document]):
    """Repository for document operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(Document, session)

    async def get_by_checksum(self, checksum: str) -> Optional[Document]:
        """Get document by checksum."""
        try:
            stmt = select(Document).where(Document.checksum == checksum)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get document by checksum: {e}")

    async def get_by_tenant(
        self, tenant_id: str, pagination: PaginationParams
    ) -> PaginatedResponse[Document]:
        """Get paginated documents for a tenant."""
        return await self.get_paginated(
            pagination,
            filters={"tenant_id": tenant_id},
            order_by=pagination.sort_by,
            order_desc=pagination.sort_desc,
        )

    async def get_by_status(self, tenant_id: str, status: str) -> List[Document]:
        """Get documents by status within a tenant."""
        try:
            stmt = select(Document).where(
                and_(
                    Document.tenant_id == tenant_id,
                    Document.processing_status == status,
                )
            )
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get documents by status: {e}")

    async def get_by_creator(
        self, tenant_id: str, creator_id: str, pagination: PaginationParams
    ) -> PaginatedResponse[Document]:
        """Get documents by creator."""
        return await self.get_paginated(
            pagination,
            filters={"tenant_id": tenant_id, "created_by": creator_id},
            order_by=pagination.sort_by,
            order_desc=pagination.sort_desc,
        )

    async def get_by_classification(
        self, tenant_id: str, classification: str
    ) -> List[Document]:
        """Get documents by classification within a tenant."""
        try:
            stmt = select(Document).where(
                and_(
                    Document.tenant_id == tenant_id,
                    Document.classification == classification,
                )
            )
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get documents by classification: {e}")

    async def get_documents_needing_processing(self, tenant_id: str) -> List[Document]:
        """Get documents that need processing."""
        try:
            stmt = select(Document).where(
                and_(
                    Document.tenant_id == tenant_id,
                    Document.processing_status == "pending",
                )
            )
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(
                f"Failed to get documents needing processing: {e}"
            )

    async def update_processing_status(self, id: str, status: str) -> Document:
        """Update document processing status."""
        return await self.update(id, {"processing_status": status})

    async def update_metadata(self, id: str, metadata: Dict[str, Any]) -> Document:
        """Update document metadata."""
        return await self.update(id, {"metadata": metadata})

    async def add_tag(self, id: str, tag: str) -> Document:
        """Add a tag to document."""
        try:
            db_obj = await self.get_by_id(id)
            if not db_obj:
                raise NotFoundError(f"Document with ID {id} not found")

            if tag not in db_obj.tags:
                db_obj.tags.append(tag)

            await self.session.flush()
            await self.session.refresh(db_obj)
            return db_obj
        except NotFoundError:
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RepositoryException(f"Failed to add tag: {e}")


class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    """Repository for document chunk operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(DocumentChunk, session)

    async def get_by_document(
        self, document_id: str, pagination: PaginationParams
    ) -> PaginatedResponse[DocumentChunk]:
        """Get chunks for a document."""
        return await self.get_paginated(
            pagination,
            filters={"document_id": document_id},
            order_by="chunk_index",
            order_desc=False,
        )

    async def get_by_tenant(
        self, tenant_id: str, pagination: PaginationParams
    ) -> PaginatedResponse[DocumentChunk]:
        """Get chunks for a tenant."""
        return await self.get_paginated(
            pagination,
            filters={"tenant_id": tenant_id},
            order_by=pagination.sort_by,
            order_desc=pagination.sort_desc,
        )

    async def get_chunks_needing_embedding(self, tenant_id: str) -> List[DocumentChunk]:
        """Get chunks that need embedding."""
        try:
            stmt = select(DocumentChunk).where(
                and_(
                    DocumentChunk.tenant_id == tenant_id,
                    DocumentChunk.embedding_status == "pending",
                )
            )
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get chunks needing embedding: {e}")

    async def update_embedding_status(self, id: str, status: str) -> DocumentChunk:
        """Update chunk embedding status."""
        return await self.update(id, {"embedding_status": status})

    async def update_embedding(
        self, id: str, embedding: List[float], processing_time: int
    ) -> DocumentChunk:
        """Update chunk embedding and status."""
        return await self.update(
            id,
            {
                "embedding": embedding,
                "embedding_status": "completed",
                "processing_time_ms": processing_time,
            },
        )

    async def vector_search(
        self, tenant_id: str, query_vector: List[float], limit: int, threshold: float
    ) -> List[DocumentChunk]:
        """Perform vector similarity search."""
        try:
            # This would use pgvector extension
            stmt = (
                select(DocumentChunk)
                .where(
                    and_(
                        DocumentChunk.tenant_id == tenant_id,
                        DocumentChunk.embedding_status == "completed",
                    )
                )
                .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
                .limit(limit)
            )

            result = await self.session.execute(stmt)
            chunks = result.scalars().all()

            # Filter by threshold
            return [
                chunk
                for chunk in chunks
                if self._calculate_similarity(chunk.embedding, query_vector)
                >= threshold
            ]
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to perform vector search: {e}")

    def _calculate_similarity(
        self, vector1: List[float], vector2: List[float]
    ) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(vector1) != len(vector2):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vector1, vector2))
        magnitude1 = sum(a * a for a in vector1) ** 0.5
        magnitude2 = sum(b * b for b in vector2) ** 0.5

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)


class APIKeyRepository(BaseRepository[APIKey]):
    """Repository for API key operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(APIKey, session)

    async def get_by_key_hash(self, key_hash: str) -> Optional[APIKey]:
        """Get API key by hash."""
        try:
            stmt = select(APIKey).where(APIKey.key_hash == key_hash)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get API key by hash: {e}")

    async def get_active_keys(self, tenant_id: str) -> List[APIKey]:
        """Get active API keys for a tenant."""
        try:
            stmt = select(APIKey).where(
                and_(APIKey.tenant_id == tenant_id, APIKey.is_active)
            )
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to get active API keys: {e}")

    async def update_last_used(self, id: str) -> APIKey:
        """Update last used timestamp."""
        try:
            stmt = (
                update(APIKey)
                .where(APIKey.id == id)
                .values(last_used=func.now(), usage_count=APIKey.usage_count + 1)
                .returning(APIKey)
            )
            result = await self.session.execute(stmt)
            return result.scalar_one()
        except SQLAlchemyError as e:
            raise RepositoryException(f"Failed to update last used: {e}")

    async def revoke_key(self, id: str) -> APIKey:
        """Revoke API key."""
        return await self.update(id, {"is_active": False})


class AuditLogRepository(BaseRepository[AuditLog]):
    """Repository for audit log operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(AuditLog, session)

    async def get_by_tenant(
        self, tenant_id: str, pagination: PaginationParams
    ) -> PaginatedResponse[AuditLog]:
        """Get audit logs for a tenant."""
        return await self.get_paginated(
            pagination,
            filters={"tenant_id": tenant_id},
            order_by=pagination.sort_by,
            order_desc=pagination.sort_desc,
        )

    async def get_by_user(
        self, user_id: str, pagination: PaginationParams
    ) -> PaginatedResponse[AuditLog]:
        """Get audit logs for a user."""
        return await self.get_paginated(
            pagination,
            filters={"user_id": user_id},
            order_by=pagination.sort_by,
            order_desc=pagination.sort_desc,
        )

    async def get_by_action(
        self, tenant_id: str, action: str, pagination: PaginationParams
    ) -> PaginatedResponse[AuditLog]:
        """Get audit logs by action."""
        return await self.get_paginated(
            pagination,
            filters={"tenant_id": tenant_id, "action": action},
            order_by=pagination.sort_by,
            order_desc=pagination.sort_desc,
        )


# Repository factory
class RepositoryFactory:
    """Factory for creating repository instances."""

    def __init__(self, session: AsyncSession):
        self.session = session

    def get_tenant_repository(self) -> TenantRepository:
        """Get tenant repository."""
        return TenantRepository(self.session)

    def get_user_repository(self) -> UserRepository:
        """Get user repository."""
        return UserRepository(self.session)

    def get_document_repository(self) -> DocumentRepository:
        """Get document repository."""
        return DocumentRepository(self.session)

    def get_document_chunk_repository(self) -> DocumentChunkRepository:
        """Get document chunk repository."""
        return DocumentChunkRepository(self.session)

    def get_api_key_repository(self) -> APIKeyRepository:
        """Get API key repository."""
        return APIKeyRepository(self.session)

    def get_audit_log_repository(self) -> AuditLogRepository:
        """Get audit log repository."""
        return AuditLogRepository(self.session)
