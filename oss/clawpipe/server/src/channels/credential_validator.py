"""Channel credential validator — validates credentials in real time."""

import logging
from typing import Any, Dict

import aiohttp

logger = logging.getLogger("finsavvyai.channels")


async def validate_slack_credentials(bot_token: str, signing_secret: str) -> Dict[str, Any]:
    """Validate Slack bot token using auth.test API."""
    if not bot_token:
        return {"valid": False, "error": "Bot token is required"}
    if not signing_secret:
        return {"valid": False, "error": "Signing secret is required"}
    if not bot_token.startswith("xoxb-"):
        return {"valid": False, "error": "Bot token must start with xoxb-"}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.post(
                "https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {bot_token}"},
            ) as resp:
                data = await resp.json()
                if data.get("ok"):
                    return {
                        "valid": True,
                        "team": data.get("team"),
                        "bot_id": data.get("bot_id"),
                        "user": data.get("user"),
                    }
                return {"valid": False, "error": data.get("error", "Unknown error")}
    except Exception as e:
        return {"valid": False, "error": f"Connection failed: {e}"}


async def validate_telegram_credentials(bot_token: str) -> Dict[str, Any]:
    """Validate Telegram bot token using getMe API."""
    if not bot_token:
        return {"valid": False, "error": "Bot token is required"}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(
                f"https://api.telegram.org/bot{bot_token}/getMe",
            ) as resp:
                data = await resp.json()
                if data.get("ok"):
                    result = data.get("result", {})
                    return {
                        "valid": True,
                        "bot_name": result.get("first_name"),
                        "username": result.get("username"),
                    }
                return {"valid": False, "error": data.get("description", "Unknown error")}
    except Exception as e:
        return {"valid": False, "error": f"Connection failed: {e}"}


async def validate_whatsapp_credentials(webhook_url: str, verify_token: str) -> Dict[str, Any]:
    """Validate WhatsApp webhook URL is reachable."""
    if not webhook_url:
        return {"valid": False, "error": "Webhook URL is required"}
    if not verify_token:
        return {"valid": False, "error": "Verify token is required"}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(webhook_url) as resp:
                if resp.status < 500:
                    return {"valid": True, "status_code": resp.status}
                return {"valid": False, "error": f"Webhook returned {resp.status}"}
    except Exception as e:
        return {"valid": False, "error": f"Connection failed: {e}"}


async def validate_credentials(channel_type: str, credentials: Dict[str, str]) -> Dict[str, Any]:
    """Validate credentials for any channel type."""
    validators = {
        "slack": lambda c: validate_slack_credentials(
            c.get("bot_token", ""), c.get("signing_secret", ""),
        ),
        "telegram": lambda c: validate_telegram_credentials(
            c.get("bot_token", ""),
        ),
        "whatsapp": lambda c: validate_whatsapp_credentials(
            c.get("webhook_url", ""), c.get("verify_token", ""),
        ),
    }
    validator = validators.get(channel_type)
    if not validator:
        return {"valid": False, "error": f"Unknown channel type: {channel_type}"}
    return await validator(credentials)
