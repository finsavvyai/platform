"""
API Key Management System for Universal Dependency Platform.

Provides secure API key generation, validation, rotation, and management
with support for different key types, scopes, and expiration policies.
"""

import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..core.models.base import BaseModel

logger = logging.getLogger(__name__)


class APIKeyType(str, Enum):
    """API key types with different privilege levels."""

    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    ADMIN = "admin"
    SERVICE_ACCOUNT = "service_account"
    TEMPORARY = "temporary"
    WEBHOOK = "webhook"


class APIKeyScope(str, Enum):
    """API key scopes for granular access control."""

    # Project access
    PROJECT_READ = "project:read"
    PROJECT_WRITE = "project:write"
    PROJECT_DELETE = "project:delete"
    PROJECT_ANALYZE = "project:analyze"

    # Package access
    PACKAGE_READ = "package:read"
    PACKAGE_WRITE = "package:write"
    PACKAGE_DELETE = "package:delete"

    # Dependency access
    DEPENDENCY_READ = "dependency:read"
    DEPENDENCY_UPDATE = "dependency:update"
    DEPENDENCY_ANALYZE = "dependency:analyze"

    # Security access
    SECURITY_READ = "security:read"
    SECURITY_SCAN = "security:scan"

    # Organization access
    ORG_READ = "org:read"
    ORG_WRITE = "org:write"
    ORG_USERS = "org:users"

    # System access
    SYSTEM_READ = "system:read"
    SYSTEM_METRICS = "system:metrics"

    # Integration access
    INTEGRATION_READ = "integration:read"
    INTEGRATION_WRITE = "integration:write"

    # Webhook access
    WEBHOOK_READ = "webhook:read"
    WEBHOOK_WRITE = "webhook:write"
    WEBHOOK_EXECUTE = "webhook:execute"


@dataclass
class APIKeyInfo:
    """API key information for validation responses."""

    key_id: str
    name: str
    key_type: APIKeyType
    scopes: list[APIKeyScope]
    organization_id: str
    user_id: Optional[str]
    is_active: bool
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    created_at: datetime
    metadata: dict[str, Any]


@dataclass
class APIKeyCreateRequest:
    """Request for creating a new API key."""

    name: str
    key_type: APIKeyType
    scopes: list[APIKeyScope]
    organization_id: str
    user_id: Optional[str] = None
    expires_in_days: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None
    rate_limit_override: Optional[dict[str, int]] = None


@dataclass
class APIKeyValidationResult:
    """Result of API key validation."""

    is_valid: bool
    key_info: Optional[APIKeyInfo] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None


class APIKeyManager:
    """
    Manages API key lifecycle including generation, validation, and rotation.
    """

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        self.settings = get_settings()
        self._scope_permissions = self._build_scope_permissions()

    def _build_scope_permissions(self) -> dict[APIKeyType, set[APIKeyScope]]:
        """Build mapping of key types to allowed scopes."""
        return {
            APIKeyType.READ_ONLY: {
                APIKeyScope.PROJECT_READ,
                APIKeyScope.PACKAGE_READ,
                APIKeyScope.DEPENDENCY_READ,
                APIKeyScope.SECURITY_READ,
                APIKeyScope.ORG_READ,
                APIKeyScope.SYSTEM_READ,
                APIKeyScope.INTEGRATION_READ,
                APIKeyScope.WEBHOOK_READ,
            },
            APIKeyType.READ_WRITE: {
                APIKeyScope.PROJECT_READ,
                APIKeyScope.PROJECT_WRITE,
                APIKeyScope.PACKAGE_READ,
                APIKeyScope.PACKAGE_WRITE,
                APIKeyScope.DEPENDENCY_READ,
                APIKeyScope.DEPENDENCY_UPDATE,
                APIKeyScope.SECURITY_READ,
                APIKeyScope.ORG_READ,
                APIKeyScope.ORG_WRITE,
                APIKeyScope.SYSTEM_READ,
                APIKeyScope.INTEGRATION_READ,
                APIKeyScope.INTEGRATION_WRITE,
                APIKeyScope.WEBHOOK_READ,
                APIKeyScope.WEBHOOK_WRITE,
            },
            APIKeyType.ADMIN: {
                # Admin keys have access to all scopes
                scope
                for scope in APIKeyScope
            },
            APIKeyType.SERVICE_ACCOUNT: {
                APIKeyScope.PROJECT_READ,
                APIKeyScope.PROJECT_ANALYZE,
                APIKeyScope.PACKAGE_READ,
                APIKeyScope.DEPENDENCY_READ,
                APIKeyScope.DEPENDENCY_ANALYZE,
                APIKeyScope.SECURITY_READ,
                APIKeyScope.SECURITY_SCAN,
                APIKeyScope.SYSTEM_READ,
                APIKeyScope.SYSTEM_METRICS,
                APIKeyScope.INTEGRATION_READ,
            },
            APIKeyType.TEMPORARY: {
                APIKeyScope.PROJECT_READ,
                APIKeyScope.PACKAGE_READ,
                APIKeyScope.DEPENDENCY_READ,
            },
            APIKeyType.WEBHOOK: {
                APIKeyScope.PROJECT_READ,
                APIKeyScope.PROJECT_ANALYZE,
                APIKeyScope.PACKAGE_READ,
                APIKeyScope.DEPENDENCY_READ,
                APIKeyScope.WEBHOOK_READ,
                APIKeyScope.WEBHOOK_WRITE,
                APIKeyScope.WEBHOOK_EXECUTE,
            },
        }

    async def create_api_key(self, request: APIKeyCreateRequest) -> tuple[str, str]:
        """
        Create a new API key.

        Returns:
            Tuple of (key_id, key_secret)
            key_secret is the full key that should be shown to user once
            key_id is the identifier that can be used to reference the key
        """

        # Validate scopes
        await self._validate_key_scopes(request.key_type, request.scopes)

        # Generate key components
        key_id = secrets.token_urlsafe(16)
        key_secret = self._generate_key_secret(key_id)

        # Calculate expiration
        expires_at = None
        if request.expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)
        elif request.key_type == APIKeyType.TEMPORARY:
            # Temporary keys default to 24 hours
            expires_at = datetime.utcnow() + timedelta(hours=24)

        # Store key in database
        api_key_record = APIKeyRecord(
            key_id=key_id,
            key_hash=self._hash_key(key_secret),
            name=request.name,
            key_type=request.key_type.value,
            scopes=[scope.value for scope in request.scopes],
            organization_id=request.organization_id,
            user_id=request.user_id,
            expires_at=expires_at,
            metadata=request.metadata or {},
            rate_limit_override=request.rate_limit_override or {},
            is_active=True,
        )

        self.db_session.add(api_key_record)
        await self.db_session.commit()

        logger.info(
            f"Created API key {key_id} for organization {request.organization_id}"
        )

        return key_id, key_secret

    async def validate_api_key(self, key_secret: str) -> APIKeyValidationResult:
        """
        Validate an API key and return its information.
        """

        if not key_secret:
            return APIKeyValidationResult(
                is_valid=False,
                error_message="API key is required",
                error_code="MISSING_KEY",
            )

        # Extract key ID from secret
        try:
            key_id = self._extract_key_id(key_secret)
        except ValueError:
            return APIKeyValidationResult(
                is_valid=False,
                error_message="Invalid API key format",
                error_code="INVALID_FORMAT",
            )

        # Look up key in database
        query = select(APIKeyRecord).where(
            and_(APIKeyRecord.key_id == key_id, APIKeyRecord.is_active == True)
        )
        result = await self.db_session.execute(query)
        api_key_record = result.scalar_one_or_none()

        if not api_key_record:
            return APIKeyValidationResult(
                is_valid=False,
                error_message="API key not found or inactive",
                error_code="KEY_NOT_FOUND",
            )

        # Check expiration
        if api_key_record.expires_at and api_key_record.expires_at < datetime.utcnow():
            return APIKeyValidationResult(
                is_valid=False,
                error_message="API key has expired",
                error_code="KEY_EXPIRED",
            )

        # Verify key hash
        if not self._verify_key_hash(key_secret, api_key_record.key_hash):
            return APIKeyValidationResult(
                is_valid=False,
                error_message="Invalid API key",
                error_code="INVALID_KEY",
            )

        # Update last used timestamp
        api_key_record.last_used_at = datetime.utcnow()
        await self.db_session.commit()

        # Build key info
        key_info = APIKeyInfo(
            key_id=api_key_record.key_id,
            name=api_key_record.name,
            key_type=APIKeyType(api_key_record.key_type),
            scopes=[APIKeyScope(scope) for scope in api_key_record.scopes],
            organization_id=api_key_record.organization_id,
            user_id=api_key_record.user_id,
            is_active=api_key_record.is_active,
            expires_at=api_key_record.expires_at,
            last_used_at=api_key_record.last_used_at,
            created_at=api_key_record.created_at,
            metadata=api_key_record.metadata,
        )

        return APIKeyValidationResult(is_valid=True, key_info=key_info)

    async def revoke_api_key(self, key_id: str, organization_id: str) -> bool:
        """
        Revoke an API key.
        """

        query = select(APIKeyRecord).where(
            and_(
                APIKeyRecord.key_id == key_id,
                APIKeyRecord.organization_id == organization_id,
            )
        )
        result = await self.db_session.execute(query)
        api_key_record = result.scalar_one_or_none()

        if not api_key_record:
            return False

        api_key_record.is_active = False
        await self.db_session.commit()

        logger.info(f"Revoked API key {key_id} for organization {organization_id}")
        return True

    async def rotate_api_key(self, key_id: str, organization_id: str) -> Optional[str]:
        """
        Rotate an API key, returning the new key secret.
        """

        query = select(APIKeyRecord).where(
            and_(
                APIKeyRecord.key_id == key_id,
                APIKeyRecord.organization_id == organization_id,
                APIKeyRecord.is_active == True,
            )
        )
        result = await self.db_session.execute(query)
        api_key_record = result.scalar_one_or_none()

        if not api_key_record:
            return None

        # Generate new key secret
        new_key_secret = self._generate_key_secret(key_id)

        # Update key hash
        api_key_record.key_hash = self._hash_key(new_key_secret)
        await self.db_session.commit()

        logger.info(f"Rotated API key {key_id} for organization {organization_id}")
        return new_key_secret

    async def list_api_keys(
        self, organization_id: str, user_id: Optional[str] = None
    ) -> list[APIKeyInfo]:
        """
        List API keys for an organization (and optionally user).
        """

        query = select(APIKeyRecord).where(
            APIKeyRecord.organization_id == organization_id
        )

        if user_id:
            query = query.where(APIKeyRecord.user_id == user_id)

        result = await self.db_session.execute(query)
        api_key_records = result.scalars().all()

        return [
            APIKeyInfo(
                key_id=record.key_id,
                name=record.name,
                key_type=APIKeyType(record.key_type),
                scopes=[APIKeyScope(scope) for scope in record.scopes],
                organization_id=record.organization_id,
                user_id=record.user_id,
                is_active=record.is_active,
                expires_at=record.expires_at,
                last_used_at=record.last_used_at,
                created_at=record.created_at,
                metadata=record.metadata,
            )
            for record in api_key_records
        ]

    async def update_api_key(
        self,
        key_id: str,
        organization_id: str,
        name: Optional[str] = None,
        scopes: Optional[list[APIKeyScope]] = None,
        expires_in_days: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> bool:
        """
        Update an existing API key.
        """

        query = select(APIKeyRecord).where(
            and_(
                APIKeyRecord.key_id == key_id,
                APIKeyRecord.organization_id == organization_id,
            )
        )
        result = await self.db_session.execute(query)
        api_key_record = result.scalar_one_or_none()

        if not api_key_record:
            return False

        # Update fields
        if name:
            api_key_record.name = name

        if scopes:
            await self._validate_key_scopes(APIKeyType(api_key_record.key_type), scopes)
            api_key_record.scopes = [scope.value for scope in scopes]

        if expires_in_days:
            api_key_record.expires_at = datetime.utcnow() + timedelta(
                days=expires_in_days
            )

        if metadata:
            api_key_record.metadata = metadata

        await self.db_session.commit()

        logger.info(f"Updated API key {key_id} for organization {organization_id}")
        return True

    async def get_api_key_stats(self, organization_id: str) -> dict[str, Any]:
        """
        Get statistics about API keys for an organization.
        """

        # Total keys
        total_query = select(APIKeyRecord).where(
            APIKeyRecord.organization_id == organization_id
        )
        total_result = await self.db_session.execute(total_query)
        total_keys = len(total_result.scalars().all())

        # Active keys
        active_query = select(APIKeyRecord).where(
            and_(
                APIKeyRecord.organization_id == organization_id,
                APIKeyRecord.is_active == True,
            )
        )
        active_result = await self.db_session.execute(active_query)
        active_keys = len(active_result.scalars().all())

        # Expired keys
        expired_query = select(APIKeyRecord).where(
            and_(
                APIKeyRecord.organization_id == organization_id,
                APIKeyRecord.expires_at < datetime.utcnow(),
            )
        )
        expired_result = await self.db_session.execute(expired_query)
        expired_keys = len(expired_result.scalars().all())

        # Keys by type
        type_stats = {}
        for key_type in APIKeyType:
            type_query = select(APIKeyRecord).where(
                and_(
                    APIKeyRecord.organization_id == organization_id,
                    APIKeyRecord.key_type == key_type.value,
                )
            )
            type_result = await self.db_session.execute(type_query)
            type_stats[key_type.value] = len(type_result.scalars().all())

        return {
            "total_keys": total_keys,
            "active_keys": active_keys,
            "expired_keys": expired_keys,
            "keys_by_type": type_stats,
        }

    def _generate_key_secret(self, key_id: str) -> str:
        """Generate a full API key secret."""
        prefix = "upm_"
        random_part = secrets.token_urlsafe(32)
        return f"{prefix}{key_id}_{random_part}"

    def _extract_key_id(self, key_secret: str) -> str:
        """Extract key ID from API key secret."""
        if not key_secret.startswith("upm_"):
            raise ValueError("Invalid API key format")

        parts = key_secret.split("_")
        if len(parts) < 3:
            raise ValueError("Invalid API key format")

        return parts[1]

    def _hash_key(self, key_secret: str) -> str:
        """Hash an API key for storage."""
        return hashlib.sha256(key_secret.encode()).hexdigest()

    def _verify_key_hash(self, key_secret: str, key_hash: str) -> bool:
        """Verify API key against stored hash."""
        return self._hash_key(key_secret) == key_hash

    async def _validate_key_scopes(
        self, key_type: APIKeyType, scopes: list[APIKeyScope]
    ):
        """Validate that scopes are allowed for the key type."""
        allowed_scopes = self._scope_permissions.get(key_type, set())

        for scope in scopes:
            if scope not in allowed_scopes:
                raise ValueError(
                    f"Scope {scope.value} is not allowed for key type {key_type.value}"
                )


# API Key Database Model
class APIKeyRecord(BaseModel):
    """Database model for API keys."""

    __tablename__ = "api_keys"

    key_id = Column(String(32), unique=True, nullable=False, index=True)
    key_hash = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    key_type = Column(String(50), nullable=False)
    scopes = Column(JSON, nullable=False, default=list)
    organization_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    metadata = Column(JSON, nullable=False, default=dict)
    rate_limit_override = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)

    # Indexes
    __table_args__ = (
        Index("idx_api_keys_org_active", "organization_id", "is_active"),
        Index("idx_api_keys_user_active", "user_id", "is_active"),
        Index("idx_api_keys_expires", "expires_at"),
    )

    def __repr__(self):
        return f"<APIKeyRecord(key_id='{self.key_id}', organization_id='{self.organization_id}')>"


# Dependency injection function
async def get_api_key_manager(db_session: AsyncSession) -> APIKeyManager:
    """Get API key manager instance."""
    return APIKeyManager(db_session)
