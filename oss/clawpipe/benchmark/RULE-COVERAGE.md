# Booster Rule Coverage Map (P0.1)

**Source of rules:** `sdk/src/booster-rules/*` in `finsavvyai/clawpipe`
(commit at run time will be referenced in published results).

**Why this exists:** The rule library determines what the Booster *can* skip.
Mapping rule modules to corpus buckets up front lets reviewers and us judge
whether a low or high skip rate matches the structural opportunity, not
just dataset luck.

## Module → bucket fit (qualitative, before any benchmark run)

| Module | Approx rules | Bucket A (agent/coding) | Bucket B (chat/RAG) | Bucket C (extraction) |
|---|---:|:---:|:---:|:---:|
| `core.ts` | 12 | high | low | medium |
| `math-rules.ts` | 11 | high | low | medium |
| `math-extra-rules.ts` | 1 | medium | low | low |
| `string-rules.ts` | 10 | medium | low | medium |
| `string-extra-rules.ts` | 2 | medium | low | medium |
| `text-rules.ts` | 5 | medium | medium | low |
| `data-rules.ts` | 8 | high | low | medium |
| `datetime-rules.ts` | 5 | high | low | low |
| `time-rules.ts` | 1 | high | low | low |
| `code-rules.ts` | 4 | **highest** | low | low |
| `regex-rules.ts` | 1 | high | low | low |
| `format-rules.ts` | 3 | high | low | medium |
| `encoding-rules.ts` | 10 | high | low | low |
| `iso-rules.ts` | 8 | medium | low | medium |
| `crypto-rules.ts` | 2 | medium | low | low |
| `color-rules.ts` | 4 | low | low | low |
| `dev-rules.ts` | 1 | medium | low | low |
| `aws-rules.ts` | 1 | medium | low | low |
| `markup-rules.ts` | 1 | low | low | low |
| `m365-intent.ts` | 0 | n/a | n/a | n/a |
| `finance-rules.ts` | 6 | low | low | medium |
| `finance-extra-rules.ts` | 1 | low | low | medium |
| `stats-rules.ts` | 8 | low | low | high |
| `science-rules.ts` | 2 | low | low | low |
| `geometry-rules.ts` | 2 | low | low | medium |
| `physics-rules.ts` | 1 | low | low | low |
| `chemistry-rules.ts` | 1 | low | low | low |
| `music-rules.ts` | 2 | low | low | low |
| `logic-rules.ts` | 2 | medium | low | medium |
| `misc-rules.ts` | 1 | low | low | low |

Approximately **125 active rules** across 30 modules.

## What this implies for the hypothesis

**Bucket A** is structurally where Booster's strong suit lives. Math, code,
datetime, JSON, regex, encoding rules dominate. If Bucket A doesn't show
a meaningful skip rate, no other bucket will.

**Bucket B** has very few rule fits by design. Natural-language Q&A,
summarization, and open-ended generation don't expose deterministic
patterns. A near-zero skip rate here would be the honest result, not a
failure.

**Bucket C** (MMLU + classification + extraction) gets partial coverage
from stats / iso / data / format rules. The classification subset
(banking77, when it lands) tests *intent labeling* — none of the current
rules target that, so skip rate there should be near zero unless the
labels happen to match deterministic patterns (unlikely). MMLU's
multi-choice-answer-letter format is also not a current rule target.

## Honest read

The Booster's pattern library is **agent-traffic-shaped**. The hypothesis
that Bucket A delta over Baseline B exceeds 25% is not arbitrary —
it follows from the rule-coverage profile above. If it doesn't hold,
the headline "Booster is the wedge" claim collapses regardless of how
buckets B and C come out.

## What this does NOT prove

This is a qualitative pre-registration of where rules live. It does
**not** predict skip rate, latency, or quality. Those are the benchmark.
This document just documents the structural opportunity.
