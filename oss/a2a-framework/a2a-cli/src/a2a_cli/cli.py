#!/usr/bin/env python3
# a2a_cli/cli.py
"""
A2A Client CLI

Provides a rich, interactive command-line interface for the Agent-to-Agent protocol.
Includes commands to send, get, cancel, and watch tasks via various A2A transports.
"""
import sys
import asyncio
import logging
import json
import os

import typer

# a2a cli imports
from a2a_cli.a2a_client import A2AClient
from a2a_cli.chat.chat_handler import handle_chat_mode
from a2a_cli.ui.ui_helpers import restore_terminal
from a2a_cli.cli_helpers import (
    setup_logging,
    resolve_base,
    install_signal_handlers,
)
from a2a_cli.task_commands import register_task_commands

# Install terminal-restoration handlers at import time (as in the original module)
install_signal_handlers()

# -----------------------------------------------------------------------------
app = typer.Typer(help="A2A Client CLI - Interactive client for the Agent-to-Agent protocol")


@app.callback(invoke_without_command=True)
def common_options(
    ctx: typer.Context,
    config_file: str = typer.Option("~/.a2a/config.json", help="Path to config file"),
    server: str = typer.Option(None, help="Server URL or name from config"),
    debug: bool = typer.Option(False, help="Enable debug logging"),
    quiet: bool = typer.Option(False, help="Suppress non-essential output"),
    log_level: str = typer.Option("INFO", help="Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL"),
):
    """
    Common options: config file, server, debug, quiet, log-level.
    If no subcommand is given, launches interactive chat mode.
    """
    # Validate log level
    if not isinstance(getattr(logging, log_level.upper(), None), int):
        typer.echo(f"Invalid log level: {log_level}")
        raise typer.Exit(1)

    class Args:
        pass
    args = Args()
    args.debug = debug
    args.quiet = quiet
    args.log_level = log_level
    setup_logging(args)

    expanded = os.path.expanduser(config_file)
    base_url = None
    if server:
        if server.startswith(("http://", "https://")):
            base_url = server
        else:
            # Try lookup in config
            if os.path.exists(expanded):
                cfg = json.load(open(expanded))
                base_url = cfg.get("servers", {}).get(server)
            if not base_url:
                base_url = resolve_base(server)

    ctx.obj = {"config_file": expanded, "base_url": base_url, "debug": debug, "quiet": quiet}

    if ctx.invoked_subcommand is None:
        try:
            asyncio.run(handle_chat_mode(base_url, expanded))
        finally:
            restore_terminal()
        raise typer.Exit()


# Task subcommands (send / get / cancel / watch) live in task_commands.py
register_task_commands(app)


# -----------------------------------------------------------------------------
@app.command()
def chat(
    config_file: str = typer.Option("~/.a2a/config.json", help="Path to config file"),
    server: str = typer.Option(None, help="Server URL or name"),
):
    """Start interactive chat mode."""
    expanded = os.path.expanduser(config_file)
    base = server if server and server.startswith(("http://", "https://")) else None
    asyncio.run(handle_chat_mode(base, expanded))
    restore_terminal()


# -----------------------------------------------------------------------------
@app.command()
def stdio():
    """Run in stdio mode (JSON-RPC over stdin/stdout)."""
    client = A2AClient.over_stdio()

    async def _run_stdio():
        async for message in client.transport.stream():
            # handle JSON-RPC requests here...
            pass

    asyncio.run(_run_stdio())


# -----------------------------------------------------------------------------
if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        app()
    except KeyboardInterrupt:
        logging.getLogger("a2a-client").debug("Interrupted by user")
    finally:
        restore_terminal()
