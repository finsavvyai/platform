#!/usr/bin/env python3
# a2a_cli/chat/commands/debug/__init__.py
"""
Debug commands for the A2A client interface.

This package re-exports the command functions that previously lived in the
single ``debug.py`` module, preserving the public API and the command
registration side effects performed on import.
"""
# Import the registration function
from a2a_cli.chat.commands import register_command

from .info import cmd_debug_info
from .sse_test import cmd_test_sse
from .send_subscribe_test import cmd_test_send_subscribe

__all__ = [
    "cmd_debug_info",
    "cmd_test_sse",
    "cmd_test_send_subscribe",
]

# Register the commands
register_command("/debug_info", cmd_debug_info)
register_command("/test_sse", cmd_test_sse)
register_command("/test_send_subscribe", cmd_test_send_subscribe)
