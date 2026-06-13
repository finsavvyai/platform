#!/usr/bin/env python3
# a2a_cli/chat/commands/tasks/resubscribe.py
"""
The /resubscribe command: watch updates for an existing task over SSE.
"""
import asyncio
from typing import List, Dict, Any

from rich import print
from rich.live import Live
from rich.text import Text
from rich.console import Console

from a2a_cli.a2a_client import A2AClient
from a2a_json_rpc.spec import (
    TaskQueryParams,
    TaskStatusUpdateEvent,
    TaskArtifactUpdateEvent,
)

from a2a_cli.ui.ui_helpers import format_status_event, format_artifact_event
from .stream import render_completion


async def cmd_resubscribe(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Watch status and artifact updates for an existing task using tasks/resubscribe.

    Usage: /resubscribe <id>

    Example: /resubscribe 123e4567-e89b-12d3-a456-426614174000
    """
    # Get the client from context
    client = context.get("client")
    if not client:
        print("[red]Error: Not connected to a server. Use /connect first.[/red]")
        return True

    # Determine task ID
    task_id = None
    if len(cmd_parts) > 1:
        task_id = cmd_parts[1]
    elif "last_task_id" in context:
        task_id = context["last_task_id"]
        print(f"[dim]Using last task ID: {task_id}[/dim]")
    else:
        print("[yellow]Error: No task ID provided and no previous task found.[/yellow]")
        return True

    # Set up SSE client if needed
    if not hasattr(client, "transport") or not hasattr(client.transport, "stream"):
        print("[yellow]Client does not support streaming. Creating a new streaming client...[/yellow]")

        base_url = context.get("base_url", "http://localhost:8000")
        rpc_url = base_url + "/rpc"
        events_url = base_url + "/events"

        try:
            client = A2AClient.over_sse(rpc_url, events_url)
            context["streaming_client"] = client
        except Exception as e:
            print(f"[red]Error creating streaming client: {e}[/red]")
            if context.get("debug_mode", False):
                import traceback
                traceback.print_exc()
            return True
    else:
        # Use existing client
        client = context.get("streaming_client", client)

    console = Console()
    print(f"[dim]Resubscribing to task {task_id}. Press Ctrl+C to stop...[/dim]")

    try:
        params = TaskQueryParams(id=task_id)
        all_artifacts = []
        final_status = None

        with Live("", refresh_per_second=4, console=console) as live:
            try:
                async for evt in client.resubscribe(params):
                    if isinstance(evt, TaskStatusUpdateEvent):
                        live.update(Text.from_markup(format_status_event(evt)))
                        if evt.final:
                            final_status = evt.status
                            break
                    elif isinstance(evt, TaskArtifactUpdateEvent):
                        live.update(Text.from_markup(format_artifact_event(evt)))
                        all_artifacts.append(evt.artifact)
                    else:
                        live.update(Text(f"Unknown event: {type(evt).__name__}"))
            except asyncio.CancelledError:
                print("\n[yellow]Watch interrupted.[/yellow]")
            except Exception as e:
                print(f"\n[red]Error watching task: {e}[/red]")
                if context.get("debug_mode", False):
                    import traceback
                    traceback.print_exc()

        # Display completion message + artifacts
        render_completion(task_id, final_status, all_artifacts, console)

        return True
    except KeyboardInterrupt:
        print("\n[yellow]Watch interrupted.[/yellow]")
        return True
    except Exception as e:
        print(f"[red]Error setting up watch: {e}[/red]")
        if context.get("debug_mode", False):
            import traceback
            traceback.print_exc()
        return True
