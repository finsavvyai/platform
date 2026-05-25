"""Claw Gateway connector — registers with central proxy and routes through it."""

import hashlib
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import aiohttp

logger = logging.getLogger("finsavvyai.claw_gateway")

GATEWAY_URL = os.environ.get(
    "CLAW_GATEWAY_URL", "https://claw-gateway.workers.dev"
)
SERVICE_ID = "finsavvyai-llm"
SERVICE_VERSION = "5.0.0"


class ClawGatewayClient:
    """Connects FinSavvyAI to the shared Claw Gateway infrastructure."""

    def __init__(
        self,
        gateway_url: str = GATEWAY_URL,
        api_key: Optional[str] = None,
    ) -> None:
        self.gateway_url = gateway_url.rstrip("/")
        self.api_key = api_key or os.environ.get("CLAW_GATEWAY_KEY", "")
        self._session: Optional[aiohttp.ClientSession] = None
        self._registered = False
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = 300  # 5 minutes

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "X-Service-Id": SERVICE_ID,
                    "X-Service-Version": SERVICE_VERSION,
                },
            )
        return self._session

    async def register(self, local_endpoint: str) -> bool:
        """Register this FinSavvyAI instance with the Claw Gateway."""
        session = await self._get_session()
        payload = {
            "service_id": SERVICE_ID,
            "version": SERVICE_VERSION,
            "endpoint": local_endpoint,
            "capabilities": [
                "chat_completions",
                "embeddings",
                "models",
                "streaming",
                "vision",
                "governance",
            ],
            "providers": ["openai", "anthropic", "ollama", "lmstudio"],
            "features": {
                "reasoning_bank": True,
                "context_packing": True,
                "smart_router": True,
            },
        }

        try:
            async with session.post(
                f"{self.gateway_url}/v1/services/register",
                json=payload,
            ) as resp:
                if resp.status in (200, 201):
                    self._registered = True
                    logger.info("Registered with Claw Gateway at %s", self.gateway_url)
                    return True
                logger.warning("Gateway registration failed: status=%d", resp.status)
                return False
        except Exception as e:
            logger.warning(f"Could not reach Claw Gateway: {e}")
            return False

    async def proxy_request(
        self,
        path: str,
        method: str = "POST",
        body: Optional[Dict] = None,
    ) -> Optional[Dict[str, Any]]:
        """Proxy a request through the Claw Gateway for shared caching."""
        session = await self._get_session()
        try:
            async with session.request(
                method,
                f"{self.gateway_url}{path}",
                json=body,
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except Exception as e:
            logger.debug(f"Gateway proxy failed, falling back to direct: {e}")
            return None

    @property
    def is_registered(self) -> bool:
        return self._registered

    async def heartbeat(self) -> bool:
        """Send heartbeat to keep registration alive."""
        session = await self._get_session()
        try:
            async with session.post(
                f"{self.gateway_url}/v1/services/{SERVICE_ID}/heartbeat",
            ) as resp:
                return resp.status == 200
        except Exception:
            return False

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()


# Singleton
_client: Optional[ClawGatewayClient] = None


def get_claw_gateway() -> Optional[ClawGatewayClient]:
    """Get or create the Claw Gateway client."""
    global _client
    enabled = os.environ.get("CLAW_GATEWAY_ENABLED", "false").lower() == "true"
    if not enabled:
        return None
    if _client is None:
        _client = ClawGatewayClient()
        logger.info("Claw Gateway client created: %s", GATEWAY_URL)
    return _client
