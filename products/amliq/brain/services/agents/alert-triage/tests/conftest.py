"""Shared fixtures + fakes for the alert-triage test suite."""

from __future__ import annotations

from typing import Any

from alert_triage import Alert, TriageAgent


class FakeAudit:
    """In-memory AuditEmitter — records emitted records; can raise on demand."""

    def __init__(self, raise_exc: Exception | None = None, return_empty: bool = False) -> None:
        self.records: list[dict[str, Any]] = []
        self._raise = raise_exc
        self._return_empty = return_empty

    def emit(self, record: dict[str, Any]) -> str:
        if self._raise is not None:
            raise self._raise
        self.records.append(record)
        if self._return_empty:
            return ""
        return f"audit-{len(self.records)}"


def make_alert(**overrides: object) -> Alert:
    """Build a default Alert that doesn't trip any rule, with overrides.

    All values are synthetic — no real PII, no real transaction data.
    """
    base: dict[str, object] = {
        "alert_id": "A-1",
        "tenant_id": "tenant-1",
        "source": "aml_decision",
        "subject_hash": "h_subject_1",
        "transaction_ids": ["T-1"],
        "amount_minor": 50_00,        # $50.00 — below all bands
        "currency": "USD",
        "mcc": "5411",                 # grocery — not high-risk
        "country_from": "US",
        "country_to": "US",            # same country — no cross-border
        "decision_score": 10.0,        # well below flag floor
    }
    base.update(overrides)
    return Alert(**base)  # type: ignore[arg-type]


def make_agent(audit: FakeAudit) -> TriageAgent:
    return TriageAgent(audit=audit)
