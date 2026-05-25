"""Rule-based materiality classifier for `PolicyDelta`.

Safety-critical (100 % coverage gate). Conservative defaults: when in
doubt, mark `material` — better to flag a non-issue than miss a real
regulatory change.

Heuristics (DESIGN.md §5):
- Added/removed sections (non-empty) → `material`.
- Sections changed only by whitespace, case, or punctuation → `typo`.
- Body-diff length ≥ MATERIAL_CHAR_THRESHOLD OR token-changes ≥
  MATERIAL_TOKEN_THRESHOLD per section → `material`.
- Small text diff with single token change → `clarifying`.
- Ambiguous → `material` (defensive default).

License: Apache-2.0
"""

from __future__ import annotations

import re
from typing import Final

from regulatory_change.types import ChangeChunk, PolicyDelta

# Tuning constants — surfaced for review and future supervised tuning.
MATERIAL_CHAR_THRESHOLD: Final[int] = 80
MATERIAL_TOKEN_THRESHOLD: Final[int] = 2

_PUNCT_RE: Final[re.Pattern[str]] = re.compile(r"[^\w\s]+")
_WS_RE: Final[re.Pattern[str]] = re.compile(r"\s+")


def _normalise(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace.

    Two strings that normalise to the same value differ only by typo-
    level noise.
    """
    lowered = text.lower()
    no_punct = _PUNCT_RE.sub(" ", lowered)
    return _WS_RE.sub(" ", no_punct).strip()


def _is_typo_only(chunk: ChangeChunk) -> bool:
    return _normalise(chunk.prior_text) == _normalise(chunk.current_text)


def _token_change_count(chunk: ChangeChunk) -> int:
    """Symmetric difference of token sets — a coarse but bounded measure."""
    prior_tokens = set(_normalise(chunk.prior_text).split())
    cur_tokens = set(_normalise(chunk.current_text).split())
    return len(prior_tokens.symmetric_difference(cur_tokens))


def _char_diff_size(chunk: ChangeChunk) -> int:
    return abs(len(chunk.current_text) - len(chunk.prior_text))


def classify(delta: PolicyDelta) -> str:
    """Return `'material'`, `'clarifying'`, or `'typo'`.

    Conservative: ambiguous diffs default to `'material'` (invariant 6).
    """
    # 1. Added/removed sections → always material.
    if delta.sections_added or delta.sections_removed:
        return "material"

    # 2. No changes at all → typo (a no-op diff is the weakest signal).
    if not delta.sections_changed:
        return "typo"

    # 3. Classify per-chunk; aggregate to whole-doc materiality.
    all_typo = True
    any_material = False
    any_clarifying = False

    for chunk in delta.sections_changed:
        if _is_typo_only(chunk):
            continue
        all_typo = False

        token_changes = _token_change_count(chunk)
        char_diff = _char_diff_size(chunk)

        if token_changes >= MATERIAL_TOKEN_THRESHOLD or char_diff >= MATERIAL_CHAR_THRESHOLD:
            any_material = True
        elif token_changes == 1:
            any_clarifying = True
        else:
            # token_changes == 0 but normalisation didn't match — punctuation
            # / case shift larger than the typo collapse can detect. Treat
            # as material per the conservative-default invariant.
            any_material = True

    if all_typo:
        return "typo"
    if any_material:
        return "material"
    if any_clarifying:
        return "clarifying"
    # Defensive fallback (theoretically unreachable given the branches
    # above; documented as the explicit conservative default).
    return "material"  # pragma: no cover


def apply_classification(delta: PolicyDelta) -> PolicyDelta:
    """Return a copy of `delta` with `materiality` set by `classify()`."""
    materiality = classify(delta)
    return delta.model_copy(update={"materiality": materiality})
