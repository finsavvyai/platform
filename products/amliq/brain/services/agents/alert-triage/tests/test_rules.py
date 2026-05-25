"""Rule predicate tests — positive, negative, and missing-field paths.

Coverage target: 100% on `rules.py` (every predicate's pos/neg/missing
branch is exercised here).
"""

from __future__ import annotations

from alert_triage import (
    HIGH_RISK_MCC,
    HIGH_RISK_OFAC_COUNTRIES,
    evaluate_all,
    r_aml_decision_block,
    r_aml_decision_flag,
    r_cross_border_amount,
    r_high_risk_mcc,
    r_sanctions_country,
    r_structuring_pattern,
)
from tests.conftest import make_alert

# ----------------------------- sanctions country ---------------------------


def test_sanctions_country_matches_high_risk() -> None:
    out = r_sanctions_country(make_alert(country_to="IR"))
    assert out.matched is True
    assert out.weight == 100
    assert out.evidence == {"country_to": "IR"}


def test_sanctions_country_normalises_case() -> None:
    out = r_sanctions_country(make_alert(country_to="ir"))
    assert out.matched is True
    assert out.evidence == {"country_to": "IR"}


def test_sanctions_country_does_not_match_safe() -> None:
    assert r_sanctions_country(make_alert(country_to="GB")).matched is False


def test_sanctions_country_handles_missing_field() -> None:
    out = r_sanctions_country(make_alert(country_to=None))
    assert out.matched is False
    assert out.evidence == {}


def test_sanctions_country_list_is_non_empty() -> None:
    assert len(HIGH_RISK_OFAC_COUNTRIES) > 0


# ----------------------------- decision block ------------------------------


def test_decision_block_matches_at_threshold() -> None:
    out = r_aml_decision_block(make_alert(decision_score=85.0))
    assert out.matched is True
    assert out.evidence == {"decision_score_band": "block"}


def test_decision_block_matches_above_threshold() -> None:
    assert r_aml_decision_block(make_alert(decision_score=99.0)).matched is True


def test_decision_block_does_not_match_below() -> None:
    assert r_aml_decision_block(make_alert(decision_score=80.0)).matched is False


def test_decision_block_handles_missing_field() -> None:
    assert r_aml_decision_block(make_alert(decision_score=None)).matched is False


# ----------------------------- structuring ---------------------------------


def test_structuring_matches_in_band_low_edge() -> None:
    assert r_structuring_pattern(make_alert(amount_minor=9_000_00)).matched is True


def test_structuring_matches_in_band_mid() -> None:
    out = r_structuring_pattern(make_alert(amount_minor=9_500_00))
    assert out.matched is True
    assert out.evidence == {"amount_band": "9k_to_10k"}


def test_structuring_does_not_match_at_upper_edge() -> None:
    # 10_000_00 is the exclusive upper bound — must NOT match (CTR territory).
    assert r_structuring_pattern(make_alert(amount_minor=10_000_00)).matched is False


def test_structuring_does_not_match_below_band() -> None:
    assert r_structuring_pattern(make_alert(amount_minor=8_999_00)).matched is False


def test_structuring_handles_zero_amount() -> None:
    assert r_structuring_pattern(make_alert(amount_minor=0)).matched is False


# ----------------------------- cross-border --------------------------------


def test_cross_border_matches_over_threshold() -> None:
    out = r_cross_border_amount(
        make_alert(country_from="US", country_to="GB", amount_minor=30_000_00)
    )
    assert out.matched is True
    assert out.evidence == {"amount_over_25k": True, "cross_border": True}


def test_cross_border_does_not_match_same_country() -> None:
    assert (
        r_cross_border_amount(
            make_alert(country_from="US", country_to="US", amount_minor=50_000_00)
        ).matched
        is False
    )


def test_cross_border_does_not_match_below_threshold() -> None:
    assert (
        r_cross_border_amount(
            make_alert(country_from="US", country_to="GB", amount_minor=24_999_00)
        ).matched
        is False
    )


def test_cross_border_handles_missing_country_from() -> None:
    assert r_cross_border_amount(make_alert(country_from=None)).matched is False


def test_cross_border_handles_missing_country_to() -> None:
    assert r_cross_border_amount(make_alert(country_to=None)).matched is False


def test_cross_border_case_insensitive_same_country() -> None:
    assert (
        r_cross_border_amount(
            make_alert(country_from="us", country_to="US", amount_minor=30_000_00)
        ).matched
        is False
    )


# ----------------------------- high-risk MCC -------------------------------


def test_high_risk_mcc_matches_gambling() -> None:
    out = r_high_risk_mcc(make_alert(mcc="7995"))
    assert out.matched is True
    assert out.evidence == {"mcc": "7995"}


def test_high_risk_mcc_does_not_match_safe() -> None:
    assert r_high_risk_mcc(make_alert(mcc="5411")).matched is False


def test_high_risk_mcc_handles_none() -> None:
    assert r_high_risk_mcc(make_alert(mcc=None)).matched is False


def test_high_risk_mcc_handles_empty_string() -> None:
    assert r_high_risk_mcc(make_alert(mcc="")).matched is False


def test_high_risk_mcc_list_is_non_empty() -> None:
    assert len(HIGH_RISK_MCC) > 0


# ----------------------------- decision flag -------------------------------


def test_decision_flag_matches_at_floor() -> None:
    out = r_aml_decision_flag(make_alert(decision_score=40.0))
    assert out.matched is True
    assert out.evidence == {"decision_score_band": "flag"}


def test_decision_flag_matches_mid_band() -> None:
    assert r_aml_decision_flag(make_alert(decision_score=70.0)).matched is True


def test_decision_flag_does_not_match_below_floor() -> None:
    assert r_aml_decision_flag(make_alert(decision_score=39.0)).matched is False


def test_decision_flag_does_not_match_at_block_floor() -> None:
    # 85 belongs to the block band, not the flag band (exclusive upper).
    assert r_aml_decision_flag(make_alert(decision_score=85.0)).matched is False


def test_decision_flag_handles_missing_field() -> None:
    assert r_aml_decision_flag(make_alert(decision_score=None)).matched is False


# ----------------------------- evaluate_all --------------------------------


def test_evaluate_all_returns_one_per_rule() -> None:
    results = evaluate_all(make_alert())
    assert len(results) == 6


def test_evaluate_all_does_not_raise_on_minimal_alert() -> None:
    alert = make_alert(
        country_from=None,
        country_to=None,
        mcc=None,
        decision_score=None,
        amount_minor=0,
    )
    # Should not raise anywhere.
    results = evaluate_all(alert)
    assert all(r.matched is False for r in results)
