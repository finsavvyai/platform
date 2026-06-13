#!/usr/bin/env python3
# a2a_cli/chat/commands/connection/discovery.py
"""
Agent-card discovery and server reachability probes.
"""
import logging
from typing import Dict, Any, Tuple

from a2a_cli.a2a_client import A2AClient
from a2a_json_rpc.json_rpc_errors import JSONRPCError
from a2a_json_rpc.spec import TaskQueryParams

logger = logging.getLogger("a2a-cli")


async def fetch_agent_card(base_url: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Look for an agent card at the legacy location *and* the RFC‑style
    .well‑known path.  Returns (found?, json_data).
    """
    import httpx

    # 1. Legacy draft path (kept for backward compatibility)
    legacy = f"{base_url.rstrip('/')}/agent-card.json"
    # 2. Current spec path
    modern = f"{base_url.rstrip('/')}/.well-known/agent.json"

    async with httpx.AsyncClient() as client:
        for url in (legacy, modern):
            try:
                r = await client.get(url, timeout=3.0)
                if r.status_code == 200:
                    logger.debug("Fetched agent card from %s", url)
                    return True, r.json()
            except Exception as e:
                logger.debug("Fetch attempt failed for %s: %s", url, e)

    logger.debug("No agent card found under %s or %s", legacy, modern)
    return False, {}


async def check_server_connection(base_url: str, client: A2AClient) -> bool:
    """
    Check if the server is responding to A2A protocol methods.

    Args:
        base_url: The base URL of the server
        client: The A2A client to use

    Returns:
        True if the server is responding, False otherwise
    """
    try:
        # Try to get a non-existent task
        params = TaskQueryParams(id="connection-test-000")
        await client.get_task(params)
        return True
    except JSONRPCError as e:
        # Expected: The task doesn't exist
        if "not found" in str(e).lower() or "tasknotfound" in str(e).lower():
            return True
        # Other errors may indicate partial support
        logger.warning(f"Unexpected error from server: {e}")
        return True
    except Exception as e:
        logger.error(f"Connection error: {e}")
        return False
