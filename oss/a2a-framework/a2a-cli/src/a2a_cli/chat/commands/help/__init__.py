#!/usr/bin/env python3
# a2a_cli/chat/commands/help/__init__.py
"""
Help commands for the A2A client interface.
Includes help and general utility commands.

This package re-exports the public help-text constants and command handlers
that previously lived in the single ``help.py`` module, preserving the public
API and the command registration side effects performed on import.
"""
# Import the registration function
from a2a_cli.chat.commands import register_command

from .text import (
    GENERAL_HELP,
    TASK_COMMANDS_HELP,
    CONNECTION_COMMANDS_HELP,
    DISPLAY_COMMANDS_HELP,
    PROTOCOL_INFO,
)
from .commands import cmd_help, display_quick_help

__all__ = [
    "GENERAL_HELP",
    "TASK_COMMANDS_HELP",
    "CONNECTION_COMMANDS_HELP",
    "DISPLAY_COMMANDS_HELP",
    "PROTOCOL_INFO",
    "cmd_help",
    "display_quick_help",
]

# Register all commands in this module
register_command("/help", cmd_help)
register_command("/quickhelp", display_quick_help)
register_command("/qh", display_quick_help)
