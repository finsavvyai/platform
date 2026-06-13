#!/usr/bin/env python3
# a2a_cli/chat/chat_context/__init__.py
"""
Chat context for the A2A client interface.

Manages the client, connection, and state information.

The ``ChatContext`` class composes :class:`ConnectionMixin` for config loading
and server connection, keeping the module within the project file-size limit
while preserving the ``from a2a_cli.chat.chat_context import ChatContext``
import path.
"""
import logging
from typing import Dict, Any, Optional

from .connection import ConnectionMixin

logger = logging.getLogger("a2a-client")

__all__ = ["ChatContext"]


class ChatContext(ConnectionMixin):
    """
    Manages the state for the A2A client chat interface.

    Handles connection to the A2A server, client configuration,
    and maintains shared state across components.
    """

    def __init__(self, base_url: Optional[str] = None, config_file: Optional[str] = None):
        """
        Initialize the chat context.

        Args:
            base_url: Optional base URL for the A2A server
            config_file: Optional path to a configuration file
        """
        # Connection info
        self.base_url = base_url or "http://localhost:8000"
        self.config_file = config_file

        # Client instances
        self.client = None
        self.streaming_client = None

        # State flags
        self.exit_requested = False
        self.verbose_mode = False
        self.debug_mode = False

        # History
        self.command_history = []

        # Server names (from config)
        self.server_names = {}

        # Tasks
        self.last_task_id = None

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the context to a dictionary for command handlers.

        Returns:
            Dictionary representation of the context
        """
        return {
            "base_url": self.base_url,
            "client": self.client,
            "streaming_client": self.streaming_client,
            "verbose_mode": self.verbose_mode,
            "debug_mode": self.debug_mode,
            "exit_requested": self.exit_requested,
            "command_history": self.command_history,
            "server_names": self.server_names,
            "last_task_id": self.last_task_id
        }

    def update_from_dict(self, context_dict: Dict[str, Any]) -> None:
        """
        Update the context from a dictionary (after command execution).

        Args:
            context_dict: Dictionary with updated context values
        """
        # Update connection info
        if "base_url" in context_dict:
            self.base_url = context_dict["base_url"]

        # Update clients
        if "client" in context_dict:
            self.client = context_dict["client"]
        if "streaming_client" in context_dict:
            self.streaming_client = context_dict["streaming_client"]

        # Update state flags
        if "verbose_mode" in context_dict:
            self.verbose_mode = context_dict["verbose_mode"]
        if "debug_mode" in context_dict:
            self.debug_mode = context_dict["debug_mode"]
        if "exit_requested" in context_dict:
            self.exit_requested = context_dict["exit_requested"]

        # Update history
        if "command_history" in context_dict:
            self.command_history = context_dict["command_history"]

        # Update server names
        if "server_names" in context_dict:
            self.server_names = context_dict["server_names"]

        # Update task info
        if "last_task_id" in context_dict:
            self.last_task_id = context_dict["last_task_id"]

    async def close(self) -> None:
        """
        Close all connections and clean up resources.
        """
        # Close streaming client if available
        if self.streaming_client and hasattr(self.streaming_client.transport, "close"):
            await self.streaming_client.transport.close()

        # Close main client if available
        if self.client and hasattr(self.client.transport, "close"):
            await self.client.transport.close()
