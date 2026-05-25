"""
Content Redaction and Sanitization Service

Advanced content redaction system with PII removal, tokenization,
content masking, and comprehensive audit logging for enterprise compliance.

Key Features:
- PII redaction with configurable masking strategies
- Tokenization for sensitive data preservation
- Content masking with multiple masking types
- Secure data handling with encryption
- Comprehensive audit logging for compliance
- Quality monitoring and validation
"""

import asyncio
import base64
import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any

import asyncpg
from app.utils.logging import get_logger
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from redis.asyncio import Redis

from app.core.config import get_settings
from app.models.database import RedactionPolicy
from app.services.presidio_detector import PresidioDetector

logger = get_logger(__name__)
settings = get_settings()


class MaskingType(StrEnum):
    FULL_MASK = "full_mask"  # [REDACTED]
    PARTIAL_MASK = "partial_mask"  # J*** D***
    HASH_MASK = "hash_mask"  # [HASH:a1b2c3]
    TOKEN_MASK = "token_mask"  # [TOKEN:abc123]
    PRESERVE_FORMAT = "preserve_format"  # Preserve original format
    CUSTOM_REPLACEMENT = "custom_replacement"


class RedactionLevel(StrEnum):
    MINIMAL = "minimal"  # Only required PII
    STANDARD = "standard"  # Standard PII plus sensitive info
    COMPREHENSIVE = "comprehensive"  # All detectable sensitive data
    CUSTOM = "custom"  # Based on custom rules


@dataclass
class RedactionResult:
    original_content: str
    redacted_content: str
    entities_found: list[dict[str, Any]]
    tokens_used: list[dict[str, Any]]
    redaction_stats: dict[str, int]
    masking_applied: dict[str, MaskingType]
    quality_score: float
    processing_time_ms: float
    audit_log_id: str


@dataclass
class RedactionPolicy:
    tenant_id: str
    policy_id: str
    name: str
    entity_types: list[str]
    masking_strategies: dict[str, MaskingType]
    redaction_level: RedactionLevel
    custom_rules: list[dict[str, Any]]
    preserve_format: bool
    quality_threshold: float


class ContentRedactor:
    """Enterprise-grade content redaction and sanitization service"""

    def __init__(self):
        self.presidio_detector = PresidioDetector()
        self.redis: Redis | None = None
        self.db_pool: asyncpg.Pool | None = None
        self._encryption_key = self._generate_encryption_key()
        self._cipher_suite = Fernet(self._encryption_key)
        self._initialize_services()

        # Performance metrics
        self._redaction_cache = {}
        self._performance_stats = {
            "total_redactions": 0,
            "avg_processing_time": 0,
            "cache_hits": 0,
            "cache_misses": 0,
        }

    def _generate_encryption_key(self) -> bytes:
        """Generate encryption key for token storage"""
        password = settings.dlp_encryption_key.encode()
        salt = b"sdlc_dlp_salt"  # In production, use random salt per deployment
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        return key

    async def _initialize_services(self):
        """Initialize Redis and database connections"""
        try:
            self.redis = Redis.from_url(
                settings.redis_url, encoding="utf-8", decode_responses=True
            )

            self.db_pool = await asyncpg.create_pool(
                settings.database_url, min_size=5, max_size=20, command_timeout=60
            )

            logger.info("Content redactor initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize content redactor: {e}")
            raise

    async def redact_content(
        self,
        content: str,
        tenant_id: str,
        user_id: str | None = None,
        policy_id: str | None = None,
        redaction_level: RedactionLevel = RedactionLevel.STANDARD,
        custom_masking: dict[str, MaskingType] | None = None,
    ) -> RedactionResult:
        """
        Perform comprehensive content redaction

        Args:
            content: Original content to redact
            tenant_id: Tenant identifier
            user_id: Optional user identifier for audit
            policy_id: Optional custom redaction policy
            redaction_level: Level of redaction to apply
            custom_masking: Custom masking strategies per entity type

        Returns:
            RedactionResult with detailed information
        """

        start_time = asyncio.get_event_loop().time()
        audit_log_id = f"{tenant_id}:{int(start_time * 1000000)}"

        try:
            # Get redaction policy
            policy = await self._get_redaction_policy(
                tenant_id, policy_id, redaction_level
            )

            # Detect entities using Presidio
            entities = await self._detect_entities(content, policy)

            # Create tokens for reversible redaction
            tokens = await self._create_tokens(entities, tenant_id, audit_log_id)

            # Apply redactions with appropriate masking
            redacted_content, masking_applied = await self._apply_redactions(
                content, entities, policy, custom_masking
            )

            # Calculate quality metrics
            quality_score = await self._calculate_redaction_quality(
                content, redacted_content, entities
            )

            # Generate statistics
            stats = await self._generate_redaction_stats(entities, tokens)

            # Log redaction for audit purposes
            await self._log_redaction(
                audit_log_id,
                tenant_id,
                user_id,
                content,
                redacted_content,
                entities,
                tokens,
                policy,
                quality_score,
            )

            processing_time = (asyncio.get_event_loop().time() - start_time) * 1000

            result = RedactionResult(
                original_content=content,
                redacted_content=redacted_content,
                entities_found=entities,
                tokens_used=tokens,
                redaction_stats=stats,
                masking_applied=masking_applied,
                quality_score=quality_score,
                processing_time_ms=processing_time,
                audit_log_id=audit_log_id,
            )

            # Update performance metrics
            self._update_performance_metrics(processing_time, True)

            return result

        except Exception as e:
            logger.error(f"Content redaction failed: {e}")
            processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self._update_performance_metrics(processing_time, False)
            raise

    async def _get_redaction_policy(
        self, tenant_id: str, policy_id: str | None, redaction_level: RedactionLevel
    ) -> RedactionPolicy:
        """Get redaction policy for tenant"""

        cache_key = f"redaction_policy:{tenant_id}:{policy_id or 'default'}"

        # Try cache first
        cached_policy = await self.redis.get(cache_key)
        if cached_policy:
            policy_data = json.loads(cached_policy)
            return RedactionPolicy(**policy_data)

        try:
            # Get from database
            if policy_id:
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """
                        SELECT * FROM redaction_policies
                        WHERE tenant_id = $1 AND policy_id = $2 AND is_active = true
                    """,
                        tenant_id,
                        policy_id,
                    )

                    if not row:
                        raise ValueError(f"Redaction policy not found: {policy_id}")
            else:
                # Get default policy for tenant
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """
                        SELECT * FROM redaction_policies
                        WHERE tenant_id = $1 AND is_default = true AND is_active = true
                    """,
                        tenant_id,
                    )

                    if not row:
                        # Create default policy
                        policy = await self._create_default_policy(
                            tenant_id, redaction_level
                        )
                    else:
                        policy = RedactionPolicy(
                            tenant_id=row["tenant_id"],
                            policy_id=row["policy_id"],
                            name=row["name"],
                            entity_types=json.loads(row["entity_types"]),
                            masking_strategies=json.loads(row["masking_strategies"]),
                            redaction_level=RedactionLevel(row["redaction_level"]),
                            custom_rules=json.loads(row["custom_rules"]),
                            preserve_format=row["preserve_format"],
                            quality_threshold=row["quality_threshold"],
                        )

            # Cache policy for 1 hour
            await self.redis.setex(
                cache_key, 3600, json.dumps(asdict(policy), default=str)
            )

            return policy

        except Exception as e:
            logger.error(f"Failed to get redaction policy: {e}")
            # Return default minimal policy as fallback
            return RedactionPolicy(
                tenant_id=tenant_id,
                policy_id="fallback",
                name="Fallback Policy",
                entity_types=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "US_SSN"],
                masking_strategies={},
                redaction_level=RedactionLevel.MINIMAL,
                custom_rules=[],
                preserve_format=True,
                quality_threshold=0.8,
            )

    async def _create_default_policy(
        self, tenant_id: str, redaction_level: RedactionLevel
    ) -> RedactionPolicy:
        """Create default redaction policy for tenant"""

        if redaction_level == RedactionLevel.MINIMAL:
            entity_types = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "US_SSN"]
        elif redaction_level == RedactionLevel.STANDARD:
            entity_types = [
                "PERSON",
                "EMAIL_ADDRESS",
                "PHONE_NUMBER",
                "US_SSN",
                "IBAN_CODE",
                "CREDIT_CARD",
                "IP_ADDRESS",
            ]
        else:  # COMPREHENSIVE
            entity_types = [
                "PERSON",
                "EMAIL_ADDRESS",
                "PHONE_NUMBER",
                "US_SSN",
                "IBAN_CODE",
                "CREDIT_CARD",
                "IP_ADDRESS",
                "LOCATION",
                "DATE_TIME",
                "URL",
                "NRP",
                "MEDICAL_LICENSE",
            ]

        # Default masking strategies
        masking_strategies = {
            "PERSON": MaskingType.PARTIAL_MASK,
            "EMAIL_ADDRESS": MaskingType.TOKEN_MASK,
            "PHONE_NUMBER": MaskingType.PARTIAL_MASK,
            "US_SSN": MaskingType.HASH_MASK,
            "CREDIT_CARD": MaskingType.HASH_MASK,
            "IBAN_CODE": MaskingType.PARTIAL_MASK,
            "IP_ADDRESS": MaskingType.PARTIAL_MASK,
            "MEDICAL_LICENSE": MaskingType.HASH_MASK,
        }

        policy = RedactionPolicy(
            tenant_id=tenant_id,
            policy_id=f"default_{int(datetime.utcnow().timestamp())}",
            name="Default Policy",
            entity_types=entity_types,
            masking_strategies=masking_strategies,
            redaction_level=redaction_level,
            custom_rules=[],
            preserve_format=True,
            quality_threshold=0.8,
        )

        # Store in database
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO redaction_policies (
                        tenant_id, policy_id, name, entity_types, masking_strategies,
                        redaction_level, custom_rules, preserve_format, quality_threshold,
                        is_default, is_active, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, NOW())
                """,
                    *[
                        policy.tenant_id,
                        policy.policy_id,
                        policy.name,
                        json.dumps(policy.entity_types),
                        json.dumps(policy.masking_strategies),
                        policy.redaction_level.value,
                        json.dumps(policy.custom_rules),
                        policy.preserve_format,
                        policy.quality_threshold,
                    ],
                )
        except Exception as e:
            logger.error(f"Failed to store default policy: {e}")

        return policy

    async def _detect_entities(
        self, content: str, policy: RedactionPolicy
    ) -> list[dict[str, Any]]:
        """Detect PII entities using Presidio"""

        try:
            # Use Presidio detector with configured entity types
            entities = await self.presidio_detector.analyze_text(
                content, language="en", entities=policy.entity_types
            )

            # Convert to standardized format
            detected_entities = []
            for entity in entities:
                detected_entities.append(
                    {
                        "entity_type": entity.entity_type,
                        "text": entity.text,
                        "start": entity.start,
                        "end": entity.end,
                        "confidence_score": entity.confidence_score,
                        "metadata": entity.to_dict(),
                    }
                )

            return detected_entities

        except Exception as e:
            logger.error(f"Entity detection failed: {e}")
            return []

    async def _create_tokens(
        self, entities: list[dict[str, Any]], tenant_id: str, audit_log_id: str
    ) -> list[dict[str, Any]]:
        """Create reversible tokens for sensitive data"""

        tokens = []

        for entity in entities:
            if entity["entity_type"] in [
                "EMAIL_ADDRESS",
                "PHONE_NUMBER",
                "US_SSN",
                "CREDIT_CARD",
            ]:
                # Create token for reversible redaction
                token_value = await self._generate_token(entity["text"], tenant_id)

                # Store token mapping
                token_data = {
                    "token_id": hashlib.sha256(
                        f"{audit_log_id}:{entity['start']}".encode()
                    ).hexdigest(),
                    "tenant_id": tenant_id,
                    "audit_log_id": audit_log_id,
                    "entity_type": entity["entity_type"],
                    "original_value": self._encrypt_value(entity["text"]),
                    "token_value": token_value,
                    "created_at": datetime.utcnow(),
                }

                # Store in database
                try:
                    async with self.db_pool.acquire() as conn:
                        await conn.execute(
                            """
                            INSERT INTO redaction_tokens (
                                token_id, tenant_id, audit_log_id, entity_type,
                                original_value, token_value, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        """,
                            *[
                                token_data["token_id"],
                                token_data["tenant_id"],
                                token_data["audit_log_id"],
                                token_data["entity_type"],
                                token_data["original_value"],
                                token_data["token_value"],
                                token_data["created_at"],
                            ],
                        )
                except Exception as e:
                    logger.error(f"Failed to store token: {e}")

                tokens.append(token_data)

        return tokens

    async def _generate_token(self, value: str, tenant_id: str) -> str:
        """Generate unique token for value"""

        # Create deterministic token for consistent mapping
        token_input = f"{tenant_id}:{value}"
        token_hash = hashlib.sha256(token_input.encode()).hexdigest()

        # Use first 12 characters for readability
        return token_hash[:12]

    def _encrypt_value(self, value: str) -> str:
        """Encrypt sensitive value for storage"""
        return self._cipher_suite.encrypt(value.encode()).decode()

    def _decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt sensitive value from storage"""
        return self._cipher_suite.decrypt(encrypted_value.encode()).decode()

    async def _apply_redactions(
        self,
        content: str,
        entities: list[dict[str, Any]],
        policy: RedactionPolicy,
        custom_masking: dict[str, MaskingType] | None,
    ) -> tuple[str, dict[str, MaskingType]]:
        """Apply redactions to content based on policy"""

        redacted_content = content
        masking_applied = {}

        # Sort entities by start position (reverse order to avoid index shifts)
        sorted_entities = sorted(entities, key=lambda x: x["start"], reverse=True)

        for entity in sorted_entities:
            entity_type = entity["entity_type"]
            original_text = entity["text"]

            # Determine masking strategy
            if custom_masking and entity_type in custom_masking:
                masking_type = custom_masking[entity_type]
            elif entity_type in policy.masking_strategies:
                masking_type = policy.masking_strategies[entity_type]
            else:
                # Default masking based on entity type
                masking_type = self._get_default_masking(entity_type)

            # Apply masking
            masked_text = self._apply_mask(original_text, masking_type, entity)

            # Replace in content
            redacted_content = (
                redacted_content[: entity["start"]]
                + masked_text
                + redacted_content[entity["end"] :]
            )

            masking_applied[entity_type] = masking_type

        return redacted_content, masking_applied

    def _get_default_masking(self, entity_type: str) -> MaskingType:
        """Get default masking strategy for entity type"""

        sensitive_types = ["US_SSN", "CREDIT_CARD", "IBAN_CODE", "MEDICAL_LICENSE"]
        contact_types = ["EMAIL_ADDRESS", "PHONE_NUMBER"]

        if entity_type in sensitive_types:
            return MaskingType.HASH_MASK
        elif entity_type in contact_types:
            return MaskingType.TOKEN_MASK
        else:
            return MaskingType.PARTIAL_MASK

    def _apply_mask(
        self, text: str, masking_type: MaskingType, entity: dict[str, Any]
    ) -> str:
        """Apply specific masking strategy to text"""

        if masking_type == MaskingType.FULL_MASK:
            return "[REDACTED]"

        elif masking_type == MaskingType.PARTIAL_MASK:
            return self._partial_mask(text)

        elif masking_type == MaskingType.HASH_MASK:
            hash_value = hashlib.sha256(text.encode()).hexdigest()[:8]
            return f"[HASH:{hash_value}]"

        elif masking_type == MaskingType.TOKEN_MASK:
            token_value = hashlib.sha256(text.encode()).hexdigest()[:12]
            return f"[TOKEN:{token_value}]"

        elif masking_type == MaskingType.PRESERVE_FORMAT:
            return self._preserve_format_mask(text)

        elif masking_type == MaskingType.CUSTOM_REPLACEMENT:
            return f"[{entity['entity_type']}_REDACTED]"

        else:
            return "[REDACTED]"

    def _partial_mask(self, text: str) -> str:
        """Apply partial masking preserving some characters"""

        if len(text) <= 2:
            return "*" * len(text)

        # Keep first and last character, mask middle
        return text[0] + "*" * (len(text) - 2) + text[-1]

    def _preserve_format_mask(self, text: str) -> str:
        """Mask while preserving format (e.g., email domains, phone structure)"""

        if "@" in text:  # Email
            local, domain = text.split("@", 1)
            masked_local = local[:2] + "*" * (len(local) - 2)
            return f"{masked_local}@{domain}"

        elif "-" in text and len(text) >= 5:  # Phone number
            parts = text.split("-")
            masked_parts = []
            for i, part in enumerate(parts):
                if i == 0:
                    masked_parts.append(part)
                else:
                    masked_parts.append("*" * len(part))
            return "-".join(masked_parts)

        else:
            return self._partial_mask(text)

    async def _calculate_redaction_quality(
        self,
        original_content: str,
        redacted_content: str,
        entities: list[dict[str, Any]],
    ) -> float:
        """Calculate quality score for redaction"""

        try:
            # Base quality score
            base_score = 0.8

            # Check if all entities were redacted
            redacted_count = 0
            for entity in entities:
                if entity["text"] not in redacted_content:
                    redacted_count += 1

            if entities:
                entity_coverage = redacted_count / len(entities)
                base_score += entity_coverage * 0.2

            # Check for formatting preservation
            original_words = len(original_content.split())
            redacted_words = len(redacted_content.split())

            # Should preserve roughly the same word count structure
            word_ratio = min(redacted_words, original_words) / max(original_words, 1)
            if word_ratio >= 0.8:  # Within 20% of original word count
                base_score += 0.1

            # Ensure score is between 0 and 1
            return min(1.0, max(0.0, base_score))

        except Exception as e:
            logger.error(f"Quality calculation failed: {e}")
            return 0.5  # Default medium quality

    async def _generate_redaction_stats(
        self, entities: list[dict[str, Any]], tokens: list[dict[str, Any]]
    ) -> dict[str, int]:
        """Generate statistics about redaction"""

        stats = {
            "total_entities": len(entities),
            "entities_by_type": {},
            "total_tokens": len(tokens),
            "tokens_by_type": {},
            "high_confidence_entities": 0,
            "medium_confidence_entities": 0,
            "low_confidence_entities": 0,
        }

        # Count entities by type and confidence
        for entity in entities:
            entity_type = entity["entity_type"]
            stats["entities_by_type"][entity_type] = (
                stats["entities_by_type"].get(entity_type, 0) + 1
            )

            confidence = entity["confidence_score"]
            if confidence >= 0.8:
                stats["high_confidence_entities"] += 1
            elif confidence >= 0.5:
                stats["medium_confidence_entities"] += 1
            else:
                stats["low_confidence_entities"] += 1

        # Count tokens by type
        for token in tokens:
            entity_type = token["entity_type"]
            stats["tokens_by_type"][entity_type] = (
                stats["tokens_by_type"].get(entity_type, 0) + 1
            )

        return stats

    async def _log_redaction(
        self,
        audit_log_id: str,
        tenant_id: str,
        user_id: str | None,
        original_content: str,
        redacted_content: str,
        entities: list[dict[str, Any]],
        tokens: list[dict[str, Any]],
        policy: RedactionPolicy,
        quality_score: float,
    ) -> None:
        """Log redaction for audit purposes"""

        try:
            # Calculate content hash for integrity
            content_hash = hashlib.sha256(original_content.encode()).hexdigest()

            # Log to database
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO redaction_logs (
                        audit_log_id, tenant_id, user_id, policy_id, policy_name,
                        original_content_hash, redacted_content, entities_found,
                        tokens_created, quality_score, processing_timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                """,
                    *[
                        audit_log_id,
                        tenant_id,
                        user_id,
                        policy.policy_id,
                        policy.name,
                        content_hash,
                        redacted_content,
                        json.dumps(entities),
                        len(tokens),
                        quality_score,
                    ],
                )

            # Log to audit system
            await self._log_audit_event(
                tenant_id,
                user_id,
                "CONTENT_REDACTION",
                {
                    "audit_log_id": audit_log_id,
                    "policy_id": policy.policy_id,
                    "entities_detected": len(entities),
                    "tokens_created": len(tokens),
                    "quality_score": quality_score,
                },
            )

        except Exception as e:
            logger.error(f"Redaction logging failed: {e}")

    async def _log_audit_event(
        self,
        tenant_id: str,
        user_id: str | None,
        event_type: str,
        metadata: dict[str, Any],
    ) -> None:
        """Log audit event"""

        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO audit_logs (
                        tenant_id, user_id, event_type, metadata, timestamp
                    ) VALUES ($1, $2, $3, $4, NOW())
                """,
                    tenant_id,
                    user_id,
                    event_type,
                    json.dumps(metadata),
                )

        except Exception as e:
            logger.error(f"Audit logging failed: {e}")

    def _update_performance_metrics(
        self, processing_time: float, success: bool
    ) -> None:
        """Update performance metrics"""

        self._performance_stats["total_redactions"] += 1

        # Update average processing time
        total = self._performance_stats["total_redactions"]
        current_avg = self._performance_stats["avg_processing_time"]
        self._performance_stats["avg_processing_time"] = (
            current_avg * (total - 1) + processing_time
        ) / total

    async def get_redaction_by_token(
        self,
        token_value: str,
        tenant_id: str,
        user_id: str | None = None,
        reason: str | None = None,
    ) -> str | None:
        """Retrieve original value using token (reversible redaction)"""

        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT original_value, entity_type, audit_log_id
                    FROM redaction_tokens
                    WHERE token_value = $1 AND tenant_id = $2
                """,
                    token_value,
                    tenant_id,
                )

                if not row:
                    return None

                # Check if user has permission to access
                if user_id:
                    has_permission = await self._check_token_access_permission(
                        user_id, tenant_id, row["audit_log_id"]
                    )
                    if not has_permission:
                        logger.warning(
                            f"Unauthorized token access attempt: {token_value}"
                        )
                        return None

                # Decrypt and return original value
                original_value = self._decrypt_value(row["original_value"])

                # Log token access for audit
                await self._log_audit_event(
                    tenant_id,
                    user_id,
                    "TOKEN_ACCESS",
                    {
                        "token_value": token_value,
                        "entity_type": row["entity_type"],
                        "audit_log_id": row["audit_log_id"],
                        "reason": reason or "API access",
                    },
                )

                return original_value

        except Exception as e:
            logger.error(f"Token lookup failed: {e}")
            return None

    async def _check_token_access_permission(
        self, user_id: str, tenant_id: str, audit_log_id: str
    ) -> bool:
        """Check if user has permission to access token"""

        try:
            # Check if user has admin or compliance role
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT role FROM user_roles
                    WHERE user_id = $1 AND tenant_id = $2
                    AND role IN ('admin', 'compliance', 'security')
                """,
                    user_id,
                    tenant_id,
                )

                return row is not None

        except Exception as e:
            logger.error(f"Permission check failed: {e}")
            return False

    async def get_redaction_analytics(
        self, tenant_id: str, days: int = 30
    ) -> dict[str, Any]:
        """Get redaction analytics for tenant"""

        try:
            async with self.db_pool.acquire() as conn:
                # Get overall statistics
                stats = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*) as total_redactions,
                        AVG(quality_score) as avg_quality,
                        AVG(EXTRACT(EPOCH FROM (processing_timestamp - created_at)) * 1000) as avg_processing_time,
                        COUNT(DISTINCT user_id) as unique_users
                    FROM redaction_logs
                    WHERE tenant_id = $1
                        AND processing_timestamp > NOW() - INTERVAL $2 DAY
                """,
                    tenant_id,
                    days,
                )

                # Get entity type distribution
                entity_stats = await conn.fetch(
                    """
                    SELECT
                        entity_type,
                        COUNT(*) as count,
                        AVG(confidence_score) as avg_confidence
                    FROM (
                        SELECT
                            jsonb_array_elements(entities_found)->>'entity_type' as entity_type,
                            (jsonb_array_elements(entities_found)->>'confidence_score')::float as confidence_score
                        FROM redaction_logs
                        WHERE tenant_id = $1
                            AND processing_timestamp > NOW() - INTERVAL $2 DAY
                    ) as entity_data
                    GROUP BY entity_type
                    ORDER BY count DESC
                """,
                    tenant_id,
                    days,
                )

                # Get daily volume
                daily_volume = await conn.fetch(
                    """
                    SELECT
                        DATE_TRUNC('day', processing_timestamp) as date,
                        COUNT(*) as redactions,
                        AVG(quality_score) as avg_quality
                    FROM redaction_logs
                    WHERE tenant_id = $1
                        AND processing_timestamp > NOW() - INTERVAL $2 DAY
                    GROUP BY DATE_TRUNC('day', processing_timestamp)
                    ORDER BY date DESC
                """,
                    tenant_id,
                    days,
                )

                return {
                    "summary": {
                        "total_redactions": stats["total_redactions"],
                        "avg_quality_score": float(stats["avg_quality"] or 0),
                        "avg_processing_time_ms": float(
                            stats["avg_processing_time"] or 0
                        ),
                        "unique_users": stats["unique_users"],
                    },
                    "entity_distribution": [
                        {
                            "entity_type": row["entity_type"],
                            "count": row["count"],
                            "avg_confidence": float(row["avg_confidence"] or 0),
                        }
                        for row in entity_stats
                    ],
                    "daily_volume": [
                        {
                            "date": row["date"].isoformat(),
                            "redactions": row["redactions"],
                            "avg_quality": float(row["avg_quality"] or 0),
                        }
                        for row in daily_volume
                    ],
                }

        except Exception as e:
            logger.error(f"Analytics retrieval failed: {e}")
            return {}

    async def close(self):
        """Close all connections"""

        if self.db_pool:
            await self.db_pool.close()

        if self.redis:
            await self.redis.close()
