#!/usr/bin/env python3
# a2a_cli/chat/commands/agent/card_render.py
"""
Pure rendering helpers that build the agent-card markup string.
"""
from typing import Dict, Any

_CAPABILITY_DESCRIPTIONS = {
    "streaming": "Supports real-time streaming responses",
    "tasks/sendSubscribe": "Supports combined send and subscribe operations",
    "tasks/resubscribe": "Supports subscribing to existing tasks",
    "tasks/send": "Supports sending tasks",
    "tasks/get": "Supports retrieving task status",
    "tasks/cancel": "Supports canceling tasks",
}


def build_agent_card_content(agent_info: Dict[str, Any], base_url: str) -> str:
    """Build the Rich-markup body describing an agent card."""
    agent_name = agent_info.get("name", "Unknown Agent")
    agent_version = agent_info.get("version", "Unknown")
    description = agent_info.get("description", "No description provided")

    content = f"[bold cyan]{agent_name}[/bold cyan]"
    if agent_version != "Unknown":
        content += f" [dim]v{agent_version}[/dim]"
    content += f"\n\n{description}\n\n"

    content += _render_capabilities(agent_info)
    content += _render_skills(agent_info)
    content += _render_modes(agent_info.get("default_input_modes", {}), "Input Modes")
    content += _render_modes(agent_info.get("default_output_modes", {}), "Output Modes")
    content += _render_extra_fields(agent_info)
    content += _render_connection_info(agent_info, base_url)
    return content


def _render_capabilities(agent_info: Dict[str, Any]) -> str:
    """Render the capabilities section."""
    capabilities = []
    caps = agent_info.get("capabilities")
    if isinstance(caps, dict):
        capabilities = [k for k, v in caps.items() if isinstance(v, bool) and v]
    elif isinstance(caps, list):
        capabilities = caps

    if not capabilities:
        return ""

    out = "[bold yellow]Capabilities[/bold yellow]\n\n"
    for cap in capabilities:
        desc = _CAPABILITY_DESCRIPTIONS.get(cap, "")
        if desc:
            out += f"• [green]{cap}[/green] - {desc}\n"
        else:
            out += f"• [green]{cap}[/green]\n"
    return out


def _render_skills(agent_info: Dict[str, Any]) -> str:
    """Render the skills section."""
    skills = agent_info.get("skills", [])
    if not skills:
        return ""
    out = "\n[bold yellow]Skills[/bold yellow]\n\n"
    for skill in skills:
        skill_name = skill.get("name", "Unnamed")
        skill_desc = skill.get("description", "")
        out += f"• [green]{skill_name}[/green] - {skill_desc}\n"
    return out


def _render_modes(modes: Any, title: str) -> str:
    """Render an input/output modes section."""
    if not (modes and isinstance(modes, dict)):
        return ""
    out = f"\n[bold yellow]{title}[/bold yellow]\n\n"
    for mode_type, mode_info in modes.items():
        if isinstance(mode_info, dict):
            enabled = mode_info.get("enabled", False)
            status = "[green]Enabled[/green]" if enabled else "[red]Disabled[/red]"
            out += f"• [magenta]{mode_type}[/magenta]: {status}"
            config = mode_info.get("configuration")
            if isinstance(config, dict) and config:
                out += " - "
                items = []
                for key, value in config.items():
                    if isinstance(value, bool):
                        value_str = "[green]Yes[/green]" if value else "[red]No[/red]"
                    else:
                        value_str = str(value)
                    items.append(f"{key}: {value_str}")
                out += ", ".join(items)
        elif isinstance(mode_info, bool):
            status = "[green]Enabled[/green]" if mode_info else "[red]Disabled[/red]"
            out += f"• [magenta]{mode_type}[/magenta]: {status}"
        else:
            out += f"• [magenta]{mode_type}[/magenta]: {mode_info}"
        out += "\n"
    return out


def _render_extra_fields(agent_info: Dict[str, Any]) -> str:
    """Render any fields not covered by the known sections."""
    known_fields = {"name", "version", "description", "capabilities", "skills", "url",
                    "default_input_modes", "default_output_modes"}
    extra_fields = {k: v for k, v in agent_info.items() if k not in known_fields}
    if not extra_fields:
        return ""

    out = "\n[bold yellow]Additional Information[/bold yellow]\n\n"
    for key, value in extra_fields.items():
        if isinstance(value, dict) and len(value) <= 3:
            preview = ", ".join(f"{k}" for k in value.keys())
            out += f"• [cyan]{key}:[/cyan] {{[dim]{preview}[/dim]}} [dim italic](use --raw for details)[/dim italic]\n"
        elif isinstance(value, list) and len(value) <= 5:
            preview = f"{len(value)} items"
            if all(isinstance(x, str) for x in value):
                preview += f": {', '.join(value[:3])}"
                if len(value) > 3:
                    preview += ", ..."
            out += f"• [cyan]{key}:[/cyan] [[dim]{preview}[/dim]] [dim italic](use --raw for details)[/dim italic]\n"
        elif isinstance(value, (dict, list)):
            out += f"• [cyan]{key}:[/cyan] [dim italic]Complex data ({type(value).__name__}) - use --raw to view[/dim italic]\n"
        else:
            out += f"• [cyan]{key}:[/cyan] {value}\n"
    return out


def _render_connection_info(agent_info: Dict[str, Any], base_url: str) -> str:
    """Render the connection-information section."""
    if not ("url" in agent_info or "mount" in agent_info or "basePath" in agent_info):
        return ""
    out = "\n[bold yellow]Connection Information[/bold yellow]\n\n"
    if "url" in agent_info:
        out += f"• [cyan]URL:[/cyan] {agent_info['url']}\n"
    if "mount" in agent_info:
        out += f"• [cyan]Mount point:[/cyan] /{agent_info['mount']}\n"
    elif "basePath" in agent_info:
        out += f"• [cyan]Base path:[/cyan] {agent_info['basePath']}\n"
    if base_url:
        out += f"• [cyan]Connected to:[/cyan] {base_url}\n"
    return out
