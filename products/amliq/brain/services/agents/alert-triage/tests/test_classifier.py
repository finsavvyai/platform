"""Classifier tests — every priority + category mapping, actions, confidence.

Coverage target: 100% on `classifier.py`.
"""

from __future__ import annotations

from alert_triage import (
    Category,
    Priority,
    ReasoningStep,
    assign_category,
    assign_priority,
    confidence,
    recommended_actions,
)
from tests.conftest import make_alert


def _step(rid: str, weight: int) -> ReasoningStep:
    return ReasoningStep(rule_id=rid, matched=True, evidence={}, weight=weight)


# ----------------------------- priority ------------------------------------


def test_priority_p1_on_sanctions() -> None:
    chain = [_step("r_sanctions_country", 100)]
    assert assign_priority(chain) is Priority.P1


def test_priority_p1_on_decision_block() -> None:
    chain = [_step("r_aml_decision_block", 90)]
    assert assign_priority(chain) is Priority.P1


def test_priority_p1_even_if_only_one_rule_matched_when_sanctions() -> None:
    # Sanctions overrides the "1 match = p3" rule.
    chain = [_step("r_sanctions_country", 100)]
    assert assign_priority(chain) is Priority.P1


def test_priority_p2_on_two_non_critical_matches() -> None:
    chain = [_step("r_high_risk_mcc", 40), _step("r_aml_decision_flag", 30)]
    assert assign_priority(chain) is Priority.P2


def test_priority_p3_on_one_non_critical_match() -> None:
    chain = [_step("r_aml_decision_flag", 30)]
    assert assign_priority(chain) is Priority.P3


def test_priority_p4_on_no_matches() -> None:
    assert assign_priority([]) is Priority.P4


# ----------------------------- category ------------------------------------


def test_category_sanctions_takes_precedence_over_structuring() -> None:
    chain = [
        _step("r_sanctions_country", 100),
        _step("r_structuring_pattern", 70),
    ]
    assert assign_category(chain, make_alert()) is Category.SANCTIONS


def test_category_structuring_when_structuring_rule_matched() -> None:
    chain = [_step("r_structuring_pattern", 70)]
    assert assign_category(chain, make_alert()) is Category.STRUCTURING


def test_category_fraud_on_decision_block_only() -> None:
    chain = [_step("r_aml_decision_block", 90)]
    assert assign_category(chain, make_alert()) is Category.FRAUD


def test_category_sanctions_outranks_fraud() -> None:
    chain = [
        _step("r_sanctions_country", 100),
        _step("r_aml_decision_block", 90),
    ]
    assert assign_category(chain, make_alert()) is Category.SANCTIONS


def test_category_structuring_outranks_fraud() -> None:
    chain = [
        _step("r_structuring_pattern", 70),
        _step("r_aml_decision_block", 90),
    ]
    assert assign_category(chain, make_alert()) is Category.STRUCTURING


def test_category_kyc_when_subject_hash_missing_and_no_matches() -> None:
    assert assign_category([], make_alert(subject_hash="")) is Category.KYC


def test_category_other_when_subject_hash_present_and_no_matches() -> None:
    assert assign_category([], make_alert()) is Category.OTHER


def test_category_other_for_low_weight_match_with_kyc_present() -> None:
    # subject_hash present + only mcc rule → falls to OTHER.
    chain = [_step("r_high_risk_mcc", 40)]
    assert assign_category(chain, make_alert()) is Category.OTHER


# ----------------------------- recommended_actions -------------------------


def test_actions_p1_sanctions() -> None:
    assert recommended_actions(Priority.P1, Category.SANCTIONS) == [
        "freeze_funds",
        "notify_compliance_officer",
        "open_sar_draft",
    ]


def test_actions_p1_fraud() -> None:
    assert recommended_actions(Priority.P1, Category.FRAUD) == [
        "freeze_card",
        "notify_fraud_team",
        "open_sar_draft",
    ]


def test_actions_p2_structuring() -> None:
    assert recommended_actions(Priority.P2, Category.STRUCTURING) == [
        "request_sof_docs",
        "escalate_to_compliance_officer",
    ]


def test_actions_p3_kyc() -> None:
    assert recommended_actions(Priority.P3, Category.KYC) == ["request_kyc_refresh"]


def test_actions_p4_other() -> None:
    assert recommended_actions(Priority.P4, Category.OTHER) == ["monitor"]


def test_actions_p4_kyc_still_requests_refresh() -> None:
    assert recommended_actions(Priority.P4, Category.KYC) == ["request_kyc_refresh"]


def test_actions_returns_copy_not_shared_reference() -> None:
    a = recommended_actions(Priority.P1, Category.SANCTIONS)
    a.append("hax")
    b = recommended_actions(Priority.P1, Category.SANCTIONS)
    assert "hax" not in b


def test_actions_every_priority_category_combo_returns_non_empty() -> None:
    """Every documented (priority, category) pair has a non-empty action list."""
    for p in Priority:
        for c in Category:
            assert recommended_actions(p, c), f"empty actions for {p}/{c}"


# ----------------------------- confidence ----------------------------------


def test_confidence_no_match_returns_floor() -> None:
    assert confidence([]) == 0.2


def test_confidence_single_low_weight_rule() -> None:
    # (1 * 0.15) + (30 / 400) = 0.225
    assert abs(confidence([_step("r_aml_decision_flag", 30)]) - 0.225) < 1e-9


def test_confidence_multi_rule_sums() -> None:
    # (2 * 0.15) + ((100+70)/400) = 0.3 + 0.425 = 0.725
    val = confidence([_step("r_a", 100), _step("r_b", 70)])
    assert abs(val - 0.725) < 1e-9


def test_confidence_clamped_to_one() -> None:
    big = [_step(f"r_{i}", 1000) for i in range(6)]
    assert confidence(big) == 1.0


def test_confidence_clamped_lower_bound() -> None:
    # Synthetic: zero-weight, single step.
    assert confidence([_step("r_zero", 0)]) == 0.15
