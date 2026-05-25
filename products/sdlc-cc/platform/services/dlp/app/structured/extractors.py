"""High-level DLP extraction helpers backed by `instructor`.

Every function returns ``None`` when the feature is disabled or when a call
fails, so callers can fall back to deterministic rule-based logic. These
helpers never raise on LLM errors — they log and return ``None``.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from .client import StructuredLLMClient, get_structured_client
from .models import (
    ClassificationResult,
    MaskingPlan,
    PolicyDecision,
)

logger = logging.getLogger(__name__)

_POLICY_SYSTEM = (
    "You are the policy evaluator for an enterprise DLP system. Given text "
    "and a set of rules, decide on the single best action (allow, redact, "
    "mask, block, escalate). Cite any matched rule ids and explain briefly."
)

_CLASSIFY_SYSTEM = (
    "You are a data sensitivity classifier. Read the text and assign a "
    "sensitivity bucket, relevant categories (e.g. pii, phi, finance, "
    "credentials), detected entity labels, and your confidence."
)

_MASK_SYSTEM = (
    "You are a masking planner for a DLP system. Given text and detected "
    "entities, produce a plan specifying how each entity type should be "
    "masked. Prefer the least destructive operation that still protects "
    "the data."
)


def _client() -> StructuredLLMClient | None:
    return get_structured_client()


def _rules_to_text(rules: Iterable[Mapping[str, Any]]) -> str:
    lines: list[str] = []
    for rule in rules:
        rid = rule.get("id", "?")
        name = rule.get("name", "")
        desc = rule.get("description") or rule.get("pattern") or ""
        severity = rule.get("severity", "")
        lines.append(f"- id={rid} name={name!r} severity={severity} :: {desc}")
    return "\n".join(lines) if lines else "(no rules provided)"


def evaluate_policy(
    text: str, rules: Sequence[Mapping[str, Any]]
) -> PolicyDecision | None:
    """Ask the LLM to choose a :class:`PolicyDecision` for ``text``."""
    client = _client()
    if client is None:
        return None
    user = (
        f"Text:\n{text}\n\nRules:\n{_rules_to_text(rules)}\n\n"
        "Return the best policy decision."
    )
    try:
        return client.create(
            response_model=PolicyDecision,
            messages=[
                {"role": "system", "content": _POLICY_SYSTEM},
                {"role": "user", "content": user},
            ],
            temperature=0.0,
            max_tokens=512,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("structured evaluate_policy failed: %s", exc)
        return None


def classify_sensitivity(text: str) -> ClassificationResult | None:
    """Classify the sensitivity of ``text`` via LLM."""
    client = _client()
    if client is None:
        return None
    snippet = text[:4000]
    try:
        return client.create(
            response_model=ClassificationResult,
            messages=[
                {"role": "system", "content": _CLASSIFY_SYSTEM},
                {"role": "user", "content": snippet},
            ],
            temperature=0.0,
            max_tokens=512,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("structured classify_sensitivity failed: %s", exc)
        return None


def plan_masking(
    text: str, detected_entities: Sequence[Mapping[str, Any]]
) -> MaskingPlan | None:
    """Produce a :class:`MaskingPlan` for the given detected entities."""
    client = _client()
    if client is None:
        return None
    entities_json = json.dumps(list(detected_entities), default=str)[:4000]
    user = (
        f"Text snippet:\n{text[:2000]}\n\n"
        f"Detected entities (JSON):\n{entities_json}\n\n"
        "Return a masking plan."
    )
    try:
        return client.create(
            response_model=MaskingPlan,
            messages=[
                {"role": "system", "content": _MASK_SYSTEM},
                {"role": "user", "content": user},
            ],
            temperature=0.0,
            max_tokens=768,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("structured plan_masking failed: %s", exc)
        return None
