#!/usr/bin/env python3
"""
FinSavvyAI Audit Logging

Records security-relevant events to a dedicated audit log for
compliance and forensic analysis. Events include:

  - Authentication attempts (success/failure)
  - API key creation, revocation, and rotation
  - Node registration and deregistration
  - Model load/unload operations
  - Configuration changes
  - Admin actions

Audit entries are written as JSON to a separate audit log file
and can optionally be forwarded to the metrics system for alerting.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional

from src.core.logger import get_correlation_id
from src.core.metrics import get_metrics_collector


class AuditAction(str, Enum):
    """Standard audit event types."""

    AUTH_SUCCESS = "auth.success"
    AUTH_FAILURE = "auth.failure"
    KEY_CREATED = "key.created"
    KEY_REVOKED = "key.revoked"
    KEY_ROTATED = "key.rotated"
    NODE_REGISTERED = "node.registered"
    NODE_REMOVED = "node.removed"
    NODE_OFFLINE = "node.offline"
    MODEL_LOADED = "model.loaded"
    MODEL_UNLOADED = "model.unloaded"
    CONFIG_CHANGED = "config.changed"
    SERVICE_STARTED = "service.started"
    SERVICE_STOPPED = "service.stopped"
    RATE_LIMITED = "rate.limited"
    CIRCUIT_BREAKER_OPEN = "circuit_breaker.open"
    ADMIN_ACTION = "admin.action"


class AuditLogger:
    """Writes structured audit events to a dedicated log file."""

    def __init__(
        self,
        log_path: Optional[str] = None,
        service_name: str = "finsavvyai",
    ):
        self.service_name = service_name
        self.log_path = log_path or os.path.join(
            os.environ.get("FINSAVVYAI_LOG_DIR", "/var/log/finsavvyai"),
            "audit.log",
        )
        self._lock = threading.Lock()
        self._metrics = get_metrics_collector()

        # Set up dedicated Python logger for audit events
        self._logger = logging.getLogger("finsavvyai.audit")
        self._logger.setLevel(logging.INFO)
        self._logger.propagate = False
        self._logger.handlers = []

        # File handler for audit log
        try:
            log_dir = Path(self.log_path).parent
            log_dir.mkdir(parents=True, exist_ok=True)
            fh = logging.FileHandler(self.log_path)
            fh.setFormatter(logging.Formatter("%(message)s"))
            self._logger.addHandler(fh)
        except OSError:
            # Fall back to stderr if file is not writable
            import sys

            fh = logging.StreamHandler(sys.stderr)
            fh.setFormatter(logging.Formatter("AUDIT: %(message)s"))
            self._logger.addHandler(fh)

    def log(
        self,
        action: AuditAction,
        actor: Optional[str] = None,
        resource: Optional[str] = None,
        detail: Optional[Dict[str, Any]] = None,
        outcome: str = "success",
        client_ip: Optional[str] = None,
    ):
        """Record an audit event.

        Args:
            action: The type of action (from AuditAction enum).
            actor: Who performed the action (API key prefix, user, system).
            resource: What was acted upon (node ID, model ID, config key).
            detail: Additional structured data about the event.
            outcome: "success" or "failure".
            client_ip: The IP address of the client if applicable.
        """
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action.value if isinstance(action, AuditAction) else action,
            "actor": actor or "system",
            "resource": resource,
            "outcome": outcome,
            "service": self.service_name,
        }

        cid = get_correlation_id()
        if cid:
            entry["correlation_id"] = cid

        if client_ip:
            entry["client_ip"] = client_ip

        if detail:
            entry["detail"] = detail

        with self._lock:
            self._logger.info(json.dumps(entry, default=str))

        # Increment audit counter for alerting
        self._metrics.increment(
            "audit_events_total",
            labels={"action": entry["action"], "outcome": outcome},
        )


# ── Global audit logger ────────────────────────────────────────────

_audit_logger: Optional[AuditLogger] = None


def get_audit_logger(service_name: str = "finsavvyai") -> AuditLogger:
    """Get or create the global audit logger."""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger(service_name=service_name)
    return _audit_logger
