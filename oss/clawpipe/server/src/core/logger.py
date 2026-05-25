#!/usr/bin/env python3
"""
FinSavvyAI Structured Logging System

Provides JSON-structured logging with correlation ID propagation,
service context, and configurable output to console and file.

Formatters live in logger_formatters.py.
"""

import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from src.core.logger_formatters import (  # noqa: F401
    ConsoleFormatter,
    StructuredJsonFormatter,
    correlation_id_var,
    get_correlation_id,
    set_correlation_id,
)


class FinSavvyLogger:
    """Centralized structured logger for FinSavvyAI services."""

    def __init__(self, name: str = "finsavvyai", level: str = "INFO",
                 log_file: Optional[str] = None, console: bool = True,
                 service: Optional[str] = None):
        self.name = name
        self.service = service or name
        self.level = getattr(logging, level.upper(), logging.INFO)

        self.logger = logging.getLogger(name)
        self.logger.setLevel(self.level)
        self.logger.handlers = []
        self.logger.propagate = False

        if console:
            ch = logging.StreamHandler(sys.stderr)
            ch.setLevel(self.level)
            ch.setFormatter(ConsoleFormatter(service=self.service))
            self.logger.addHandler(ch)

        if log_file:
            log_dir = Path(log_file).parent
            log_dir.mkdir(parents=True, exist_ok=True)
            fh = logging.FileHandler(log_file)
            fh.setLevel(self.level)
            fh.setFormatter(StructuredJsonFormatter(service=self.service))
            self.logger.addHandler(fh)

    def info(self, message: str, **kwargs: Any) -> None:
        self._emit(logging.INFO, message, kwargs)

    def error(self, message: str, **kwargs: Any) -> None:
        self._emit(logging.ERROR, message, kwargs)

    def warning(self, message: str, **kwargs: Any) -> None:
        self._emit(logging.WARNING, message, kwargs)

    def debug(self, message: str, **kwargs: Any) -> None:
        self._emit(logging.DEBUG, message, kwargs)

    def _emit(self, level: int, message: str, extra: Dict[str, Any]) -> None:
        """Emit a log record with structured extras attached."""
        if not self.logger.isEnabledFor(level):
            return
        record = self.logger.makeRecord(
            self.name, level, "(unknown)", 0, message, (), None)
        record._structured_extra = extra if extra else None
        try:
            frame = sys._getframe(2)
            record.pathname = frame.f_code.co_filename
            record.lineno = frame.f_lineno
            record.funcName = frame.f_code.co_name
            record.module = os.path.splitext(os.path.basename(frame.f_code.co_filename))[0]
        except (ValueError, AttributeError):
            pass
        self.logger.handle(record)


# Global logger management
_loggers: Dict[str, FinSavvyLogger] = {}


def get_logger(name: str = "finsavvyai", level: str = "INFO",
               log_file: Optional[str] = None, console: bool = True,
               service: Optional[str] = None) -> FinSavvyLogger:
    """Get or create a named logger instance."""
    if name in _loggers:
        return _loggers[name]
    logger = FinSavvyLogger(name=name, level=level, log_file=log_file,
                            console=console, service=service or name)
    _loggers[name] = logger
    return logger
