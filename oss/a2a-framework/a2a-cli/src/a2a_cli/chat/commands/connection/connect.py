#!/usr/bin/env python3
# a2a_cli/chat/commands/connection/connect.py
"""
The /connect, /disconnect, and /use commands.
"""
import logging
from typing import List, Dict, Any

from rich import print
from rich.panel import Panel
from rich.console import Console

from a2a_cli.a2a_client import A2AClient
from .discovery import fetch_agent_card, check_server_connection

logger = logging.getLogger("a2a-cli")


async def cmd_connect(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Connect to an A2A server by URL or server name.

    Usage:
      /connect <url>         - Connect to a specific URL
      /connect <server_name> - Connect to a named server from config
    """
    quiet = context.get("quiet", False)

    if len(cmd_parts) < 2:
        print("[yellow]Error: No URL or server name provided. Usage: /connect <url or name>[/yellow]")
        return True

    # Resolve incoming target
    target = cmd_parts[1]
    server_names = context.get("server_names", {})
    if target in server_names:
        base_url = server_names[target]
        if not quiet:
            print(f"[dim]Using server '{target}' at {base_url}[/dim]")
    else:
        base_url = target
        if not base_url.startswith(("http://", "https://")):
            base_url = f"http://localhost:8000/{base_url.strip('/')}"
        if not quiet:
            print(f"[dim]Using direct URL: {base_url}[/dim]")

    # 1) Fetch the agent‑card if it exists
    if not quiet:
        print(f"[dim]Checking for agent card at {base_url}/agent-card.json...[/dim]")
    success, agent_data = await fetch_agent_card(base_url)

    if success:
        agent_name = agent_data.get("name", "Unknown Agent")
        print(f"[green]Found agent: {agent_name}[/green]")
        base_url = _rebase_from_card(base_url, agent_data, quiet)
        context["agent_info"] = agent_data
    else:
        if not quiet:
            print(f"[dim]No agent card found, continuing with connection...[/dim]")

    # 4) Now build the proper endpoints
    rpc_url = base_url.rstrip("/") + "/rpc"
    events_url = base_url.rstrip("/") + "/events"

    try:
        if not quiet:
            print(f"[dim]Creating HTTP client for {rpc_url}...[/dim]")
        client = A2AClient.over_http(rpc_url)

        if not quiet:
            print(f"[dim]Testing connection to A2A server...[/dim]")
        if await check_server_connection(base_url, client):
            if not quiet:
                print(f"[green]Successfully connected to A2A server at {base_url}[/green]")
            context["client"] = client
            _init_sse_client(context, rpc_url, events_url, quiet)
            await _render_agent_card(context)
            return True

        print(f"[red]Failed to connect to A2A server at {base_url}[/red]")
        print(f"[yellow]Make sure the server supports the A2A protocol[/yellow]")
        return True

    except Exception as e:
        print(f"[red]Error connecting to server: {e}[/red]")
        if context.get("debug_mode"):
            import traceback
            traceback.print_exc()
        return True


def _rebase_from_card(base_url: str, agent_data: Dict[str, Any], quiet: bool) -> str:
    """Apply an agent card's advertised url/mount/basePath to the base URL."""
    if agent_data.get("url"):
        base_url = agent_data["url"].rstrip("/")
        if not quiet:
            print(f"[dim]Re‑based via agent‑card 'url': {base_url}[/dim]")
    else:
        mount = agent_data.get("mount") or agent_data.get("basePath", "").lstrip("/")
        if mount:
            base_url = base_url.rstrip("/") + "/" + mount
            if not quiet:
                print(f"[dim]Applying mount point: /{mount} → new base_url: {base_url}[/dim]")
    return base_url


def _init_sse_client(context: Dict[str, Any], rpc_url: str, events_url: str, quiet: bool) -> None:
    """Initialise the SSE streaming client on the /events path."""
    if not quiet:
        print(f"[dim]Creating SSE client for {events_url}...[/dim]")
    try:
        sse_client = A2AClient.over_sse(rpc_url, events_url)
        context["streaming_client"] = sse_client
        if not quiet:
            print(f"[green]SSE client initialized[/green]")
    except Exception as e:
        if not quiet:
            print(f"[yellow]Warning: Could not initialize SSE client: {e}[/yellow]")
            print(f"[yellow]Some streaming functionality may not be available[/yellow]")


async def _render_agent_card(context: Dict[str, Any]) -> None:
    """Render the agent-card UI if one was discovered."""
    if "agent_info" not in context:
        return
    try:
        from a2a_cli.chat.commands.agent import cmd_agent_card
        await cmd_agent_card(["/agent_card"], context)
    except Exception as e:
        if context.get("debug_mode"):
            print(f"[yellow]Error displaying agent card: {e}[/yellow]")
        # fallback: simple panel
        info = context["agent_info"]
        desc = info.get("description", "")
        if desc:
            console = Console()
            console.print(Panel(desc, title=f"Connected to {info.get('name')}", border_style="green"))
