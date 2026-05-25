"""Pure: ReasoningStep chain → (Priority, Category, actions, confidence).

Deterministic mapping per DESIGN.md §6 / §7 / §8. No side effects.

License: Apache-2.0
"""

from __future__ import annotations

from typing import Final

from alert_triage.types import Alert, Category, Priority, ReasoningStep

# ---------------------------------------------------------------------------
# Rule-id sets used by the classifier (single source of truth for mapping).
# ---------------------------------------------------------------------------

_SANCTIONS_RULES: Final[frozenset[str]] = frozenset({"r_sanctions_country"})
_STRUCTURING_RULES: Final[frozenset[str]] = frozenset({"r_structuring_pattern"})
_FRAUD_RULES: Final[frozenset[str]] = frozenset({"r_aml_decision_block"})

# Confidence formula constants (DESIGN.md §9).
_CONF_PER_MATCH: Final[float] = 0.15
_CONF_WEIGHT_DIVISOR: Final[float] = 400.0
_CONF_NO_MATCH: Final[float] = 0.2


def assign_priority(chain: list[ReasoningStep]) -> Priority:
    """Map reasoning chain → priority (DESIGN.md §6)."""
    ids = {s.rule_id for s in chain}
    if ids & (_SANCTIONS_RULES | _FRAUD_RULES):
        return Priority.P1
    n = len(chain)
    if n >= 2:
        return Priority.P2
    if n == 1:
        return Priority.P3
    return Priority.P4


def assign_category(chain: list[ReasoningStep], alert: Alert) -> Category:
    """Map reasoning chain + alert → category (DESIGN.md §7).

    Mutually exclusive precedence:
        sanctions > structuring > fraud > kyc > other
    `kyc` triggers on missing `subject_hash` (analyst must refresh KYC
    before any other action).
    """
    ids = {s.rule_id for s in chain}
    if ids & _SANCTIONS_RULES:
        return Category.SANCTIONS
    if ids & _STRUCTURING_RULES:
        return Category.STRUCTURING
    if ids & _FRAUD_RULES:
        return Category.FRAUD
    if not alert.subject_hash:
        return Category.KYC
    return Category.OTHER


# ---------------------------------------------------------------------------
# Recommended actions table (DESIGN.md §8).
# Keyed by (priority, category); the orchestrator looks up; any missing
# combination falls back to `_FALLBACK_ACTIONS`.
# ---------------------------------------------------------------------------

_ACTIONS_BY_PRIORITY_CATEGORY: Final[dict[tuple[Priority, Category], list[str]]] = {
    (Priority.P1, Category.SANCTIONS): [
        "freeze_funds",
        "notify_compliance_officer",
        "open_sar_draft",
    ],
    (Priority.P1, Category.FRAUD): [
        "freeze_card",
        "notify_fraud_team",
        "open_sar_draft",
    ],
    (Priority.P1, Category.STRUCTURING): [
        "freeze_funds",
        "request_sof_docs",
        "escalate_to_compliance_officer",
    ],
    (Priority.P1, Category.KYC): [
        "freeze_account",
        "request_kyc_refresh",
        "escalate_to_compliance_officer",
    ],
    (Priority.P1, Category.OTHER): [
        "escalate_to_compliance_officer",
    ],
    (Priority.P2, Category.SANCTIONS): [
        "freeze_funds",
        "notify_compliance_officer",
    ],
    (Priority.P2, Category.STRUCTURING): [
        "request_sof_docs",
        "escalate_to_compliance_officer",
    ],
    (Priority.P2, Category.FRAUD): [
        "notify_fraud_team",
        "request_sof_docs",
    ],
    (Priority.P2, Category.KYC): [
        "request_kyc_refresh",
        "escalate_to_compliance_officer",
    ],
    (Priority.P2, Category.OTHER): [
        "request_sof_docs",
    ],
    (Priority.P3, Category.SANCTIONS): ["notify_compliance_officer"],
    (Priority.P3, Category.STRUCTURING): ["request_sof_docs"],
    (Priority.P3, Category.FRAUD): ["notify_fraud_team"],
    (Priority.P3, Category.KYC): ["request_kyc_refresh"],
    (Priority.P3, Category.OTHER): ["request_sof_docs"],
    (Priority.P4, Category.SANCTIONS): ["monitor"],
    (Priority.P4, Category.STRUCTURING): ["monitor"],
    (Priority.P4, Category.FRAUD): ["monitor"],
    (Priority.P4, Category.KYC): ["request_kyc_refresh"],
    (Priority.P4, Category.OTHER): ["monitor"],
}

_FALLBACK_ACTIONS: Final[list[str]] = ["monitor"]


def recommended_actions(priority: Priority, category: Category) -> list[str]:
    """Return the deterministic action checklist for a (priority, category)."""
    return list(_ACTIONS_BY_PRIORITY_CATEGORY.get((priority, category), _FALLBACK_ACTIONS))


def confidence(chain: list[ReasoningStep]) -> float:
    """Compute confidence per DESIGN.md §9 — clamped to `[0.0, 1.0]`."""
    if not chain:
        return _CONF_NO_MATCH
    weight_sum = sum(step.weight for step in chain)
    raw = (len(chain) * _CONF_PER_MATCH) + (weight_sum / _CONF_WEIGHT_DIVISOR)
    return max(0.0, min(1.0, raw))
