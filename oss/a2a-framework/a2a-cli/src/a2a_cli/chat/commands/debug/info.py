#!/usr/bin/env python3
# a2a_cli/chat/commands/debug/info.py
"""
The /debug_info command: detailed connection diagnostics.
"""
import logging
import sys
import platform
from typing import List, Dict, Any

from rich import print
from rich.panel import Panel
from rich.console import Console
from rich.table import Table

from a2a_json_rpc.spec import TaskQueryParams


async def cmd_debug_info(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Display detailed debug information about the current connection.

    Usage: /debug_info
    """
    console = Console()

    # Get server information
    base_url = context.get("base_url", "Not set")
    client = context.get("client")
    streaming_client = context.get("streaming_client")

    # Create debug panel
    print(Panel("Debug Information", style="red"))

    # Basic connection info
    print("[bold]Connection Details:[/bold]")
    print(f"Base URL: {base_url}")
    print(f"RPC URL: {base_url}/rpc")
    print(f"Events URL: {base_url}/events")
    print(f"Client available: {client is not None}")
    print(f"Streaming client available: {streaming_client is not None}")

    # System information
    print("\n[bold]System Information:[/bold]")
    print(f"Operating System: {platform.system()} {platform.release()}")
    print(f"Python version: {sys.version}")

    _print_package_versions()
    _print_transport_details(client)
    await _test_server_connection(client, base_url)
    _print_method_table(console, client)

    # Set debug mode
    context["debug_mode"] = True
    logging.getLogger("a2a-client").setLevel(logging.DEBUG)
    print("\n[green]Debug mode enabled. Detailed logs will be shown.[/green]")

    print("\n[bold]For additional help:[/bold]")
    print("- Use /connect to reconnect to the server")
    print("- Use /test_sse to test the SSE connection")
    print("- Use /help for available commands")
    print("- Try a simple task with /send hello")

    return True


def _print_package_versions() -> None:
    """Print versions of key runtime dependencies."""
    print("\n[bold]Package Versions:[/bold]")
    for label, module in (("HTTPX", "httpx"), ("Rich", "rich"),
                          ("Prompt Toolkit", "prompt_toolkit"), ("Typer", "typer")):
        try:
            mod = __import__(module)
            print(f"{label}: {getattr(mod, '__version__', 'unknown')}")
        except ImportError:
            print(f"{label}: Not installed")


def _print_transport_details(client: Any) -> None:
    """Print transport-specific configuration if a client is present."""
    if not (client and hasattr(client, 'transport')):
        return
    print("\n[bold]Transport Details:[/bold]")
    transport_type = type(client.transport).__name__
    print(f"Transport type: {transport_type}")

    if hasattr(client.transport, 'endpoint'):
        print(f"Transport endpoint: {client.transport.endpoint}")
    if hasattr(client.transport, 'sse_endpoint'):
        print(f"SSE endpoint: {client.transport.sse_endpoint}")

    if transport_type == "JSONRPCHTTPClient":
        timeout = client.transport._client.timeout if hasattr(client.transport, '_client') else 'Unknown'
        print(f"Timeout: {timeout}")
    elif transport_type == "JSONRPCSSEClient":
        alias = client.transport.alias_endpoint if hasattr(client.transport, 'alias_endpoint') else 'Unknown'
        pending = client.transport._pending_resp is not None if hasattr(client.transport, '_pending_resp') else 'Unknown'
        print(f"Alias endpoint: {alias}")
        print(f"Pending response: {pending}")


async def _test_server_connection(client: Any, base_url: str) -> None:
    """Probe the agent card and RPC endpoint to confirm the server responds."""
    print("\n[bold]Testing Server Connection:[/bold]")
    if not client:
        return
    try:
        print("Attempting to connect to agent-card.json...")
        try:
            import httpx
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(f"{base_url}/agent-card.json", timeout=3.0)
                print(f"Status code: {response.status_code}")
                if response.status_code == 200:
                    _print_agent_card(response)
                else:
                    print("Agent card not available")
        except Exception as e:
            print(f"Error connecting to agent card: {e}")

        print("\nTesting RPC endpoint...")
        try:
            params = TaskQueryParams(id="debug-probe-000")
            try:
                await client.get_task(params)
            except Exception as e:
                if "not found" in str(e).lower() or "tasknotfound" in str(e).lower():
                    print("[green]RPC endpoint is responding correctly[/green]")
                else:
                    print(f"[yellow]RPC endpoint responded with: {e}[/yellow]")
        except Exception as e:
            print(f"[red]Error testing RPC endpoint: {e}[/red]")
    except Exception as e:
        print(f"[red]Connection test error: {e}[/red]")


def _print_agent_card(response: Any) -> None:
    """Render parsed agent-card.json fields."""
    try:
        data = response.json()
        print(f"Agent name: {data.get('name', 'Unknown')}")
        print(f"Description: {data.get('description', 'Not provided')}")
        print(f"Version: {data.get('version', 'Unknown')}")
        if 'capabilities' in data:
            print("\nAgent capabilities:")
            for cap in data['capabilities']:
                print(f"- {cap}")
    except Exception as e:
        print(f"Error parsing agent card: {e}")


def _print_method_table(console: Console, client: Any) -> None:
    """Render a table of A2A protocol commands and their availability."""
    print("\n[bold]A2A Protocol Commands:[/bold]")
    table = Table(title="Available A2A Methods")
    table.add_column("Command", style="green")
    table.add_column("A2A Method")
    table.add_column("Status")

    methods = [
        ("/send", "tasks/send", "send_task"),
        ("/get", "tasks/get", "get_task"),
        ("/cancel", "tasks/cancel", "cancel_task"),
        ("/resubscribe", "tasks/resubscribe", "resubscribe"),
        ("/send_subscribe", "tasks/sendSubscribe", "send_subscribe"),
    ]

    for cmd, method, client_method in methods:
        if client and hasattr(client, client_method):
            func = getattr(client, client_method)
            status = "[green]Available[/green]" if callable(func) else "[yellow]Not callable[/yellow]"
            table.add_row(cmd, method, status)
        else:
            table.add_row(cmd, method, "[red]Not implemented[/red]")

    console.print(table)
