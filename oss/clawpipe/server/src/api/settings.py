"""Environment-backed settings for the FastAPI surface."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

TRUE_VALUES = {"1", "true", "yes", "on"}
LOCAL_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def _env_bool(*names: str, default: bool) -> bool:
    for name in names:
        value = os.getenv(name)
        if value is not None:
            return value.strip().lower() in TRUE_VALUES
    return default


def _env_first(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value:
            return value.strip()
    return default


def _env_csv(*names: str, default: tuple[str, ...]) -> tuple[str, ...]:
    value = _env_first(*names)
    if value is None:
        return default
    parts = tuple(item.strip() for item in value.split(",") if item.strip())
    return parts or default


@dataclass(frozen=True)
class AppSettings:
    """Resolved runtime configuration for the FastAPI app."""

    environment: str
    auth_enabled: bool
    jwt_secret: str | None
    jwt_algorithm: str
    jwt_expiry_minutes: int
    cors_origins: tuple[str, ...]
    allow_credentials: bool
    payment_webhook_secret: str | None
    checkout_base_url: str
    version: str = "1.0.0"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def wildcard_cors(self) -> bool:
        return "*" in self.cors_origins

    def validate(self) -> None:
        """Fail fast on unsafe production configuration."""
        if not self.is_production:
            return
        if self.auth_enabled and not self.jwt_secret:
            raise RuntimeError(
                "JWT secret is required in production. Set "
                "FINSAVVYAI_JWT_SECRET, JWT_SECRET, or SECRET_KEY."
            )
        if self.wildcard_cors:
            raise RuntimeError(
                "Wildcard CORS is not allowed in production. Set "
                "FINSAVVYAI_CORS_ORIGINS to explicit origins."
            )
        if not self.payment_webhook_secret:
            raise RuntimeError(
                "Payment webhook secret is required in production. Set "
                "FINSAVVYAI_PAYMENT_WEBHOOK_SECRET or PAYMENT_WEBHOOK_SECRET."
            )


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Return cached application settings."""
    environment = _env_first("ENVIRONMENT", "FINSAVVYAI_ENVIRONMENT", default="development")
    auth_enabled = _env_bool("FINSAVVYAI_AUTH_ENABLED", default=True)
    jwt_expiry_minutes = int(_env_first("JWT_EXPIRY_MINUTES", default="60"))
    cors_default = LOCAL_ORIGINS if environment != "production" else ("*",)
    jwt_secret = _env_first("FINSAVVYAI_JWT_SECRET", "JWT_SECRET", "SECRET_KEY")
    if not jwt_secret and environment != "production":
        jwt_secret = "dev-only-secret-change-before-production"

    return AppSettings(
        environment=environment,
        auth_enabled=auth_enabled,
        jwt_secret=jwt_secret,
        jwt_algorithm=_env_first("JWT_ALGORITHM", default="HS256") or "HS256",
        jwt_expiry_minutes=jwt_expiry_minutes,
        cors_origins=_env_csv("FINSAVVYAI_CORS_ORIGINS", "CORS_ORIGINS", default=cors_default),
        allow_credentials=_env_bool("ALLOW_CREDENTIALS", default=True),
        payment_webhook_secret=_env_first(
            "FINSAVVYAI_PAYMENT_WEBHOOK_SECRET",
            "PAYMENT_WEBHOOK_SECRET",
        ),
        checkout_base_url=(
            _env_first(
                "FINSAVVYAI_CHECKOUT_BASE_URL",
                default="https://checkout.finsavvyai.com/sessions",
            )
            or "https://checkout.finsavvyai.com/sessions"
        ).rstrip("/"),
    )
