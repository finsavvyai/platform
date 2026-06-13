#!/usr/bin/env python3
# a2a_cli/chat/ui_manager/sigint.py
"""
SIGINT / interrupt handling mixin for the chat UI manager.
"""
import signal
from types import FrameType
from typing import Optional

from rich import print


class SigintMixin:
    """Provides cooperative Ctrl-C handling for in-flight tasks."""

    def _install_sigint_handler(self) -> None:
        """Replace SIGINT handler so first ^C only cancels current operations."""
        if self._prev_sigint_handler is not None:
            return  # already installed

        self._prev_sigint_handler = signal.getsignal(signal.SIGINT)

        def _handler(sig: int, frame: Optional[FrameType]) -> None:
            if self.task_running:
                if not self.interrupt_requested:
                    self.interrupt_requested = True
                    print("\n[yellow]Interrupt requested – waiting for "
                          "current task to complete...[/yellow]")
                    self._interrupt_now()
                    return
                # second Ctrl‑C: fall through
            if callable(self._prev_sigint_handler):
                self._prev_sigint_handler(sig, frame)

        signal.signal(signal.SIGINT, _handler)

    def _restore_sigint_handler(self) -> None:
        """Restore the original SIGINT handler."""
        if self._prev_sigint_handler is not None:
            signal.signal(signal.SIGINT, self._prev_sigint_handler)
            self._prev_sigint_handler = None

    def _interrupt_now(self) -> None:
        """
        Invoked on the *first* Ctrl‑C (or `/interrupt` command).

        • Stops the spinner / Live display immediately
        • Clears all timing state so the next turn starts fresh
        • Restores the original SIGINT handler so a second Ctrl‑C exits the app
        """
        # Halt the animated compact view, if active
        if self.live_display:
            self.live_display.stop()
            self.live_display = None

        # Reset runtime flags & timers
        self.task_running = False
        self.task_start_time = None
        self.interrupt_requested = False  # <- allow future task runs

        # Give Ctrl‑C its normal behaviour back
        self._restore_sigint_handler()
