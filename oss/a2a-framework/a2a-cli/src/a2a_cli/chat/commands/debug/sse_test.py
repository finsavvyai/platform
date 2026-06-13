#!/usr/bin/env python3
# a2a_cli/chat/commands/debug/sse_test.py
"""
The /test_sse command: exercise the SSE connection to the server.
"""
import logging
import asyncio
from typing import List, Dict, Any

from rich import print
from rich.panel import Panel

from a2a_cli.a2a_client import A2AClient


async def cmd_test_sse(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Test SSE connection with the server.

    Usage: /test_sse [--timeout <seconds>]

    Example: /test_sse --timeout 10
    """
    base_url = context.get("base_url", "http://localhost:8000")
    rpc_url = base_url + "/rpc"
    events_url = base_url + "/events"

    # Parse timeout if provided
    timeout = 5.0
    if len(cmd_parts) > 2 and cmd_parts[1] == "--timeout":
        try:
            timeout = float(cmd_parts[2])
        except (ValueError, IndexError):
            print("[yellow]Invalid timeout value. Using default 5 seconds.[/yellow]")

    print(Panel(f"Testing SSE Connection to {events_url}", style="cyan"))

    # First, check the client configuration
    print("[bold]SSE Client Configuration:[/bold]")
    client = context.get("streaming_client")
    if client and hasattr(client, 'transport'):
        transport_type = type(client.transport).__name__
        print(f"Transport type: {transport_type}")

        if hasattr(client.transport, 'sse_endpoint'):
            print(f"Configured SSE endpoint: {client.transport.sse_endpoint}")
    else:
        print("[yellow]No streaming client available. Creating new one for test...[/yellow]")

    # Test direct HTTP connection to the events endpoint
    print("\n[bold]Testing HTTP Connection to Events Endpoint:[/bold]")
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            headers = {"Accept": "text/event-stream"}
            print(f"Sending GET request to {events_url}...")

            try:
                async with client.stream("GET", events_url, headers=headers, timeout=timeout) as response:
                    print(f"Response status: {response.status_code}")
                    print(f"Response headers: {dict(response.headers)}")

                    if response.status_code == 200:
                        print("[green]SSE connection successful![/green]")
                        print(f"[yellow]Waiting for first event (will timeout after {timeout} seconds)...[/yellow]")

                        try:
                            event_received = False
                            async for line in response.aiter_lines():
                                if line.strip():  # Only print non-empty lines
                                    print(f"Received: {line}")
                                    event_received = True
                                    break  # Just show the first line

                            if event_received:
                                print("[green]Successfully received event data![/green]")
                            else:
                                print("[yellow]Connected, but no data was received.[/yellow]")
                        except httpx.ReadTimeout:
                            print("[yellow]No events received in timeout period, but connection was successful.[/yellow]")
                    else:
                        print(f"[red]Failed to connect to SSE endpoint. Status: {response.status_code}[/red]")
                        print(f"Response body: {await response.text()}")
            except Exception as e:
                print(f"[red]Error connecting to SSE endpoint: {e}[/red]")
    except ImportError:
        print("[red]httpx not installed. Cannot test SSE connection.[/red]")

    # Now test the actual client's streaming capability
    print("\n[bold]Testing A2A Client Streaming API:[/bold]")
    streaming_client = context.get("streaming_client")
    if not streaming_client:
        try:
            print(f"Creating new streaming client for {rpc_url} and {events_url}...")
            streaming_client = A2AClient.over_sse(rpc_url, events_url)
            context["streaming_client"] = streaming_client
        except Exception as e:
            print(f"[red]Failed to create streaming client: {e}[/red]")
            return True

    print("Testing stream() method...")
    try:
        # Use asyncio.wait_for to implement timeout
        async def _test_stream():
            async for msg in streaming_client.transport.stream():
                print(f"Received event: {msg}")
                return True  # Exit after first message
            return False

        try:
            result = await asyncio.wait_for(_test_stream(), timeout=timeout)
            if result:
                print("[green]Successfully received event from transport.stream()[/green]")
            else:
                print("[yellow]Stream ended without receiving any events[/yellow]")
        except asyncio.TimeoutError:
            print("[yellow]No events received within timeout period, but stream() is working[/yellow]")
        except Exception as e:
            print(f"[red]Error in stream() method: {e}[/red]")
    except Exception as e:
        print(f"[red]Failed to test stream method: {e}[/red]")

    # Set debug mode
    context["debug_mode"] = True
    logging.getLogger("a2a-client").setLevel(logging.DEBUG)
    logging.getLogger("a2a-client.sse").setLevel(logging.DEBUG)
    print("\n[green]Debug mode enabled for SSE. Detailed logs will be shown for future operations.[/green]")

    return True
