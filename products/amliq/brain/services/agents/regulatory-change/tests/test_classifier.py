"""Tests for `classifier.classify` — safety-critical (100 % coverage gate)."""

from __future__ import annotations

from regulatory_change import classify
from regulatory_change.classifier import apply_classification
from regulatory_change.types import ChangeChunk, PolicyDelta, Section


def _delta(**kw: object) -> PolicyDelta:
    base: dict[str, object] = {
        "doc_id": "D1",
        "new_version_id": "sha-current",
        "prior_version_id": "sha-prior",
        "diff_summary": "test",
    }
    base.update(kw)
    return PolicyDelta(**base)  # type: ignore[arg-type]


def test_no_change_classified_as_typo() -> None:
    assert classify(_delta()) == "typo"


def test_added_section_is_material() -> None:
    delta = _delta(sections_added=[Section(heading="X", text="new")])
    assert classify(delta) == "material"


def test_removed_section_is_material() -> None:
    delta = _delta(sections_removed=[Section(heading="X", text="gone")])
    assert classify(delta) == "material"


def test_whitespace_only_change_is_typo() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="hello world", current_text="hello  world")
        ]
    )
    assert classify(delta) == "typo"


def test_case_only_change_is_typo() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="Hello World", current_text="hello world")
        ]
    )
    assert classify(delta) == "typo"


def test_punctuation_only_change_is_typo() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="hello, world.", current_text="hello world")
        ]
    )
    assert classify(delta) == "typo"


def test_two_token_swap_meets_material_threshold() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="alpha beta gamma", current_text="alpha beta delta")
        ]
    )
    # symmetric diff = {gamma, delta} → 2 token changes → meets material threshold.
    assert classify(delta) == "material"


def test_single_addition_clarifying() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="alpha beta", current_text="alpha beta gamma")
        ]
    )
    # symmetric diff = {gamma} → 1 token change → clarifying
    assert classify(delta) == "clarifying"


def test_long_diff_is_material() -> None:
    prior = "Once upon a time."
    current = "Once upon a time, " + ("there were many strange events. " * 5)
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text=prior, current_text=current)
        ]
    )
    assert classify(delta) == "material"


def test_many_token_changes_is_material() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(
                heading="A",
                prior_text="aaa bbb ccc",
                current_text="xxx yyy zzz",
            )
        ]
    )
    assert classify(delta) == "material"


def test_ambiguous_word_reorder_defaults_to_material() -> None:
    """Invariant 6 — token-change=0 but normalised strings differ → material.

    Word reordering keeps the token SET identical (symmetric diff = 0) but
    the normalised STRINGS differ, so `_is_typo_only` is False. This hits
    the documented conservative-default branch in the classifier.
    """
    delta = _delta(
        sections_changed=[
            ChangeChunk(
                heading="A",
                prior_text="alpha beta gamma delta",
                current_text="delta gamma beta alpha",
            )
        ]
    )
    # tokens identical → symmetric diff 0; not typo (order matters in normalised string);
    # char_diff = 0 < threshold; falls through to conservative branch.
    assert classify(delta) == "material"


def test_mixed_chunks_typo_and_material_yields_material() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="hello world", current_text="HELLO WORLD"),
            ChangeChunk(
                heading="B",
                prior_text="alpha",
                current_text="alpha " + ("beta " * 30),
            ),
        ]
    )
    assert classify(delta) == "material"


def test_mixed_chunks_typo_and_clarifying_yields_clarifying() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="hello world", current_text="HELLO WORLD"),
            ChangeChunk(
                heading="B",
                prior_text="alpha beta",
                current_text="alpha beta gamma",  # 1-token add
            ),
        ]
    )
    assert classify(delta) == "clarifying"


def test_all_typo_chunks_yields_typo() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="A", prior_text="hello", current_text="Hello"),
            ChangeChunk(heading="B", prior_text="world.", current_text="world"),
        ]
    )
    assert classify(delta) == "typo"


def test_apply_classification_sets_field() -> None:
    delta = _delta(sections_added=[Section(heading="X", text="new")])
    out = apply_classification(delta)
    assert out.materiality == "material"
    assert delta.materiality == "clarifying"  # original untouched (model_copy)
