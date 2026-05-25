"""Tests for `differ.diff_policy` — pure section diff."""

from __future__ import annotations

from regulatory_change import diff_policy
from tests.conftest import make_doc


def test_identical_docs_yield_no_delta() -> None:
    body = "A\nfirst.\n\nB\nsecond."
    d = diff_policy(make_doc(body=body), make_doc(body=body))
    assert d.sections_added == []
    assert d.sections_removed == []
    assert d.sections_changed == []
    assert "+0 added" in d.diff_summary
    assert d.prior_version_id is not None
    assert d.new_version_id == d.prior_version_id


def test_added_section_detected() -> None:
    prior = make_doc(body="A\nfirst.")
    current = make_doc(body="A\nfirst.\n\nB\nbrand new section.")
    d = diff_policy(current, prior)
    assert len(d.sections_added) == 1
    assert d.sections_added[0].heading == "B"
    assert d.sections_removed == []
    assert d.sections_changed == []


def test_removed_section_detected() -> None:
    prior = make_doc(body="A\nfirst.\n\nB\nsecond.")
    current = make_doc(body="A\nfirst.")
    d = diff_policy(current, prior)
    assert d.sections_added == []
    assert len(d.sections_removed) == 1
    assert d.sections_removed[0].heading == "B"


def test_modified_section_detected() -> None:
    prior = make_doc(body="A\nfirst version.")
    current = make_doc(body="A\nsecond version, materially different.")
    d = diff_policy(current, prior)
    assert d.sections_added == []
    assert d.sections_removed == []
    assert len(d.sections_changed) == 1
    chunk = d.sections_changed[0]
    assert chunk.heading == "A"
    assert chunk.prior_text == "first version."
    assert chunk.current_text == "second version, materially different."


def test_missing_prior_returns_empty_delta() -> None:
    current = make_doc(body="A\ntext")
    d = diff_policy(current, None)
    assert d.sections_added == []
    assert d.sections_removed == []
    assert d.sections_changed == []
    assert d.prior_version_id is None
    assert d.new_version_id == current.sha256


def test_empty_body_handled() -> None:
    prior = make_doc(body="")
    current = make_doc(body="")
    d = diff_policy(current, prior)
    assert d.sections_added == []
    assert d.sections_removed == []
    assert d.sections_changed == []


def test_empty_current_against_populated_prior() -> None:
    prior = make_doc(body="A\nfirst.")
    current = make_doc(body="")
    d = diff_policy(current, prior)
    assert len(d.sections_removed) == 1
    assert d.sections_added == []


def test_crlf_line_endings_normalised() -> None:
    body = "A\r\nfirst.\r\n\r\nB\r\nsecond."
    d = diff_policy(make_doc(body=body), make_doc(body=body))
    assert d.sections_added == d.sections_removed == d.sections_changed == []


def test_duplicate_headings_last_wins() -> None:
    body = "A\nfirst.\n\nA\nsecond."
    current = make_doc(body=body)
    prior = make_doc(body="A\nsecond.")
    d = diff_policy(current, prior)
    # Both have heading A; last-seen wins, so the texts match — no change.
    assert d.sections_changed == []
    assert d.sections_added == []
