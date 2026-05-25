from __future__ import annotations

from typing import Any

from sar_draft.http_runtime import draft_response, handle_draft_payload
from sar_draft.types import AlertInput, SarDraft
from tests.conftest import FakeAudit, FakeRetrieval, make_agent, make_alert, make_hits


def test_draft_response_matches_ts_http_generator_envelope() -> None:
    draft = SarDraft(
        alert_id="A-1",
        template_id="structuring",
        filled_text="Draft narrative.",
        citations=[],
        confidence=0.6,
        human_review_required=True,
        audit_event_id="audit-1",
    )
    assert draft_response(draft) == {
        "ok": True,
        "draft": {
            "alert_id": "A-1",
            "template_id": "structuring",
            "filled_text": "Draft narrative.",
            "citations": [],
            "confidence": 0.6,
            "human_review_required": True,
            "audit_event_id": "audit-1",
        },
    }


def test_handle_draft_payload_success() -> None:
    agent = make_agent(FakeRetrieval(make_hits()), FakeAudit())
    status, body = handle_draft_payload(agent, {"alert": make_alert().model_dump()})
    assert status == 200
    assert body["ok"] is True
    assert body["draft"]["alert_id"] == "A-1"
    assert body["draft"]["human_review_required"] is True


def test_handle_draft_payload_rejects_missing_alert() -> None:
    assert handle_draft_payload(object(), {}) == (
        400,
        {"ok": False, "error": "missing_alert"},
    )


def test_handle_draft_payload_rejects_invalid_alert() -> None:
    status, body = handle_draft_payload(object(), {"alert": {"alert_id": ""}})
    assert status == 400
    assert body == {"ok": False, "error": "invalid_alert"}


class _FailingAgent:
    def draft(self, alert: AlertInput) -> Any:
        raise RuntimeError("boom")


def test_handle_draft_payload_maps_agent_errors() -> None:
    status, body = handle_draft_payload(
        _FailingAgent(),
        {"alert": make_alert().model_dump()},
    )
    assert status == 500
    assert body == {"ok": False, "error": "agent_error"}
