"""
a2a_server.tasks._manager_lifecycle
===================================
Task-execution and cancellation mixin for :class:`TaskManager`.
"""
from __future__ import annotations

import asyncio
import logging

from a2a_json_rpc.spec import (
    Message,
    Role,
    Task,
    TaskArtifactUpdateEvent,
    TaskState,
    TaskStatusUpdateEvent,
    TextPart,
)
from a2a_server.tasks.task_handler import TaskHandler

logger = logging.getLogger(__name__)


class LifecycleMixin:
    """Background task execution, cancellation, and shutdown."""

    async def cancel_task(self, task_id: str, *, reason: str | None = None) -> Task:
        real = self._aliases.get(task_id, task_id)
        h_name = self._active.get(real)
        if h_name and await self._handlers[h_name].cancel_task(real):
            return await self._finish_cancel(real, reason)
        return await self._finish_cancel(real, reason)

    async def _finish_cancel(self, task_id: str, reason: str | None) -> Task:
        msg = Message(role=Role.agent, parts=[TextPart(type="text", text=reason or "Canceled by client")])
        return await self.update_status(task_id, TaskState.canceled, message=msg)

    async def _run_task(self, task_id: str, handler: TaskHandler, user_msg: Message, session_id: str) -> None:
        try:
            async for event in handler.process_task(task_id, user_msg, session_id):
                if isinstance(event, TaskStatusUpdateEvent):
                    await self.update_status(task_id, event.status.state, message=event.status.message)
                elif isinstance(event, TaskArtifactUpdateEvent):
                    await self.add_artifact(task_id, event.artifact)
        except asyncio.CancelledError:
            logger.info("Task %s cancelled", task_id)
            await self.update_status(task_id, TaskState.canceled)
            raise
        except Exception as exc:
            logger.exception("Task %s failed: %s", task_id, exc)
            await self.update_status(task_id, TaskState.failed)
        finally:
            self._active.pop(task_id, None)

    async def shutdown(self) -> None:
        for bg in list(self._background):
            bg.cancel()
        if self._background:
            await asyncio.gather(*self._background, return_exceptions=True)
        self._background.clear()

    def tasks_by_state(self, state: TaskState) -> list[Task]:
        """Return all tasks currently in the given state."""
        return [t for t in self._tasks.values() if t.status.state == state]
