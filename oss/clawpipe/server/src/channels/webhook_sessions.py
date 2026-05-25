#!/usr/bin/env python3
"""
Webhook session manager for FinSavvyAI.

Maps OpenClaw session IDs to FinSavvyAI conversation context.
Stores recent messages per session for multi-turn context.

Sprint 12 — Task 12.6, 12.9
Extracted from webhook_receiver.py.
"""

import logging
import time
from typing import Any, Dict, List

logger = logging.getLogger("finsavvyai.channels.webhook")


class SessionManager:
    """
    Maps OpenClaw session IDs to FinSavvyAI conversation context (Task 12.6).
    Stores recent messages per session for multi-turn context.
    """

    def __init__(self, max_history: int = 20):
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self.max_history = max_history

    def get_or_create(
        self, session_id: str, channel: str, sender: str
    ) -> Dict:
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "session_id": session_id,
                "channel": channel,
                "sender": sender,
                "messages": [],
                "created_at": time.time(),
                "last_active": time.time(),
            }
        sess = self._sessions[session_id]
        sess["last_active"] = time.time()
        return sess

    def add_message(self, session_id: str, role: str, content: Any) -> None:
        sess = self._sessions.get(session_id)
        if not sess:
            return
        sess["messages"].append({"role": role, "content": content})
        if len(sess["messages"]) > self.max_history:
            sess["messages"] = sess["messages"][-self.max_history:]

    def reset(self, session_id: str) -> None:
        """Reset a session's conversation history (Task 12.9)."""
        if session_id in self._sessions:
            self._sessions[session_id]["messages"] = []
            logger.info("Session reset: %s", session_id)

    def delete(self, session_id: str) -> None:
        """Delete a session entirely (Task 12.9 /new command)."""
        self._sessions.pop(session_id, None)
        logger.info("Session deleted: %s", session_id)

    def get_messages(self, session_id: str) -> List[Dict]:
        sess = self._sessions.get(session_id)
        if not sess:
            return []
        return list(sess["messages"])

    def list_sessions(self) -> List[Dict]:
        return [
            {
                "session_id": s["session_id"],
                "channel": s["channel"],
                "sender": s["sender"],
                "message_count": len(s["messages"]),
                "last_active": s["last_active"],
            }
            for s in self._sessions.values()
        ]
