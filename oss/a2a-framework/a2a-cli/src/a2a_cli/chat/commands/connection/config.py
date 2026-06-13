#!/usr/bin/env python3
# a2a_cli/chat/commands/connection/config.py
"""
The /load_config and /save_config commands.
"""
import json
import os
from typing import List, Dict, Any

from rich import print

from .servers import cmd_servers


async def cmd_load_config(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Load server configuration from a file.

    Usage: /load_config <file_path>
    """
    if len(cmd_parts) > 1:
        file_path = os.path.expanduser(cmd_parts[1])
    else:
        default_paths = [
            "~/.a2a/config.json",
            "~/.a2a/servers.json",
            "./a2a-config.json",
            "./servers.json"
        ]
        for path in default_paths:
            expanded = os.path.expanduser(path)
            if os.path.exists(expanded):
                file_path = expanded
                print(f"[dim]Using config file: {file_path}[/dim]")
                break
        else:
            print("[yellow]No config file specified and no default config found.[/yellow]")
            print("[yellow]Usage: /load_config <file_path>[/yellow]")
            return True

    try:
        with open(file_path, 'r') as f:
            config = json.load(f)
        servers = config.get("servers", {})
        if not servers:
            print(f"[yellow]No servers found in config file: {file_path}[/yellow]")
            return True
        context["server_names"] = servers
        context["config_file"] = file_path
        print(f"[green]Loaded {len(servers)} servers from {file_path}[/green]")
        await cmd_servers(cmd_parts, context)
        return True
    except FileNotFoundError:
        print(f"[red]Config file not found: {file_path}[/red]")
        return True
    except json.JSONDecodeError:
        print(f"[red]Invalid JSON in config file: {file_path}[/red]")
        return True
    except Exception as e:
        print(f"[red]Error loading config: {e}[/red]")
        if context.get("debug_mode", False):
            traceback.print_exc()  # noqa: F821  (preserved from original module)
        return True


async def cmd_save_config(cmd_parts: List[str], context: Dict[str, Any]) -> bool:
    """
    Save current server configuration to a file.

    Usage: /save_config [file_path]
    """
    if len(cmd_parts) > 1:
        file_path = os.path.expanduser(cmd_parts[1])
    elif context.get("config_file"):
        file_path = context["config_file"]
    else:
        file_path = os.path.expanduser("~/.a2a/config.json")

    servers = context.get("server_names", {})
    if not servers:
        print("[yellow]No servers configured to save.[/yellow]")
        return True

    directory = os.path.dirname(file_path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
        print(f"[dim]Created directory: {directory}[/dim]")

    try:
        with open(file_path, 'w') as f:
            json.dump({"servers": servers}, f, indent=2)
        context["config_file"] = file_path
        print(f"[green]Saved {len(servers)} servers to {file_path}[/green]")
        return True
    except Exception as e:
        print(f"[red]Error saving config: {e}[/red]")
        if context.get("debug_mode", False):
            traceback.print_exc()  # noqa: F821  (preserved from original module)
        return True
