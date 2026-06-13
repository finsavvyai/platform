#!/usr/bin/env python3
# a2a_cli/chat/commands/tasks/query.py
"""
The /get and /cancel commands: inspect and cancel tasks.
"""
from typing import List, Dict, Any

from rich import print
from rich.panel import Panel
from rich.console import Console

from a2a_json_rpc.spec import TaskQueryParams, TaskIdParams

from a2a_cli.ui.ui_helpers import display_task_info
from .artifacts import display_artifact


async def cmd_get(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Get details about a task by ID using tasks/get.

    Usage: /get <id>

    Example: /get 123e4567-e89b-12d3-a456-426614174000
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

    try:
        # Get the task - using proper TaskQueryParams object
        params = TaskQueryParams(id=task_id)
        task = await client.get_task(params)

        # Create console for output
        console = Console()

        # Display the task information
        display_task_info(task, console=console)

        # Display task status message if available
        if hasattr(task, "status") and hasattr(task.status, "message") and task.status.message:
            message = task.status.message
            if hasattr(message, "parts") and message.parts:
                message_parts = []
                for part in message.parts:
                    if hasattr(part, "text") and part.text:
                        message_parts.append(part.text)

                if message_parts:
                    console.print(Panel(
                        "\n".join(message_parts),
                        title="Task Message",
                        border_style="blue"
                    ))

        # Display all artifacts
        if hasattr(task, "artifacts") and task.artifacts:
            print(f"\n[bold]Artifacts ({len(task.artifacts)}):[/bold]")
            for artifact in task.artifacts:
                display_artifact(artifact, console)

        return True
    except Exception as e:
        print(f"[red]Error getting task: {e}[/red]")
        if context.get("debug_mode", False):
            import traceback
            traceback.print_exc()
        return True


async def cmd_cancel(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Cancel a running task using tasks/cancel.

    Usage: /cancel <id>

    Example: /cancel 123e4567-e89b-12d3-a456-426614174000
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

    try:
        # Cancel the task - using proper TaskIdParams object
        params = TaskIdParams(id=task_id)
        await client.cancel_task(params)

        print(f"[green]Successfully cancelled task {task_id}[/green]")

        # Get the latest task status
        await cmd_get(["/get", task_id], context)

        return True
    except Exception as e:
        print(f"[red]Error cancelling task: {e}[/red]")
        if context.get("debug_mode", False):
            import traceback
            traceback.print_exc()
        return True
