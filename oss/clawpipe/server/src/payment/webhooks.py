"""Helpers for payment webhook signature validation."""

from __future__ import annotations

import hashlib
import hmac


def build_webhook_signature(payload: bytes, secret: str) -> str:
    """Build an HMAC-SHA256 signature for the raw payload."""
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def verify_webhook_signature(
    payload: bytes,
    provided_signature: str | None,
    secret: str | None,
    *,
    required: bool,
) -> bool:
    """Verify webhook signatures when a secret is configured or required."""
    if not secret:
        return not required
    if not provided_signature:
        return False

    normalized_signature = provided_signature.removeprefix("sha256=").strip()
    expected = build_webhook_signature(payload, secret)
    return hmac.compare_digest(expected, normalized_signature)
