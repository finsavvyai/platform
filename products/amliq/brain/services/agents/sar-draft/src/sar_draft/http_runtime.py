"""HTTP contract helpers for a separately hosted SAR Draft runtime.

This module intentionally does not start a server. ASGI/WSGI/Workers-like
hosts can call `handle_draft_payload()` and serialize the returned dict.
Keeping the contract here lets the TS API adapter test against the exact
`{ok, draft}` response shape without coupling TS to Python internals.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from sar_draft.types import AlertInput, SarDraft


def draft_response(draft: SarDraft) -> dict[str, Any]:
    """Return the transport envelope consumed by `HttpSarDraftGenerator`."""
    return {"ok": True, "draft": draft.model_dump(mode="json")}


def error_response(code: str, status: int) -> tuple[int, dict[str, Any]]:
    return status, {"ok": False, "error": code}


def handle_draft_payload(agent: Any, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Validate an HTTP JSON payload and call `agent.draft(AlertInput)`.

    Expected request shape:
        {"alert": AlertInput}

    Response shape:
        (200, {"ok": True, "draft": SarDraft})
        (400, {"ok": False, "error": "missing_alert"|"invalid_alert"})
        (500, {"ok": False, "error": "agent_error"})
    """
    raw_alert = payload.get("alert")
    if not isinstance(raw_alert, dict):
        return error_response("missing_alert", 400)
    try:
        alert = AlertInput.model_validate(raw_alert)
    except ValidationError:
        return error_response("invalid_alert", 400)

    try:
        draft = agent.draft(alert)
    except Exception:
        return error_response("agent_error", 500)

    return 200, draft_response(draft)
