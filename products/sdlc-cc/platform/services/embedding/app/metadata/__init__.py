"""
Metadata management system package.

This package provides comprehensive metadata management for embeddings
with tracking, versioning, and audit capabilities.
"""

from .metadata_manager import MetadataManager
from .metadata_store import MetadataStore
from .audit_logger import AuditLogger
from .version_manager import VersionManager

__all__ = [
    "MetadataManager",
    "MetadataStore",
    "AuditLogger",
    "VersionManager",
]
