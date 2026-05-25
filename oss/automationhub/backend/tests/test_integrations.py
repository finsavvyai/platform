"""
Tests for external integrations: OpenClaw webhook, OpenHands adapter, resilience.
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.integrations.openclaw_webhook import (
    verify_signature,
    parse_incoming,
)
from app.integrations.resilience import (
    CircuitBreaker,
    CircuitState,
    IntegrationRateLimiter,
)


def test_verify_signature_rejects_when_no_secret():
    assert verify_signature(b"body", "sha256=abc", None) is False
    assert verify_signature(b"body", None, "secret") is False


def test_verify_signature_accepts_valid_hmac():
    import hmac
    import hashlib
    body = b"test payload"
    secret = "my-secret"
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_signature(body, sig, secret) is True


def test_verify_signature_rejects_invalid_hmac():
    assert verify_signature(b"body", "sha256=wrong", "secret") is False


def test_parse_incoming():
    out = parse_incoming({"message_id": "m1", "text": "hello", "channel_id": "c1"})
    assert out["message_id"] == "m1"
    assert out["text"] == "hello"
    assert out["channel_id"] == "c1"


def test_parse_incoming_message_key():
    out = parse_incoming({"id": "e1", "message": "hi"})
    assert out["message_id"] == "e1"
    assert out["text"] == "hi"


@pytest.mark.asyncio
async def test_circuit_breaker_closed_then_open():
    cb = CircuitBreaker("test", failure_threshold=2, cooldown_seconds=0.1)
    assert cb.state == CircuitState.CLOSED
    async def fail():
        raise ValueError("fail")
    for _ in range(2):
        try:
            await cb.call(fail)
        except ValueError:
            pass
    assert cb.state == CircuitState.OPEN
    with pytest.raises(RuntimeError, match="open"):
        await cb.call(fail)


@pytest.mark.asyncio
async def test_rate_limiter_allows_under_limit():
    limiter = IntegrationRateLimiter("test", max_requests=2, window_seconds=10)
    assert await limiter.is_allowed("k1") is True
    assert await limiter.is_allowed("k1") is True
    assert await limiter.is_allowed("k1") is False


@pytest.mark.asyncio
async def test_rate_limiter_check_and_raise():
    limiter = IntegrationRateLimiter("test", max_requests=1, window_seconds=10)
    await limiter.check_and_raise("k2")
    with pytest.raises(RuntimeError, match="Rate limit"):
        await limiter.check_and_raise("k2")


def test_integrations_status_endpoint():
    from fastapi.testclient import TestClient
    from app.api.v1.endpoints.integrations import router
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    r = client.get("/integrations/status")
    assert r.status_code == 200
    data = r.json()
    assert "openclaw" in data and "openhands" in data
    assert "enabled" in data["openclaw"] and "enabled" in data["openhands"]
