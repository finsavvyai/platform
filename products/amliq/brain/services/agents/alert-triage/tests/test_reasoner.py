"""Reasoner tests — chain order, matched-only filtering, determinism."""

from __future__ import annotations

from alert_triage import RuleMatch, build_chain, matched_rule_ids


def _m(rid: str, matched: bool, weight: int) -> RuleMatch:
    return RuleMatch(rule_id=rid, matched=matched, weight=weight, evidence={"k": rid})


def test_chain_includes_only_matched_rules() -> None:
    chain = build_chain(
        [
            _m("r_a", True, 30),
            _m("r_b", False, 100),
            _m("r_c", True, 70),
        ]
    )
    assert [s.rule_id for s in chain] == ["r_c", "r_a"]


def test_chain_sorted_by_weight_desc() -> None:
    chain = build_chain(
        [
            _m("r_low", True, 10),
            _m("r_high", True, 90),
            _m("r_mid", True, 50),
        ]
    )
    assert [s.weight for s in chain] == [90, 50, 10]


def test_chain_tiebreaks_by_rule_id_asc() -> None:
    chain = build_chain(
        [
            _m("r_b", True, 50),
            _m("r_a", True, 50),
            _m("r_c", True, 50),
        ]
    )
    assert [s.rule_id for s in chain] == ["r_a", "r_b", "r_c"]


def test_chain_is_deterministic_across_invocations() -> None:
    matches = [
        _m("r_high", True, 90),
        _m("r_low", True, 10),
        _m("r_mid_b", True, 50),
        _m("r_mid_a", True, 50),
    ]
    first = build_chain(matches)
    second = build_chain(list(matches))  # copy
    assert [s.rule_id for s in first] == [s.rule_id for s in second]


def test_chain_preserves_evidence() -> None:
    chain = build_chain([_m("r_x", True, 1)])
    assert chain[0].evidence == {"k": "r_x"}


def test_chain_marks_all_steps_matched() -> None:
    chain = build_chain([_m("r_a", True, 1), _m("r_b", True, 2)])
    assert all(s.matched is True for s in chain)


def test_chain_empty_when_no_matches() -> None:
    assert build_chain([_m("r_a", False, 1), _m("r_b", False, 2)]) == []


def test_matched_rule_ids_uses_chain_order() -> None:
    matches = [
        _m("r_low", True, 10),
        _m("r_high", True, 90),
    ]
    assert matched_rule_ids(matches) == ["r_high", "r_low"]


def test_chain_does_not_mutate_input() -> None:
    matches = [_m("r_b", True, 10), _m("r_a", True, 10)]
    original_order = [m.rule_id for m in matches]
    build_chain(matches)
    assert [m.rule_id for m in matches] == original_order
