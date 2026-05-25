"""Loki LogQL query helpers for the audit pipeline.

Used by the Admin UI backend and by compliance tooling to pull
evidence for SOC2 audits. All queries respect tenant isolation —
``tenant_id`` is always an indexed Loki label.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Iterable

import httpx

from .events import AuditEvent, AuditEventType

_LOKI_URL = os.getenv("LOKI_URL", "http://loki:3100")
_LOKI_TIMEOUT = float(os.getenv("LOKI_TIMEOUT", "15.0"))
_QUERY_PATH = "/loki/api/v1/query_range"


def _to_ns(ts: datetime) -> str:
    """Loki expects unix-nanosecond timestamps as strings."""
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return str(int(ts.timestamp() * 1_000_000_000))


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


class LokiAuditQuery:
    """Thin LogQL client scoped to the audit pipeline.

    All methods return ``list[AuditEvent]`` so callers never deal with
    raw Loki response shapes. Streams are materialised in memory —
    callers must cap ``limit`` (default 1000).
    """

    def __init__(
        self,
        base_url: str | None = None,
        tenant_header: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or _LOKI_URL).rstrip("/")
        self.tenant_header = tenant_header
        self.timeout = timeout or _LOKI_TIMEOUT

    # ------------------------------------------------------------------
    # high-level queries
    # ------------------------------------------------------------------

    def query_by_user(
        self,
        user_id: str,
        start: datetime,
        end: datetime,
        limit: int = 1000,
    ) -> list[AuditEvent]:
        q = f'{{service="rag"}} | json | user_id="{_escape(user_id)}"'
        return self._run(q, start, end, limit)

    def query_by_tenant(
        self,
        tenant_id: str,
        start: datetime,
        end: datetime,
        event_types: Iterable[AuditEventType] | None = None,
        limit: int = 1000,
    ) -> list[AuditEvent]:
        base = f'{{tenant_id="{_escape(tenant_id)}"'
        if event_types:
            types = "|".join(e.value for e in event_types)
            base += f',event_type=~"{types}"'
        base += "}"
        return self._run(base, start, end, limit)

    def query_by_resource(
        self,
        resource_id: str,
        resource_type: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 1000,
    ) -> list[AuditEvent]:
        now = datetime.now(timezone.utc)
        end = end or now
        start = start or end.replace(year=end.year - 1)
        selector = '{service="rag"}'
        q = f'{selector} | json | resource_id="{_escape(resource_id)}"'
        if resource_type:
            q += f' | resource_type="{_escape(resource_type)}"'
        return self._run(q, start, end, limit)

    # ------------------------------------------------------------------
    # low-level HTTP
    # ------------------------------------------------------------------

    def _run(
        self,
        logql: str,
        start: datetime,
        end: datetime,
        limit: int,
    ) -> list[AuditEvent]:
        params = {
            "query": logql,
            "start": _to_ns(start),
            "end": _to_ns(end),
            "limit": str(limit),
            "direction": "backward",
        }
        headers: dict[str, str] = {}
        if self.tenant_header:
            headers["X-Scope-OrgID"] = self.tenant_header

        url = f"{self.base_url}{_QUERY_PATH}"
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            return self._parse(resp.json())

    @staticmethod
    def _parse(body: dict[str, Any]) -> list[AuditEvent]:
        events: list[AuditEvent] = []
        data = body.get("data", {})
        for stream in data.get("result", []):
            for _ts, line in stream.get("values", []):
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    continue
                try:
                    events.append(AuditEvent.from_dict(payload))
                except (KeyError, ValueError):
                    continue
        return events
