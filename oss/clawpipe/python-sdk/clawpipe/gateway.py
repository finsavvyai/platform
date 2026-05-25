"""Gateway -- HTTP client for the ClawPipe gateway API.

Handles prompt dispatch and streaming to the remote gateway.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, AsyncIterator

import httpx

from .types import GatewayResponse, RouteDecision


@dataclass
class GatewayConfig:
    """Gateway connection config."""

    gateway_url: str
    api_key: str
    project_id: str


class GatewayError(Exception):
    """Error from the ClawPipe gateway."""

    def __init__(self, status_code: int, body: str = "") -> None:
        detail = f" -- {body[:200]}" if body else ""
        super().__init__(f"ClawPipe gateway error: {status_code}{detail}")
        self.status_code = status_code
        self.response_body = body


class Gateway:
    """HTTP client for the ClawPipe gateway."""

    def __init__(self, config: GatewayConfig) -> None:
        self._config = config

    async def call(
        self,
        prompt: str,
        options: dict[str, Any],
        route: RouteDecision,
    ) -> GatewayResponse:
        """Send a prompt to the gateway and return the response."""
        url = f"{self._config.gateway_url}/prompt"
        payload = {
            "prompt": prompt,
            **options,
            "provider": route.provider,
            "model": route.model,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                json=payload,
                headers=self._build_headers(),
                timeout=60.0,
            )
        if resp.status_code >= 400:
            raise GatewayError(resp.status_code, resp.text)
        return GatewayResponse(**resp.json())

    async def stream(
        self,
        prompt: str,
        options: dict[str, Any],
        route: RouteDecision,
    ) -> AsyncIterator[str]:
        """Stream a prompt through the gateway. Yields text chunks."""
        url = f"{self._config.gateway_url}/stream"
        payload = {
            "prompt": prompt,
            **options,
            "provider": route.provider,
            "model": route.model,
        }
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                url,
                json=payload,
                headers=self._build_headers(),
                timeout=60.0,
            ) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise GatewayError(resp.status_code, body.decode())
                async for chunk in resp.aiter_text():
                    yield chunk

    def _build_headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._config.api_key}",
            "X-Project-Id": self._config.project_id,
        }
