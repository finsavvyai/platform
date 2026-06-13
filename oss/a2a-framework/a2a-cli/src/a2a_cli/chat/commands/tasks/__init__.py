#!/usr/bin/env python3
# a2a_cli/chat/commands/tasks/__init__.py
"""
Task management commands for the A2A client interface.
Includes send, get, cancel, resubscribe, and sendSubscribe commands.
These commands map directly to A2A protocol methods for consistency.

This package re-exports the public command functions and helpers that
previously lived in the single ``tasks.py`` module, preserving the public
API and the command-registration side effects performed on import.
"""
# Import the registration function
from a2a_cli.chat.commands import register_command

# Public helpers and command handlers (re-exported for backward compatibility)
from .artifacts import display_artifact, display_task_artifacts
from .send import cmd_send
from .query import cmd_get, cmd_cancel
from .resubscribe import cmd_resubscribe
from .subscribe import cmd_send_subscribe

__all__ = [
    "display_artifact",
    "display_task_artifacts",
    "cmd_send",
    "cmd_get",
    "cmd_cancel",
    "cmd_resubscribe",
    "cmd_send_subscribe",
]

# Register all commands in this module with names that match A2A protocol methods
register_command("/send", cmd_send)
register_command("/get", cmd_get)
register_command("/cancel", cmd_cancel)
register_command("/resubscribe", cmd_resubscribe)
register_command("/send_subscribe", cmd_send_subscribe)

# Register aliases for backward compatibility
register_command("/watch", cmd_resubscribe)          # Alias for /resubscribe
register_command("/sendsubscribe", cmd_send_subscribe)  # No underscore variant
register_command("/watch_text", cmd_send_subscribe)     # Old alias
