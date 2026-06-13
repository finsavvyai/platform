#!/usr/bin/env python3
# a2a_cli/chat/ui_manager/__init__.py
"""
UI Manager for the A2A client chat interface.

Handles the chat UI, status displays, and user interaction.

The ``ChatUIManager`` class composes two behaviour mixins
(:class:`SigintMixin`, :class:`TaskDisplayMixin`) so the implementation stays
within the project file-size limit while keeping a single public class and the
original ``from a2a_cli.chat.ui_manager import ChatUIManager`` import path.
"""
import os
import signal
from typing import Optional

from rich import print
from rich.panel import Panel
from rich.console import Console
from rich.live import Live

from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
from prompt_toolkit.styles import Style

# a2a client imports
from a2a_cli.chat.command_completer import ChatCommandCompleter
from a2a_cli.chat.commands import handle_command
from a2a_cli.ui.colors import *  # noqa: F401,F403  (USER_COLOR, TEXT_INFO, ...)

from .sigint import SigintMixin
from .task_display import TaskDisplayMixin

__all__ = ["ChatUIManager"]


class ChatUIManager(SigintMixin, TaskDisplayMixin):
    """
    Manage the chat UI and user interaction.

    Handles command input, task status display, and event streaming visuals.
    """

    def __init__(self, context):
        """
        Initialize the UI manager.

        Args:
            context: The chat context object
        """
        self.context = context
        self.console = Console()

        # ui / mode flags
        self.task_running = False
        self.interrupt_requested = False

        # task timing
        self.task_start_time = None

        # live spinner
        self.live_display: Optional[Live] = None
        self.spinner_frames = ["⠋", "⠙", "⠹", "⠸", "⠼",
                               "⠴", "⠦", "⠧", "⠇", "⠏"]
        self.spinner_idx = 0

        # SIGINT handling
        self._prev_sigint_handler: Optional[signal.Handlers] = None

        # prompt‑toolkit
        history_file = os.path.expanduser("~/.a2a_chat_history")
        style = Style.from_dict({
            "completion-menu": "bg:default",
            "completion-menu.completion": "bg:default fg:goldenrod",
            "completion-menu.completion.current": "bg:default fg:goldenrod bold",
            "auto-suggestion": "fg:ansibrightblack",
        })
        self.session = PromptSession(
            history=FileHistory(history_file),
            auto_suggest=AutoSuggestFromHistory(),
            completer=ChatCommandCompleter(context.to_dict()),
            complete_while_typing=True,
            style=style,
            message="> ",
        )

        # misc
        self.last_input = None

    # ------------------------------------------------------------------ #
    # user input
    # ------------------------------------------------------------------ #
    async def get_user_input(self) -> str:
        """
        Get input from the user.

        Returns:
            The user's input string
        """
        user_message = await self.session.prompt_async()
        self.last_input = user_message.strip()

        # Add to command history if it's a command
        if self.last_input.startswith("/"):
            context_dict = self.context.to_dict()
            if "command_history" in context_dict:
                context_dict["command_history"].append(self.last_input)
            self.context.update_from_dict(context_dict)

        # Clear the line for clean display
        print("\r" + " " * (len(self.last_input) + 2), end="\r")
        return self.last_input

    # ------------------------------------------------------------------ #
    # message rendering
    # ------------------------------------------------------------------ #
    def print_message(self, message: str, role: str = "user") -> None:
        """
        Print a message from the user or system.

        Args:
            message: The message content
            role: The role of the message sender ('user' or 'system')
        """
        style = USER_COLOR if role == "user" else TEXT_INFO
        title = "You" if role == "user" else "System"

        print(Panel(message or "[No Message]",
                   style=style, title=title))

        if role == "user":
            # Reset the task state for new user message
            self.task_running = False
            self.task_start_time = None

            if self.live_display:
                self.live_display.stop()
                self.live_display = None

    # ------------------------------------------------------------------ #
    # command handling
    # ------------------------------------------------------------------ #
    async def handle_command(self, command: str) -> bool:
        """
        Handle a command.

        Args:
            command: The command string

        Returns:
            True if the command was handled, False otherwise
        """
        context_dict = self.context.to_dict()
        handled = await handle_command(command, context_dict)
        self.context.update_from_dict(context_dict)
        return handled

    # ------------------------------------------------------------------ #
    # cleanup
    # ------------------------------------------------------------------ #
    async def cleanup(self) -> None:
        """Clean up resources and reset the terminal."""
        if self.live_display:
            self.live_display.stop()
            self.live_display = None

        self._restore_sigint_handler()

        # Close any active clients
        await self.context.close()
