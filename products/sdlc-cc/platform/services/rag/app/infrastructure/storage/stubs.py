"""
Storage stubs for RAG service.

This module provides stub implementations for storage operations.
"""

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict

logger = logging.getLogger(__name__)


class StorageBackend:
    """Base storage backend interface."""

    async def upload(
        self, key: str, data: bytes, metadata: Dict[str, Any] = None
    ) -> str:
        """Upload data to storage."""
        raise NotImplementedError

    async def download(self, key: str) -> bytes:
        """Download data from storage."""
        raise NotImplementedError

    async def delete(self, key: str) -> bool:
        """Delete data from storage."""
        raise NotImplementedError

    async def exists(self, key: str) -> bool:
        """Check if key exists in storage."""
        raise NotImplementedError

    async def get_metadata(self, key: str) -> Dict[str, Any]:
        """Get metadata for a key."""
        raise NotImplementedError


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend for development."""

    def __init__(self, base_path: str = "/tmp/rag-storage"):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)
        self._metadata: Dict[str, Dict[str, Any]] = {}

    def _get_path(self, key: str) -> str:
        """Get full filesystem path for a key."""
        return os.path.join(self.base_path, key.lstrip("/"))

    async def upload(
        self, key: str, data: bytes, metadata: Dict[str, Any] = None
    ) -> str:
        """Upload data to local filesystem."""
        path = self._get_path(key)
        os.makedirs(os.path.dirname(path), exist_ok=True)

        with open(path, "wb") as f:
            f.write(data)

        if metadata:
            self._metadata[key] = {
                **metadata,
                "uploaded_at": datetime.utcnow().isoformat(),
                "size": len(data),
            }

        logger.info(f"Uploaded {key} to local storage ({len(data)} bytes)")
        return key

    async def download(self, key: str) -> bytes:
        """Download data from local filesystem."""
        path = self._get_path(key)

        if not os.path.exists(path):
            raise FileNotFoundError(f"Key {key} not found in storage")

        with open(path, "rb") as f:
            data = f.read()

        logger.info(f"Downloaded {key} from local storage ({len(data)} bytes)")
        return data

    async def delete(self, key: str) -> bool:
        """Delete data from local filesystem."""
        path = self._get_path(key)

        if os.path.exists(path):
            os.remove(path)
            if key in self._metadata:
                del self._metadata[key]
            logger.info(f"Deleted {key} from local storage")
            return True

        return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in local storage."""
        path = self._get_path(key)
        return os.path.exists(path)

    async def get_metadata(self, key: str) -> Dict[str, Any]:
        """Get metadata for a key."""
        return self._metadata.get(key, {})


class S3StorageBackend(StorageBackend):
    """S3-compatible storage backend stub."""

    def __init__(
        self,
        endpoint_url: str = None,
        access_key_id: str = None,
        secret_access_key: str = None,
        bucket_name: str = "rag-documents",
    ):
        self.endpoint_url = endpoint_url
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.bucket_name = bucket_name
        self._storage: Dict[str, bytes] = {}
        self._metadata: Dict[str, Dict[str, Any]] = {}

    async def upload(
        self, key: str, data: bytes, metadata: Dict[str, Any] = None
    ) -> str:
        """Upload data to S3 storage (stub implementation)."""
        self._storage[key] = data

        if metadata:
            self._metadata[key] = {
                **metadata,
                "uploaded_at": datetime.utcnow().isoformat(),
                "size": len(data),
            }

        logger.info(f"Uploaded {key} to S3 storage ({len(data)} bytes)")
        return f"s3://{self.bucket_name}/{key}"

    async def download(self, key: str) -> bytes:
        """Download data from S3 storage."""
        if key not in self._storage:
            raise FileNotFoundError(f"Key {key} not found in S3 storage")

        data = self._storage[key]
        logger.info(f"Downloaded {key} from S3 storage ({len(data)} bytes)")
        return data

    async def delete(self, key: str) -> bool:
        """Delete data from S3 storage."""
        if key in self._storage:
            del self._storage[key]
            if key in self._metadata:
                del self._metadata[key]
            logger.info(f"Deleted {key} from S3 storage")
            return True

        return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in S3 storage."""
        return key in self._storage

    async def get_metadata(self, key: str) -> Dict[str, Any]:
        """Get metadata for a key."""
        return self._metadata.get(key, {})


class StorageService:
    """Storage service with multiple backend support."""

    def __init__(self, backend: StorageBackend = None):
        self.backend = backend or LocalStorageBackend()
        self._default_metadata = {}

    async def upload_document(
        self,
        filename: str,
        data: bytes,
        tenant_id: str = None,
        document_id: str = None,
        metadata: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Upload a document with automatic key generation."""
        doc_id = document_id or str(uuid.uuid4())

        # Generate storage key
        key_parts = ["documents"]
        if tenant_id:
            key_parts.append(tenant_id)
        key_parts.append(doc_id)
        key_parts.append(filename)

        key = "/".join(key_parts)

        # Prepare metadata
        doc_metadata = {
            "filename": filename,
            "tenant_id": tenant_id,
            "document_id": doc_id,
            "content_type": self._guess_content_type(filename),
            **(metadata or {}),
        }

        # Upload
        storage_key = await self.backend.upload(key, data, doc_metadata)

        return {
            "storage_key": storage_key,
            "document_id": doc_id,
            "filename": filename,
            "size": len(data),
            "metadata": doc_metadata,
        }

    async def download_document(self, storage_key: str) -> bytes:
        """Download a document by storage key."""
        return await self.backend.download(storage_key)

    async def delete_document(self, storage_key: str) -> bool:
        """Delete a document by storage key."""
        return await self.backend.delete(storage_key)

    async def document_exists(self, storage_key: str) -> bool:
        """Check if a document exists."""
        return await self.backend.exists(storage_key)

    async def get_document_metadata(self, storage_key: str) -> Dict[str, Any]:
        """Get document metadata."""
        return await self.backend.get_metadata(storage_key)

    def _guess_content_type(self, filename: str) -> str:
        """Guess content type from filename."""
        ext = os.path.splitext(filename)[1].lower()

        content_types = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc": "application/msword",
            ".txt": "text/plain",
            ".html": "text/html",
            ".md": "text/markdown",
            ".json": "application/json",
            ".csv": "text/csv",
        }

        return content_types.get(ext, "application/octet-stream")


def get_storage_service() -> StorageService:
    """Get the storage service instance."""
    return StorageService()


def get_s3_storage_service(
    endpoint_url: str = None,
    access_key_id: str = None,
    secret_access_key: str = None,
    bucket_name: str = "rag-documents",
) -> StorageService:
    """Get an S3-based storage service instance."""
    backend = S3StorageBackend(
        endpoint_url=endpoint_url,
        access_key_id=access_key_id,
        secret_access_key=secret_access_key,
        bucket_name=bucket_name,
    )
    return StorageService(backend)
