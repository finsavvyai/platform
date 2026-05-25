# ClawPipe Booster — Public Benchmark

> **Status: Day 1 of 14-day kill-or-commit window. Methodology in review. No results yet.**

This repo measures one specific claim: how often a deterministic rule engine
(the ClawPipe Booster) can skip an LLM provider call entirely, **beyond what
provider-side prompt caching and standard semantic-cache gateways already
deliver**.

## What this benchmark answers

A binary, per-bucket question: does the Booster save measurable cost on top
of what Anthropic's 90%-off cached tokens, OpenAI's 50%-off cached input,
and a free Cloudflare AI Gateway already deliver?

If the answer is no, this repo will say so. The methodology is locked
**before** the runs (see [METHODOLOGY.md](METHODOLOGY.md)) and the decision
rule (see [DECISION-RULE.md](DECISION-RULE.md)) is set in advance to
prevent post-hoc selection.

## What "skip" means

A request enters the Booster. If a deterministic rule matches with high
confidence (≥99% precision against a labeled validation set), the response
is computed locally — no provider API call, no tokens billed. The skip is
recorded with: matched rule ID, input hash, computed output, computation
time in microseconds.

Cache and routing savings are **out of scope** for this benchmark; they are
measured separately to avoid bundling savings from multiple stages into a
single inflated headline number.

## The four baselines

| Baseline | What it measures |
|---|---|
| **A** — Raw provider calls, no caching | Easy comparison. Kept for context. |
| **B** — Provider with prompt caching enabled | The real comparison. (Anthropic `cache_control`, OpenAI `prompt_cache_key`.) |
| **C** — Cloudflare AI Gateway with caching | On-platform comparison. |
| **D** — ClawPipe (Booster + cache + routing) | The product under test. |

The reportable number is the delta between **D** and **B**, and **D** and **C**.

## The three workload buckets

| Bucket | Source | Sample | Why |
|---|---|---|---|
| **A — Agent / coding** | SWE-bench traces, Aider logs, OpenHands trajectories, synthetic Claude Code traffic | 5,000 | Agent traffic has heavy structured tool calls, JSON, arithmetic, file paths — Booster's strong suit. |
| **B — SaaS chatbot + RAG** | LMSYS Chatbot Arena dataset | 5,000 | Booster's worst case — natural language, summarization, open-ended Q&A. |
| **C — Structured extraction** | MMLU subsets, document-parsing corpus, classification | 5,000 | High proportion of deterministic patterns; tests rule library coverage. |

We publish all three numbers separately. **No blended average.** Blended
averages let weak buckets hide behind strong ones.

## Reproducibility

```bash
git clone https://github.com/finsavvyai/clawpipe-booster-benchmark.git
cd clawpipe-booster-benchmark
npm install
cp .env.example .env   # add your provider keys
npm run smoke          # 50 requests/bucket, ~$1, validates harness
npm run bench          # full run, 15,000 requests × 3 days × 4 baselines
```

Approximate full reproduction cost: **~$80** (eight models across four
providers, three independent runs per bucket).

## License

[MIT](LICENSE). Corpora retain their original licenses (see
[corpora/PROVENANCE.md](corpora/PROVENANCE.md)).

## Status

- [x] Repo created (Day 1 — 2026-05-02)
- [ ] Methodology document locked + 14-day public-comment window opened (Day 4)
- [ ] Smoke test passing on 50 requests/bucket (Day 3)
- [ ] Buckets A, B, C run (Days 4–6)
- [ ] Final results + decision (Days 7–8)

The plan: [`clawpipe/BOOSTER-WEDGE-PLAN.md`](https://github.com/finsavvyai/clawpipe/blob/main/BOOSTER-WEDGE-PLAN.md).
