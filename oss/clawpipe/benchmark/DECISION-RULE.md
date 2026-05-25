# Decision Rule (locked 2026-05-02, BEFORE results)

The point of locking this before the results is to prevent post-hoc
rationalization. Whatever Bucket A's Day 7 number is over Baseline B, the
corresponding action below is the action.

## The rule

| Bucket A delta over **Baseline B** (provider with prompt caching) | Action |
|---|---|
| ≥ 25% | **Commit.** Six-month sprint on agent-infrastructure niche. |
| 10–25% | **Library.** Ship `@clawpipe/booster` npm only. No managed gateway. |
| < 10% | **Archive.** Salvage patterns into OpenSyber. Stop ClawPipe as a separate product. |

If the number lands at 22–27, the temptation to round up is real. Don't.
The rule is the rule.

## Why Baseline B and not Baseline A

Baseline A (raw provider calls, no caching) is the easy comparison. Anyone
quoting savings against Baseline A is comparing against a strawman: no
production customer runs naive raw calls in 2026 when Anthropic gives 90%
off cached tokens and OpenAI gives 50% off cached input.

The Booster's contribution is the savings *on top of* what a competent team
already gets from prompt caching. That's Baseline B.

## Why Bucket A is the gate

Bucket A (agent / coding traffic) is where Booster's deterministic rule
library is structurally strongest. If the wedge doesn't show on Bucket A,
it doesn't show anywhere. Buckets B and C are reported separately for
completeness, but the binary decision is gated on Bucket A.

## What happens after the decision

See [`clawpipe/BOOSTER-WEDGE-PLAN.md`](https://github.com/finsavvyai/clawpipe/blob/main/BOOSTER-WEDGE-PLAN.md)
Days 9–14. The day-by-day for each branch (Commit / Library / Archive) is
already written.
