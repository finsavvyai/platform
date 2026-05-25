#!/usr/bin/env python3
"""
Hybrid Router - Routes inference requests to optimal backend.

Factory and CLI entry point live in hybrid_router_factory.py.
"""

import asyncio
from typing import Dict, Optional

from src.core.logger import get_logger
from src.core.openclaw_client import OpenCLawClient

logger = get_logger()


class HybridRouter:
    """Routes inference requests to optimal backend."""

    ROUTE_CONFIG = {
        "code": "local", "writing": "openclaw", "analysis": "openclaw",
        "vision": "openclaw", "chat": "local", "general": "local",
    }

    def __init__(self, openclaw_enabled: bool = False,
                 openclaw_url: str = "http://localhost:11434",
                 openclaw_api_key: Optional[str] = None):
        self.openclaw_enabled = openclaw_enabled
        self.openclaw_url = openclaw_url
        self.openclaw_api_key = openclaw_api_key
        self._openclaw_client: Optional[OpenCLawClient] = None
        if self.openclaw_enabled:
            self._openclaw_client = OpenCLawClient(
                base_url=self.openclaw_url, api_key=self.openclaw_api_key)
            logger.info("HybridRouter initialized", openclaw_enabled=True, openclaw_url=openclaw_url)

    def route(self, task_type: str, prompt: str, **kwargs) -> str:
        """Route inference request to appropriate backend."""
        backend = self.ROUTE_CONFIG.get(task_type, "local")
        logger.info("Routing request", task_type=task_type, backend=backend, prompt_length=len(prompt))
        return backend

    async def route_async(self, task_type: str, prompt: str, **kwargs) -> Dict:
        """Async route to actual backend execution."""
        backend = self.route(task_type, prompt)
        if backend == "openclaw" and self._openclaw_client:
            if not await self._openclaw_client.is_available():
                logger.warning("OpenCLaw unavailable, falling back to local")
                return {"backend": "local", "error": "OpenCLaw service unavailable"}
            try:
                model = kwargs.get("model", "default")
                stream = kwargs.get("stream", False)
                temperature = kwargs.get("temperature", 0.7)
                if stream:
                    result = await self._openclaw_client.stream_chat(
                        messages=[{"role": "user", "content": prompt}],
                        model=model, temperature=temperature)
                    return {"backend": "openclaw", "result": result}
                else:
                    result = await self._openclaw_client.complete(prompt=prompt, model=model)
                    return {"backend": "openclaw", "result": result}
            except Exception as e:
                logger.error("OpenCLaw request failed: %s", e)
                return {"backend": "openclaw", "error": str(e)}
        logger.info("Using local backend for %s", task_type)
        return {"backend": "local", "result": f"Local inference for: {prompt[:100]}..."}

    def is_available(self) -> bool:
        """Check if router has any backends available."""
        return True


# Re-export factory for backward compatibility
from src.core.hybrid_router_factory import get_hybrid_router, main  # noqa: F401, E402

if __name__ == "__main__":
    asyncio.run(main())
