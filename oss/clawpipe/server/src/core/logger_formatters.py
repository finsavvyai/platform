#!/usr/bin/env python3
"""
FinSavvyAI Log Formatters

JSON and console formatters for structured logging.
"""

import contextvars
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Context variable for correlation / request ID propagation
correlation_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)


def set_correlation_id(cid: str) -> None:
    """Set the correlation ID for the current async/thread context."""
    correlation_id_var.set(cid)


def get_correlation_id() -> Optional[str]:
    """Get the correlation ID for the current context."""
    return correlation_id_var.get()


class StructuredJsonFormatter(logging.Formatter):
    """Produces one JSON object per log line with standard fields."""

    def __init__(self, service: str = "finsavvyai"):
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        cid = correlation_id_var.get()
        if cid:
            log_entry["correlation_id"] = cid
        extra = getattr(record, "_structured_extra", None)
        if extra and isinstance(extra, dict):
            log_entry.update(extra)
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)


class ConsoleFormatter(logging.Formatter):
    """Human-readable console format with optional correlation ID."""

    COLORS = {
        "DEBUG": "\033[36m", "INFO": "\033[32m",
        "WARNING": "\033[33m", "ERROR": "\033[31m", "CRITICAL": "\033[35m",
    }
    RESET = "\033[0m"

    def __init__(self, service: str = "finsavvyai", use_color: bool = True):
        super().__init__()
        self.service = service
        self.use_color = use_color and sys.stderr.isatty()

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        level = record.levelname
        cid = correlation_id_var.get()
        if self.use_color:
            color = self.COLORS.get(level, "")
            level_str = f"{color}{level:8s}{self.RESET}"
        else:
            level_str = f"{level:8s}"
        parts = [f"{ts} {level_str} [{self.service}]"]
        if cid:
            parts.append(f"[{cid}]")
        parts.append(record.getMessage())
        extra = getattr(record, "_structured_extra", None)
        if extra:
            kv = " | ".join(f"{k}={v}" for k, v in extra.items())
            parts.append(f"| {kv}")
        msg = " ".join(parts)
        if record.exc_info and record.exc_info[0] is not None:
            msg += "\n" + self.formatException(record.exc_info)
        return msg
