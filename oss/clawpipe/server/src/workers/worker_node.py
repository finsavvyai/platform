"""FinSavvyAI Worker Node - thin orchestrator importing route and inference modules."""

import argparse
import asyncio
import os
import socket
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiohttp
import aiohttp.web
import psutil

from src.core.config import ClusterConfig
from src.core.inference_engine import ModelConfig, get_inference_engine
from src.core.logger import get_logger
from src.core.metrics import get_metrics_collector
from src.core.openclaw_client import OpenCLawClient
from src.workers import worker_routes as wr, worker_status_routes as wsr, worker_vision_routes as wvr
from src.workers.worker_auth import worker_auth_middleware
from src.workers.worker_completion import handle_completion
from src.workers.worker_config import WorkerConfig
from src.workers.worker_init import check_gpu, get_system_info, init_channel_components, init_vision_components
from src.api.middleware.cors import cors_middleware_factory
from src.api.middleware.security_headers import security_headers_middleware_factory


class WorkerNode:
    """Worker node that runs AI processing."""

    def __init__(self, config: WorkerConfig):
        self.config = config
        self.cluster_config = ClusterConfig()
        self.session = None
        self.heartbeat_task = None
        self.request_count = 0
        self.start_time = datetime.now()
        self.status = "starting"
        self.system_info = get_system_info()
        self.engine = get_inference_engine()
        self.metrics = get_metrics_collector()
        self.logger = get_logger(
            f"worker-{config.worker_id[:8]}",
            level=self.cluster_config.log_level,
            log_file=self.cluster_config.log_file,
        )
        self.openclaw_client: Optional[OpenCLawClient] = None
        if self.config.openclaw_enabled:
            self.openclaw_client = OpenCLawClient(base_url=self.config.openclaw_url, api_key=self.config.openclaw_api_key)
        self.channel_adapter = self.webhook_receiver = None
        init_channel_components(self)
        self.vision_cache = self.vision_rate_limiter = self.image_preprocessor = None
        self.vision_pipeline = self.document_processor = None
        init_vision_components(self)

    def _get_current_load(self) -> int:
        try:
            return int(psutil.cpu_percent(interval=0.1) / 10)
        except Exception:
            return 0

    async def start(self):
        """Start the worker node."""
        self.logger.info("Starting worker node", worker_id=self.config.worker_id, port=self.config.port)
        self.session = aiohttp.ClientSession()
        self.status = "online"
        if not await self._register_with_master():
            raise Exception("Failed to register with master")
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        preload_model = os.environ.get("FINSAVVYAI_PRELOAD_MODEL")
        preload_path = os.environ.get("FINSAVVYAI_PRELOAD_MODEL_PATH")
        if preload_model and preload_path:
            asyncio.create_task(self._preload_model(preload_model, preload_path))
        await self._start_server()

    async def _register_with_master(self):
        data = {
            "id": self.config.worker_id, "name": self.config.worker_name,
            "host": socket.gethostbyname(socket.gethostname()), "port": self.config.port,
            "models": self.config.models,
            "capabilities": {
                "system": self.system_info, "gpu": check_gpu(),
                "inference_engine": self.engine.get_engine_status(), "status": self.status,
            },
            "max_load": min(10, max(1, self.system_info.get("cpu_count", 1) // 2)),
        }
        try:
            async with self.session.post(
                f"http://{self.config.master_host}:{self.config.master_port}/cluster/join", json=data,
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get("status") == "registered":
                        self.logger.info("Registered with cluster master")
                        return True
                return False
        except Exception as e:
            self.logger.warning(f"Cannot connect to cluster master: {e}")
            return False

    async def _heartbeat_loop(self):
        consecutive_failures, base_interval = 0, 30
        while True:
            try:
                loaded = self.engine.get_loaded_models()
                ready = [mid for mid, info in loaded.items() if info["status"] == "ready"]
                data = {
                    "id": self.config.worker_id, "status": self.status,
                    "load": self._get_current_load(), "request_count": self.request_count,
                    "uptime": (datetime.now() - self.start_time).total_seconds(), "loaded_models": ready,
                }
                async with self.session.post(
                    f"http://{self.config.master_host}:{self.config.master_port}/cluster/heartbeat", json=data,
                ) as response:
                    consecutive_failures = 0 if response.status == 200 else consecutive_failures + 1
            except Exception:
                consecutive_failures += 1
            await asyncio.sleep(min(base_interval * (2 ** min(consecutive_failures, 4)), 300))

    async def _preload_model(self, model_id: str, model_path: str):
        try:
            config = ModelConfig(model_path=model_path, model_id=model_id)
            await self.engine.load_model_async(config)
        except Exception as e:
            self.logger.error("Model preload error", model_id=model_id, error=str(e))

    async def _start_server(self):
        app = aiohttp.web.Application()
        app["worker"] = self

        app.middlewares.append(cors_middleware_factory())
        app.middlewares.append(worker_auth_middleware(self.cluster_config))
        app.middlewares.append(security_headers_middleware_factory())
        app.router.add_route("OPTIONS", "/{path:.*}", lambda r: aiohttp.web.Response(status=200))
        app.router.add_post("/v1/chat/completions", handle_completion)
        app.router.add_get("/v1/models", wr.handle_models)
        app.router.add_get("/health", wsr.handle_health)
        app.router.add_get("/status", wsr.handle_status)
        app.router.add_post("/models/load", wr.handle_load_model)
        app.router.add_post("/models/unload", wr.handle_unload_model)
        app.router.add_get("/models/local", wr.handle_list_local_models)
        app.router.add_get("/models/health/{model_id}", wr.handle_model_health)
        app.router.add_get("/engine/status", wr.handle_engine_status)
        app.router.add_get("/metrics", wr.handle_metrics)
        if self.webhook_receiver:
            self.webhook_receiver.register_routes(app)
        app.router.add_post("/v1/vision/pipeline", wvr.handle_vision_pipeline)
        app.router.add_post("/v1/vision/document/ocr", wvr.handle_document_ocr)
        app.router.add_post("/v1/vision/batch", wvr.handle_vision_batch)
        app.router.add_get("/v1/vision/cache/stats", wvr.handle_cache_stats)
        app.router.add_post("/v1/vision/cache/clear", wvr.handle_cache_clear)
        app.router.add_get("/v1/vision/pipelines/templates", wvr.handle_pipeline_templates)
        app.router.add_get("/", wsr.handle_root)
        runner = aiohttp.web.AppRunner(app)
        await runner.setup()
        await aiohttp.web.TCPSite(runner, self.config.host, self.config.port).start()
        self.logger.info(f"Worker server running on port {self.config.port}")


async def main():
    parser = argparse.ArgumentParser(description="FinSavvyAI Worker Node")
    parser.add_argument("--master", default=os.environ.get("FINSAVVYAI_MASTER_HOST", "localhost"), help="Master host")
    parser.add_argument("--master-port", type=int, default=int(os.environ.get("FINSAVVYAI_MASTER_PORT", "8000")), help="Master port")
    parser.add_argument("--port", type=int, help="Worker port")
    parser.add_argument("--name", help="Worker name")
    parser.add_argument("--id", help="Worker ID")
    parser.add_argument("--models", nargs="+", default=["gpt-3.5-turbo-sim"])
    parser.add_argument("--load-model", help="GGUF model file to auto-load")
    parser.add_argument("--model-id", help="Model ID for auto-loaded model")
    args = parser.parse_args()
    config = WorkerConfig(
        master_host=args.master, master_port=args.master_port,
        port=args.port, worker_name=args.name, worker_id=args.id, models=args.models,
    )
    worker = WorkerNode(config)
    try:
        await worker.start()
        if args.load_model:
            model_id = args.model_id or Path(args.load_model).stem
            mc = ModelConfig(model_id=model_id, model_path=args.load_model)
            if await worker.engine.load_model_async(mc) and model_id not in config.models:
                config.models.append(model_id)
        while True:
            await asyncio.sleep(60)
    except KeyboardInterrupt:
        if worker.heartbeat_task:
            worker.heartbeat_task.cancel()
        if worker.session:
            await worker.session.close()
        worker.status = "offline"

if __name__ == "__main__":
    asyncio.run(main())
