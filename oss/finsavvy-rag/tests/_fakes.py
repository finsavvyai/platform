"""
In-memory fakes for the SQLAlchemy layer used by the RAG service.

The RAG app talks to the DB through ``engine.begin()`` (ingest, a
transactional context manager) and ``engine.connect()`` (healthz + search, a
plain connection context manager). Both yield an object with ``.execute()``.

These fakes record the SQL + params they are handed and return scripted
results, so request/response paths can be asserted without Postgres.
"""

from __future__ import annotations

from typing import Any, Dict, List


class FakeResult:
    """Mimics the subset of a SQLAlchemy Result used by the app."""

    def __init__(self, rows: List[Dict[str, Any]] | None = None, scalar: Any = None):
        self._rows = rows or []
        self._scalar = scalar

    def scalar(self) -> Any:
        return self._scalar

    def mappings(self) -> "FakeResult":
        return self

    def all(self) -> List[Dict[str, Any]]:
        return list(self._rows)


class FakeConnection:
    """Context-manager connection capturing every execute() call."""

    def __init__(self, owner: "FakeEngine"):
        self._owner = owner

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *exc) -> bool:
        return False

    def execute(self, statement, params=None):
        sql = str(statement)
        self._owner.calls.append({"sql": sql, "params": params})
        return self._owner.next_result(sql, params)


class FakeEngine:
    """Stand-in for a SQLAlchemy Engine.

    ``connect`` and ``begin`` both yield a :class:`FakeConnection`. The result
    returned by ``execute`` is decided by ``result_for`` — a callable a test
    installs to script DB behaviour. By default returns an empty result with
    scalar ``1`` (so ``SELECT 1`` healthz passes).
    """

    def __init__(self) -> None:
        self.calls: List[Dict[str, Any]] = []
        self.result_for = None  # type: ignore[assignment]

    def connect(self) -> FakeConnection:
        return FakeConnection(self)

    def begin(self) -> FakeConnection:
        return FakeConnection(self)

    def next_result(self, sql: str, params) -> FakeResult:
        if self.result_for is not None:
            return self.result_for(sql, params)
        return FakeResult(rows=[], scalar=1)
