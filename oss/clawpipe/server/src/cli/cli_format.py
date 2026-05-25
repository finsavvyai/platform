"""AWS-style output formatting for FinSavvyAI CLI."""

import json
import os
import textwrap
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List


class OutputFormat(Enum):
    JSON = "json"
    TABLE = "table"
    TEXT = "text"
    YAML = "yaml"


class Color:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    WHITE = "\033[37m"
    GRAY = "\033[90m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    ORANGE = "\033[38;5;208m"
    RED = "\033[31m"
    BLUE = "\033[34m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_RED = "\033[41m"
    BG_BLUE = "\033[44m"


@dataclass
class Column:
    name: str
    width: int
    align: str = "left"
    color: str = None


class AWSStyleFormatter:
    """AWS-style output formatter."""

    COLOR_MAP = {
        "bold": Color.BOLD, "dim": Color.DIM, "white": Color.WHITE,
        "gray": Color.GRAY, "green": Color.GREEN, "yellow": Color.YELLOW,
        "orange": Color.ORANGE, "red": Color.RED, "blue": Color.BLUE,
        "cyan": Color.CYAN, "magenta": Color.MAGENTA,
    }

    def __init__(self, output_format: OutputFormat = OutputFormat.TABLE):
        self.output_format = output_format
        try:
            self.terminal_width = os.get_terminal_size().columns
        except Exception:
            self.terminal_width = 80

    def _colorize(self, text: str, color: str) -> str:
        code = self.COLOR_MAP.get(color, "")
        return f"{code}{text}{Color.RESET}" if code else text

    def format_table(self, data: List[Dict], columns: List[Column]) -> str:
        if self.output_format == OutputFormat.JSON:
            return json.dumps(data, indent=2)
        if self.output_format == OutputFormat.YAML:
            return self._format_yaml(data)

        if not data:
            return self._colorize("No results found.", "yellow")

        header = ""
        for col in columns:
            header += self._colorize(col.name.ljust(col.width), "bold") + " "
        separator = self._colorize("-" * min(sum(c.width + 1 for c in columns), self.terminal_width), "dim")
        lines = [header, separator]

        for row in data:
            line = ""
            for col in columns:
                val = str(row.get(col.name, ""))
                visible_len = len(val.replace(Color.RESET, "").replace(Color.GREEN, "").replace(Color.RED, "").replace(Color.YELLOW, "").replace(Color.BOLD, ""))
                padding = max(0, col.width - visible_len)
                line += val + " " * padding + " "
            lines.append(line)
        return "\n".join(lines)

    def _format_yaml(self, data: List[Dict]) -> str:
        lines = []
        for i, item in enumerate(data):
            if i > 0:
                lines.append("---")
            lines.append(self._dict_to_yaml(item, 0))
        return "\n".join(lines)

    def _dict_to_yaml(self, data: Dict, indent: int) -> str:
        lines = []
        prefix = "  " * indent
        for key, value in data.items():
            if isinstance(value, dict):
                lines.append(f"{prefix}{key}:")
                lines.append(self._dict_to_yaml(value, indent + 1))
            elif isinstance(value, list):
                lines.append(f"{prefix}{key}:")
                for item in value:
                    if isinstance(item, dict):
                        lines.append(f"{prefix}  -")
                        lines.append(self._dict_to_yaml(item, indent + 2))
                    else:
                        lines.append(f"{prefix}  - {item}")
            else:
                lines.append(f"{prefix}{key}: {value}")
        return "\n".join(lines)

    def format_key_value(self, key: str, value: str, key_width: int = 20, value_color: str = None) -> str:
        key_str = self._colorize(f"{key}:".ljust(key_width), "cyan")
        val_str = self._colorize(str(value), value_color) if value_color else str(value)
        return f"  {key_str} {val_str}"

    def format_error(self, message: str, error_code: str = None) -> str:
        error = self._colorize("ERROR", "red")
        code = f" ({self._colorize(error_code, 'yellow')})" if error_code else ""
        return f"\n{error}{code}: {message}"

    def format_success(self, message: str) -> str:
        return self._colorize(message, "green")

    def format_warning(self, message: str) -> str:
        return self._colorize(message, "yellow")
