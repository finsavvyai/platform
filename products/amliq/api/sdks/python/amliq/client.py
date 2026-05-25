"""AMLIQ API client with sync and async support."""

from __future__ import annotations

import httpx
from typing import Optional

from amliq.models import ScreenRequest, ScreenResponse, AlertsResponse
from amliq.errors import AMLIQError, AuthError, RateLimitError


class AMLIQClient:
    """Synchronous AMLIQ API client."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.amliq.io/api/v1",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=timeout,
        )

    def screen(self, request: ScreenRequest) -> ScreenResponse:
        """Screen a single entity against sanctions lists."""
        resp = self._post("/screen", request.model_dump(exclude_none=True))
        return ScreenResponse(**resp)

    def screen_fast(self, name: str) -> dict:
        """Fast sub-10ms payment screening (Exact + Fuzzy only)."""
        resp = self._post("/screen/fast", {"name": name})
        return resp

    def list_alerts(self) -> AlertsResponse:
        """List all alerts for the authenticated tenant."""
        resp = self._get("/alerts")
        return AlertsResponse(**resp)

    def resolve_alert(self, alert_id: str, resolution: str, justification: str = "") -> None:
        """Resolve an alert with a disposition."""
        self._put(f"/alerts/{alert_id}/resolve", {
            "resolution": resolution,
            "justification": justification,
        })

    def get_config(self) -> dict:
        """Get tenant screening configuration."""
        return self._get("/config")

    def billing_health(self) -> dict:
        """Check billing system status."""
        return self._get("/billing/health")

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def _get(self, path: str) -> dict:
        return self._handle(self._client.get(self.base_url + path))

    def _post(self, path: str, data: dict) -> dict:
        return self._handle(self._client.post(self.base_url + path, json=data))

    def _put(self, path: str, data: dict) -> dict:
        return self._handle(self._client.put(self.base_url + path, json=data))

    def _handle(self, resp: httpx.Response) -> dict:
        if resp.status_code == 401:
            raise AuthError("Invalid API key")
        if resp.status_code == 429:
            raise RateLimitError("Rate limit exceeded")
        if resp.status_code >= 400:
            body = resp.json() if resp.content else {}
            raise AMLIQError(body.get("message", f"HTTP {resp.status_code}"))
        return resp.json()
