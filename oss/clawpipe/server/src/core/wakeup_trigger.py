#!/usr/bin/env python3
"""
Wakeup trigger system for condition-based alerts and notifications.

Sprint 13 — Task 13.9
"""

import asyncio
import logging
from datetime import datetime
from typing import Callable, Dict, List

logger = logging.getLogger("finsavvyai.heartbeat")


class WakeupTrigger:
    """
    Wakeup trigger system (Task 13.9).
    Fires alerts/notifications when specific conditions are detected.
    """

    def __init__(self) -> None:
        self._triggers: Dict[str, Dict] = {}
        self._fired: List[Dict] = []

    def register_trigger(
        self,
        name: str,
        condition: Callable[[], bool],
        action: Callable,
        description: str = "",
    ) -> None:
        self._triggers[name] = {
            "name": name,
            "condition": condition,
            "action": action,
            "description": description,
            "enabled": True,
        }

    def disable_trigger(self, name: str) -> None:
        if name in self._triggers:
            self._triggers[name]["enabled"] = False

    def enable_trigger(self, name: str) -> None:
        if name in self._triggers:
            self._triggers[name]["enabled"] = True

    async def evaluate(self) -> None:
        """Evaluate all triggers and fire actions for those whose conditions are met."""
        for trigger in self._triggers.values():
            if not trigger["enabled"]:
                continue
            try:
                met = trigger["condition"]()
                if met:
                    result = trigger["action"]()
                    if asyncio.iscoroutine(result):
                        await result
                    self._fired.append(
                        {
                            "trigger": trigger["name"],
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    )
            except Exception as e:
                logger.error("Trigger %s error: %s", trigger["name"], e)

    def get_fired(self) -> List[Dict]:
        return list(self._fired)

    def clear_fired(self) -> None:
        self._fired.clear()

    def list_triggers(self) -> List[Dict]:
        return [
            {
                "name": t["name"],
                "description": t["description"],
                "enabled": t["enabled"],
            }
            for t in self._triggers.values()
        ]
