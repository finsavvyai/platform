"""
Base ecosystem adapter architecture.

Provides abstract base classes and interfaces for implementing
package ecosystem adapters using the Strategy pattern.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field
from udp.domain.models import EcosystemType, Package


class DependencyInfo(BaseModel):
    """Information about a single dependency."""

    name: str = Field(..., description="Package name")
    version_constraint: str = Field(..., description="Version constraint (e.g., ^1.0.0, >=2.0.0)")
    ecosystem: EcosystemType = Field(..., description="Package ecosystem")
    namespace: Optional[str] = Field(default=None, description="Package namespace/scope")
    is_dev_dependency: bool = Field(default=False, description="Development dependency flag")
    is_optional: bool = Field(default=False, description="Optional dependency flag")
    source: Optional[str] = Field(default=None, description="Source registry or repository")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ParsedManifest(BaseModel):
    """Parsed manifest file information."""

    ecosystem: EcosystemType = Field(..., description="Package ecosystem")
    project_name: str = Field(..., description="Project name")
    project_version: str = Field(..., description="Project version")
    dependencies: list[DependencyInfo] = Field(default_factory=list, description="Direct dependencies")
    dev_dependencies: list[DependencyInfo] = Field(default_factory=list, description="Development dependencies")
    lock_file_data: Optional[dict[str, Any]] = Field(default=None, description="Lock file data if available")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional manifest metadata")


class ResolutionResult(BaseModel):
    """Dependency resolution result."""

    resolved_dependencies: list[Package] = Field(..., description="Resolved package instances")
    conflicts: list[dict[str, Any]] = Field(default_factory=list, description="Version conflicts")
    warnings: list[str] = Field(default_factory=list, description="Resolution warnings")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Resolution metadata")


class EcosystemAdapter(ABC):
    """
    Abstract base class for package ecosystem adapters.

    Each ecosystem (npm, pip, maven, etc.) implements this interface
    to provide ecosystem-specific parsing and resolution capabilities.
    """

    def __init__(self, organization_id: UUID):
        """
        Initialize ecosystem adapter.

        Args:
            organization_id: Organization ID for multi-tenant support
        """
        self.organization_id = organization_id
        self._cache: dict[str, Any] = {}

    @property
    @abstractmethod
    def ecosystem_type(self) -> EcosystemType:
        """Get the ecosystem type this adapter handles."""
        pass

    @property
    @abstractmethod
    def supported_file_extensions(self) -> list[str]:
        """Get list of supported file extensions."""
        pass

    @property
    @abstractmethod
    def registry_url(self) -> str:
        """Get the primary registry URL for this ecosystem."""
        pass

    @abstractmethod
    async def parse_manifest(self, manifest_content: str, file_path: str) -> ParsedManifest:
        """
        Parse a manifest file and extract dependency information.

        Args:
            manifest_content: Raw manifest file content
            file_path: Path to the manifest file

        Returns:
            Parsed manifest information

        Raises:
            ParseError: If manifest cannot be parsed
        """
        pass

    @abstractmethod
    async def parse_lock_file(self, lock_content: str, file_path: str) -> dict[str, Any]:
        """
        Parse a lock file and extract resolved dependency information.

        Args:
            lock_content: Raw lock file content
            file_path: Path to the lock file

        Returns:
            Parsed lock file data

        Raises:
            ParseError: If lock file cannot be parsed
        """
        pass

    @abstractmethod
    async def resolve_dependencies(
        self,
        parsed_manifest: ParsedManifest,
        organization_id: UUID
    ) -> ResolutionResult:
        """
        Resolve dependencies for a parsed manifest.

        Args:
            parsed_manifest: Parsed manifest information
            organization_id: Organization ID for policy enforcement

        Returns:
            Resolution result with resolved packages and conflicts
        """
        pass

    @abstractmethod
    async def fetch_package_metadata(self, package_name: str, version: str) -> Optional[Package]:
        """
        Fetch package metadata from the ecosystem registry.

        Args:
            package_name: Package name
            version: Package version

        Returns:
            Package metadata or None if not found
        """
        pass

    @abstractmethod
    async def generate_lock_file(
        self,
        resolved_dependencies: list[Package],
        output_format: str = "json"
    ) -> str:
        """
        Generate a lock file from resolved dependencies.

        Args:
            resolved_dependencies: List of resolved packages
            output_format: Output format (json, yaml, etc.)

        Returns:
            Generated lock file content
        """
        pass

    async def validate_version_constraint(self, constraint: str) -> bool:
        """
        Validate a version constraint string.

        Args:
            constraint: Version constraint to validate

        Returns:
            True if constraint is valid
        """
        # Default implementation - can be overridden by specific adapters
        return bool(constraint and constraint.strip())

    async def normalize_package_name(self, name: str) -> str:
        """
        Normalize package name according to ecosystem conventions.

        Args:
            name: Package name to normalize

        Returns:
            Normalized package name
        """
        # Default implementation - can be overridden by specific adapters
        return name.strip().lower()

    def _cache_key(self, key: str) -> str:
        """Generate cache key with organization prefix."""
        return f"{self.organization_id}:{self.ecosystem_type.value}:{key}"

    async def _get_cached(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        return self._cache.get(self._cache_key(key))

    async def _set_cached(self, key: str, value: Any, ttl: int = 3600) -> None:
        """Set value in cache with TTL."""
        # Simple in-memory cache - in production, use Redis
        self._cache[self._cache_key(key)] = value

    async def _clear_cache(self, pattern: Optional[str] = None) -> None:
        """Clear cache entries."""
        if pattern:
            keys_to_remove = [
                k for k in self._cache.keys()
                if pattern in k
            ]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            self._cache.clear()


class ParseError(Exception):
    """Exception raised when parsing fails."""

    def __init__(self, message: str, file_path: str, line_number: Optional[int] = None):
        self.message = message
        self.file_path = file_path
        self.line_number = line_number
        super().__init__(f"Parse error in {file_path}:{line_number or 'unknown'}: {message}")


class ResolutionError(Exception):
    """Exception raised when dependency resolution fails."""

    def __init__(self, message: str, conflicts: Optional[list[dict[str, Any]]] = None):
        self.message = message
        self.conflicts = conflicts or []
        super().__init__(message)


class RegistryError(Exception):
    """Exception raised when registry operations fail."""

    def __init__(self, message: str, registry_url: str, status_code: Optional[int] = None):
        self.message = message
        self.registry_url = registry_url
        self.status_code = status_code
        super().__init__(f"Registry error ({registry_url}): {message}")

