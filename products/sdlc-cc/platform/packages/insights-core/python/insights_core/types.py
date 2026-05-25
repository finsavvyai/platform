"""Shared signal/insight types for the compliance-insights stack."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class Source(str, Enum):
    LLM_GATEWAY = "llm_gateway"
    DLP = "dlp"
    OPA = "opa"
    RAG = "rag"
    USAGE = "usage"


@dataclass(slots=True)
class SignalEvent:
    id: str
    tenant_id: str
    source: Source
    event_type: str
    occurred_at: datetime
    ingested_at: datetime
    payload: dict[str, Any] = field(default_factory=dict)
    payload_hash: bytes = b""
    subject_user: str | None = None
    model: str | None = None
    embedding: list[float] | None = None

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "source": self.source.value,
            "event_type": self.event_type,
            "payload": self.payload,
            "payload_hash": self.payload_hash.hex() if self.payload_hash else "",
            "occurred_at": self.occurred_at.isoformat().replace("+00:00", "Z"),
            "ingested_at": self.ingested_at.isoformat().replace("+00:00", "Z"),
        }
        if self.subject_user is not None:
            out["subject_user"] = self.subject_user
        if self.model is not None:
            out["model"] = self.model
        if self.embedding is not None:
            out["embedding"] = self.embedding
        return out
