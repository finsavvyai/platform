"""Append-only audit logging for SDLC RAG service.

Emits structured JSON events to stdout + tenant-scoped files.
Vector.dev collects them and routes to Loki (90d hot) and
Cloudflare R2 (7y cold) per SOC2 CC7.2 retention requirements.
"""
from .events import AuditEvent, AuditEventType
from .logger import AuditLogger, audit_context, get_audit_logger
from .queries import LokiAuditQuery

__all__ = [
    "AuditEvent",
    "AuditEventType",
    "AuditLogger",
    "LokiAuditQuery",
    "audit_context",
    "get_audit_logger",
]
