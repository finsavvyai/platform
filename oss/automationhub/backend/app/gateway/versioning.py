"""
API Versioning System

This module provides comprehensive API versioning support including:
- URL-based versioning (/v1/, /v2/, etc.)
- Header-based versioning (Accept-Version, API-Version)
- Query parameter versioning
- Content negotiation
- Version deprecation and migration
- Backward compatibility support
- Version-aware routing
- Version-specific transformations

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from urllib.parse import urlparse, parse_qs

from fastapi import Request, Response, HTTPException, status
from fastapi.routing import APIRoute

from app.gateway.config import GatewayPolicyConfig

logger = logging.getLogger(__name__)


class VersioningStrategy(str, Enum):
    """API versioning strategies"""
    URL_PATH = "url_path"  # /api/v1/users
    HEADER = "header"  # Accept-Version: v1
    QUERY_PARAM = "query_param"  # ?version=v1
    CONTENT_TYPE = "content_type"  # application/vnd.api+json;version=1
    CUSTOM_HEADER = "custom_header"  # X-API-Version: v1


class VersionStatus(str, Enum):
    """API version status"""
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    SUNSET = "sunset"
    BETA = "beta"
    ALPHA = "alpha"


@dataclass
class APIVersion:
    """API version definition"""
    version: str  # e.g., "v1", "v2"
    status: VersionStatus
    introduced_at: datetime
    deprecated_at: Optional[datetime] = None
    sunset_at: Optional[datetime] = None
    description: str = ""
    migration_guide: Optional[str] = None
    breaking_changes: List[str] = field(default_factory=list)
    supported_formats: List[str] = field(default_factory=lambda: ["json"])
    max_response_size: Optional[int] = None
    rate_limit_multiplier: float = 1.0
    features: Dict[str, bool] = field(default_factory=dict)


@dataclass
class VersionMapping:
    """Version mapping for routing"""
    version: str
    path_prefix: str
    target_service: str
    target_path: str
    methods: List[str]
    transformers: Dict[str, str] = field(default_factory=dict)
    middleware: List[str] = field(default_factory=list)


@dataclass
class VersionPolicy:
    """Version policy configuration"""
    default_version: str = "v1"
    supported_versions: List[str] = field(default_factory=lambda: ["v1"])
    deprecated_versions: List[str] = field(default_factory=list)
    sunset_versions: List[str] = field(default_factory=list)
    versioning_strategy: VersioningStrategy = VersioningStrategy.URL_PATH
    header_name: str = "Accept-Version"
    query_param: str = "version"
    enforce_version: bool = True
    allow_unversioned: bool = False
    grace_period_days: int = 90


class APIVersioning:
    """
    API versioning system with multiple strategies and comprehensive management
    """

    def __init__(self, config: GatewayPolicyConfig):
        self.config = config
        self.versions: Dict[str, APIVersion] = {}
        self.mappings: Dict[str, List[VersionMapping]] = {}
        self.policy = VersionPolicy()
        self._initialize_versions()
        self._initialize_mappings()

    def _initialize_versions(self):
        """Initialize default API versions"""
        now = datetime.utcnow()

        # v1 - Stable version
        self.versions["v1"] = APIVersion(
            version="v1",
            status=VersionStatus.ACTIVE,
            introduced_at=now - timedelta(days=365),
            description="Stable API v1 with core functionality",
            supported_formats=["json", "xml"],
            features={
                "pagination": True,
                "filtering": True,
                "sorting": True,
                "webhooks": True,
                "batch_operations": False
            }
        )

        # v2 - Current version with enhancements
        self.versions["v2"] = APIVersion(
            version="v2",
            status=VersionStatus.ACTIVE,
            introduced_at=now - timedelta(days=90),
            description="Enhanced API v2 with advanced features",
            supported_formats=["json", "xml", "yaml"],
            breaking_changes=[
                "Changed response format for user endpoints",
                "Updated authentication headers",
                "Modified pagination structure"
            ],
            features={
                "pagination": True,
                "filtering": True,
                "sorting": True,
                "webhooks": True,
                "batch_operations": True,
                "real_time": True,
                "advanced_search": True
            }
        )

        # v3 - Beta version
        self.versions["v3"] = APIVersion(
            version="v3",
            status=VersionStatus.BETA,
            introduced_at=now - timedelta(days=30),
            description="Beta API v3 with experimental features",
            breaking_changes=[
                "Complete overhaul of response structure",
                "New authentication system",
                "Redesigned endpoint URLs"
            ],
            features={
                "pagination": True,
                "filtering": True,
                "sorting": True,
                "webhooks": True,
                "batch_operations": True,
                "real_time": True,
                "advanced_search": True,
                "graphql": True,
                "ai_integration": True
            }
        )

    def _initialize_mappings(self):
        """Initialize version-specific mappings"""
        # v1 mappings
        self.mappings["v1"] = [
            VersionMapping(
                version="v1",
                path_prefix="/api/v1",
                target_service="upm_backend",
                target_path="/api/v1",
                methods=["GET", "POST", "PUT", "DELETE"]
            )
        ]

        # v2 mappings
        self.mappings["v2"] = [
            VersionMapping(
                version="v2",
                path_prefix="/api/v2",
                target_service="upm_backend_v2",
                target_path="/api/v2",
                methods=["GET", "POST", "PUT", "DELETE", "PATCH"]
            )
        ]

        # v3 mappings
        self.mappings["v3"] = [
            VersionMapping(
                version="v3",
                path_prefix="/api/v3",
                target_service="upm_backend_v3",
                target_path="/api/v3",
                methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
            )
        ]

    async def process_request(self, request: Request) -> Request:
        """Process request to handle API versioning"""
        try:
            # Extract version from request
            version = await self._extract_version(request)

            # Validate version
            if version and not await self._is_version_supported(version):
                if await self._is_version_deprecated(version):
                    raise HTTPException(
                        status_code=status.HTTP_301_MOVED_PERMANENTLY,
                        detail=f"Version {version} is deprecated. Please upgrade to {self.policy.default_version}",
                        headers={"Location": f"/api/{self.policy.default_version}{request.url.path}"}
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Unsupported API version: {version}. Supported versions: {self.policy.supported_versions}"
                    )

            # Set default version if none provided
            if not version:
                if not self.policy.allow_unversioned:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"API version required. Use {self.policy.default_version} or specify version in request"
                    )
                version = self.policy.default_version

            # Apply version-specific transformations
            request = await self._apply_version_transformations(request, version)

            # Add version information to request state
            request.state.api_version = version
            request.state.version_info = self.versions.get(version)

            # Add version headers
            request.headers.mutablecopy()["X-API-Version"] = version

            return request

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"API versioning failed: {e}")
            # Continue without versioning if it fails
            return request

    async def _extract_version(self, request: Request) -> Optional[str]:
        """Extract API version from request using configured strategy"""
        strategy = self.policy.versioning_strategy

        try:
            if strategy == VersioningStrategy.URL_PATH:
                return self._extract_version_from_path(request)
            elif strategy == VersioningStrategy.HEADER:
                return self._extract_version_from_header(request)
            elif strategy == VersioningStrategy.QUERY_PARAM:
                return self._extract_version_from_query(request)
            elif strategy == VersioningStrategy.CONTENT_TYPE:
                return self._extract_version_from_content_type(request)
            elif strategy == VersioningStrategy.CUSTOM_HEADER:
                return self._extract_version_from_custom_header(request)
            else:
                return None

        except Exception as e:
            logger.error(f"Version extraction failed: {e}")
            return None

    def _extract_version_from_path(self, request: Request) -> Optional[str]:
        """Extract version from URL path"""
        path = request.url.path

        # Match patterns like /api/v1/, /v2/, etc.
        version_match = re.search(r'/api/(v\d+)/', path)
        if version_match:
            return version_match.group(1)

        # Alternative pattern: /v1/
        alt_version_match = re.search(r'^/(v\d+)/', path)
        if alt_version_match:
            return alt_version_match.group(1)

        return None

    def _extract_version_from_header(self, request: Request) -> Optional[str]:
        """Extract version from Accept-Version header"""
        accept_version = request.headers.get(self.policy.header_name)
        if accept_version:
            # Handle various formats: "v1", "application/vnd.api.v1+json", etc.
            if accept_version.startswith('v'):
                return accept_version
            elif 'v' in accept_version:
                version_match = re.search(r'v(\d+)', accept_version)
                if version_match:
                    return f"v{version_match.group(1)}"

        return None

    def _extract_version_from_query(self, request: Request) -> Optional[str]:
        """Extract version from query parameter"""
        query_params = parse_qs(request.url.query)
        version_values = query_params.get(self.policy.query_param, [])
        if version_values:
            version = version_values[0]
            if not version.startswith('v'):
                version = f"v{version}"
            return version

        return None

    def _extract_version_from_content_type(self, request: Request) -> Optional[str]:
        """Extract version from Content-Type header"""
        content_type = request.headers.get("content-type", "")
        if 'version=' in content_type:
            version_match = re.search(r'version=(\d+)', content_type)
            if version_match:
                return f"v{version_match.group(1)}"

        # Check for vendor-specific content types
        if 'vnd.api' in content_type:
            version_match = re.search(r'vnd\.api\.v(\d+)', content_type)
            if version_match:
                return f"v{version_match.group(1)}"

        return None

    def _extract_version_from_custom_header(self, request: Request) -> Optional[str]:
        """Extract version from custom header"""
        custom_header = request.headers.get("X-API-Version")
        if custom_header:
            if custom_header.startswith('v'):
                return custom_header
            else:
                return f"v{custom_header}"

        return None

    async def _is_version_supported(self, version: str) -> bool:
        """Check if version is supported"""
        return version in self.policy.supported_versions

    async def _is_version_deprecated(self, version: str) -> bool:
        """Check if version is deprecated"""
        if version not in self.versions:
            return False

        version_info = self.versions[version]
        return version_info.status == VersionStatus.DEPRECATED

    async def _apply_version_transformations(self, request: Request, version: str) -> Request:
        """Apply version-specific transformations to request"""
        try:
            # Update request path if needed
            if self.policy.versioning_strategy == VersioningStrategy.URL_PATH:
                request = await self._update_request_path(request, version)

            # Apply version-specific headers
            request = await self._add_version_headers(request, version)

            # Apply version-specific rate limiting adjustments
            request = await self._adjust_rate_limits(request, version)

            return request

        except Exception as e:
            logger.error(f"Version transformation failed: {e}")
            return request

    async def _update_request_path(self, request: Request, version: str) -> Request:
        """Update request path for version routing"""
        original_path = request.url.path

        # If path doesn't have version, add it
        if not re.search(r'/api/(v\d+)/', original_path):
            # Find insertion point after /api/ or at beginning
            if original_path.startswith('/api/'):
                new_path = original_path.replace('/api/', f'/api/{version}/')
            else:
                new_path = f'/api/{version}{original_path}'

            # Update request URL (this is a simplified approach)
            request.scope["path"] = new_path
            request.scope["raw_path"] = new_path.encode()

        return request

    async def _add_version_headers(self, request: Request, version: str) -> Request:
        """Add version-specific headers"""
        version_info = self.versions.get(version)
        if not version_info:
            return request

        # Add version information headers
        headers = request.headers.mutablecopy()
        headers["X-API-Version"] = version
        headers["X-API-Version-Status"] = version_info.status.value

        if version_info.deprecated_at:
            headers["X-API-Version-Deprecated"] = version_info.deprecated_at.isoformat()

        if version_info.sunset_at:
            headers["X-API-Version-Sunset"] = version_info.sunset_at.isoformat()

        return request

    async def _adjust_rate_limits(self, request: Request, version: str) -> Request:
        """Adjust rate limits based on version"""
        version_info = self.versions.get(version)
        if not version_info:
            return request

        # Store rate limit multiplier for rate limiter to use
        request.state.rate_limit_multiplier = version_info.rate_limit_multiplier

        return request

    def get_version_info(self, version: str) -> Optional[APIVersion]:
        """Get information about specific version"""
        return self.versions.get(version)

    def get_all_versions(self) -> Dict[str, APIVersion]:
        """Get all available versions"""
        return self.versions.copy()

    def get_supported_versions(self) -> List[str]:
        """Get list of supported versions"""
        return self.policy.supported_versions.copy()

    def get_deprecated_versions(self) -> List[str]:
        """Get list of deprecated versions"""
        deprecated_versions = []
        for version, version_info in self.versions.items():
            if version_info.status == VersionStatus.DEPRECATED:
                deprecated_versions.append(version)
        return deprecated_versions

    def get_version_migration_info(self, from_version: str, to_version: str) -> Optional[Dict[str, Any]]:
        """Get migration information between versions"""
        if from_version not in self.versions or to_version not in self.versions:
            return None

        from_info = self.versions[from_version]
        to_info = self.versions[to_version]

        return {
            "from_version": from_version,
            "to_version": to_version,
            "breaking_changes": to_info.breaking_changes,
            "migration_guide": to_info.migration_guide,
            "grace_period_days": self.policy.grace_period_days,
            "deprecation_date": from_info.deprecated_at.isoformat() if from_info.deprecated_at else None,
            "sunset_date": from_info.sunset_at.isoformat() if from_info.sunset_at else None,
            "new_features": [feature for feature, enabled in to_info.features.items() if enabled and not from_info.features.get(feature, False)]
        }

    def add_version(self, version: APIVersion):
        """Add new API version"""
        self.versions[version.version] = version
        logger.info(f"Added API version: {version.version}")

    def deprecate_version(self, version: str, sunset_days: int = None):
        """Deprecate an API version"""
        if version not in self.versions:
            raise ValueError(f"Version {version} not found")

        version_info = self.versions[version]
        version_info.status = VersionStatus.DEPRECATED
        version_info.deprecated_at = datetime.utcnow()

        if sunset_days:
            version_info.sunset_at = datetime.utcnow() + timedelta(days=sunset_days)

        if version in self.policy.supported_versions:
            self.policy.supported_versions.remove(version)

        if version not in self.policy.deprecated_versions:
            self.policy.deprecated_versions.append(version)

        logger.info(f"Deprecated API version: {version}")

    def sunset_version(self, version: str):
        """Sunset an API version (remove support)"""
        if version not in self.versions:
            raise ValueError(f"Version {version} not found")

        version_info = self.versions[version]
        version_info.status = VersionStatus.SUNSET
        version_info.sunset_at = datetime.utcnow()

        if version in self.policy.supported_versions:
            self.policy.supported_versions.remove(version)

        if version in self.policy.deprecated_versions:
            self.policy.deprecated_versions.remove(version)

        if version not in self.policy.sunset_versions:
            self.policy.sunset_versions.append(version)

        logger.info(f"Sunset API version: {version}")

    def set_default_version(self, version: str):
        """Set default API version"""
        if version not in self.versions:
            raise ValueError(f"Version {version} not found")

        self.policy.default_version = version
        logger.info(f"Set default API version: {version}")

    def update_policy(self, policy: VersionPolicy):
        """Update versioning policy"""
        self.policy = policy
        logger.info("Updated API versioning policy")

    def get_version_stats(self) -> Dict[str, Any]:
        """Get version statistics"""
        active_count = sum(1 for v in self.versions.values() if v.status == VersionStatus.ACTIVE)
        deprecated_count = sum(1 for v in self.versions.values() if v.status == VersionStatus.DEPRECATED)
        beta_count = sum(1 for v in self.versions.values() if v.status == VersionStatus.BETA)

        return {
            "total_versions": len(self.versions),
            "active_versions": active_count,
            "deprecated_versions": deprecated_count,
            "sunset_versions": len(self.policy.sunset_versions),
            "beta_versions": beta_count,
            "default_version": self.policy.default_version,
            "versioning_strategy": self.policy.versioning_strategy.value,
            "supported_versions": self.policy.supported_versions
        }