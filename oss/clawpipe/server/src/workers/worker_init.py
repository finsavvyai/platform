"""Worker node initialization helpers."""

import logging
import platform
import socket
import sys

import psutil

logger = logging.getLogger("finsavvyai.workers.init")


def get_system_info():
    """Collect system information for reporting."""
    try:
        return {
            "hostname": socket.gethostname(),
            "platform": platform.system(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total,
            "memory_available": psutil.virtual_memory().available,
            "disk_total": psutil.disk_usage("/").total,
            "disk_free": psutil.disk_usage("/").free,
            "python_version": sys.version,
            "arch": platform.architecture()[0],
        }
    except Exception:
        return {"error": "Could not get system info"}


def check_gpu():
    """Check if GPU is available (CUDA or Apple Metal)."""
    try:
        import torch

        return {
            "available": torch.cuda.is_available(),
            "count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
        }
    except ImportError:
        if platform.system() == "Darwin" and platform.machine() == "arm64":
            return {"available": True, "type": "metal", "count": 1}
        return {"available": False, "count": 0}


def init_vision_components(worker):
    """Initialize vision pipeline components if OpenClaw is available."""
    try:
        from src.core.image_preprocessor import ImagePreprocessor
        from src.core.vision_rate_limiter import VisionRateLimiter

        vision_cfg = worker.cluster_config.get("vision", {})
        worker.image_preprocessor = ImagePreprocessor(
            max_dimension=vision_cfg.get("max_image_dimension", 2048),
            jpeg_quality=vision_cfg.get("jpeg_quality", 85),
            fetch_timeout=vision_cfg.get("fetch_timeout", 10),
        )
        worker.vision_rate_limiter = VisionRateLimiter(
            rate=vision_cfg.get("rate_limit_rate", 5.0),
            max_concurrent=vision_cfg.get("max_concurrent_requests", 5),
        )

        if vision_cfg.get("cache_enabled", True):
            from src.core.vision_cache import VisionCache

            worker.vision_cache = VisionCache(ttl=vision_cfg.get("cache_ttl", 3600))

        if worker.openclaw_client:
            from src.core.document_processor import DocumentProcessor
            from src.core.vision_pipeline import VisionPipeline

            worker.vision_pipeline = VisionPipeline(
                openclaw_client=worker.openclaw_client,
                preprocessor=worker.image_preprocessor,
                cache=worker.vision_cache,
                rate_limiter=worker.vision_rate_limiter,
            )
            worker.document_processor = DocumentProcessor(
                openclaw_client=worker.openclaw_client,
                preprocessor=worker.image_preprocessor,
                cache=worker.vision_cache,
                rate_limiter=worker.vision_rate_limiter,
                dpi=vision_cfg.get("pdf_dpi", 200),
                max_pages=vision_cfg.get("max_pdf_pages", 50),
            )
            worker.logger.info("Vision pipeline components initialized")
    except ImportError as e:
        worker.logger.warning(f"Vision components not available: {e}")
    except Exception as e:
        worker.logger.error(f"Failed to init vision components: {e}")


def init_channel_components(worker):
    """Initialize channel integration components (Sprint 12)."""
    try:
        channel_cfg = worker.cluster_config.get("channels", {})
        if not channel_cfg.get("enabled", False) and not worker.config.openclaw_enabled:
            return

        from src.channels.channel_adapter import ChannelAdapter
        from src.channels.webhook_receiver import WebhookReceiver

        cluster_url = f"http://localhost:{worker.config.port}"
        worker.channel_adapter = ChannelAdapter(
            openclaw_url=worker.config.openclaw_url,
            cluster_url=cluster_url,
            api_key=worker.config.openclaw_api_key,
            agent_id=channel_cfg.get("agent_id", "finsavvy-ai"),
            agent_name=channel_cfg.get("agent_name", "FinSavvyAI"),
        )

        if not channel_cfg.get("webhook_secret"):
            logger.warning(
                "Channels enabled but webhook_secret is not configured. "
                "All incoming webhooks will be rejected until a secret is set."
            )

        allowed = channel_cfg.get("allowed_senders")
        allowed_set = set(allowed) if isinstance(allowed, list) else None

        worker.webhook_receiver = WebhookReceiver(
            adapter=worker.channel_adapter,
            allowed_senders=allowed_set,
            webhook_secret=channel_cfg.get("webhook_secret"),
            mention_trigger=channel_cfg.get("mention_trigger", "@finsavvy"),
        )
        worker.webhook_receiver.sessions.max_history = channel_cfg.get("max_session_history", 20)
        worker.logger.info("Channel integration components initialized")
    except ImportError as e:
        worker.logger.warning(f"Channel components not available: {e}")
    except Exception as e:
        worker.logger.error(f"Failed to init channel components: {e}")
