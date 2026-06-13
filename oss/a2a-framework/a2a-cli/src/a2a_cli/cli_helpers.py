#!/usr/bin/env python3
# a2a_cli/cli_helpers.py
"""
Helpers for the A2A Client CLI: logging configuration, base-URL resolution,
server reachability checks, and terminal signal handling.
"""
import sys
import signal
import atexit
import logging
from typing import Optional

from a2a_cli.ui.ui_helpers import restore_terminal

DEFAULT_HOST = "http://localhost:8000"
RPC_SUFFIX = "/rpc"
EVENTS_SUFFIX = "/events"


def setup_logging(args) -> logging.Logger:
    """
    Configure logging so that by default only errors are shown,
    unless --debug or a more verbose --log-level is requested.
    """
    # Determine desired level
    if args.debug:
        level = logging.DEBUG
    elif args.quiet:
        level = logging.ERROR
    elif args.log_level.upper() not in ("INFO",):
        level = getattr(logging, args.log_level.upper(), logging.ERROR)
    else:
        # default “clean” mode: show only errors
        level = logging.ERROR

    # Root logger: only errors
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.ERROR)

    # CLI logger
    cli_logger = logging.getLogger("a2a-cli")
    cli_logger.setLevel(level)

    # HTTPX logger (if present)
    http_logger = logging.getLogger("httpx") if "httpx" in sys.modules else None
    if http_logger:
        http_logger.setLevel(logging.WARNING if args.quiet else level)

    # SSE logger
    sse_logger = logging.getLogger("a2a-client.sse")
    sse_logger.setLevel(logging.WARNING if args.quiet else level)

    # Formatter: include timestamps only in debug
    fmt = "%(asctime)s - %(levelname)s - %(message)s" if args.debug else "%(message)s"
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(fmt))

    # Clear existing handlers and attach our handler
    for lg in [root_logger, cli_logger, sse_logger] + ([http_logger] if http_logger else []):
        lg.handlers.clear()
        lg.addHandler(handler)

    return cli_logger


def resolve_base(prefix: Optional[str]) -> str:
    """Resolve a prefix/URL into an absolute server base URL."""
    if prefix and prefix.startswith(("http://", "https://")):
        return prefix.rstrip("/")
    if prefix:
        return f"{DEFAULT_HOST.rstrip('/')}/{prefix.strip('/')}"
    return DEFAULT_HOST


async def check_server_running(base_url: str, quiet: bool = False) -> bool:
    """Return True if the server at base_url is reachable (or httpx is absent)."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            try:
                await client.get(base_url, timeout=3.0)
            except httpx.ConnectError:
                if not quiet:
                    logging.getLogger("a2a-cli").error(
                        "Cannot connect to A2A server at %s", base_url
                    )
                return False
            except Exception as exc:
                if not quiet:
                    logging.getLogger("a2a-cli").warning(
                        "Server check warning: %s", exc
                    )
                return False
    except ImportError:
        logging.getLogger("a2a-cli").warning(
            "httpx not installed, skipping connection check"
        )
    return True


def restore_and_exit(signum=None, frame=None):
    """Clean up and exit on signal."""
    restore_terminal()
    sys.exit(0)


def install_signal_handlers() -> None:
    """Register terminal-restoration handlers for exit and signals."""
    atexit.register(restore_terminal)
    signal.signal(signal.SIGINT, restore_and_exit)
    signal.signal(signal.SIGTERM, restore_and_exit)
    if hasattr(signal, "SIGQUIT"):
        signal.signal(signal.SIGQUIT, restore_and_exit)
