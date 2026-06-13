#!/usr/bin/env python3
# a2a_cli/chat/commands/tasks/_artifacts.py
"""
Artifact rendering helpers shared across task commands.
"""
from typing import Any, Optional

from rich.panel import Panel
from rich.console import Console


def display_artifact(artifact: Any, console: Optional[Console] = None) -> None:
    """
    Render a single artifact: display the first available text field.
    """
    if console is None:
        console = Console()

    name = getattr(artifact, "name", None) or "<unnamed>"

    # Try to find a 'text' value in each part
    for part in getattr(artifact, "parts", []):
        # Prefer direct attribute
        text = getattr(part, "text", None)
        # Fallback to model_dump if available
        if not text and hasattr(part, "model_dump"):
            try:
                text = part.model_dump().get("text")
            except Exception:
                text = None
        if text:
            console.print(
                Panel(text, title=f"Artifact: {name}", border_style="green")
            )
            return

    # No text found → placeholder
    console.print(
        Panel("[no displayable text]", title=f"Artifact: {name}", border_style="green")
    )


def display_task_artifacts(task: Any, console: Optional[Console] = None) -> None:
    """
    Display all artifacts in a task.

    Args:
        task: The task containing artifacts
        console: Optional Console instance
    """
    if console is None:
        console = Console()

    # Check if task has artifacts
    if not hasattr(task, "artifacts") or not task.artifacts:
        return

    # Display each artifact
    for artifact in task.artifacts:
        display_artifact(artifact, console)
