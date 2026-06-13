#!/usr/bin/env python3
# a2a_cli/chat/commands/tasks/subscribe.py
"""
The /send_subscribe command: send a task and stream its updates over SSE.
"""
import uuid
from typing import List, Dict, Any

from rich import print
from rich.console import Console

from a2a_cli.a2a_client import A2AClient
from a2a_json_rpc.spec import TextPart, Message, TaskSendParams

from a2a_cli.ui.ui_helpers import display_task_info
from .stream import consume_event_stream, render_completion


async def cmd_send_subscribe(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Send a task and subscribe to its updates using tasks/sendSubscribe.

    Usage: /send_subscribe <text>
    """
    if len(cmd_parts) < 2:
        print("[yellow]Error: No text provided. Usage: /send_subscribe <text>[/yellow]")
        return True

    text = " ".join(cmd_parts[1:])

    # 1) Ensure we have an HTTP client (with the correct /rpc URL)
    http_client = context.get("client")
    base_url = context.get("base_url", "http://localhost:8000")
    rpc_url = base_url.rstrip("/") + "/rpc"
    if not http_client:
        try:
            http_client = A2AClient.over_http(rpc_url)
            context["client"] = http_client
        except Exception as e:
            print(f"[red]Error creating HTTP client: {e}[/red]")
            if context.get("debug_mode"):
                import traceback
                traceback.print_exc()
            return True

    # 2) Ensure we have a streaming client (with the correct /events URL)
    sse_client = context.get("streaming_client")
    events_url = base_url.rstrip("/") + "/events"
    if not sse_client:
        try:
            print(f"[dim]Initializing SSE client for {events_url}...[/dim]")
            sse_client = A2AClient.over_sse(rpc_url, events_url)
            context["streaming_client"] = sse_client
            print(f"[green]SSE client initialized[/green]")
        except Exception as e:
            print(f"[yellow]Warning: Could not initialize SSE client: {e}[/yellow]")
            print(f"[yellow]Streaming will fall back to non‑streaming mode[/yellow]")
            sse_client = None

    # 3) Build the send parameters
    task_id = str(uuid.uuid4())
    part = TextPart(type="text", text=text)
    message = Message(role="user", parts=[part])
    params = TaskSendParams(id=task_id, sessionId=None, message=message)
    context["last_task_id"] = task_id

    console = Console()
    print(f"[dim]Sending task with ID: {task_id}[/dim]")

    try:
        # Send the initial task via HTTP RPC
        task = await http_client.send_task(params)
        display_task_info(task)
    except Exception as e:
        print(f"[red]Error sending task: {e}[/red]")
        if context.get("debug_mode"):
            import traceback
            traceback.print_exc()
        return True

    # 4) If we have an SSE client, stream updates
    if sse_client:
        print(f"[dim]Subscribing to updates. Press Ctrl+C to stop...[/dim]")
        final_status = None
        all_artifacts: List[Any] = []

        try:
            final_status, all_artifacts = await consume_event_stream(
                sse_client.send_subscribe(params), console
            )
        except KeyboardInterrupt:
            print("\n[yellow]Subscription interrupted.[/yellow]")
        except Exception as e:
            print(f"\n[red]Error during streaming: {e}[/red]")
            if context.get("debug_mode"):
                import traceback
                traceback.print_exc()

        # 5) Final output
        render_completion(task_id, final_status, all_artifacts, console)

    return True
