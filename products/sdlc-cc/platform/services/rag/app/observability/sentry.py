"""
Sentry initialization for the RAG service.

Reads configuration from the environment so deploys can change behavior
without code changes:

    SENTRY_DSN                  required to enable; absent disables.
    SENTRY_ENVIRONMENT          defaults to "development".
    SENTRY_RELEASE              defaults to "" (Sentry derives from CI).
    SENTRY_TRACES_SAMPLE_RATE   float, defaults to 0.1.

When the DSN is unset, init_sentry() is a no-op and the rest of the
codebase can call ``capture_exception`` freely.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def init_sentry() -> bool:
    """Initialize Sentry from environment. Returns True iff enabled."""
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        logger.info("sentry disabled (SENTRY_DSN unset)")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    except ImportError:
        logger.warning(
            "SENTRY_DSN set but sentry-sdk not installed; "
            "add `sentry-sdk[fastapi]>=1.40` to requirements.txt"
        )
        return False

    try:
        sample_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    except ValueError:
        logger.error("SENTRY_TRACES_SAMPLE_RATE not parseable; using 0.1")
        sample_rate = 0.1

    sentry_sdk.init(
        dsn=dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
        release=os.getenv("SENTRY_RELEASE") or None,
        traces_sample_rate=sample_rate,
        attach_stacktrace=True,
        send_default_pii=False,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
    )
    logger.info(
        "sentry initialised",
        extra={
            "environment": os.getenv("SENTRY_ENVIRONMENT", "development"),
            "traces_sample_rate": sample_rate,
        },
    )
    return True


def capture_exception(exc: BaseException) -> None:
    """Report an exception to Sentry. No-op when disabled."""
    try:
        import sentry_sdk
    except ImportError:
        return
    sentry_sdk.capture_exception(exc)
