#!/usr/bin/env python3
"""OpenCLaw Client - thin orchestrator composing vision and streaming mixins."""

import logging
from typing import Any, Dict, Optional

import aiohttp

from src.core.openclaw_streaming import OpenCLawStreamingMixin
from src.core.openclaw_vision import OpenCLawVisionMixin

logger = logging.getLogger("finsavvyai.openclaw")


class OpenCLawClient(OpenCLawVisionMixin, OpenCLawStreamingMixin):
    """
    Async client for OpenCLaw API.

    Provides:
    - Health check
    - Text completion and chat completions
    - Vision/multimodal completions with image support (via OpenCLawVisionMixin)
    - Streaming chat and vision (via OpenCLawStreamingMixin)
    """

    # Maximum image size in bytes (10MB default)
    MAX_IMAGE_SIZE = 10 * 1024 * 1024

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        timeout: int = 30,
        api_key: Optional[str] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.api_key = api_key
        self._session: Optional[aiohttp.ClientSession] = None
        self._available: Optional[bool] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create the HTTP session."""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=10,
                limit_per_host=5,
                ttl_dns_cache=300,
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=self.timeout,
            )
        return self._session

    def _get_headers(self) -> Dict[str, str]:
        """Build request headers."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key

        return headers

    async def is_available(self, timeout: int = 5) -> bool:
        """Check if OpenCLaw service is available."""
        if self._available is not None:
            return self._available

        try:
            session = await self._get_session()
            health_timeout = aiohttp.ClientTimeout(total=timeout)
            async with session.get(
                f"{self.base_url}/health",
                timeout=health_timeout,
            ) as response:
                self._available = response.status == 200
                if self._available:
                    logger.info("OpenCLaw service is available")
                else:
                    logger.warning(
                        "OpenCLaw health check failed",
                        status=response.status,
                    )
                return self._available

        except Exception as e:
            logger.warning(f"OpenCLaw unavailable: {e}")
            self._available = False
            return False

    def _extract_text_result(self, result: Any) -> Dict[str, Any]:
        """Extract text from common OpenCLaw response formats."""
        if isinstance(result, dict):
            if "text" in result:
                return result
            if "choices" in result and len(result["choices"]) > 0:
                choice = result["choices"][0]
                # Chat completion format
                message = choice.get("message", {})
                if message:
                    return {"text": message.get("content", "")}
                # Plain completion format
                if "text" in choice:
                    return {"text": choice["text"]}
        return result

    async def complete(
        self,
        prompt: str,
        model: str = "default",
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> Dict[str, Any]:
        """Send a completion request to OpenCLaw."""
        session = await self._get_session()

        payload = {
            "model": model,
            "prompt": prompt,
            "max_tokens": max_tokens,
            "stream": False,
        }

        logger.debug(
            "OpenCLaw completion request",
            model=model,
            prompt_len=len(prompt),
        )

        try:
            async with session.post(
                f"{self.base_url}/v1/completions",
                json=payload,
                headers=self._get_headers(),
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info("OpenCLaw completion successful")
                    return self._extract_text_result(result)
                else:
                    error_text = await response.text()
                    logger.error(
                        "OpenCLaw completion failed",
                        status=response.status,
                        error=error_text[:200],
                    )
                    return {
                        "error": f"OpenCLaw returned {response.status}",
                        "status": "desktop_app_error",
                        "details": error_text,
                    }

        except Exception as e:
            logger.error(f"OpenCLaw request error: {e}")
            return {
                "error": "Failed to connect to OpenCLaw",
                "status": "status_code_500",
                "reason": str(e),
            }

    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._available = False
            logger.info("OpenCLaw client session closed")


# Singleton instance
_openclaw_client: Optional[OpenCLawClient] = None


def get_openclaw_client() -> Optional[OpenCLawClient]:
    """Get or create the OpenCLaw client singleton."""
    global _openclaw_client

    import os

    enabled = os.environ.get("OPENCLAW_ENABLED", "false").lower() == "true"
    url = os.environ.get("OPENCLAW_URL", "http://localhost:11434")
    api_key = os.environ.get("OPENCLAW_API_KEY")

    if not enabled:
        return None

    if _openclaw_client is None:
        _openclaw_client = OpenCLawClient(
            base_url=url,
            api_key=api_key,
        )
        logger.info("OpenCLaw client created", url=url)

    return _openclaw_client
