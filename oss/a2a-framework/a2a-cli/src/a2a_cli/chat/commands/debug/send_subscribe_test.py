#!/usr/bin/env python3
# a2a_cli/chat/commands/debug/send_subscribe_test.py
"""
The /test_send_subscribe command: diagnostic sendSubscribe with event counts.
"""
import logging
import asyncio
from typing import List, Dict, Any

from rich import print
from rich.panel import Panel
from rich.console import Console


async def cmd_test_send_subscribe(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Test the sendSubscribe operation with diagnostic information.

    Usage: /test_send_subscribe <text>

    Example: /test_send_subscribe hello
    """
    if len(cmd_parts) < 2:
        print("[yellow]Error: No text provided. Usage: /test_send_subscribe <text>[/yellow]")
        return True

    # Enable debug mode
    context["debug_mode"] = True
    logging.getLogger("a2a-client").setLevel(logging.DEBUG)
    logging.getLogger("a2a-client.sse").setLevel(logging.DEBUG)

    print(Panel("Testing sendSubscribe Operation with Diagnostics", style="cyan"))

    # Extract text
    text = " ".join(cmd_parts[1:])

    # Get server information
    base_url = context.get("base_url", "http://localhost:8000")
    rpc_url = base_url + "/rpc"
    events_url = base_url + "/events"

    print("[bold]Connection Information:[/bold]")
    print(f"Base URL: {base_url}")
    print(f"RPC URL: {rpc_url}")
    print(f"Events URL: {events_url}")

    # Create a new SSE client specifically for this test
    try:
        print("\n[bold]Creating new SSE client...[/bold]")
        from a2a_cli.a2a_client import A2AClient
        sse_client = A2AClient.over_sse(rpc_url, events_url)

        # Show client information
        print(f"Client type: {type(sse_client).__name__}")
        print(f"Transport type: {type(sse_client.transport).__name__}")

        if hasattr(sse_client.transport, 'endpoint'):
            print(f"Transport endpoint: {sse_client.transport.endpoint}")
        if hasattr(sse_client.transport, 'sse_endpoint'):
            print(f"SSE endpoint: {sse_client.transport.sse_endpoint}")
        if hasattr(sse_client.transport, 'alias_endpoint'):
            print(f"Alias endpoint: {sse_client.transport.alias_endpoint}")
    except Exception as e:
        print(f"[red]Error creating SSE client: {e}[/red]")
        return True

    # Create the task parameters
    print("\n[bold]Creating task parameters...[/bold]")
    from a2a_json_rpc.spec import TextPart, Message, TaskSendParams
    import uuid

    task_id = str(uuid.uuid4())
    part = TextPart(type="text", text=text)
    message = Message(role="user", parts=[part])
    params = TaskSendParams(id=task_id, sessionId=None, message=message)

    print(f"Task ID: {task_id}")
    print(f"Parameters: {params.model_dump(exclude_none=True)}")

    # Store in context for reference
    context["last_task_id"] = task_id

    console = Console()
    print(f"\n[bold]Sending task and subscribing to updates...[/bold]")
    print(f"Text: '{text}'")

    # Set up event tracking
    status_events = 0
    artifact_events = 0
    other_events = 0

    try:
        from rich.live import Live
        from rich.text import Text
        from a2a_cli.ui.ui_helpers import format_status_event, format_artifact_event

        with Live("", refresh_per_second=4, console=console) as live:
            try:
                print(f"[dim]Calling send_subscribe method...[/dim]")

                # Start a timer
                import time
                start_time = time.time()

                async for evt in sse_client.send_subscribe(params):
                    elapsed = time.time() - start_time

                    if hasattr(evt, "__class__"):
                        evt_type = evt.__class__.__name__
                    else:
                        evt_type = type(evt).__name__

                    # Debug information
                    print(f"[dim]Received event type: {evt_type} at {elapsed:.2f}s[/dim]")

                    if hasattr(evt, "status"):
                        status_events += 1
                        live.update(Text.from_markup(format_status_event(evt)))

                        # Debug status information
                        if hasattr(evt.status, "state"):
                            print(f"[dim]Status state: {evt.status.state}[/dim]")

                        # Check for final event
                        if hasattr(evt, "final") and evt.final:
                            print(f"[green]Task {task_id} completed after {elapsed:.2f}s with {status_events} status events and {artifact_events} artifact events[/green]")
                            break
                    elif hasattr(evt, "artifact"):
                        artifact_events += 1
                        live.update(Text.from_markup(format_artifact_event(evt)))

                        # Debug artifact information
                        if hasattr(evt.artifact, "name"):
                            print(f"[dim]Artifact name: {evt.artifact.name}[/dim]")
                    else:
                        other_events += 1
                        live.update(Text(f"Unknown event at {elapsed:.2f}s: {evt_type}"))

                        # Extra debug for unknown events
                        print(f"[dim]Unknown event data: {evt}[/dim]")
            except asyncio.CancelledError:
                print("\n[yellow]Operation interrupted.[/yellow]")
            except Exception as e:
                print(f"\n[red]Error during sendSubscribe: {e}[/red]")
                import traceback
                traceback.print_exc()
    except Exception as e:
        print(f"[red]Error setting up test: {e}[/red]")

    # Final report
    print("\n[bold]Test Results:[/bold]")
    print(f"Status Events: {status_events}")
    print(f"Artifact Events: {artifact_events}")
    print(f"Other Events: {other_events}")

    return True
