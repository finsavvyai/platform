"""Slack channel adapter -- handles Slack Events API and posts responses."""

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, Optional

import aiohttp
import aiohttp.web

from src.channels.webhook_sessions import SessionManager

logger = logging.getLogger("finsavvyai.channels.slack")


class SlackAdapter:
    """Handles Slack Events API webhooks and sends responses via Web API.

    Config via env vars:
    - SLACK_BOT_TOKEN: Bot User OAuth Token (xoxb-...)
    - SLACK_SIGNING_SECRET: Slack app signing secret for request verification
    """

    def __init__(
        self,
        bot_token: str = "",
        signing_secret: str = "",
        cluster_url: str = "http://localhost:8001",
        api_key: Optional[str] = None,
    ) -> None:
        self.bot_token = bot_token
        self.signing_secret = signing_secret
        self.cluster_url = cluster_url.rstrip("/")
        self.api_key = api_key
        self.sessions = SessionManager()
        self._session: Optional[aiohttp.ClientSession] = None
        self._processed_events: set[str] = set()

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
            )
        return self._session

    def verify_request(
        self, body: bytes, timestamp: str, signature: str
    ) -> bool:
        """Verify Slack request signature (HMAC-SHA256)."""
        if not self.signing_secret:
            logger.warning("Slack signing secret not configured")
            return False
        try:
            if abs(time.time() - float(timestamp)) > 300:
                return False
        except (ValueError, TypeError):
            return False
        sig_basestring = f"v0:{timestamp}:{body.decode('utf-8')}"
        expected = "v0=" + hmac.new(
            self.signing_secret.encode(),
            sig_basestring.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def handle_event(
        self, request: aiohttp.web.Request
    ) -> aiohttp.web.Response:
        """Handle Slack Events API POST."""
        body = await request.read()
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
        signature = request.headers.get("X-Slack-Signature", "")

        if not self.verify_request(body, timestamp, signature):
            return aiohttp.web.json_response(
                {"error": "Invalid signature"}, status=401
            )

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return aiohttp.web.json_response(
                {"error": "Invalid JSON"}, status=400
            )

        if data.get("type") == "url_verification":
            return aiohttp.web.json_response(
                {"challenge": data.get("challenge", "")}
            )

        if data.get("type") == "event_callback":
            event = data.get("event", {})
            return await self._handle_message_event(event)

        return aiohttp.web.json_response({"status": "ignored"})

    async def _handle_message_event(
        self, event: Dict[str, Any]
    ) -> aiohttp.web.Response:
        """Process a Slack message event."""
        if event.get("bot_id") or event.get("subtype"):
            return aiohttp.web.json_response({"status": "ignored"})

        event_ts = event.get("event_ts", "")
        if event_ts in self._processed_events:
            return aiohttp.web.json_response({"status": "duplicate"})
        self._processed_events.add(event_ts)
        if len(self._processed_events) > 5000:
            self._processed_events = set(
                list(self._processed_events)[-2500:]
            )

        text = event.get("text", "").strip()
        channel = event.get("channel", "")
        user = event.get("user", "")
        session_id = f"slack-{channel}-{user}"

        if not text:
            return aiohttp.web.json_response({"status": "empty"})

        self.sessions.get_or_create(session_id, "slack", user)
        self.sessions.add_message(session_id, "user", text)
        history = self.sessions.get_messages(session_id)

        completion = {
            "model": "default",
            "messages": history,
            "stream": False,
        }
        result = await self._forward_to_cluster(completion)

        response_text = ""
        if "error" not in result:
            choices = result.get("choices", [])
            if choices:
                response_text = (
                    choices[0].get("message", {}).get("content", "")
                )

        if response_text:
            self.sessions.add_message(session_id, "assistant", response_text)
            await self._post_message(channel, response_text)

        return aiohttp.web.json_response(
            {"status": "ok", "channel": channel}
        )

    async def _forward_to_cluster(self, body: Dict[str, Any]) -> Dict:
        """Forward completion request to FinSavvyAI cluster."""
        session = await self._get_session()
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        try:
            async with session.post(
                f"{self.cluster_url}/v1/chat/completions",
                json=body,
                headers=headers,
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"error": f"Cluster returned {resp.status}"}
        except Exception as e:
            logger.error("Cluster forward error: %s", e)
            return {"error": str(e)}

    async def _post_message(self, channel: str, text: str) -> bool:
        """Post a message to a Slack channel via chat.postMessage."""
        session = await self._get_session()
        try:
            async with session.post(
                "https://slack.com/api/chat.postMessage",
                json={"channel": channel, "text": text},
                headers={"Authorization": f"Bearer {self.bot_token}"},
            ) as resp:
                data = await resp.json()
                if data.get("ok"):
                    return True
                logger.error("Slack post failed: %s", data.get("error"))
                return False
        except Exception as e:
            logger.error("Slack post error: %s", e)
            return False

    def register_routes(self, app: aiohttp.web.Application) -> None:
        """Register the /hooks/slack route on an aiohttp app."""
        app.router.add_post("/hooks/slack", self.handle_event)
        logger.info("Slack webhook route registered at /hooks/slack")

    async def close(self) -> None:
        """Close the underlying HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
