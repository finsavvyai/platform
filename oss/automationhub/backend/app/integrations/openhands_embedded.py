"""
Embedded OpenHands adapter - runs vendored OpenHands SDK in-process (no external API).

Uses vendor/openhands (fork). Requires LLM_API_KEY (OpenAI/Anthropic).
Keep file under 200 lines.
"""

import asyncio
import logging
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.config import settings
from app.core.integrations_config import get_openhands_settings
from app.integrations.base import AdapterResult, AdapterStatus, ExternalAgentAdapter
from app.integrations.resilience import IntegrationRateLimiter

logger = logging.getLogger(__name__)

# Add vendored OpenHands fork to path (vendor/openhands at project root)
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_VENDOR_OPENHANDS = _PROJECT_ROOT / "vendor" / "openhands"
if _VENDOR_OPENHANDS.exists():
    for pkg in ("openhands-sdk", "openhands-tools"):
        p = _VENDOR_OPENHANDS / pkg
        if p.exists():
            s = str(p)
            if s not in sys.path:
                sys.path.insert(0, s)
OPENHANDS_RATE_LIMITER = IntegrationRateLimiter("openhands", max_requests=30, window_seconds=3600)
_RESULTS: Dict[str, AdapterResult] = {}


def _run_conversation_sync(workspace: Path, message: str, model: str, api_key: str, task_id: str) -> None:
    """Run OpenHands conversation in thread; store result in _RESULTS."""
    start = time.monotonic()
    try:
        from openhands.sdk import LLM, Agent, Conversation, Tool
        from openhands.tools.file_editor import FileEditorTool
        from openhands.tools.task_tracker import TaskTrackerTool
        from openhands.tools.terminal import TerminalTool
        from pydantic import SecretStr

        llm = LLM(model=model or "anthropic/claude-sonnet-4-5-20250929", api_key=SecretStr(api_key))
        agent = Agent(llm=llm, tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
            Tool(name=TaskTrackerTool.name),
        ])
        conv = Conversation(agent=agent, workspace=str(workspace))
        conv.send_message(message)
        conv.run()
        dur = int((time.monotonic() - start) * 1000)
        _RESULTS[task_id] = AdapterResult(
            external_task_id=task_id,
            status=AdapterStatus.COMPLETED,
            result={"workspace": str(workspace), "message": message, "status": "completed"},
            duration_ms=dur,
            metadata={"mode": "sdk"},
        )
    except Exception as e:
        logger.exception("OpenHands embedded failed: %s", e)
        _RESULTS[task_id] = AdapterResult(
            external_task_id=task_id,
            status=AdapterStatus.FAILED,
            error=str(e),
            duration_ms=int((time.monotonic() - start) * 1000),
            metadata={"mode": "sdk"},
        )


class OpenHandsEmbeddedAdapter(ExternalAgentAdapter):
    """Embedded OpenHands - runs SDK in-process. No external API calls."""

    def __init__(self):
        self._settings = get_openhands_settings()
        self._api_key = os.getenv("LLM_API_KEY") or settings.OPENAI_API_KEY or settings.ANTHROPIC_API_KEY
        self._model = os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-5-20250929")

    @property
    def name(self) -> str:
        return "openhands"

    def is_available(self) -> bool:
        if not (self._settings.ENABLED and self._api_key and self._settings.MODE == "sdk"):
            return False
        try:
            from openhands.sdk import LLM, Agent, Conversation  # noqa: F401
            return True
        except ImportError:
            logger.debug("openhands-sdk not installed, embedded adapter unavailable")
            return False

    async def submit_task(self, task_payload: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> str:
        tenant_id = (context or {}).get("tenant_id", "default")
        await OPENHANDS_RATE_LIMITER.check_and_raise(f"tenant:{tenant_id}")
        message = task_payload.get("prompt") or task_payload.get("message", "")
        root = self._settings.WORKSPACE_ROOT or tempfile.gettempdir()
        workspace = Path(root) / f"oh_{int(time.time())}_{id(task_payload) % 10000}"
        workspace.mkdir(parents=True, exist_ok=True)
        task_id = f"emb_{workspace.name}"
        loop = asyncio.get_event_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: _run_conversation_sync(workspace, message, self._model, self._api_key, task_id),
                ),
                timeout=self._settings.MAX_DURATION_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("OpenHands embedded timed out task_id=%s", task_id)
            _RESULTS[task_id] = AdapterResult(
                external_task_id=task_id, status=AdapterStatus.TIMEOUT, error="Timeout",
                metadata={"mode": "sdk"},
            )
        except Exception as e:
            _RESULTS[task_id] = AdapterResult(
                external_task_id=task_id, status=AdapterStatus.FAILED, error=str(e),
                metadata={"mode": "sdk"},
            )
        return task_id

    async def get_status(self, external_task_id: str) -> AdapterStatus:
        r = _RESULTS.get(external_task_id)
        return r.status if r else AdapterStatus.PENDING

    async def get_result(self, external_task_id: str) -> AdapterResult:
        r = _RESULTS.get(external_task_id)
        if not r:
            return AdapterResult(external_task_id=external_task_id, status=AdapterStatus.PENDING)
        return r
