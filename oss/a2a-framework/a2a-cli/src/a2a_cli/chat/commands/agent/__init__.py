#!/usr/bin/env python3
# a2a_cli/chat/commands/agent/__init__.py
"""
Agent-related commands for the A2A client interface.

The public functions ``fetch_agent_card`` and ``cmd_agent_card`` live here (as
they did in the original ``agent.py`` module) so that callers and tests that
patch ``a2a_cli.chat.commands.agent.fetch_agent_card`` keep working unchanged.
The heavy card-rendering logic is delegated to :mod:`card_render`.
"""
import logging
import json
from typing import List, Dict, Any, Optional

from rich import print
from rich.panel import Panel
from rich.console import Console
from rich.syntax import Syntax
from rich.text import Text

# Import the registration function
from a2a_cli.chat.commands import register_command
from .card_render import build_agent_card_content

logger = logging.getLogger("a2a-cli")

__all__ = ["fetch_agent_card", "cmd_agent_card", "build_agent_card_content"]


async def fetch_agent_card(base_url: str) -> Optional[Dict[str, Any]]:
    """
    Fetch the agent card from the server.

    Args:
        base_url: The base URL of the server

    Returns:
        The agent card data, or None if not found
    """
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            url = f"{base_url}/agent-card.json"
            logger.debug(f"Fetching agent card from {url}")

            response = await client.get(url, timeout=3.0)
            if response.status_code == 200:
                data = response.json()
                return data
            else:
                logger.debug(f"Agent card not available: {response.status_code}")
                return None
    except Exception as e:
        logger.debug(f"Error fetching agent card: {e}")
        return None


async def cmd_agent_card(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Display the agent card for the current server.

    Usage: /agent_card [--raw]

    Options:
      --raw  Show the raw JSON of the agent card
    """
    console = Console()

    # Check if connected
    base_url = context.get("base_url")
    if not base_url:
        print("[yellow]Not connected to any server. Use /connect to connect.[/yellow]")
        return True

    # Check if we want raw output
    raw_mode = len(cmd_parts) > 1 and cmd_parts[1] == "--raw"

    # Check if we already have agent info
    agent_info = context.get("agent_info")

    if not agent_info:
        print(f"[dim]Fetching agent card from {base_url}/agent-card.json...[/dim]")
        agent_info = await fetch_agent_card(base_url)

        if agent_info:
            # Store in context for future use
            context["agent_info"] = agent_info
        else:
            print(f"[yellow]No agent card found at {base_url}/agent-card.json[/yellow]")
            return True

    # Display the agent card
    if raw_mode:
        # Show raw JSON
        json_str = json.dumps(agent_info, indent=2)
        console.print(Syntax(json_str, "json", theme="monokai", line_numbers=True))
        return True

    content = build_agent_card_content(agent_info, base_url)

    # Use a panel with Rich text formatting
    console.print(Panel(
        Text.from_markup(content),
        title="Agent Card",
        border_style="cyan"
    ))

    return True


# Register the commands
register_command("/agent_card", cmd_agent_card)
register_command("/agent", cmd_agent_card)  # Alias
