#!/usr/bin/env python3
# a2a_cli/chat/commands/tasks/send.py
"""
The /send command: send a single task via tasks/send.
"""
import uuid
from typing import List, Dict, Any

from rich import print

from a2a_cli.a2a_client import A2AClient  # noqa: F401  (kept for parity / patching)
from a2a_json_rpc.spec import TextPart, Message, TaskSendParams

from a2a_cli.ui.ui_helpers import display_task_info
from .artifacts import display_task_artifacts


async def cmd_send(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Send a task to the A2A server using tasks/send.

    Usage: /send <text>

    Example: /send Hello, please summarize this conversation
    """
    if len(cmd_parts) < 2:
        print("[yellow]Error: No text provided. Usage: /send <text>[/yellow]")
        return True

    # Get the client from context
    client = context.get("client")
    if not client:
        print("[red]Error: Not connected to a server. Use /connect first.[/red]")
        return True

    # Extract the text (everything after the command)
    text = " ".join(cmd_parts[1:])

    # Create the task parameters
    task_id = str(uuid.uuid4())
    part = TextPart(type="text", text=text)
    message = Message(role="user", parts=[part])
    params = TaskSendParams(id=task_id, sessionId=None, message=message)

    try:
        # Send the task
        print(f"[dim]Sending task with ID: {task_id}[/dim]")
        task = await client.send_task(params)

        # Store the task ID in context for easy reference
        context["last_task_id"] = task_id

        # Display the task information
        display_task_info(task)

        # Display artifacts if any
        if hasattr(task, "artifacts") and task.artifacts:
            print(f"\n[bold]Artifacts ({len(task.artifacts)}):[/bold]")
            display_task_artifacts(task)

        return True
    except Exception as e:
        print(f"[red]Error sending task: {e}[/red]")
        if context.get("debug_mode", False):
            import traceback
            traceback.print_exc()
        return True
