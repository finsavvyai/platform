"""FinSavvyAI API Gateway entry point."""

import asyncio
import signal
import time
from datetime import datetime

from aiohttp import web

from src.api.gateway_providers import build_request_queue, create_session
from src.api.gateway_routes import register_gateway_routes
from src.api.gateway_startup import main  # noqa: F401
from src.api.middleware.cors import cors_middleware_factory
from src.api.middleware.rate_limit import rate_limit_middleware_factory
from src.api.middleware.request_tracking import request_tracking_middleware_factory
from src.api.middleware.security_headers import security_headers_middleware_factory
from src.api.routes.agent_decision import handle_agent_decision_for_gateway
from src.api.routes.chat import handle_chat_completions_for_gateway
from src.api.routes.governance import evaluate_openhands_governance, infer_openhands_action
from src.api.routes.openclaw import (
    make_openclaw_wrapper_handler,
    normalize_openclaw_wrapper_payload,
)
from src.api.versioning import version_middleware_factory
from src.core.circuit_breaker import CircuitBreaker
from src.core.config import ClusterConfig
from src.core.logger import get_logger
from src.core.rate_limiter import RateLimiter

try:
    from src.core.multi_layer_router import IntelligentRouter
except ImportError:
    IntelligentRouter = None

# Re-export provider names so existing patches (src.api.gateway.X) still work
try:
    from src.core.provider_registry import get_registry as get_provider_registry  # noqa: F401
    from src.providers.anthropic_provider import AnthropicProvider  # noqa: F401
    from src.providers.lmstudio_provider import LMStudioProvider  # noqa: F401
    from src.providers.ollama_provider import OllamaProvider  # noqa: F401
    from src.providers.openai_provider import OpenAIProvider  # noqa: F401
    from src.providers.openhands_provider import OpenHandsProvider  # noqa: F401

    CLOUD_PROVIDERS_AVAILABLE = True
except ImportError:
    CLOUD_PROVIDERS_AVAILABLE = False

logger = get_logger()


class APIGateway:
    """API Gateway for routing requests to workers and cloud providers."""

    def __init__(self, master_host: str = "localhost", master_port: int = 8000):
        self.master_url = f"http://{master_host}:{master_port}"
        self.config = ClusterConfig()
        self.router = IntelligentRouter() if IntelligentRouter else None
        self.session = None
        self.start_time = datetime.now()
        self.request_count = 0
        self.error_count = 0
        self._models_cache, self._models_cache_time, self._models_cache_ttl = None, 0.0, 15
        self._auth_cache: dict[str, float] = {}
        self._auth_cache_ttl: int = 300
        self._auth_cache_max: int = 1024
        self.max_request_size = self.config.get("api.max_request_size", 10 * 1024 * 1024)
        self.circuit_breakers: dict[str, CircuitBreaker] = {}
        self._openclaw_wrapper = None
        self.rate_limiter = RateLimiter(
            max_requests=self.config.get("api.rate_limit_requests", 100),
            window_seconds=self.config.get("api.rate_limit_window", 60),
        )
        self.request_queue = self._build_request_queue()
        self.provider_registry = self._build_provider_registry()

    def _build_request_queue(self):
        return build_request_queue(self.config)

    def _build_provider_registry(self):
        if not CLOUD_PROVIDERS_AVAILABLE:
            return None
        import os

        registry = get_provider_registry()
        if os.getenv("OPENAI_API_KEY"):
            registry.register("openai", OpenAIProvider())
        if os.getenv("ANTHROPIC_API_KEY"):
            registry.register("anthropic", AnthropicProvider())
        registry.register("ollama", OllamaProvider())
        registry.register("lmstudio", LMStudioProvider())
        if os.getenv("OPENHANDS_ENABLED", "false").lower() == "true" or os.getenv(
            "OPENHANDS_BASE_URL"
        ):
            registry.register("openhands", OpenHandsProvider())
        return registry

    async def _create_session(self):
        await create_session(self, self.config)

    def build_app(self):
        app = web.Application()
        app["gateway"] = self
        app.middlewares.extend(
            [
                request_tracking_middleware_factory(self.max_request_size),
                cors_middleware_factory(),
                security_headers_middleware_factory(),
                rate_limit_middleware_factory(self.rate_limiter, self.config),
                version_middleware_factory(),
            ]
        )
        register_gateway_routes(app, self)
        return app

    def _evict_auth_cache(self) -> None:
        """Remove expired entries; if still over max capacity, drop oldest half."""
        now = time.monotonic()
        expired = [k for k, exp in self._auth_cache.items() if now >= exp]
        for k in expired:
            self._auth_cache.pop(k, None)
        if len(self._auth_cache) > self._auth_cache_max:
            excess = sorted(self._auth_cache.items(), key=lambda kv: kv[1])
            for k, _ in excess[: len(excess) // 2]:
                self._auth_cache.pop(k, None)

    async def start(self, host: str = "0.0.0.0", port: int = 8080):
        await self._create_session()
        app = self.build_app()
        try:
            from src.dashboard.server import setup_dashboard_routes

            setup_dashboard_routes(app)
        except ImportError:
            logger.debug("Dashboard module unavailable; skipping mount")
        runner = web.AppRunner(app)
        await runner.setup()
        await web.TCPSite(runner, host, port).start()
        logger.info(f"API Gateway started on http://{host}:{port}")

        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                loop.add_signal_handler(sig, stop_event.set)
            except NotImplementedError:
                pass

        try:
            while not stop_event.is_set():
                await asyncio.sleep(1)
                self._evict_auth_cache()
        finally:
            logger.info("Gateway shutting down gracefully\u2026")
            await runner.cleanup()
            if self.session:
                await self.session.close()
            logger.info("Gateway stopped.")

    @staticmethod
    def _normalize_openclaw_wrapper_payload(payload):
        return normalize_openclaw_wrapper_payload(payload)

    def _infer_openhands_action(self, data, messages):
        return infer_openhands_action(data, messages)

    def _evaluate_openhands_governance(self, data, messages, request_id):
        return evaluate_openhands_governance(data, messages, request_id)

    async def _handle_chat_completions(self, request):
        return await handle_chat_completions_for_gateway(self, request)

    async def _handle_agent_decision(self, request):
        return await handle_agent_decision_for_gateway(self, request)

    async def _handle_openclaw_wrapper(self, request):
        if self._openclaw_wrapper is None:
            self._openclaw_wrapper = make_openclaw_wrapper_handler(self._handle_chat_completions)
        return await self._openclaw_wrapper(request)


if __name__ == "__main__":
    asyncio.run(main())
