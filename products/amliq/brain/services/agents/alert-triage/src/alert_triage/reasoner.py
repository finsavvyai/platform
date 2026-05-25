"""Pure: turn `RuleMatch[]` into an ordered `ReasoningStep[]` chain.

Only matched rules become reasoning steps in the public chain. Order is
weight-descending, with `rule_id` ascending as the deterministic tie-
breaker so the same alert always produces the same chain (analyst trust).

License: Apache-2.0
"""

from __future__ import annotations

from alert_triage.rules import RuleMatch
from alert_triage.types import ReasoningStep


def build_chain(matches: list[RuleMatch]) -> list[ReasoningStep]:
    """Return the ordered reasoning chain for the matched rules.

    Sort key: (-weight, rule_id). This puts heavier rules first and keeps
    ordering stable when two rules share the same weight.
    """
    matched = [m for m in matches if m.matched]
    matched.sort(key=lambda m: (-m.weight, m.rule_id))
    return [
        ReasoningStep(
            rule_id=m.rule_id,
            matched=True,
            evidence=dict(m.evidence),
            weight=m.weight,
        )
        for m in matched
    ]


def matched_rule_ids(matches: list[RuleMatch]) -> list[str]:
    """Convenience: rule IDs of matched rules, in chain order."""
    return [step.rule_id for step in build_chain(matches)]
