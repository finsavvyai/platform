"""Runtime settings, env-driven."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    nats_url: str
    rules_dir: str
    embedding_model: str

    @classmethod
    def load(cls) -> "Settings":
        return cls(
            database_url=os.getenv("DATABASE_URL", ""),
            nats_url=os.getenv("NATS_URL", "nats://localhost:4222"),
            rules_dir=os.getenv("RULES_DIR", "./rules"),
            embedding_model=os.getenv(
                "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
            ),
        )
