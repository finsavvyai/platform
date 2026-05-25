"""
Unified interface for external agent frameworks (OpenHands, OpenClaw tools, etc.).

Enables circuit breaker, timeouts, retries, and audit without duplicating logic.
Keep this file under 200 lines; add concrete adapters in separate modules.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional


class AdapterStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


@dataclass
class AdapterResult:
    """Result from an external agent adapter."""
    external_task_id: str
    status: AdapterStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration_ms: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class ExternalAgentAdapter(ABC):
    """
    Interface for external agent frameworks (OpenHands, OpenClaw tool execution, etc.).
    Implementations should use circuit breaker, timeouts, and audit logging.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Integration name for health checks and audit logs."""
        ...

    def is_available(self) -> bool:
        """Override to check config/feature flag; default True."""
        return True

    @abstractmethod
    async def submit_task(
        self,
        task_payload: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Submit task to external system.
        Returns external task_id for status/result polling.
        """
        ...

    @abstractmethod
    async def get_status(self, external_task_id: str) -> AdapterStatus:
        """Return current status of the external task."""
        ...

    @abstractmethod
    async def get_result(self, external_task_id: str) -> AdapterResult:
        """Return full result; may raise if not ready or failed."""
        ...

    async def cancel(self, external_task_id: str) -> bool:
        """Cancel running task. Override if supported."""
        return False


__all__ = ["ExternalAgentAdapter", "AdapterResult", "AdapterStatus"]
