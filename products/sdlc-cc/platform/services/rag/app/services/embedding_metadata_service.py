"""
Embedding metadata tracking and version management service.

This module provides comprehensive metadata management capabilities including:
- Embedding version tracking and management
- Metadata schema validation and storage
- Audit logging and change tracking
- Embedding lineage and provenance tracking
- Model version management
- Metadata search and indexing
- Version rollback capabilities
- Compliance and governance features
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4


from ..core.config import get_settings
from ..models.document import DocumentChunk

logger = logging.getLogger(__name__)


class MetadataVersion(str, Enum):
    """Metadata schema versions."""

    V1_0 = "1.0"
    V1_1 = "1.1"
    V2_0 = "2.0"
    CURRENT = V2_0


class ChangeType(str, Enum):
    """Types of changes to track."""

    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    VERSIONED = "versioned"
    MIGRATED = "migrated"
    ROLLED_BACK = "rolled_back"
    VALIDATED = "validated"
    APPROVED = "approved"
    REJECTED = "rejected"


class ComplianceLevel(str, Enum):
    """Compliance levels for embeddings."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    GDPR_PROTECTED = "gdpr_protected"
    HIPAA_PROTECTED = "hipaa_protected"


@dataclass
class EmbeddingMetadata:
    """Comprehensive metadata for an embedding."""

    # Core identification
    embedding_id: str
    tenant_id: UUID
    document_id: Optional[UUID]
    chunk_id: UUID
    version: int = 1

    # Generation information
    provider: str
    model: str
    model_version: Optional[str] = None
    generation_timestamp: datetime = field(default_factory=datetime.utcnow)
    generation_duration_ms: int = 0

    # Content information
    source_text_hash: str
    source_text_length: int
    language: str = "en"
    content_type: str = "text"
    chunk_index: int = 0

    # Technical specifications
    embedding_dimensions: int
    data_type: str = "float32"
    compression: Optional[str] = None
    checksum: str

    # Quality metrics
    quality_score: Optional[float] = None
    validation_status: str = "pending"
    quality_metrics: Dict[str, Any] = field(default_factory=dict)

    # Usage and performance
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    cache_hit_count: int = 0
    average_response_time_ms: float = 0.0

    # Cost information
    generation_cost_usd: float = 0.0
    total_cost_usd: float = 0.0

    # Governance and compliance
    compliance_level: ComplianceLevel = ComplianceLevel.INTERNAL
    data_classification: str = "internal"
    retention_policy: Dict[str, Any] = field(default_factory=dict)
    access_controls: List[str] = field(default_factory=list)

    # Processing information
    processing_pipeline: List[str] = field(default_factory=list)
    preprocessing_steps: List[str] = field(default_factory=list)
    postprocessing_steps: List[str] = field(default_factory=list)

    # Custom metadata
    tags: List[str] = field(default_factory=list)
    custom_attributes: Dict[str, Any] = field(default_factory=dict)

    # Schema version
    metadata_schema_version: MetadataVersion = MetadataVersion.CURRENT

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        data = asdict(self)

        # Convert UUIDs to strings
        if self.tenant_id:
            data["tenant_id"] = str(self.tenant_id)
        if self.document_id:
            data["document_id"] = str(self.document_id)
        if self.chunk_id:
            data["chunk_id"] = str(self.chunk_id)

        # Convert datetime to ISO string
        data["generation_timestamp"] = self.generation_timestamp.isoformat()
        if self.last_accessed:
            data["last_accessed"] = self.last_accessed.isoformat()

        # Convert enums to strings
        data["compliance_level"] = self.compliance_level.value
        data["metadata_schema_version"] = self.metadata_schema_version.value

        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmbeddingMetadata":
        """Create from dictionary."""
        # Convert UUIDs from strings
        if "tenant_id" in data and isinstance(data["tenant_id"], str):
            data["tenant_id"] = UUID(data["tenant_id"])
        if (
            "document_id" in data
            and data["document_id"]
            and isinstance(data["document_id"], str)
        ):
            data["document_id"] = UUID(data["document_id"])
        if "chunk_id" in data and isinstance(data["chunk_id"], str):
            data["chunk_id"] = UUID(data["chunk_id"])

        # Convert datetime from ISO string
        if "generation_timestamp" in data and isinstance(
            data["generation_timestamp"], str
        ):
            data["generation_timestamp"] = datetime.fromisoformat(
                data["generation_timestamp"]
            )
        if (
            "last_accessed" in data
            and data["last_accessed"]
            and isinstance(data["last_accessed"], str)
        ):
            data["last_accessed"] = datetime.fromisoformat(data["last_accessed"])

        # Convert enums from strings
        if "compliance_level" in data and isinstance(data["compliance_level"], str):
            data["compliance_level"] = ComplianceLevel(data["compliance_level"])
        if "metadata_schema_version" in data and isinstance(
            data["metadata_schema_version"], str
        ):
            data["metadata_schema_version"] = MetadataVersion(
                data["metadata_schema_version"]
            )

        return cls(**data)

    def calculate_content_hash(self) -> str:
        """Calculate hash of the content for integrity verification."""
        content_str = (
            f"{self.source_text_hash}:{self.provider}:{self.model}:{self.version}"
        )
        return hashlib.sha256(content_str.encode()).hexdigest()

    def update_access_stats(
        self, response_time_ms: float, cache_hit: bool = False
    ) -> None:
        """Update access statistics."""
        self.access_count += 1
        self.last_accessed = datetime.utcnow()

        if cache_hit:
            self.cache_hit_count += 1

        # Update average response time
        total_requests = self.access_count
        self.average_response_time_ms = (
            self.average_response_time_ms * (total_requests - 1) + response_time_ms
        ) / total_requests


@dataclass
class EmbeddingVersion:
    """Version information for an embedding."""

    embedding_id: str
    version: int
    created_at: datetime
    created_by: UUID
    change_type: ChangeType
    change_description: str
    previous_version: Optional[int] = None
    metadata_snapshot: Dict[str, Any] = field(default_factory=dict)
    rollback_data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        data["created_by"] = str(self.created_by)
        data["change_type"] = self.change_type.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmbeddingVersion":
        """Create from dictionary."""
        if "created_at" in data:
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "created_by" in data:
            data["created_by"] = UUID(data["created_by"])
        if "change_type" in data:
            data["change_type"] = ChangeType(data["change_type"])
        return cls(**data)


@dataclass
class EmbeddingLineage:
    """Lineage information for embedding provenance."""

    embedding_id: str
    lineage_id: UUID = field(default_factory=uuid4)

    # Source information
    source_documents: List[UUID] = field(default_factory=list)
    source_chunks: List[UUID] = field(default_factory=list)

    # Processing lineage
    processing_steps: List[Dict[str, Any]] = field(default_factory=list)
    transformations_applied: List[str] = field(default_factory=list)

    # Dependencies
    parent_embeddings: List[str] = field(default_factory=list)
    child_embeddings: List[str] = field(default_factory=list)

    # Model lineage
    model_versions_used: Dict[str, str] = field(default_factory=dict)
    provider_history: List[str] = field(default_factory=list)

    # Quality lineage
    quality_evolution: List[Dict[str, Any]] = field(default_factory=list)
    validation_history: List[Dict[str, Any]] = field(default_factory=list)

    created_at: datetime = field(default_factory=datetime.utcnow)
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AuditLogEntry:
    """Audit log entry for compliance and governance."""

    id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # Entity information
    entity_type: str = "embedding"  # embedding, version, metadata, etc.
    entity_id: str = ""

    # Action information
    action: ChangeType = ChangeType.CREATED
    user_id: Optional[UUID] = None
    tenant_id: UUID = field(default_factory=lambda: UUID(int=0))

    # Change details
    old_values: Dict[str, Any] = field(default_factory=dict)
    new_values: Dict[str, Any] = field(default_factory=dict)
    changed_fields: List[str] = field(default_factory=list)

    # Context
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None

    # Compliance
    compliance_level: ComplianceLevel = ComplianceLevel.INTERNAL
    retention_days: int = 2555  # 7 years default

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        data["id"] = str(self.id)
        if self.user_id:
            data["user_id"] = str(self.user_id)
        data["tenant_id"] = str(self.tenant_id)
        data["action"] = self.action.value
        data["compliance_level"] = self.compliance_level.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditLogEntry":
        """Create from dictionary."""
        if "timestamp" in data:
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        if "id" in data:
            data["id"] = UUID(data["id"])
        if "user_id" in data and data["user_id"]:
            data["user_id"] = UUID(data["user_id"])
        if "tenant_id" in data:
            data["tenant_id"] = UUID(data["tenant_id"])
        if "action" in data:
            data["action"] = ChangeType(data["action"])
        if "compliance_level" in data:
            data["compliance_level"] = ComplianceLevel(data["compliance_level"])
        return cls(**data)


class EmbeddingMetadataService:
    """
    Comprehensive embedding metadata tracking and version management service.

    Features:
    - Complete metadata lifecycle management
    - Version control with rollback capabilities
    - Audit logging for compliance
    - Lineage tracking and provenance
    - Metadata search and indexing
    - Governance and compliance enforcement
    - Performance optimization for large datasets
    - Integration with document processing pipeline
    """

    def __init__(self, config: Dict[str, Any] = None):
        """Initialize metadata service."""
        self.settings = get_settings()
        self.config = config or {}

        # Storage configuration
        self.storage_type = self.config.get(
            "storage_type", "file"
        )  # file, database, etc.
        self.storage_path = self.config.get("storage_path", "./metadata")

        # Version management
        self.max_versions_per_embedding = self.config.get(
            "max_versions_per_embedding", 10
        )
        self.auto_version_cleanup = self.config.get("auto_version_cleanup", True)
        self.version_retention_days = self.config.get("version_retention_days", 90)

        # Audit logging
        self.audit_enabled = self.config.get("audit_enabled", True)
        self.audit_retention_days = self.config.get(
            "audit_retention_days", 2555
        )  # 7 years

        # Indexing and search
        self.search_enabled = self.config.get("search_enabled", True)
        self.index_fields = self.config.get(
            "index_fields",
            ["tenant_id", "provider", "model", "compliance_level", "tags"],
        )

        # Performance optimization
        self.cache_enabled = self.config.get("cache_enabled", True)
        self.cache_size = self.config.get("cache_size", 10000)
        self.batch_processing = self.config.get("batch_processing", True)

        # Initialize storage
        self._metadata_store: Dict[str, EmbeddingMetadata] = {}
        self._version_store: Dict[str, List[EmbeddingVersion]] = {}
        self._lineage_store: Dict[str, EmbeddingLineage] = {}
        self._audit_log: List[AuditLogEntry] = []

        # Cache for performance
        self._metadata_cache: Dict[str, EmbeddingMetadata] = {}

        # Initialize storage backend
        self._initialize_storage()

    def _initialize_storage(self) -> None:
        """Initialize storage backend."""
        try:
            if self.storage_type == "file":
                import os

                os.makedirs(self.storage_path, exist_ok=True)
                logger.info(
                    f"Initialized file-based metadata storage at {self.storage_path}"
                )
            else:
                logger.warning(
                    f"Storage type '{self.storage_type}' not implemented, using in-memory storage"
                )
        except Exception as e:
            logger.error(f"Failed to initialize storage: {str(e)}")

    async def create_metadata(
        self,
        chunk: DocumentChunk,
        provider: str,
        model: str,
        embedding_dimensions: int,
        generation_cost_usd: float = 0.0,
        generation_duration_ms: int = 0,
        user_id: Optional[UUID] = None,
        **kwargs,
    ) -> EmbeddingMetadata:
        """
        Create metadata for a new embedding.

        Args:
            chunk: Document chunk
            provider: Embedding provider used
            model: Embedding model used
            embedding_dimensions: Dimensions of the embedding
            generation_cost_usd: Cost to generate the embedding
            generation_duration_ms: Time taken to generate
            user_id: User who requested the embedding
            **kwargs: Additional metadata

        Returns:
            Created embedding metadata
        """
        # Generate embedding ID
        embedding_id = str(uuid4())

        # Calculate source text hash
        source_text_hash = hashlib.sha256(chunk.content.encode()).hexdigest()

        # Calculate embedding checksum
        embedding_data = kwargs.get("embedding_data", [])
        if embedding_data:
            checksum = hashlib.sha256(json.dumps(embedding_data).encode()).hexdigest()
        else:
            checksum = hashlib.sha256(
                f"{embedding_id}:{source_text_hash}".encode()
            ).hexdigest()

        # Create metadata
        metadata = EmbeddingMetadata(
            embedding_id=embedding_id,
            tenant_id=chunk.tenant_id,
            document_id=chunk.document_id,
            chunk_id=chunk.id,
            provider=provider,
            model=model,
            model_version=kwargs.get("model_version"),
            generation_duration_ms=generation_duration_ms,
            source_text_hash=source_text_hash,
            source_text_length=len(chunk.content),
            language=kwargs.get("language", "en"),
            content_type=kwargs.get("content_type", "text"),
            chunk_index=chunk.chunk_index,
            embedding_dimensions=embedding_dimensions,
            checksum=checksum,
            quality_score=kwargs.get("quality_score"),
            quality_metrics=kwargs.get("quality_metrics", {}),
            generation_cost_usd=generation_cost_usd,
            total_cost_usd=generation_cost_usd,
            compliance_level=ComplianceLevel(
                kwargs.get("compliance_level", "internal")
            ),
            data_classification=kwargs.get("data_classification", "internal"),
            processing_pipeline=kwargs.get("processing_pipeline", []),
            preprocessing_steps=kwargs.get("preprocessing_steps", []),
            postprocessing_steps=kwargs.get("postprocessing_steps", []),
            tags=kwargs.get("tags", []),
            custom_attributes=kwargs.get("custom_attributes", {}),
        )

        # Store metadata
        await self._store_metadata(metadata)

        # Create initial version
        await self._create_version(
            metadata.embedding_id,
            1,
            ChangeType.CREATED,
            "Initial embedding creation",
            user_id or chunk.tenant_id,
            metadata.to_dict(),
        )

        # Create lineage
        await self._create_lineage(metadata)

        # Log audit entry
        if self.audit_enabled:
            await self._log_audit(
                entity_type="embedding",
                entity_id=metadata.embedding_id,
                action=ChangeType.CREATED,
                user_id=user_id,
                tenant_id=metadata.tenant_id,
                new_values=metadata.to_dict(),
                compliance_level=metadata.compliance_level,
            )

        logger.info(f"Created metadata for embedding {metadata.embedding_id}")
        return metadata

    async def update_metadata(
        self,
        embedding_id: str,
        updates: Dict[str, Any],
        user_id: Optional[UUID] = None,
        create_version: bool = True,
    ) -> Optional[EmbeddingMetadata]:
        """
        Update embedding metadata.

        Args:
            embedding_id: ID of the embedding to update
            updates: Dictionary of fields to update
            user_id: User making the update
            create_version: Whether to create a new version

        Returns:
            Updated metadata or None if not found
        """
        # Get current metadata
        current_metadata = await self.get_metadata(embedding_id)
        if not current_metadata:
            return None

        # Store old values for audit
        old_values = current_metadata.to_dict()

        # Apply updates
        for field, value in updates.items():
            if hasattr(current_metadata, field):
                setattr(current_metadata, field, value)

        # Update checksum if content changed
        if "source_text_hash" in updates:
            current_metadata.checksum = current_metadata.calculate_content_hash()

        # Update version
        if create_version:
            current_metadata.version += 1

        # Store updated metadata
        await self._store_metadata(current_metadata)

        # Create version entry
        if create_version:
            await self._create_version(
                embedding_id,
                current_metadata.version,
                ChangeType.UPDATED,
                f"Updated fields: {', '.join(updates.keys())}",
                user_id or current_metadata.tenant_id,
                current_metadata.to_dict(),
                old_values,
            )

        # Log audit entry
        if self.audit_enabled:
            await self._log_audit(
                entity_type="embedding",
                entity_id=embedding_id,
                action=ChangeType.UPDATED,
                user_id=user_id,
                tenant_id=current_metadata.tenant_id,
                old_values=old_values,
                new_values=current_metadata.to_dict(),
                changed_fields=list(updates.keys()),
                compliance_level=current_metadata.compliance_level,
            )

        logger.info(f"Updated metadata for embedding {embedding_id}")
        return current_metadata

    async def get_metadata(self, embedding_id: str) -> Optional[EmbeddingMetadata]:
        """Get metadata for an embedding."""
        # Check cache first
        if self.cache_enabled and embedding_id in self._metadata_cache:
            return self._metadata_cache[embedding_id]

        # Get from store
        metadata = self._metadata_store.get(embedding_id)
        if metadata and self.cache_enabled:
            self._metadata_cache[embedding_id] = metadata

        return metadata

    async def get_metadata_by_version(
        self, embedding_id: str, version: int
    ) -> Optional[EmbeddingMetadata]:
        """Get metadata for a specific version of an embedding."""
        versions = await self.get_versions(embedding_id)
        for version_info in versions:
            if version_info.version == version:
                return EmbeddingMetadata.from_dict(version_info.metadata_snapshot)
        return None

    async def get_versions(self, embedding_id: str) -> List[EmbeddingVersion]:
        """Get all versions of an embedding."""
        return self._version_store.get(embedding_id, [])

    async def rollback_to_version(
        self, embedding_id: str, target_version: int, user_id: Optional[UUID] = None
    ) -> Optional[EmbeddingMetadata]:
        """
        Rollback an embedding to a previous version.

        Args:
            embedding_id: ID of the embedding to rollback
            target_version: Version to rollback to
            user_id: User performing the rollback

        Returns:
            Rolled back metadata or None if failed
        """
        # Get target version metadata
        target_metadata = await self.get_metadata_by_version(
            embedding_id, target_version
        )
        if not target_metadata:
            return None

        # Get current metadata for audit
        current_metadata = await self.get_metadata(embedding_id)
        if not current_metadata:
            return None

        # Create rollback version
        new_version = current_metadata.version + 1

        # Update target metadata with new version info
        target_metadata.version = new_version

        # Store rollback
        await self._store_metadata(target_metadata)

        # Create version entry
        await self._create_version(
            embedding_id,
            new_version,
            ChangeType.ROLLED_BACK,
            f"Rolled back to version {target_version}",
            user_id or current_metadata.tenant_id,
            target_metadata.to_dict(),
            current_metadata.to_dict(),
        )

        # Log audit entry
        if self.audit_enabled:
            await self._log_audit(
                entity_type="embedding",
                entity_id=embedding_id,
                action=ChangeType.ROLLED_BACK,
                user_id=user_id,
                tenant_id=target_metadata.tenant_id,
                old_values=current_metadata.to_dict(),
                new_values=target_metadata.to_dict(),
                changed_fields=["version_rollback"],
                compliance_level=target_metadata.compliance_level,
            )

        logger.info(f"Rolled back embedding {embedding_id} to version {target_version}")
        return target_metadata

    async def delete_metadata(
        self,
        embedding_id: str,
        user_id: Optional[UUID] = None,
        soft_delete: bool = True,
    ) -> bool:
        """
        Delete embedding metadata.

        Args:
            embedding_id: ID of the embedding to delete
            user_id: User performing the deletion
            soft_delete: Whether to soft delete (mark as deleted)

        Returns:
            True if deleted successfully
        """
        metadata = await self.get_metadata(embedding_id)
        if not metadata:
            return False

        if soft_delete:
            # Soft delete by adding deletion marker
            await self.update_metadata(
                embedding_id,
                {
                    "custom_attributes": {
                        "deleted": True,
                        "deleted_at": datetime.utcnow().isoformat(),
                    }
                },
                user_id,
                create_version=True,
            )
        else:
            # Hard delete
            self._metadata_store.pop(embedding_id, None)
            self._metadata_cache.pop(embedding_id, None)

        # Log audit entry
        if self.audit_enabled:
            await self._log_audit(
                entity_type="embedding",
                entity_id=embedding_id,
                action=ChangeType.DELETED,
                user_id=user_id,
                tenant_id=metadata.tenant_id,
                old_values=metadata.to_dict(),
                compliance_level=metadata.compliance_level,
            )

        logger.info(
            f"{'Soft' if soft_delete else 'Hard'} deleted embedding {embedding_id}"
        )
        return True

    async def search_metadata(
        self,
        query: Dict[str, Any],
        tenant_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[EmbeddingMetadata]:
        """
        Search embedding metadata.

        Args:
            query: Search query parameters
            tenant_id: Tenant ID to filter by
            limit: Maximum results to return
            offset: Results offset

        Returns:
            List of matching metadata
        """
        results = []

        # Filter by tenant if specified
        if tenant_id:
            metadata_items = [
                metadata
                for metadata in self._metadata_store.values()
                if metadata.tenant_id == tenant_id
            ]
        else:
            metadata_items = list(self._metadata_store.values())

        # Apply query filters
        for metadata in metadata_items:
            if self._matches_query(metadata, query):
                results.append(metadata)

        # Sort by creation time (newest first)
        results.sort(key=lambda x: x.generation_timestamp, reverse=True)

        # Apply pagination
        return results[offset : offset + limit]

    def _matches_query(
        self, metadata: EmbeddingMetadata, query: Dict[str, Any]
    ) -> bool:
        """Check if metadata matches search query."""
        for field, value in query.items():
            if not hasattr(metadata, field):
                continue

            metadata_value = getattr(metadata, field)

            # Handle different comparison types
            if isinstance(value, dict):
                # Range queries
                if "gte" in value and metadata_value < value["gte"]:
                    return False
                if "lte" in value and metadata_value > value["lte"]:
                    return False
                if "in" in value and metadata_value not in value["in"]:
                    return False
                if "contains" in value and value["contains"] not in str(metadata_value):
                    return False
            else:
                # Exact match
                if metadata_value != value:
                    return False

        return True

    async def get_lineage(self, embedding_id: str) -> Optional[EmbeddingLineage]:
        """Get lineage information for an embedding."""
        return self._lineage_store.get(embedding_id)

    async def update_access_stats(
        self, embedding_id: str, response_time_ms: float, cache_hit: bool = False
    ) -> None:
        """Update access statistics for an embedding."""
        metadata = await self.get_metadata(embedding_id)
        if metadata:
            metadata.update_access_stats(response_time_ms, cache_hit)
            await self._store_metadata(metadata)

    async def get_audit_log(
        self,
        tenant_id: Optional[UUID] = None,
        entity_id: Optional[str] = None,
        action: Optional[ChangeType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 1000,
    ) -> List[AuditLogEntry]:
        """Get audit log entries with filtering."""
        filtered_log = self._audit_log

        # Apply filters
        if tenant_id:
            filtered_log = [
                entry for entry in filtered_log if entry.tenant_id == tenant_id
            ]

        if entity_id:
            filtered_log = [
                entry for entry in filtered_log if entry.entity_id == entity_id
            ]

        if action:
            filtered_log = [entry for entry in filtered_log if entry.action == action]

        if start_date:
            filtered_log = [
                entry for entry in filtered_log if entry.timestamp >= start_date
            ]

        if end_date:
            filtered_log = [
                entry for entry in filtered_log if entry.timestamp <= end_date
            ]

        # Sort by timestamp (newest first)
        filtered_log.sort(key=lambda x: x.timestamp, reverse=True)

        return filtered_log[:limit]

    async def _store_metadata(self, metadata: EmbeddingMetadata) -> None:
        """Store metadata in the appropriate backend."""
        self._metadata_store[metadata.embedding_id] = metadata

        # Update cache
        if self.cache_enabled:
            self._metadata_cache[metadata.embedding_id] = metadata

            # Maintain cache size
            if len(self._metadata_cache) > self.cache_size:
                # Remove oldest entries (simple LRU)
                oldest_keys = list(self._metadata_cache.keys())[: -self.cache_size // 2]
                for key in oldest_keys:
                    del self._metadata_cache[key]

    async def _create_version(
        self,
        embedding_id: str,
        version: int,
        change_type: ChangeType,
        description: str,
        user_id: UUID,
        metadata_snapshot: Dict[str, Any],
        old_values: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Create a version entry for an embedding."""
        version_info = EmbeddingVersion(
            embedding_id=embedding_id,
            version=version,
            created_at=datetime.utcnow(),
            created_by=user_id,
            change_type=change_type,
            change_description=description,
            previous_version=version - 1 if version > 1 else None,
            metadata_snapshot=metadata_snapshot,
            rollback_data=old_values,
        )

        # Store version
        if embedding_id not in self._version_store:
            self._version_store[embedding_id] = []

        self._version_store[embedding_id].append(version_info)

        # Cleanup old versions if needed
        if self.auto_version_cleanup:
            await self._cleanup_old_versions(embedding_id)

    async def _cleanup_old_versions(self, embedding_id: str) -> None:
        """Clean up old versions beyond retention limit."""
        versions = self._version_store.get(embedding_id, [])

        if len(versions) > self.max_versions_per_embedding:
            # Keep only the most recent versions
            versions_to_keep = versions[-self.max_versions_per_embedding :]
            self._version_store[embedding_id] = versions_to_keep

        # Remove versions older than retention period
        cutoff_date = datetime.utcnow() - timedelta(days=self.version_retention_days)
        recent_versions = [
            version for version in versions if version.created_at >= cutoff_date
        ]
        self._version_store[embedding_id] = recent_versions

    async def _create_lineage(self, metadata: EmbeddingMetadata) -> None:
        """Create lineage information for an embedding."""
        lineage = EmbeddingLineage(
            embedding_id=metadata.embedding_id,
            source_documents=[metadata.document_id] if metadata.document_id else [],
            source_chunks=[metadata.chunk_id],
            model_versions_used={metadata.provider: metadata.model},
            provider_history=[metadata.provider],
        )

        self._lineage_store[metadata.embedding_id] = lineage

    async def _log_audit(
        self,
        entity_type: str,
        entity_id: str,
        action: ChangeType,
        user_id: Optional[UUID],
        tenant_id: UUID,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        changed_fields: Optional[List[str]] = None,
        compliance_level: ComplianceLevel = ComplianceLevel.INTERNAL,
        **kwargs,
    ) -> None:
        """Log an audit entry."""
        audit_entry = AuditLogEntry(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            tenant_id=tenant_id,
            old_values=old_values or {},
            new_values=new_values or {},
            changed_fields=changed_fields or [],
            compliance_level=compliance_level,
            **kwargs,
        )

        self._audit_log.append(audit_entry)

        # Cleanup old audit entries
        if len(self._audit_log) > 10000:  # Arbitrary limit
            cutoff_date = datetime.utcnow() - timedelta(days=self.audit_retention_days)
            self._audit_log = [
                entry for entry in self._audit_log if entry.timestamp >= cutoff_date
            ]

    async def get_statistics(self, tenant_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Get metadata statistics."""
        # Filter by tenant if specified
        if tenant_id:
            metadata_items = [
                metadata
                for metadata in self._metadata_store.values()
                if metadata.tenant_id == tenant_id
            ]
        else:
            metadata_items = list(self._metadata_store.values())

        if not metadata_items:
            return {"message": "No metadata found"}

        # Calculate statistics
        total_embeddings = len(metadata_items)
        total_versions = sum(len(versions) for versions in self._version_store.values())

        # Provider breakdown
        provider_counts = {}
        for metadata in metadata_items:
            provider_counts[metadata.provider] = (
                provider_counts.get(metadata.provider, 0) + 1
            )

        # Model breakdown
        model_counts = {}
        for metadata in metadata_items:
            model_counts[metadata.model] = model_counts.get(metadata.model, 0) + 1

        # Compliance breakdown
        compliance_counts = {}
        for metadata in metadata_items:
            level = metadata.compliance_level.value
            compliance_counts[level] = compliance_counts.get(level, 0) + 1

        # Quality metrics
        quality_scores = [
            m.quality_score for m in metadata_items if m.quality_score is not None
        ]
        avg_quality_score = (
            sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
        )

        # Cost metrics
        total_cost = sum(m.total_cost_usd for m in metadata_items)
        avg_cost_per_embedding = (
            total_cost / total_embeddings if total_embeddings > 0 else 0.0
        )

        # Access metrics
        total_accesses = sum(m.access_count for m in metadata_items)
        avg_cache_hit_rate = (
            sum(m.cache_hit_count for m in metadata_items) / total_accesses
            if total_accesses > 0
            else 0.0
        )

        return {
            "total_embeddings": total_embeddings,
            "total_versions": total_versions,
            "provider_breakdown": provider_counts,
            "model_breakdown": model_counts,
            "compliance_breakdown": compliance_counts,
            "quality_metrics": {
                "avg_quality_score": avg_quality_score,
                "embeddings_with_quality_score": len(quality_scores),
            },
            "cost_metrics": {
                "total_cost_usd": total_cost,
                "avg_cost_per_embedding": avg_cost_per_embedding,
            },
            "access_metrics": {
                "total_accesses": total_accesses,
                "avg_cache_hit_rate": avg_cache_hit_rate,
            },
            "storage_metrics": {
                "audit_log_entries": len(self._audit_log),
                "lineage_records": len(self._lineage_store),
                "cache_size": len(self._metadata_cache) if self.cache_enabled else 0,
            },
        }

    async def export_metadata(
        self,
        tenant_id: Optional[UUID] = None,
        format: str = "json",
        include_versions: bool = False,
        include_lineage: bool = False,
    ) -> Dict[str, Any]:
        """Export metadata for backup or analysis."""
        # Get metadata
        metadata_items = await self.search_metadata({}, tenant_id, limit=10000)

        export_data = {
            "export_timestamp": datetime.utcnow().isoformat(),
            "tenant_id": str(tenant_id) if tenant_id else "all",
            "total_embeddings": len(metadata_items),
            "embeddings": [metadata.to_dict() for metadata in metadata_items],
        }

        if include_versions:
            export_data["versions"] = {}
            for metadata in metadata_items:
                versions = await self.get_versions(metadata.embedding_id)
                export_data["versions"][metadata.embedding_id] = [
                    version.to_dict() for version in versions
                ]

        if include_lineage:
            export_data["lineage"] = {}
            for metadata in metadata_items:
                lineage = await self.get_lineage(metadata.embedding_id)
                if lineage:
                    export_data["lineage"][metadata.embedding_id] = asdict(lineage)

        return export_data

    async def import_metadata(
        self,
        import_data: Dict[str, Any],
        overwrite: bool = False,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Import metadata from backup or external source."""
        imported_count = 0
        skipped_count = 0
        error_count = 0

        try:
            # Import embeddings
            for embedding_data in import_data.get("embeddings", []):
                try:
                    embedding_id = embedding_data["embedding_id"]

                    # Check if embedding already exists
                    existing = await self.get_metadata(embedding_id)
                    if existing and not overwrite:
                        skipped_count += 1
                        continue

                    # Create metadata object
                    metadata = EmbeddingMetadata.from_dict(embedding_data)

                    # Store metadata
                    await self._store_metadata(metadata)

                    # Log import
                    if self.audit_enabled:
                        await self._log_audit(
                            entity_type="embedding",
                            entity_id=embedding_id,
                            action=ChangeType.CREATED,
                            user_id=user_id,
                            tenant_id=metadata.tenant_id,
                            new_values=metadata.to_dict(),
                            compliance_level=metadata.compliance_level,
                        )

                    imported_count += 1

                except Exception as e:
                    logger.error(f"Error importing embedding: {str(e)}")
                    error_count += 1

            # Import versions if provided
            if "versions" in import_data:
                for embedding_id, versions in import_data["versions"].items():
                    for version_data in versions:
                        try:
                            version = EmbeddingVersion.from_dict(version_data)

                            if embedding_id not in self._version_store:
                                self._version_store[embedding_id] = []

                            self._version_store[embedding_id].append(version)

                        except Exception as e:
                            logger.error(f"Error importing version: {str(e)}")

            return {
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "error_count": error_count,
                "total_processed": imported_count + skipped_count + error_count,
            }

        except Exception as e:
            logger.error(f"Error during import: {str(e)}")
            return {
                "error": str(e),
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "error_count": error_count + 1,
            }


# Global instance
_metadata_service: Optional[EmbeddingMetadataService] = None


def get_metadata_service() -> EmbeddingMetadataService:
    """Get global metadata service instance."""
    global _metadata_service

    if _metadata_service is None:
        _metadata_service = EmbeddingMetadataService()

    return _metadata_service


# Convenience functions
async def create_embedding_metadata(
    chunk: DocumentChunk, provider: str, model: str, embedding_dimensions: int, **kwargs
) -> EmbeddingMetadata:
    """Create metadata for a new embedding."""
    service = get_metadata_service()
    return await service.create_metadata(
        chunk, provider, model, embedding_dimensions, **kwargs
    )


async def get_embedding_metadata(embedding_id: str) -> Optional[EmbeddingMetadata]:
    """Get metadata for an embedding."""
    service = get_metadata_service()
    return await service.get_metadata(embedding_id)
