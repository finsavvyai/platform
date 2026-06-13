#!/usr/bin/env python3
# a2a_cli/task_commands.py
"""
Typer task subcommands (send / get / cancel / watch) for the A2A Client CLI.

``register_task_commands(app)`` attaches these commands to the given Typer app,
keeping the command bodies out of ``cli.py`` to respect the file-size limit.
"""
import uuid
import json
import asyncio
import logging
from typing import Optional

import typer
from rich import print
from rich.console import Console

from a2a_json_rpc.spec import (
    TextPart, Message,
    TaskSendParams, TaskQueryParams, TaskIdParams,
    TaskStatusUpdateEvent, TaskArtifactUpdateEvent,
)
from a2a_json_rpc.json_rpc_errors import JSONRPCError

from a2a_cli.a2a_client import A2AClient
from a2a_cli.ui.ui_helpers import display_task_info
from a2a_cli.cli_helpers import RPC_SUFFIX, EVENTS_SUFFIX, resolve_base, check_server_running


def send(
    text: str = typer.Argument(..., help="Text of the task to send"),
    prefix: Optional[str] = typer.Option(None, help="Handler mount or URL"),
    wait: bool = typer.Option(False, help="Wait and stream status/artifacts"),
    color: bool = typer.Option(True, help="Colorize output"),
):
    """Send a text task to the A2A server and optionally wait for results."""
    base = resolve_base(prefix)
    rpc_url = base + RPC_SUFFIX
    events_url = base + EVENTS_SUFFIX
    if not asyncio.run(check_server_running(base, quiet=False)):
        raise typer.Exit(1)

    client = A2AClient.over_http(rpc_url)
    task_id = str(uuid.uuid4())
    params = TaskSendParams(
        id=task_id,
        sessionId=None,
        message=Message(role="user", parts=[TextPart(type="text", text=text)])
    )

    try:
        task = asyncio.run(client.send_task(params))
        if not wait:
            display_task_info(task, color)
        logging.getLogger("a2a-client").debug(
            "Send response: %s", json.dumps(task.model_dump(by_alias=True), indent=2)
        )
    except JSONRPCError as exc:
        logging.getLogger("a2a-client").error("Send failed: %s", exc)
        raise typer.Exit(1)

    if wait:
        sse_client = A2AClient.over_sse(rpc_url, events_url)

        async def _stream():
            from rich.live import Live
            from rich.text import Text
            from a2a_cli.ui.ui_helpers import format_status_event, format_artifact_event
            console = Console()
            with Live("", refresh_per_second=4, console=console) as live:
                async for evt in sse_client.send_subscribe(params):
                    if isinstance(evt, TaskStatusUpdateEvent):
                        live.update(Text.from_markup(format_status_event(evt)))
                    elif isinstance(evt, TaskArtifactUpdateEvent):
                        live.update(Text.from_markup(format_artifact_event(evt)))
        asyncio.run(_stream())


def get(
    id: str = typer.Argument(..., help="Task ID to fetch"),
    prefix: Optional[str] = typer.Option(None, help="Handler mount or URL"),
    json_output: bool = typer.Option(False, "--json", help="Output full JSON"),
    color: bool = typer.Option(True, help="Colorize output"),
):
    """Fetch a task by ID."""
    base = resolve_base(prefix)
    rpc_url = base + RPC_SUFFIX
    if not asyncio.run(check_server_running(base, quiet=False)):
        raise typer.Exit(1)

    client = A2AClient.over_http(rpc_url)
    task = asyncio.run(client.get_task(TaskQueryParams(id=id)))
    if json_output:
        Console().print(json.dumps(task.model_dump(by_alias=True), indent=2))
    else:
        display_task_info(task, color)


def cancel(
    id: str = typer.Argument(..., help="Task ID to cancel"),
    prefix: Optional[str] = typer.Option(None, help="Handler mount or URL"),
):
    """Cancel a task by ID."""
    base = resolve_base(prefix)
    rpc_url = base + RPC_SUFFIX
    if not asyncio.run(check_server_running(base, quiet=False)):
        raise typer.Exit(1)

    asyncio.run(A2AClient.over_http(rpc_url).cancel_task(TaskIdParams(id=id)))
    Console().print(f"[green]Canceled task {id}[/green]")


def watch(
    id: Optional[str] = typer.Argument(None, help="Task ID to watch"),
    text: Optional[str] = typer.Option(None, help="Text to send and watch new task"),
    prefix: Optional[str] = typer.Option(None, help="Handler mount or URL"),
):
    """Watch task events via SSE."""
    base = resolve_base(prefix)
    rpc_url = base + RPC_SUFFIX
    events_url = base + EVENTS_SUFFIX
    if not asyncio.run(check_server_running(base, quiet=False)):
        raise typer.Exit(1)

    client = A2AClient.over_sse(rpc_url, events_url)
    from rich.live import Live
    from rich.text import Text
    from a2a_cli.ui.ui_helpers import format_status_event, format_artifact_event

    if text:
        params = TaskSendParams(
            id=str(uuid.uuid4()), sessionId=None,
            message=Message(role="user", parts=[TextPart(type="text", text=text)])
        )
        stream = client.send_subscribe(params)
    elif id:
        stream = client.resubscribe(TaskQueryParams(id=id))
    else:
        print("[red]Error: specify --id or --text[/red]")
        return

    async def _watch():
        console = Console()
        with Live("", refresh_per_second=4, console=console) as live:
            async for evt in stream:
                if isinstance(evt, TaskStatusUpdateEvent):
                    live.update(Text.from_markup(format_status_event(evt)))
                elif isinstance(evt, TaskArtifactUpdateEvent):
                    live.update(Text.from_markup(format_artifact_event(evt)))
    asyncio.run(_watch())


def register_task_commands(app: typer.Typer) -> None:
    """Attach the send/get/cancel/watch commands to the given Typer app."""
    app.command()(send)
    app.command()(get)
    app.command()(cancel)
    app.command()(watch)
