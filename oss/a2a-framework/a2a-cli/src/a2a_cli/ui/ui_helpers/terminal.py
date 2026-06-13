#!/usr/bin/env python3
# a2a_cli/ui/ui_helpers/terminal.py
"""
Cross-platform terminal control helpers.
"""
import os
import sys
import platform


def clear_screen() -> None:
    """Clear the terminal screen in a cross-platform way."""
    if platform.system() == "Windows":
        os.system("cls")
    else:
        os.system("clear")


def restore_terminal() -> None:
    """Best‑effort attempt to reset the TTY."""
    if sys.platform != "win32":
        os.system("stty sane")
