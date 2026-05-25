"""
Development agent - delegates coding tasks to embedded OpenHands (SDK) or Cloud API.

Built-in when OPENHANDS_ENABLED and LLM key (or API key for cloud). Keeps file under 200 lines.
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Optional

from app.agents.base import (
    UPMAgent,
    Task,
    TaskResult,
    TaskStatus,
    TaskType,
    ExecutionContext,
    ExecutionStep,
    Capability,
    AgentStatus,
)
from app.integrations.base import AdapterStatus

logger = logging.getLogger(__name__)


def _get_adapter():
    """Use embedded SDK adapter when MODE=sdk, else cloud adapter."""
    from app.core.integrations_config import get_openhands_settings
    cfg = get_openhands_settings()
    if cfg.MODE == "sdk":
        from app.integrations.openhands_embedded import OpenHandsEmbeddedAdapter
        a = OpenHandsEmbeddedAdapter()
    else:
        from app.integrations.openhands_adapter import OpenHandsAdapter
        a = OpenHandsAdapter()
    return a if a.is_available() else None


class DevelopmentAgent(UPMAgent):
    """Agent for code generation, refactoring, and debugging via OpenHands."""

    def __init__(self, **kwargs):
        capabilities = [
            Capability(
                name="code_generation",
                description="Generate code from natural language",
                supported_task_types=[TaskType.CUSTOM],
            ),
            Capability(
                name="refactor",
                description="Refactor and improve code",
                supported_task_types=[TaskType.CUSTOM],
            ),
            Capability(
                name="debug",
                description="Debug and fix issues",
                supported_task_types=[TaskType.CUSTOM],
            ),
        ]
        kwargs_no_name = {k: v for k, v in kwargs.items() if k != "name"}
        super().__init__(
            name=kwargs.get("name", "DevelopmentAgent"),
            capabilities=capabilities,
            agent_type="development",
            **kwargs_no_name,
        )

    def _register_default_tools(self):
        pass

    def _setup_capabilities(self):
        pass

    async def can_handle_task(self, task: Task) -> bool:
        if not _get_adapter():
            return False
        return await super().can_handle_task(task)

    async def execute_task(self, task: Task, context: ExecutionContext) -> TaskResult:
        self.status = AgentStatus.BUSY
        started_at = datetime.utcnow()
        step = ExecutionStep(action="openhands_submit", parameters=task.parameters, started_at=started_at)
        adapter = _get_adapter()
        if not adapter:
            self.status = AgentStatus.IDLE
            step.error = "OpenHands not available"
            step.completed_at = datetime.utcnow()
            return TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error="OpenHands integration is not enabled or configured",
                started_at=started_at,
                completed_at=datetime.utcnow(),
                execution_steps=[step],
            )
        try:
            task_payload = {
                "prompt": task.parameters.get("prompt") or task.name,
                "message": task.parameters.get("message") or task.description or task.name,
                "repository": task.parameters.get("repository"),
                "workspace_path": task.parameters.get("workspace_path"),
            }
            ctx = {"tenant_id": str(context.organization_id or context.user_id or "default")}
            external_id = await adapter.submit_task(task_payload, context=ctx)
            step.result = {"external_task_id": external_id}
            step.completed_at = datetime.utcnow()
            max_wait = adapter._settings.MAX_DURATION_SECONDS
            deadline = time.monotonic() + max_wait
            while time.monotonic() < deadline:
                status = await adapter.get_status(external_id)
                if status in (AdapterStatus.COMPLETED, AdapterStatus.FAILED, AdapterStatus.CANCELLED):
                    break
                await asyncio.sleep(5)
            adapter_result = await adapter.get_result(external_id)
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            task_status = TaskStatus.COMPLETED if adapter_result.status == AdapterStatus.COMPLETED else TaskStatus.FAILED
            self.status = AgentStatus.IDLE
            return TaskResult(
                task_id=task.id,
                status=task_status,
                result=adapter_result.result,
                error=adapter_result.error,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                execution_steps=[ExecutionStep(
                    action="openhands_submit",
                    parameters=task.parameters,
                    result=adapter_result.result,
                    error=adapter_result.error,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_ms=adapter_result.duration_ms,
                )],
                metadata={"external_task_id": external_id},
            )
        except Exception as e:
            logger.exception("DevelopmentAgent execute_task failed")
            self.status = AgentStatus.IDLE
            step.error = str(e)
            step.completed_at = datetime.utcnow()
            return TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error=str(e),
                started_at=started_at,
                completed_at=datetime.utcnow(),
                execution_steps=[step],
            )
