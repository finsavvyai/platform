"""Pure rule predicates over `Alert`.

Each rule is a `(rule_id, weight, predicate)` triple. Predicates take an
`Alert` and return a `RuleMatch` describing whether they matched and
what PII-free evidence supports the match.

Rules are deterministic, side-effect-free, and tolerate missing optional
fields (return `not matched` rather than raise). The orchestrator calls
`evaluate_all()` to get the ordered list of `RuleMatch`.

License: Apache-2.0
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Final

from alert_triage.types import Alert

# ---------------------------------------------------------------------------
# Placeholder constants (real lists land via the regulatory-change feed).
# ---------------------------------------------------------------------------

#: ISO-3166 alpha-2 country codes considered high-risk for sanctions
#: in v0. Placeholder — the production list is signed + version-pinned
#: by the regulatory-change pipeline (M3).
HIGH_RISK_OFAC_COUNTRIES: Final[frozenset[str]] = frozenset({
    "IR",  # Iran
    "KP",  # North Korea
    "SY",  # Syria
    "CU",  # Cuba
    "RU",  # Russia (partial sanctions; v0 treats as high-risk)
})

#: Merchant Category Codes considered high-risk (gambling, crypto,
#: money-transfer). Placeholder — production list comes from the policy
#: pack.
HIGH_RISK_MCC: Final[frozenset[str]] = frozenset({
    "7995",  # gambling
    "6051",  # quasi-cash / crypto
    "4829",  # money transfer
    "6011",  # ATM cash disbursement
})

#: USD-cents lower bound of the structuring-suspicion band.
#: $9,000.00 -> $10,000.00 is the classic "just-under reporting threshold"
#: pattern. Stored as integer minor units throughout.
_STRUCTURING_BAND_LOW_MINOR: Final[int] = 9_000_00
_STRUCTURING_BAND_HIGH_MINOR: Final[int] = 10_000_00

#: $25,000.00 in integer minor units (cross-border high-value).
_CROSS_BORDER_THRESHOLD_MINOR: Final[int] = 25_000_00

_DECISION_BLOCK_FLOOR: Final[float] = 85.0
_DECISION_FLAG_FLOOR: Final[float] = 40.0


@dataclass(frozen=True)
class RuleMatch:
    """Outcome of evaluating one rule against one `Alert`."""

    rule_id: str
    matched: bool
    weight: int
    evidence: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Individual rule predicates.
# ---------------------------------------------------------------------------


def r_sanctions_country(alert: Alert) -> RuleMatch:
    """Match if `country_to` is in the high-risk OFAC list."""
    rid, weight = "r_sanctions_country", 100
    country = alert.country_to
    if country is None:
        return RuleMatch(rid, False, weight)
    if country.upper() in HIGH_RISK_OFAC_COUNTRIES:
        return RuleMatch(rid, True, weight, {"country_to": country.upper()})
    return RuleMatch(rid, False, weight)


def r_aml_decision_block(alert: Alert) -> RuleMatch:
    """Match if `decision_score >= 85` — upstream Investigate said block."""
    rid, weight = "r_aml_decision_block", 90
    score = alert.decision_score
    if score is None:
        return RuleMatch(rid, False, weight)
    if score >= _DECISION_BLOCK_FLOOR:
        return RuleMatch(rid, True, weight, {"decision_score_band": "block"})
    return RuleMatch(rid, False, weight)


def r_structuring_pattern(alert: Alert) -> RuleMatch:
    """Match if amount falls in the just-under-$10k structuring band."""
    rid, weight = "r_structuring_pattern", 70
    amt = alert.amount_minor
    if amt <= 0:
        return RuleMatch(rid, False, weight)
    if _STRUCTURING_BAND_LOW_MINOR <= amt < _STRUCTURING_BAND_HIGH_MINOR:
        return RuleMatch(rid, True, weight, {"amount_band": "9k_to_10k"})
    return RuleMatch(rid, False, weight)


def r_cross_border_amount(alert: Alert) -> RuleMatch:
    """Match if cross-border AND amount > $25k."""
    rid, weight = "r_cross_border_amount", 50
    if alert.country_from is None or alert.country_to is None:
        return RuleMatch(rid, False, weight)
    if alert.country_from.upper() == alert.country_to.upper():
        return RuleMatch(rid, False, weight)
    if alert.amount_minor > _CROSS_BORDER_THRESHOLD_MINOR:
        return RuleMatch(
            rid, True, weight, {"amount_over_25k": True, "cross_border": True}
        )
    return RuleMatch(rid, False, weight)


def r_high_risk_mcc(alert: Alert) -> RuleMatch:
    """Match if `mcc` is in the high-risk MCC set."""
    rid, weight = "r_high_risk_mcc", 40
    mcc = alert.mcc
    if mcc is None or mcc == "":
        return RuleMatch(rid, False, weight)
    if mcc in HIGH_RISK_MCC:
        return RuleMatch(rid, True, weight, {"mcc": mcc})
    return RuleMatch(rid, False, weight)


def r_aml_decision_flag(alert: Alert) -> RuleMatch:
    """Match if `40 <= decision_score < 85` — upstream said review-band."""
    rid, weight = "r_aml_decision_flag", 30
    score = alert.decision_score
    if score is None:
        return RuleMatch(rid, False, weight)
    if _DECISION_FLAG_FLOOR <= score < _DECISION_BLOCK_FLOOR:
        return RuleMatch(rid, True, weight, {"decision_score_band": "flag"})
    return RuleMatch(rid, False, weight)


#: Ordered registry — used by `evaluate_all`. Order is documented but the
#: reasoner re-sorts the matched subset by weight desc for determinism.
ALL_RULES: Final[tuple[Callable[[Alert], RuleMatch], ...]] = (
    r_sanctions_country,
    r_aml_decision_block,
    r_structuring_pattern,
    r_cross_border_amount,
    r_high_risk_mcc,
    r_aml_decision_flag,
)


def evaluate_all(alert: Alert) -> list[RuleMatch]:
    """Run every rule. Returns all outcomes (matched + unmatched)."""
    return [rule(alert) for rule in ALL_RULES]
