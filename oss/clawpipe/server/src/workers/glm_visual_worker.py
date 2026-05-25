"""GLM-4V Multimodal Worker Node for FinSavvyAI."""

import asyncio
import logging
from functools import partial
from typing import List

import aiohttp
from aiohttp import web

from src.workers.glm_visual_service import GLMVisualService
from src.workers.glm_visual_routes import (
    handle_analyze_image,
    handle_completion,
    handle_health,
    handle_models,
    handle_upload_image,
    handle_vision_completion,
)

try:
    import torch
except ImportError:
    torch = None

logger = logging.getLogger("finsavvyai.glm_visual")


class GLMVisualWorkerNode:
    """Multimodal worker node with GLM-4V capabilities."""

    def __init__(
        self, node_id: str, name: str, host: str, port: int,
        models: List[str], master_host: str = "localhost", master_port: int = 8000,
    ) -> None:
        self.node_id = node_id
        self.name = name
        self.host = host
        self.port = port
        self.models = models
        self.master_url = f"http://{master_host}:{master_port}"
        self.session: aiohttp.ClientSession | None = None
        self.heartbeat_task: asyncio.Task | None = None
        self.glm_service = GLMVisualService()

    async def start(self) -> None:
        """Start the GLM-4V worker node."""
        self.session = aiohttp.ClientSession()
        await self.glm_service.load_model()
        await asyncio.sleep(1)
        await self._register_with_master()
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        await self._start_server()
        logger.info("GLM-4V Worker started: %s on %s:%d", self.name, self.host, self.port)

    async def _register_with_master(self) -> None:
        """Register this multimodal node with the cluster master."""
        data = {
            "id": self.node_id, "name": self.name,
            "host": self.host, "port": self.port, "models": self.models,
            "capabilities": {
                "gpu": torch.backends.mps.is_available() if torch else False,
                "device": self.glm_service.device,
                "model_loaded": self.glm_service.loaded,
                "supports_images": True, "supports_vision": True,
                "vision_model": "glm-4v-9b",
            },
            "max_load": 2,
        }
        try:
            async with self.session.post(f"{self.master_url}/cluster/join", json=data) as resp:
                result = await resp.json()
                if result.get("status") == "registered":
                    logger.info("%s registered with cluster master", self.name)
                else:
                    logger.error("Failed to register: %s", result)
        except Exception as e:
            logger.error("%s cannot connect to cluster master: %s", self.name, e)

    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeat to master."""
        while True:
            try:
                data = {"id": self.node_id, "status": "online", "load": 1}
                async with self.session.post(
                    f"{self.master_url}/cluster/heartbeat", json=data
                ) as resp:
                    pass  # noqa: WPS420
            except Exception as e:
                logger.error("%s heartbeat error: %s", self.name, e)
            await asyncio.sleep(30)

    async def _start_server(self) -> None:
        """Start multimodal server with vision endpoints."""
        app = web.Application()
        w = self
        app.router.add_post("/v1/chat/completions", partial(handle_completion, worker=w))
        app.router.add_post("/v1/chat/completions/vision", partial(handle_vision_completion, worker=w))
        app.router.add_post("/v1/analyze-image", partial(handle_analyze_image, worker=w))
        app.router.add_get("/v1/models", partial(handle_models, worker=w))
        app.router.add_get("/health", partial(handle_health, worker=w))
        app.router.add_post("/upload-image", handle_upload_image)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        logger.info("Multimodal server running on http://%s:%d", self.host, self.port)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        worker = GLMVisualWorkerNode(
            node_id="glm-vision-01", name="GLM-4V Vision Worker",
            host="0.0.0.0", port=8002, models=["glm-4v-9b", "gpt-3.5-turbo-sim"],
        )
        asyncio.run(worker.start())
    except KeyboardInterrupt:
        logger.info("GLM-4V Multimodal Worker stopped")
