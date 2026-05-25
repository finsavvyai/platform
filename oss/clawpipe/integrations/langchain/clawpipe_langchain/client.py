"""HTTP client for the ClawPipe gateway."""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

DEFAULT_GATEWAY_URL = "https://api.clawpipe.ai"
DEFAULT_TIMEOUT = 120.0


class ClawPipeClient:
    """Thin HTTP wrapper around the ClawPipe gateway API."""

    def __init__(
        self,
        api_key: str,
        project_id: str,
        gateway_url: str = DEFAULT_GATEWAY_URL,
        timeout: float = DEFAULT_TIMEOUT,
        enable_booster: bool = True,
        enable_cache: bool = True,
    ) -> None:
        self.api_key = api_key
        self.project_id = project_id
        self.gateway_url = gateway_url.rstrip("/")
        self.timeout = timeout
        self.enable_booster = enable_booster
        self.enable_cache = enable_cache

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "X-Project-Id": self.project_id,
            "Content-Type": "application/json",
        }

    def _build_body(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        stop: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {"prompt": prompt}
        if system is not None:
            body["system"] = system
        if provider is not None:
            body["provider"] = provider
        if model is not None:
            body["model"] = model
        if max_tokens is not None:
            body["maxTokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
        if stop is not None:
            body["stop"] = stop
        body["enableBooster"] = self.enable_booster
        body["enableCache"] = self.enable_cache
        return body

    def prompt(
        self,
        prompt: str,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Send a synchronous prompt request to the gateway."""
        body = self._build_body(prompt, **kwargs)
        url = f"{self.gateway_url}/v1/prompt"
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=body, headers=self._headers())
            response.raise_for_status()
            return response.json()

    async def aprompt(
        self,
        prompt: str,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Send an async prompt request to the gateway."""
        body = self._build_body(prompt, **kwargs)
        url = f"{self.gateway_url}/v1/prompt"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url, json=body, headers=self._headers()
            )
            response.raise_for_status()
            return response.json()
