#!/usr/bin/env python3
# a2a_cli/chat/commands/tasks/_stream.py
"""
Shared streaming primitives for the /resubscribe and /send_subscribe commands.

Consumes an async event stream of TaskStatusUpdateEvent / TaskArtifactUpdateEvent
into a Rich ``Live`` display, accumulating artifacts and tracking final status.
"""
from typing import Any, AsyncIterator, List, Optional, Tuple

from rich.panel import Panel
from rich.live import Live
from rich.text import Text
from rich.console import Console

from a2a_json_rpc.spec import TaskStatusUpdateEvent, TaskArtifactUpdateEvent

from a2a_cli.ui.ui_helpers import format_status_event, format_artifact_event
from .artifacts import display_artifact


async def consume_event_stream(
    events: AsyncIterator[Any],
    console: Console,
) -> Tuple[Optional[Any], List[Any]]:
    """
    Drive a Rich ``Live`` view from a task event stream.

    Args:
        events: Async iterator yielding task status/artifact update events.
        console: Rich console for rendering.

    Returns:
        A tuple ``(final_status, all_artifacts)``.
    """
    all_artifacts: List[Any] = []
    final_status: Optional[Any] = None

    with Live("", refresh_per_second=4, console=console) as live:
        async for evt in events:
            if isinstance(evt, TaskStatusUpdateEvent):
                live.update(Text.from_markup(format_status_event(evt)))
                if evt.final:
                    final_status = evt.status
                    break
            elif isinstance(evt, TaskArtifactUpdateEvent):
                live.update(Text.from_markup(format_artifact_event(evt)))
                all_artifacts.append(evt.artifact)
            else:
                live.update(Text(f"Unknown event: {type(evt).__name__}"))

    return final_status, all_artifacts


def render_completion(
    task_id: str,
    final_status: Optional[Any],
    all_artifacts: List[Any],
    console: Console,
) -> None:
    """Render the post-stream completion summary: final message + artifacts."""
    if final_status:
        from rich import print  # local to keep markup behaviour identical
        print(f"[green]Task {task_id} completed.[/green]")
        message = getattr(final_status, "message", None)
        if message and getattr(message, "parts", None):
            for part in message.parts:
                if getattr(part, "text", None):
                    console.print(Panel(part.text, title="Response", border_style="blue"))

    if all_artifacts:
        from rich import print
        print(f"\n[bold]Artifacts ({len(all_artifacts)}):[/bold]")
        for art in all_artifacts:
            display_artifact(art, console)
