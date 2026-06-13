#!/usr/bin/env python3
# a2a_cli/chat/ui_manager/task_display.py
"""
Task spinner / status display mixin for the chat UI manager.
"""
import time

from rich import print
from rich.live import Live
from rich.text import Text

from a2a_cli.ui.colors import *  # noqa: F401,F403  (status style constants)


class TaskDisplayMixin:
    """Provides the animated spinner and task status rendering."""

    def _get_spinner_char(self) -> str:
        """Get the next spinner character in the animation sequence."""
        char = self.spinner_frames[self.spinner_idx]
        self.spinner_idx = (self.spinner_idx + 1) % len(self.spinner_frames)
        return char

    def start_task_spinner(self, task_id: str) -> None:
        """
        Start the animated spinner for a running task.

        Args:
            task_id: The ID of the task being watched
        """
        if self.live_display:
            self.live_display.stop()

        self.task_running = True
        self.task_start_time = time.time()
        self._install_sigint_handler()

        self.live_display = Live("", refresh_per_second=4, console=self.console)
        self.live_display.start()

        print("[dim italic]Press Ctrl+C to interrupt task execution[/dim italic]", end="\r")

    def update_task_status(self, status: str, message: str = "") -> None:
        """
        Update the displayed task status.

        Args:
            status: The status string
            message: Optional status message
        """
        if not self.live_display:
            self.start_task_spinner("<unknown>")

        # Determine status style
        status_style = {
            "pending": TEXT_WARNING,
            "running": TEXT_INFO,
            "completed": TEXT_SUCCESS,
            "cancelled": TEXT_DEEMPHASIS,
            "failed": TEXT_ERROR
        }.get(status.lower(), TEXT_NORMAL)

        # Calculate elapsed time
        now = time.time()
        elapsed = int(now - self.task_start_time) if self.task_start_time else 0

        # Get spinner char
        spinner = self._get_spinner_char()

        # Create the display
        display_text = f"[dim]Task status ({elapsed}s): {spinner}[/dim] "
        display_text += f"[{status_style}]{status}[/{status_style}]"

        if message:
            display_text += f" - {message}"

        self.live_display.update(Text.from_markup(display_text))

    def stop_task_display(self, final_status: str = "completed") -> None:
        """
        Stop the task display and show completion information.

        Args:
            final_status: The final status of the task
        """
        if self.live_display:
            self.live_display.stop()
            self.live_display = None

        if self.task_start_time:
            elapsed = time.time() - self.task_start_time
            print(f"[dim]Task {final_status} in {elapsed:.2f}s[/dim]")

        self.task_running = False
        self.task_start_time = None
        self._restore_sigint_handler()
