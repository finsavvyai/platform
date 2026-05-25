"""Append-only audit logger.

Writes structured JSON to:
  1. stdout         — picked up by Vector via docker_logs
  2. tenant file    — /var/log/sdlc/rag/audit-<tenant>.log (prod only)
  3. Langfuse       — optional, for trace correlation

The logger is *append-only*: files are opened with ``O_APPEND`` and
never rewritten. Rotation is handled by Vector's file source, which
tails new segments produced by logrotate / CronJob.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .events import AuditEvent, AuditEventType

_LOG_ROOT = Path(os.getenv("SDLC_AUDIT_LOG_DIR", "/var/log/sdlc/rag"))
_ENV = os.getenv("ENVIRONMENT", "dev")
_LANGFUSE_ENABLED = os.getenv("LANGFUSE_ENABLED", "false").lower() == "true"


class AuditLogger:
    """Singleton-safe audit logger.

    Uses @finsavvyai/monitor conventions (structured JSON, ISO-8601
    timestamps, trace-id propagation) so the Python event stream is
    identical to the Node/Go services downstream of Vector.
    """

    def __init__(self, service: str = "rag") -> None:
        self.service = service
        self._lock = threading.Lock()
        self._file_handles: dict[str, Any] = {}
        self._stdout_logger = self._build_stdout_logger()
        self._langfuse = self._maybe_build_langfuse()
        if _ENV != "dev":
            _LOG_ROOT.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def log_event(self, event: AuditEvent) -> None:
        """Emit an audit event. Never raises on sink failure."""
        event.service = self.service
        payload = event.to_dict()
        line = json.dumps(payload, separators=(",", ":"), sort_keys=True)

        self._write_stdout(line)
        if _ENV != "dev":
            self._write_tenant_file(event.tenant_id, line)
        if self._langfuse is not None:
            self._write_langfuse(event)

    def log(
        self,
        event_type: AuditEventType,
        tenant_id: str,
        **kwargs: Any,
    ) -> AuditEvent:
        """Convenience wrapper that builds + emits an event."""
        event = AuditEvent(event_type=event_type, tenant_id=tenant_id, **kwargs)
        self.log_event(event)
        return event

    # ------------------------------------------------------------------
    # sink plumbing
    # ------------------------------------------------------------------

    def _build_stdout_logger(self) -> logging.Logger:
        logger = logging.getLogger("sdlc.audit")
        logger.setLevel(logging.INFO)
        logger.propagate = False
        if not logger.handlers:
            h = logging.StreamHandler(sys.stdout)
            h.setFormatter(logging.Formatter("%(message)s"))
            logger.addHandler(h)
        return logger

    def _write_stdout(self, line: str) -> None:
        try:
            self._stdout_logger.info(line)
        except Exception:  # pragma: no cover - best effort
            pass

    def _write_tenant_file(self, tenant_id: str, line: str) -> None:
        safe = "".join(c for c in tenant_id if c.isalnum() or c in "-_")[:64] or "unknown"
        path = _LOG_ROOT / f"audit-{safe}.log"
        with self._lock:
            fh = self._file_handles.get(safe)
            if fh is None:
                fh = open(path, "a", buffering=1, encoding="utf-8")
                self._file_handles[safe] = fh
            try:
                fh.write(line + "\n")
            except Exception:  # pragma: no cover
                pass

    def _maybe_build_langfuse(self) -> Any | None:
        if not _LANGFUSE_ENABLED:
            return None
        try:  # pragma: no cover - optional dep
            from langfuse import Langfuse

            return Langfuse()
        except Exception:
            return None

    def _write_langfuse(self, event: AuditEvent) -> None:  # pragma: no cover
        try:
            self._langfuse.event(
                name=f"audit.{event.event_type.value}",
                metadata=event.to_dict(),
            )
        except Exception:
            pass


_default: AuditLogger | None = None


def get_audit_logger(service: str = "rag") -> AuditLogger:
    """Return the process-wide audit logger."""
    global _default
    if _default is None:
        _default = AuditLogger(service=service)
    return _default


@contextmanager
def audit_context(
    tenant_id: str,
    user_id: str | None,
    action: str,
    event_type: AuditEventType = AuditEventType.ADMIN_ACTION,
    **metadata: Any,
) -> Iterator[dict[str, Any]]:
    """Wrap an operation; emit success/failure events automatically.

    Usage::

        with audit_context(tenant_id, user_id, "delete_document",
                           AuditEventType.DOCUMENT_DELETE,
                           resource_id=doc_id) as ctx:
            delete(doc_id)
            ctx["metadata"]["bytes_freed"] = 12345
    """
    logger = get_audit_logger()
    ctx: dict[str, Any] = {"metadata": dict(metadata)}
    try:
        yield ctx
    except Exception as exc:
        logger.log(
            event_type=event_type,
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            success=False,
            error_message=str(exc),
            metadata=ctx["metadata"],
        )
        raise
    else:
        logger.log(
            event_type=event_type,
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            success=True,
            metadata=ctx["metadata"],
        )
