#!/usr/bin/env python3
# a2a_cli/chat/commands/connection/__init__.py
"""
Connection management commands for the A2A client interface.
Includes connect, server info, and server switching commands.

This package re-exports the public functions that previously lived in the
single ``connection.py`` module, preserving the public API (including
``fetch_agent_card`` / ``check_server_connection``) and the command
registration side effects performed on import.
"""
# Import the registration function
from a2a_cli.chat.commands import register_command

from .discovery import fetch_agent_card, check_server_connection
from .connect import cmd_connect
from .switch import cmd_disconnect, cmd_use
from .servers import cmd_servers, cmd_add_server, cmd_remove_server
from .config import cmd_load_config, cmd_save_config

__all__ = [
    "fetch_agent_card",
    "check_server_connection",
    "cmd_connect",
    "cmd_disconnect",
    "cmd_use",
    "cmd_servers",
    "cmd_add_server",
    "cmd_remove_server",
    "cmd_load_config",
    "cmd_save_config",
]

# Register all commands in this module
register_command("/connect", cmd_connect)
register_command("/disconnect", cmd_disconnect)
register_command("/servers", cmd_servers)
register_command("/use", cmd_use)
register_command("/load_config", cmd_load_config)
register_command("/save_config", cmd_save_config)
register_command("/add_server", cmd_add_server)
register_command("/remove_server", cmd_remove_server)
