#!/usr/bin/env python3
# a2a_cli/ui/ui_helpers/formatting.py
"""
Event formatting helpers for status and artifact updates.
"""
from typing import Any

from a2a_cli.ui.colors import *  # noqa: F401,F403  (status/artifact color constants)


def format_status_event(event: Any) -> str:
    """Format a status update event for display."""
    state = event.status.state.value
    msg = ""
    if event.status.message and event.status.message.parts:
        msg = f" — {event.status.message.parts[0].text}"

    status_style = {
        "pending": TEXT_WARNING,
        "running": TEXT_INFO,
        "completed": TEXT_SUCCESS,
        "cancelled": TEXT_DEEMPHASIS,
        "failed": TEXT_ERROR
    }.get(state.lower(), TEXT_NORMAL)

    return f"[{STATUS_UPDATE_COLOR}]Status:[/{STATUS_UPDATE_COLOR}] [{status_style}]{state}{msg}[/{status_style}]"


def format_artifact_event(event: Any) -> str:
    """
    Format an artifact update event for display.

    Args:
        event: The artifact update event

    Returns:
        A string with rich formatting markup
    """
    name = event.artifact.name or "<unnamed>"
    parts_text = []

    # Process each part in the artifact
    for part in event.artifact.parts:
        if hasattr(part, "text"):
            text = part.text[:200] + "..." if len(part.text) > 200 else part.text
            parts_text.append(f"  {text}")
        elif hasattr(part, "mime_type"):
            parts_text.append(f"  [dim]Content with MIME type: {part.mime_type}[/dim]")
        else:
            parts_text.append(f"  [dim]{type(part).__name__} data[/dim]")

    return f"[{ARTIFACT_COLOR}]Artifact: {name}[/{ARTIFACT_COLOR}]\n" + "\n".join(parts_text)
