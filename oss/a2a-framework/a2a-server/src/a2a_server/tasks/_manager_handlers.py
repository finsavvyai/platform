"""
a2a_server.tasks._manager_handlers
==================================
Handler-registry mixin for :class:`TaskManager`.
"""
from __future__ import annotations

import logging
from typing import Dict

from a2a_server.tasks.task_handler import TaskHandler

logger = logging.getLogger(__name__)


class HandlerRegistryMixin:
    """Handler registration and resolution for the task manager."""

    def register_handler(self, handler: TaskHandler, *, default: bool = False) -> None:
        self._handlers[handler.name] = handler
        if default or self._default_handler is None:
            self._default_handler = handler.name
        logger.debug("Registered handler %s%s", handler.name, " (default)" if default else "")

    def _resolve_handler(self, name: str | None) -> TaskHandler:
        if name is None:
            if self._default_handler is None:
                raise ValueError("No default handler registered")
            return self._handlers[self._default_handler]
        return self._handlers[name]

    def get_handler(self, name: str | None = None) -> TaskHandler:
        return self._resolve_handler(name)

    def get_handlers(self) -> Dict[str, str]:
        return {n: n for n in self._handlers}

    def get_default_handler(self) -> str | None:
        return self._default_handler
