"""Shared fixtures + fakes for the sar-draft test suite."""

from __future__ import annotations

from typing import Any

from sar_draft import AlertInput, Citation, DraftAgent, SearchResult, TemplateRegistry


class FakeRetrieval:
    """In-memory RetrievalAdapter — records calls; returns pre-set hits."""

    def __init__(self, hits: list[SearchResult] | Exception) -> None:
        self._hits = hits
        self.calls: list[tuple[str, str, int]] = []

    def search(self, query: str, tenant_id: str, top_k: int) -> list[SearchResult]:
        self.calls.append((query, tenant_id, top_k))
        if isinstance(self._hits, Exception):
            raise self._hits
        return self._hits


class FakeAudit:
    """In-memory AuditEmitter — records emitted records; can raise on demand."""

    def __init__(self, raise_exc: Exception | None = None) -> None:
        self.records: list[dict[str, Any]] = []
        self._raise = raise_exc

    def emit(self, record: dict[str, Any]) -> str:
        if self._raise is not None:
            raise self._raise
        self.records.append(record)
        return f"audit-{len(self.records)}"


def make_alert(**overrides: object) -> AlertInput:
    base: dict[str, object] = {
        "alert_id": "A-1",
        "tenant_id": "tenant-1",
        "alert_type": "structuring",
        "transaction_ids": ["T-1"],
        "amount": 9500.0,
        "currency": "USD",
        "parties": ["Acme Corp"],
        "jurisdiction": "US",
    }
    base.update(overrides)
    return AlertInput(**base)  # type: ignore[arg-type]


def make_hits(n_citations: int = 3) -> list[SearchResult]:
    return [
        SearchResult(
            doc_id=f"D{i}",
            snippet=f"snippet {i}",
            score=0.9,
            citations=[
                Citation(doc_id=f"D{i}", span_start=0, span_end=4, source="fincen")
            ],
        )
        for i in range(n_citations)
    ]


def make_agent(retrieval: FakeRetrieval, audit: FakeAudit) -> DraftAgent:
    return DraftAgent(
        registry=TemplateRegistry.from_default(),
        retrieval=retrieval,
        audit=audit,
    )
