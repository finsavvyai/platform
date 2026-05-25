#!/usr/bin/env python3
"""
FinSavvyAI Channel Adapter.

Registers FinSavvyAI as an OpenClaw agent backend and bridges
incoming channel messages (WhatsApp, Telegram) to the cluster
completion API.

Sprint 12 — Tasks 12.1, 12.3, 12.4
"""

import logging
from typing import Any, AsyncGenerator, Dict, Optional

import aiohttp

from src.channels.channel_streaming import forward_streaming

logger = logging.getLogger("finsavvyai.channels")


class ChannelAdapter:
    """
    Bridges OpenClaw channel messages to FinSavvyAI cluster.

    Responsibilities:
    - Register with OpenClaw gateway as agent backend
    - Convert incoming channel messages to /v1/chat/completions requests
    - Stream responses back through OpenClaw delivery system
    - Map media messages to vision pipeline
    """

    def __init__(
        self,
        openclaw_url: str = "http://localhost:11434",
        cluster_url: str = "http://localhost:8001",
        api_key: Optional[str] = None,
        agent_id: str = "finsavvy-ai",
        agent_name: str = "FinSavvyAI",
    ):
        self.openclaw_url = openclaw_url.rstrip("/")
        self.cluster_url = cluster_url.rstrip("/")
        self.api_key = api_key
        self.agent_id = agent_id
        self.agent_name = agent_name
        self._session: Optional[aiohttp.ClientSession] = None
        self._registered = False

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60),
            )
        return self._session

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key
        return headers

    async def register(self) -> bool:
        """Register FinSavvyAI as an OpenClaw agent backend (Task 12.1)."""
        session = await self._get_session()
        payload = {
            "agent_id": self.agent_id,
            "name": self.agent_name,
            "description": "FinSavvyAI distributed AI cluster",
            "capabilities": ["text", "vision", "streaming", "document_ocr"],
            "webhook_url": f"{self.cluster_url}/hooks/agent",
            "supported_channels": ["whatsapp", "telegram"],
        }

        try:
            async with session.post(
                f"{self.openclaw_url}/v1/agents/register",
                json=payload,
                headers=self._get_headers(),
            ) as resp:
                if resp.status in (200, 201):
                    self._registered = True
                    logger.info(
                        "Registered with OpenClaw gateway as %s",
                        self.agent_id,
                    )
                    return True
                else:
                    text = await resp.text()
                    logger.error(
                        "Registration failed status=%d body=%s",
                        resp.status, text[:200],
                    )
                    return False
        except Exception as e:
            logger.error("Registration error: %s", e)
            return False

    @property
    def is_registered(self) -> bool:
        return self._registered

    def channel_message_to_completion(
        self, message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Convert an OpenClaw channel message to a completions request (Task 12.3)."""
        text = message.get("text", "")
        media = message.get("media") or []
        model = message.get("model", "default")

        content: Any
        if media:
            content = [{"type": "text", "text": text}]
            for item in media:
                if item.get("type") in ("image", "photo"):
                    url = item.get("url", "")
                    content.append(
                        {"type": "image_url", "image_url": {"url": url}}
                    )
        else:
            content = text

        return {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "stream": False,
        }

    async def forward_to_cluster(
        self, completion_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Forward the completion request to the local cluster worker."""
        session = await self._get_session()
        try:
            async with session.post(
                f"{self.cluster_url}/v1/chat/completions",
                json=completion_body,
                headers=self._get_headers(),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    text = await resp.text()
                    return {
                        "error": f"Cluster returned {resp.status}",
                        "details": text,
                    }
        except Exception as e:
            logger.error("Cluster forward error: %s", e)
            return {"error": str(e)}

    async def forward_streaming(
        self, completion_body: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """Forward a streaming completion request (Task 12.4)."""
        session = await self._get_session()
        async for chunk in forward_streaming(
            session, self.cluster_url, completion_body, self._get_headers()
        ):
            yield chunk

    async def deliver_response(
        self, session_id: str, channel: str, text: str
    ) -> bool:
        """Deliver a response back through the OpenClaw channel (Task 12.4)."""
        session = await self._get_session()
        payload = {
            "session_id": session_id,
            "channel": channel,
            "message": {"text": text},
            "agent_id": self.agent_id,
        }
        try:
            async with session.post(
                f"{self.openclaw_url}/v1/channels/deliver",
                json=payload,
                headers=self._get_headers(),
            ) as resp:
                if resp.status in (200, 201, 202):
                    logger.info(
                        "Delivered response to %s/%s", channel, session_id
                    )
                    return True
                else:
                    logger.error("Delivery failed status=%d", resp.status)
                    return False
        except Exception as e:
            logger.error("Delivery error: %s", e)
            return False

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("ChannelAdapter session closed")
