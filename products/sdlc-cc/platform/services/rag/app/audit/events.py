"""Audit event schema.

Every event emitted by the platform is an instance of ``AuditEvent``.
The schema is stable (schema_version = "1.0") and versioned — breaking
changes must bump the version and include a migration in Vector.
"""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class AuditEventType(str, Enum):
    """Closed set of audit event types.

    Adding a new type is a schema change — update the Loki label
    allow-list in vector-config.toml as well.
    """

    AUTH_LOGIN = "AUTH_LOGIN"
    AUTH_LOGOUT = "AUTH_LOGOUT"
    AUTH_FAILED = "AUTH_FAILED"
    DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
    DOCUMENT_DELETE = "DOCUMENT_DELETE"
    DOCUMENT_ACCESS = "DOCUMENT_ACCESS"
    POLICY_CREATE = "POLICY_CREATE"
    POLICY_UPDATE = "POLICY_UPDATE"
    POLICY_DELETE = "POLICY_DELETE"
    LLM_QUERY = "LLM_QUERY"
    DLP_VIOLATION = "DLP_VIOLATION"
    ADMIN_ACTION = "ADMIN_ACTION"
    API_KEY_CREATED = "API_KEY_CREATED"
    API_KEY_REVOKED = "API_KEY_REVOKED"


def _new_id() -> str:
    return f"evt_{uuid.uuid4().hex[:24]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AuditEvent:
    """Immutable audit record.

    Fields map 1:1 to Loki labels + R2 JSON columns. See
    ``deployments/audit-pipeline/vector-config.toml`` for the
    downstream routing rules.
    """

    event_type: AuditEventType
    tenant_id: str
    user_id: str | None = None
    resource_id: str | None = None
    resource_type: str | None = None
    action: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    ip_address: str | None = None
    user_agent: str | None = None
    success: bool = True
    error_message: str | None = None
    id: str = field(default_factory=_new_id)
    timestamp: str = field(default_factory=_now_iso)
    schema_version: str = "1.0"
    service: str = "rag"

    def to_dict(self) -> dict[str, Any]:
        """Return the event as a JSON-serialisable dict."""
        d = asdict(self)
        d["event_type"] = self.event_type.value
        return d

    def to_loki_labels(self) -> dict[str, str]:
        """Minimal label set for Loki indexing.

        Loki labels must be low-cardinality. Keep this small:
        high-cardinality fields (user_id, resource_id) live in the
        log line itself and are queryable via JSON parsing.
        """
        return {
            "service": self.service,
            "tenant_id": self.tenant_id,
            "event_type": self.event_type.value,
            "success": str(self.success).lower(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AuditEvent:
        """Reconstruct from a parsed Loki/R2 JSON line."""
        event_type = data.get("event_type")
        if isinstance(event_type, str):
            event_type = AuditEventType(event_type)
        return cls(
            event_type=event_type,
            tenant_id=data["tenant_id"],
            user_id=data.get("user_id"),
            resource_id=data.get("resource_id"),
            resource_type=data.get("resource_type"),
            action=data.get("action"),
            metadata=data.get("metadata", {}),
            ip_address=data.get("ip_address"),
            user_agent=data.get("user_agent"),
            success=bool(data.get("success", True)),
            error_message=data.get("error_message"),
            id=data.get("id", _new_id()),
            timestamp=data.get("timestamp", _now_iso()),
            schema_version=data.get("schema_version", "1.0"),
            service=data.get("service", "rag"),
        )
