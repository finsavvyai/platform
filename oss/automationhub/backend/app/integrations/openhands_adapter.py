"""
OpenHands Cloud API adapter for the DevelopmentAgent.

Uses ExternalAgentAdapter interface; circuit breaker and rate limit applied by caller or here.
Keep file under 200 lines.
"""

import logging
import time
from typing import Any, Dict, Optional

import httpx

from app.core.integrations_config import get_openhands_settings
from app.integrations.base import AdapterResult, AdapterStatus, ExternalAgentAdapter
from app.integrations.resilience import CircuitBreaker, IntegrationRateLimiter

logger = logging.getLogger(__name__)

OPENHANDS_CIRCUIT = CircuitBreaker("openhands", failure_threshold=5, cooldown_seconds=60.0)
OPENHANDS_RATE_LIMITER = IntegrationRateLimiter("openhands", max_requests=30, window_seconds=3600)


class OpenHandsAdapter(ExternalAgentAdapter):
    """OpenHands Cloud API adapter. Requires OPENHANDS_ENABLED and OPENHANDS_API_KEY."""

    def __init__(self):
        self._settings = get_openhands_settings()
        self._client: Optional[httpx.AsyncClient] = None
        self._base = (self._settings.API_URL or "").rstrip("/")

    @property
    def name(self) -> str:
        return "openhands"

    def is_available(self) -> bool:
        return bool(
            self._settings.ENABLED
            and self._settings.API_KEY
            and self._settings.MODE == "cloud"
        )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base,
                timeout=httpx.Timeout(self._settings.MAX_DURATION_SECONDS + 30),
                headers={"Authorization": f"Bearer {self._settings.API_KEY}"},
            )
        return self._client

    async def submit_task(
        self,
        task_payload: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        tenant_id = (context or {}).get("tenant_id", "default")
        await OPENHANDS_RATE_LIMITER.check_and_raise(f"tenant:{tenant_id}")
        client = await self._get_client()
        payload = {
            "initial_user_msg": task_payload.get("prompt", task_payload.get("message", "")),
            "repository": task_payload.get("repository"),
        }
        if task_payload.get("workspace_path"):
            payload["workspace_path"] = task_payload["workspace_path"]

        async def _post():
            r = await client.post("/api/conversations", json=payload)
            r.raise_for_status()
            data = r.json()
            return data.get("id") or data.get("conversation_id") or str(data)

        try:
            external_id = await OPENHANDS_CIRCUIT.call(_post)
            logger.info("OpenHands task submitted external_id=%s", external_id)
            return str(external_id)
        except Exception as e:
            logger.exception("OpenHands submit_task failed")
            raise

    async def get_status(self, external_task_id: str) -> AdapterStatus:
        client = await self._get_client()
        try:
            r = await client.get(f"/api/conversations/{external_task_id}")
            r.raise_for_status()
            data = r.json()
            s = (data.get("status") or data.get("state") or "").lower()
            if s in ("completed", "done", "success"):
                return AdapterStatus.COMPLETED
            if s in ("failed", "error"):
                return AdapterStatus.FAILED
            if s in ("cancelled", "canceled"):
                return AdapterStatus.CANCELLED
            return AdapterStatus.RUNNING
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return AdapterStatus.FAILED
            raise
        except Exception:
            return AdapterStatus.FAILED

    async def get_result(self, external_task_id: str) -> AdapterResult:
        start = time.monotonic()
        status = await self.get_status(external_task_id)
        duration_ms = int((time.monotonic() - start) * 1000)
        client = await self._get_client()
        r = await client.get(f"/api/conversations/{external_task_id}")
        r.raise_for_status()
        data = r.json()
        result = data.get("result") or data.get("output") or data
        error = data.get("error") if status == AdapterStatus.FAILED else None
        return AdapterResult(
            external_task_id=external_task_id,
            status=status,
            result=result if isinstance(result, dict) else {"raw": result},
            error=error,
            duration_ms=duration_ms,
            metadata={"response_keys": list(data.keys())},
        )

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
