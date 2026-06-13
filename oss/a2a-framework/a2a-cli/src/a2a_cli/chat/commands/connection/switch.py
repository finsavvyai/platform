#!/usr/bin/env python3
# a2a_cli/chat/commands/connection/switch.py
"""
The /disconnect and /use commands: tear down or switch active connections.
"""
from typing import List, Dict, Any

from rich import print

from .connect import cmd_connect


async def cmd_disconnect(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Disconnect from the current A2A server.

    Usage: /disconnect
    """
    if "client" not in context and "streaming_client" not in context:
        print("[yellow]Not connected to any server.[/yellow]")
        return True

    base_url = context.get("base_url", "Unknown")

    # Clean up clients
    if "client" in context:
        client = context["client"]
        if hasattr(client, "transport") and hasattr(client.transport, "close"):
            try:
                await client.transport.close()
                print(f"[green]HTTP client disconnected[/green]")
            except Exception as e:
                print(f"[yellow]Error closing HTTP client: {e}[/yellow]")
        context.pop("client", None)

    if "streaming_client" in context:
        streaming_client = context["streaming_client"]
        if hasattr(streaming_client, "transport") and hasattr(streaming_client.transport, "close"):
            try:
                await streaming_client.transport.close()
                print(f"[green]SSE client disconnected[/green]")
            except Exception as e:
                print(f"[yellow]Error closing SSE client: {e}[/yellow]")
        context.pop("streaming_client", None)

    print(f"[green]Disconnected from {base_url}[/green]")
    return True


async def cmd_use(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Switch to a different preconfigured server.

    Usage: /use <server_name or #>
    """
    if len(cmd_parts) < 2:
        print("[yellow]Error: No server name or number provided. Usage: /use <server_name or #>[/yellow]")
        return True

    target = cmd_parts[1]
    server_names = context.get("server_names", {})

    if target in server_names:
        await cmd_disconnect(["/disconnect"], context)
        return await cmd_connect(["/connect", target], context)

    try:
        idx = int(target) - 1
        if 0 <= idx < len(server_names):
            await cmd_disconnect(["/disconnect"], context)
            name = list(server_names.keys())[idx]
            return await cmd_connect(["/connect", name], context)
    except ValueError:
        pass

    print(f"[yellow]Server '{target}' not found. Use /servers to see available servers.[/yellow]")
    return True
