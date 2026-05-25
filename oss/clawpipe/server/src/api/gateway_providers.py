"""Provider registry, request queue, and session builders for the API Gateway."""

import os

import aiohttp

from src.core.config import ClusterConfig
from src.core.logger import get_logger
from src.core.request_queue import RequestQueue

try:
    from src.core.provider_registry import get_registry as get_provider_registry
    from src.providers.anthropic_provider import AnthropicProvider
    from src.providers.lmstudio_provider import LMStudioProvider
    from src.providers.ollama_provider import OllamaProvider
    from src.providers.openai_provider import OpenAIProvider
    from src.providers.openhands_provider import OpenHandsProvider

    CLOUD_PROVIDERS_AVAILABLE = True
except ImportError:
    CLOUD_PROVIDERS_AVAILABLE = False

logger = get_logger()


def build_request_queue(config: ClusterConfig):
    """Build a RequestQueue if queue is enabled in config, else return None."""
    if not config.get("api.queue_enabled", False):
        return None
    return RequestQueue(
        max_size=config.get("api.queue_max_size", 1000),
        max_concurrent=config.get("api.queue_max_concurrent", 10),
    )


def build_provider_registry():
    """Register cloud providers based on environment variables."""
    if not CLOUD_PROVIDERS_AVAILABLE:
        return None
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


async def create_session(gateway, config: ClusterConfig):
    """Create an aiohttp ClientSession and assign it to the gateway."""
    connector = aiohttp.TCPConnector(limit=100, limit_per_host=20, ttl_dns_cache=300)
    timeout = aiohttp.ClientTimeout(total=config.get("api.timeout", 60), connect=10)
    gateway.session = aiohttp.ClientSession(connector=connector, timeout=timeout)
