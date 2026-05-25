"""Shared fixtures + fakes for the regulatory-change test suite.

`FakeJiraClient` records draft calls but performs NO HTTP — this fake
exists precisely BECAUSE the safety invariant says no Jira HTTP from
this package. A test that imports this fake is itself an assertion that
the production code never reaches a real Jira API.
"""

from __future__ import annotations

import hashlib
from typing import Any

from regulatory_change import (
    ComplianceDoc,
    JiraDraft,
    RegulatoryChangeAgent,
)


def _sha(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


class FakeJiraClient:
    """In-memory JiraClient — records draft payloads; NEVER calls HTTP."""

    def __init__(self, raise_exc: Exception | None = None) -> None:
        self.drafts: list[JiraDraft] = []
        self._raise = raise_exc

    def draft(self, payload: JiraDraft) -> str:
        if self._raise is not None:
            raise self._raise
        self.drafts.append(payload)
        return f"jira-draft-{len(self.drafts)}"


class FakeAudit:
    """In-memory AuditEmitter — records records; can raise on demand."""

    def __init__(self, raise_exc: Exception | None = None) -> None:
        self.records: list[dict[str, Any]] = []
        self._raise = raise_exc

    def emit(self, record: dict[str, Any]) -> str:
        if self._raise is not None:
            raise self._raise
        self.records.append(record)
        return f"audit-{len(self.records)}"


def make_doc(
    *,
    doc_id: str = "FIN-2026-01",
    body: str = "Section A\nOriginal text.\n\nSection B\nMore text.",
    title: str = "FinCEN Notice 2026-01",
    source: str = "fincen-rss",
    jurisdiction: str = "US",
    published_at: str = "2026-05-25T00:00:00+00:00",
) -> ComplianceDoc:
    return ComplianceDoc(
        source=source,
        jurisdiction=jurisdiction,
        doc_id=doc_id,
        title=title,
        published_at=published_at,
        sha256=_sha(body),
        body=body,
    )


def make_agent(
    jira: FakeJiraClient | None = None,
    audit: FakeAudit | None = None,
) -> RegulatoryChangeAgent:
    return RegulatoryChangeAgent(
        jira=jira or FakeJiraClient(),
        audit=audit or FakeAudit(),
    )
