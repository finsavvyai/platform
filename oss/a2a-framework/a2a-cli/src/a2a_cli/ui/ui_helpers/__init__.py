#!/usr/bin/env python3
# a2a_cli/ui/ui_helpers/__init__.py
"""
UI helper functions for A2A client display and formatting.

This package re-exports the helper functions (and the ``a2a_cli.ui.colors``
star-imported constants) that previously lived in the single ``ui_helpers.py``
module, preserving every ``from a2a_cli.ui.ui_helpers import ...`` call site.
"""
# Preserve the original module's `from a2a_cli.ui.colors import *` surface
from a2a_cli.ui.colors import *  # noqa: F401,F403

from .terminal import clear_screen, restore_terminal
from .formatting import format_status_event, format_artifact_event
from .panels import (
    display_welcome_banner,
    display_markdown_panel,
    display_task_info,
    display_artifact,
    display_task_artifacts,
)

__all__ = [
    "clear_screen",
    "restore_terminal",
    "format_status_event",
    "format_artifact_event",
    "display_welcome_banner",
    "display_markdown_panel",
    "display_task_info",
    "display_artifact",
    "display_task_artifacts",
]
