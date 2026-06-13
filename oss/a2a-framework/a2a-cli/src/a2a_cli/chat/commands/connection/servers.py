#!/usr/bin/env python3
# a2a_cli/chat/commands/connection/servers.py
"""
The /servers, /add_server, and /remove_server commands.
"""
from typing import List, Dict, Any

from rich import print
from rich.table import Table
from rich.console import Console


async def cmd_servers(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    List all available preconfigured servers.

    Usage: /servers
    """
    console = Console()

    # Get server names from context
    server_names = context.get("server_names", {})

    if not server_names:
        print("[yellow]No preconfigured servers found. You can still connect with /connect <url>[/yellow]")
        print("[dim]Use /load_config to load server configurations from a file.[/dim]")
        return True

    # Create table for server list
    table = Table(title="Available Servers")
    table.add_column("#", style="dim")
    table.add_column("Name", style="green")
    table.add_column("URL")

    # Add rows for each server
    for i, (name, url) in enumerate(server_names.items(), 1):
        current_marker = " [yellow]✓[/yellow]" if url.rstrip("/") == context.get("base_url", "").rstrip("/") else ""
        table.add_row(str(i), f"{name}{current_marker}", url)

    console.print(table)
    console.print("\nConnect to a server with [green]/connect <name>[/green] or [green]/use <#>[/green]")

    return True


async def cmd_add_server(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Add a server to the configuration.

    Usage: /add_server <name> <url>
    """
    if len(cmd_parts) < 3:
        print("[yellow]Error: Missing arguments. Usage: /add_server <name> <url>[/yellow]")
        return True

    name, url = cmd_parts[1], cmd_parts[2]
    if not url.startswith(("http://", "https://")):
        url = f"http://localhost:8000/{url.strip('/')}"
        print(f"[dim]Normalized URL to: {url}[/dim]")

    servers = context.get("server_names", {})
    servers[name] = url
    context["server_names"] = servers
    print(f"[green]Added server '{name}' at {url}[/green]")
    await cmd_servers(cmd_parts, context)
    return True


async def cmd_remove_server(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Remove a server from the configuration.

    Usage: /remove_server <name>
    """
    if len(cmd_parts) < 2:
        print("[yellow]Error: No server name provided. Usage: /remove_server <name>[/yellow]")
        return True

    name = cmd_parts[1]
    servers = context.get("server_names", {})
    if name not in servers:
        print(f"[yellow]Server '{name}' not found.[/yellow]")
        return True

    url = servers.pop(name)
    context["server_names"] = servers
    print(f"[green]Removed server '{name}' at {url}[/green]")
    await cmd_servers(cmd_parts, context)
    return True
