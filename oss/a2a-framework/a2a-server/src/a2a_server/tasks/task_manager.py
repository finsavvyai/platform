"""
a2a_server.tasks.task_manager
================================
Canonical TaskManager used by all transports.

Key guarantees
--------------
* Accepts **`task_id`** or **`id`** kwarg so transports never need to guess.
* Keeps an **alias map** so both server‑generated and client‑provided IDs work.
* Publishes initial *submitted* status immediately via `EventBus`.
* Provides **legacy helpers** `get_handler`, `get_handlers`, `get_default_handler`.
* Exposes the historical names `_tasks` and `_active_tasks` so older code that
  pokes internals continues to run.
* Graceful `shutdown()` cancels and waits for background jobs.

The handler-registry and task-lifecycle behaviour live in mixins
(:mod:`_manager_handlers`, :mod:`_manager_lifecycle`) so this module stays
within the project file-size limit.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from a2a_json_rpc.spec import (
    Artifact,
    Message,
    Task,
    TaskArtifactUpdateEvent,
    TaskState,
    TaskStatus,
    TaskStatusUpdateEvent,
)
from a2a_server.pubsub import EventBus
from a2a_server.tasks.task_handler import TaskHandler
from a2a_server.tasks._manager_handlers import HandlerRegistryMixin
from a2a_server.tasks._manager_lifecycle import LifecycleMixin

__all__ = [
    "TaskManager",
    "TaskNotFound",
    "InvalidTransition",
    "Task",
]

logger = logging.getLogger(__name__)


class TaskNotFound(Exception):
    """Raised when the requested task ID is unknown."""


class InvalidTransition(Exception):
    """Raised on an illegal FSM transition."""


class TaskManager(HandlerRegistryMixin, LifecycleMixin):  # pylint: disable=too-many-instance-attributes
    """Central task registry and orchestrator for the A2A server."""

    _TRANSITIONS: Dict[TaskState, List[TaskState]] = {
        TaskState.submitted:     [TaskState.working, TaskState.completed, TaskState.canceled, TaskState.failed],
        TaskState.working:       [TaskState.input_required, TaskState.completed, TaskState.canceled, TaskState.failed],
        TaskState.input_required:[TaskState.working, TaskState.canceled],
        TaskState.completed:     [],
        TaskState.canceled:      [],
        TaskState.failed:        [],
        TaskState.unknown:       list(TaskState),
    }

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._bus = event_bus
        self._tasks: Dict[str, Task] = {}
        self._aliases: Dict[str, str] = {}           # alias → canonical
        self._handlers: Dict[str, TaskHandler] = {}
        self._default_handler: str | None = None
        self._active: Dict[str, str] = {}            # task_id → handler_name
        self._active_tasks: Dict[str, str] = self._active  # legacy alias

        self._lock = asyncio.Lock()
        self._background: set[asyncio.Task[Any]] = set()

    # ─── public API ────────────────────────────────────────────────────

    async def create_task(
        self,
        user_msg: Message,
        *,
        session_id: str | None = None,
        handler_name: str | None = None,
        task_id: str | None = None,
        id: str | None = None,
    ) -> Task:
        """
        Register *user_msg* as a new task.

        You may pass either `task_id=…` or `id=…`; whichever you provide
        becomes the client‑visible ID.  Internally we normalize to `canonical`.
        """
        canonical = id or task_id or str(uuid4())

        async with self._lock:
            if canonical in self._tasks:
                raise ValueError(f"Task {canonical} already exists")

            if id and task_id and id != task_id:
                self._aliases[id] = canonical

            task = Task(
                id=canonical,
                session_id=session_id or str(uuid4()),
                status=TaskStatus(state=TaskState.submitted),
                history=[user_msg],
            )
            self._tasks[canonical] = task
            hdl = self._resolve_handler(handler_name)
            self._active[canonical] = hdl.name

        if self._bus:
            await self._bus.publish(
                TaskStatusUpdateEvent(id=canonical, status=task.status, final=False)
            )

        bg = asyncio.create_task(self._run_task(canonical, hdl, user_msg, task.session_id))
        self._background.add(bg)
        bg.add_done_callback(self._background.discard)

        return task

    async def get_task(self, task_id: str) -> Task:
        real = self._aliases.get(task_id, task_id)
        try:
            return self._tasks[real]
        except KeyError as exc:
            raise TaskNotFound(task_id) from exc

    async def update_status(
        self,
        task_id: str,
        new_state: TaskState,
        message: Message | None = None,
    ) -> Task:
        real = self._aliases.get(task_id, task_id)
        async with self._lock:
            task = await self.get_task(real)
            cur = task.status.state
            if new_state != cur and new_state not in self._TRANSITIONS[cur]:
                raise InvalidTransition(f"{cur} → {new_state} not allowed")
            task.status = TaskStatus(state=new_state, timestamp=datetime.now(timezone.utc))
            if message:
                task.history = (task.history or []) + [message]

        if self._bus:
            await self._bus.publish(
                TaskStatusUpdateEvent(
                    id=real,
                    status=task.status,
                    final=new_state in (TaskState.completed, TaskState.canceled, TaskState.failed),
                )
            )
        return task

    async def add_artifact(self, task_id: str, artifact: Artifact) -> Task:
        real = self._aliases.get(task_id, task_id)
        async with self._lock:
            task = await self.get_task(real)
            task.artifacts = (task.artifacts or []) + [artifact]
        if self._bus:
            await self._bus.publish(TaskArtifactUpdateEvent(id=real, artifact=artifact))
        return task
