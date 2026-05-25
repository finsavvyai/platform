"""
Optional integration settings for OpenClaw, OpenHands, and future external agents.

Kept separate from main config to respect 200-line file limit and optional dependencies.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class OpenClawSettings(BaseSettings):
    """OpenClaw channel gateway - embedded in our stack, internal only."""
    model_config = {"env_prefix": "OPENCLAW_", "extra": "ignore"}

    ENABLED: bool = Field(default=True, description="Enable embedded OpenClaw gateway")
    WEBHOOK_SECRET: Optional[str] = Field(default=None, description="Secret for internal webhook (backend<->gateway)")
    INTERNAL_ONLY: bool = Field(default=True, description="Webhook only accepts internal/docker network")
    API_URL: Optional[str] = Field(default=None, description="OpenClaw gateway URL for outbound")
    API_KEY: Optional[str] = Field(default=None, description="API key for outbound")
    RATE_LIMIT_PER_TENANT_PER_MINUTE: int = Field(default=60, description="Max outbound per tenant per minute")


class OpenHandsSettings(BaseSettings):
    """OpenHands development agent - embedded via SDK (default) or cloud API."""
    model_config = {"env_prefix": "OPENHANDS_", "extra": "ignore"}

    ENABLED: bool = Field(default=True, description="Enable embedded OpenHands (built-in)")
    MODE: str = Field(default="sdk", description="sdk (embedded) | cloud")
    API_URL: Optional[str] = Field(default=None, description="Cloud API URL when MODE=cloud")
    API_KEY: Optional[str] = Field(default=None, description="Cloud API key when MODE=cloud")
    WORKSPACE_ROOT: Optional[str] = Field(default=None, description="Sandbox root for SDK (default: temp)")
    MAX_DURATION_SECONDS: int = Field(default=600, description="Max run time per task (10 min)")
    RATE_LIMIT_PER_TENANT_PER_HOUR: int = Field(default=30, description="Max tasks per tenant per hour")


def get_openclaw_settings() -> OpenClawSettings:
    return OpenClawSettings()


def get_openhands_settings() -> OpenHandsSettings:
    return OpenHandsSettings()
