"""Webhook receiver — inbound messages via /hooks/agent to cluster pipeline."""

import hashlib
import hmac
import json
import logging
import re
from typing import Dict, Optional, Set

import aiohttp.web

from src.channels.channel_adapter import ChannelAdapter
from src.channels.webhook_dedup import WebhookDedup
from src.channels.webhook_sessions import SessionManager

logger = logging.getLogger("finsavvyai.channels.webhook")


class WebhookReceiver:
    """HTTP handler for /hooks/agent webhook from OpenClaw gateway.

    Implements webhook receiver, media handling, sender filtering,
    group mention support, and session commands (/reset, /new).
    """

    def __init__(
        self,
        adapter: ChannelAdapter,
        allowed_senders: Optional[Set[str]] = None,
        webhook_secret: Optional[str] = None,
        mention_trigger: str = "@finsavvy",
    ):
        self.adapter = adapter
        self.allowed_senders = allowed_senders
        self.webhook_secret = webhook_secret
        self.mention_trigger = mention_trigger.lower()
        self.sessions = SessionManager()
        self._dedup = WebhookDedup()
        self._request_count = 0

    def verify_signature(self, body: bytes, signature: str) -> bool:
        """Verify webhook HMAC-SHA256 signature."""
        if not self.webhook_secret:
            logger.warning("Webhook rejected: no webhook_secret configured")
            return False
        expected = hmac.new(
            self.webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def is_sender_allowed(self, sender: str) -> bool:
        if self.allowed_senders is None:
            return True
        return sender in self.allowed_senders

    def is_group_mention(self, message: Dict) -> bool:
        """Check if message is a group chat mention for this agent."""
        group = message.get("group")
        if not group:
            return False
        text = (message.get("text") or "").lower()
        mention = (group.get("mention") or "").lower()
        return self.mention_trigger in text or self.mention_trigger in mention

    def strip_mention(self, text: str) -> str:
        """Remove the mention trigger from the message text."""
        pattern = re.compile(re.escape(self.mention_trigger), re.IGNORECASE)
        return pattern.sub("", text).strip()

    def _handle_command(
        self, session_id: str, command: str
    ) -> Optional[str]:
        """Handle /reset and /new session commands."""
        cmd = command.strip().lower()
        if cmd == "/reset":
            self.sessions.reset(session_id)
            return "Session history cleared. Starting fresh."
        elif cmd == "/new":
            self.sessions.delete(session_id)
            return "New session created."
        return None

    async def handle_webhook(self, request: aiohttp.web.Request) -> aiohttp.web.Response:
        """POST /hooks/agent -- main webhook handler."""
        self._request_count += 1
        body = await request.read()

        sig = request.headers.get("X-Webhook-Signature", "")
        if not self.verify_signature(body, sig):
            logger.warning("Invalid webhook signature")
            return aiohttp.web.json_response({"error": "Invalid signature"}, status=401)

        # Check for duplicate webhook
        webhook_id = request.headers.get("X-Webhook-Id", "")
        if webhook_id and self._dedup.is_duplicate(webhook_id):
            return aiohttp.web.json_response(
                {"status": "duplicate", "webhook_id": webhook_id}, status=200
            )

        try:
            message = json.loads(body)
        except json.JSONDecodeError:
            return aiohttp.web.json_response(
                {"error": "Invalid JSON"}, status=400
            )

        sender = message.get("sender", "")
        channel = message.get("channel", "unknown")
        session_id = message.get("session_id", sender)

        if not self.is_sender_allowed(sender):
            logger.warning("Blocked sender: %s", sender)
            return aiohttp.web.json_response(
                {"error": "Sender not allowed"}, status=403
            )

        if message.get("group"):
            if not self.is_group_mention(message):
                return aiohttp.web.json_response(
                    {"status": "ignored", "reason": "no_mention"}
                )
            message["text"] = self.strip_mention(message.get("text", ""))

        command = message.get("command")
        if command:
            reply = self._handle_command(session_id, command)
            if reply:
                await self.adapter.deliver_response(session_id, channel, reply)
                return aiohttp.web.json_response(
                    {"status": "ok", "command": command}
                )

        text = (message.get("text") or "").strip()
        if text.startswith("/"):
            reply = self._handle_command(session_id, text)
            if reply:
                await self.adapter.deliver_response(session_id, channel, reply)
                return aiohttp.web.json_response(
                    {"status": "ok", "command": text}
                )

        self.sessions.get_or_create(session_id, channel, sender)

        media = message.get("media") or []
        if media:
            user_content = [{"type": "text", "text": text}]
            for item in media:
                if item.get("type") in ("image", "photo"):
                    user_content.append(
                        {"type": "image_url", "image_url": {"url": item.get("url", "")}}
                    )
        else:
            user_content = text

        self.sessions.add_message(session_id, "user", user_content)

        history = self.sessions.get_messages(session_id)
        completion_body = {
            "model": message.get("model", "default"),
            "messages": history,
            "stream": False,
        }

        result = await self.adapter.forward_to_cluster(completion_body)

        if "error" in result:
            logger.error("Cluster error: %s", result["error"])
            return aiohttp.web.json_response(
                {"status": "error", "error": result["error"]}, status=502
            )

        response_text = ""
        choices = result.get("choices", [])
        if choices:
            response_text = choices[0].get("message", {}).get("content", "")

        self.sessions.add_message(session_id, "assistant", response_text)

        delivered = await self.adapter.deliver_response(
            session_id, channel, response_text
        )

        return aiohttp.web.json_response({
            "status": "ok",
            "session_id": session_id,
            "delivered": delivered,
            "response_length": len(response_text),
        })

    def register_routes(self, app: aiohttp.web.Application) -> None:
        """Register webhook routes on an aiohttp app."""
        app.router.add_post("/hooks/agent", self.handle_webhook)
        app.router.add_get("/hooks/sessions", self._list_sessions)
        logger.info("Webhook routes registered")

    async def _list_sessions(self, request: aiohttp.web.Request) -> aiohttp.web.Response:
        return aiohttp.web.json_response({"sessions": self.sessions.list_sessions()})
