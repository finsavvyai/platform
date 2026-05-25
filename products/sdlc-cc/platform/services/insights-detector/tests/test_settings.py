"""Settings loader behaviour."""

from __future__ import annotations

import os

from app.settings import Settings


def test_settings_defaults(monkeypatch) -> None:
    for key in ("DATABASE_URL", "NATS_URL", "RULES_DIR", "EMBEDDING_MODEL"):
        monkeypatch.delenv(key, raising=False)
    s = Settings.load()
    assert s.database_url == ""
    assert s.nats_url == "nats://localhost:4222"
    assert s.rules_dir == "./rules"
    assert "MiniLM" in s.embedding_model


def test_settings_env_override(monkeypatch) -> None:
    monkeypatch.setenv("NATS_URL", "nats://example:4222")
    s = Settings.load()
    assert s.nats_url == "nats://example:4222"
