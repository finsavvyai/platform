#!/usr/bin/env python3
# a2a_cli/chat/chat_context/connection.py
"""
Connection and configuration mixin for the chat context.
"""
import os
import json
import logging

from a2a_cli.a2a_client import A2AClient
from a2a_json_rpc.json_rpc_errors import JSONRPCError
from a2a_json_rpc.spec import TaskQueryParams

logger = logging.getLogger("a2a-client")


class ConnectionMixin:
    """Config loading and server connection behaviour for ``ChatContext``."""

    async def initialize(self) -> bool:
        """
        Initialize the chat context and establish connections.

        Returns:
            True if initialization was successful, False otherwise
        """
        # Load config if provided
        if self.config_file:
            try:
                self._load_config()
            except Exception as e:
                logger.error(f"Error loading config: {e}")
                return False

        # Connect to the server
        try:
            await self._connect_to_server()
            return True
        except Exception as e:
            logger.error(f"Error connecting to server: {e}")
            return False

    def _load_config(self) -> None:
        """
        Load configuration from file.
        """
        config_path = os.path.expanduser(self.config_file)

        if not os.path.exists(config_path):
            logger.warning(f"Config file not found: {config_path}")
            return

        try:
            with open(config_path, 'r') as f:
                config = json.load(f)

            # Extract server names
            self.server_names = config.get("servers", {})
            logger.info(f"Loaded {len(self.server_names)} servers from config")

            # If a base URL is not specified and we have servers, use the first one
            if not self.base_url and self.server_names:
                first_server = next(iter(self.server_names.values()))
                self.base_url = first_server
                logger.info(f"Using first server from config: {self.base_url}")

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in config file: {config_path}")
        except Exception as e:
            logger.error(f"Error loading config: {e}")

    async def _connect_to_server(self) -> None:
        """
        Establish connection to the A2A server.
        """
        rpc_url = self.base_url + "/rpc"
        events_url = self.base_url + "/events"

        # Create standard HTTP client
        try:
            self.client = A2AClient.over_http(rpc_url)

            # Try a simple ping to verify connection
            logger.debug(f"Testing connection to {rpc_url}...")

            try:
                # Create a proper TaskQueryParams object instead of a raw dict
                params = TaskQueryParams(id="ping-test-000")
                await self.client.get_task(params)
            except JSONRPCError as e:
                # This is expected - we just wanted to verify the server responds
                if "not found" in str(e).lower():
                    logger.info(f"Successfully connected to {self.base_url}")
                else:
                    # Some other error
                    logger.warning(f"Connected but received unexpected error: {e}")

            # Create SSE client for streaming operations
            self.streaming_client = A2AClient.over_sse(rpc_url, events_url)

        except Exception as e:
            logger.error(f"Error connecting to server: {e}")
            raise
