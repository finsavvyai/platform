# ClawPipe Booster Benchmark — Methodology v1.0

**Locked: 2026-05-04. Public-comment window: 14 days at the GitHub repo issues.**
**Pre-registered.** Results published per this methodology, regardless of outcome.

## Why this document exists

Every gateway in the LLM cost-optimization space claims a cost-reduction
percentage. Almost none publish how they got the number. This benchmark
rests on a single claim: the Booster stage can deterministically skip a
measurable fraction of LLM API calls **without quality regression and
on top of provider-side prompt caching**. The methodology is locked
before the runs so the result cannot be reverse-engineered from the
analysis.

## Hypothesis

**H1.** On Bucket A (agent / coding traffic) the Booster achieves a
cost-reduction delta of ≥25% over **Baseline B** (provider with prompt
caching enabled), with a quality regression rate of <2%.

**Null hypothesis.** Delta < 10%, OR regression rate > 2% on any bucket
where skip rate is reported.

If H1 holds, ClawPipe commits. If the null holds, ClawPipe ships
`@clawpipe/booster` as a library only or archives. See
[`DECISION-RULE.md`](DECISION-RULE.md). This binding is set before any
result is observed.

## What "skip" means, precisely

A request enters the Booster. If a deterministic rule matches with high
confidence (≥99% precision against a labeled validation set), the
response is computed locally — no provider API call, no tokens billed.
The skip is recorded with: matched rule ID, input hash, computed output,
computation time in microseconds.

Cache and routing savings are **out of scope** for this benchmark.
They are measured separately to avoid bundling savings from multiple
stages into a single inflated headline number.

## The four baselines

| Baseline | What it measures | Why |
|---|---|---|
| **A** — Raw provider, no caching | Easy comparison; context only | Anyone quoting savings against this is comparing against a strawman |
| **B** — Provider with prompt caching | The real comparison | Anthropic 90% off cached / OpenAI 50% off cached / DeepSeek auto / Google systemInstruction |
| **C** — Cloudflare AI Gateway with caching | On-platform comparison | Free tier on the same infra ClawPipe runs on |
| **D** — ClawPipe (Booster + cache + routing) | The product under test | |

The reportable number is the delta between **D** and **B** and between
**D** and **C**. Delta over **A** is reported for context only.

## Workload buckets

Skip behavior is workload-dependent. A benchmark on a single workload
type would let us pick whichever one favors us. We pre-commit to three
buckets, reported separately, **with no blended average**.

### Bucket A — Agent / coding (target 5,000; got 3,314)

| Source | License | N |
|---|---|---|
| SWE-bench_Lite | CC-BY-4.0 | 300 |
| Aider / exercism-python | MIT | 140 |
| MBPP train split | CC-BY-4.0 | 374 |
| SWE-Gym (OpenHands-style) | MIT-style | 1,000 |
| Synthetic Claude Code-style (deterministic seed) | n/a | 1,500 |
| **Total** | | **3,314** |

Below 5,000 target. Confidence intervals are wider as a result. The
synthetic share is 45%; the real-vs-synthetic split is reported with
every per-bucket result.

### Bucket B — SaaS chatbot + RAG (target 5,000)

| Source | License | N |
|---|---|---|
| LMSYS Chatbot Arena | LMSYS-Chat-1M (research-use, signed) | 5,000 (pending HF terms acceptance) |

Booster's worst case — natural language, summarization, open-ended Q&A.
If skip rates here look flattering, treat them as suspicious.

### Bucket C — Structured extraction (target 5,000; got 2,500)

| Source | License | N |
|---|---|---|
| MMLU (all 57 subjects) | MIT | 2,500 |
| Document-parsing | TBD | 0 (Day 4 source decision) |
| Classification | TBD | 0 (Day 4 source decision) |
| **Total** | | **2,500** |

## Providers tested

| Provider | Models |
|---|---|
| OpenAI | GPT-5, GPT-5-mini |
| Anthropic | Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash |
| DeepSeek | DeepSeek V3 |

Eight models. Costs use published rates as of the run date (see
`baselines/types.ts` `PRICING`). No negotiated discounts, no batch API
rates, no enterprise tiers.

## What we measure

**Per request:** skip vs provider call (binary), end-to-end latency,
cost (provider rate × tokens, $0 if skipped), quality verdict per the
validation rules below.

**Aggregated per bucket:** skip rate, cost reduction vs each baseline,
latency p50/p95, quality regression rate.

Each metric is reported with a 95% confidence interval, computed across
the three independent runs.

## Quality validation

This is the section that determines whether the benchmark is honest.

Every skipped request is also sent to a high-capability baseline
provider in shadow mode. We compare the local Booster answer to the
baseline answer:

- **Buckets A and C (deterministic outputs):** byte-equality after
  normalization (whitespace collapse, JSON key sort, lowercase).
- **Bucket B (natural language):** LLM-as-judge with three independent
  judges — GPT-5, Claude Opus 4.7, Gemini 2.5 Pro. Judges are blinded
  to which response came from which source. ≥2 of 3 disagree = regression.

A skip rate of 40% with a 5% regression rate is reported as
*"skip 40%, regression 5%"* — never collapsed into a single net-savings
number. Customers can decide what regression rate they tolerate.

All judge disagreements are published in the raw output JSONL.

Implementation: [`bench/quality.ts`](bench/quality.ts).

## Statistical rigor

- **Sample size:** 5,000 per bucket as target; actual N reported per
  bucket with corresponding CI.
- **Independent runs:** three per bucket on three different days, to
  control for provider drift.
- **Reporting:** point estimate plus 95% CI for every metric. No
  selective reporting of best run.
- **Random seeds:** fixed (`bench/seed.txt`). Same seed → same sample
  on any reproduction.

## Cost calculation

Provider rates as published on each provider's pricing page on the run
date. No enterprise discounts, no batch API discounts, no negotiated
rates. A typical mid-market customer paying retail should see numbers
in the same range. See [`baselines/types.ts`](baselines/types.ts) for
the exact dollar figures.

Token counts are measured from provider response metadata. Cached input
tokens are billed at the provider's published cached rate when the
provider distinguishes them. Skipped-request cost is $0.

## Reproducibility

Everything is open. License: MIT.

```bash
git clone https://github.com/finsavvyai/clawpipe-booster-benchmark.git
cd clawpipe-booster-benchmark
npm install
cp .env.example .env   # add provider keys + HF_TOKEN + CF gateway
npm run pull:corpora   # fetch the corpora into corpora/{a,b,c}/
npm run smoke          # 50 req/bucket, ~$1, validates harness
npm run bench          # full run, 15,000 requests × 3 days × 4 baselines
```

Approximate full reproduction cost: **~$80** for 4-baseline coverage
across 3 buckets and 3 days. The cap is enforced at runtime by
`BENCH_SPEND_CAP_USD` in `.env`; the runner hard-kills at 25% over cap.

## Threats to validity

We call these out before someone else does.

1. **Synthetic share in Bucket A.** 45% of Bucket A is deterministic-seeded
   synthetic traffic, intentionally rich in Booster's strong patterns.
   The real-vs-synthetic split is reported per bucket; reviewers should
   weight accordingly.
2. **Bucket A and C below target N.** 3,314 / 2,500 vs 5,000. CIs widen.
   Reported with point estimate + CI for every metric.
3. **Provider drift.** Provider responses change across days, model
   revisions, sampling temperature. Three runs on three days mitigate
   but do not eliminate this.
4. **Judge bias.** LLM judges have documented biases toward verbose
   responses and self-similar phrasing. Three independent judges from
   different providers reduce single-judge bias but do not eliminate it.
5. **Quality threshold subjectivity.** "Semantically equivalent" is
   judgment-dependent in Bucket B. All disagreement cases are published.
6. **Provider sample.** Eight models across four providers is a sample,
   not a census. Smaller open-weight models are not included.
7. **Distribution match.** Even with anonymized customer traces, our
   corpus may not match any specific customer's distribution.
   Per-customer benchmarking is the only way to know.
8. **Booster rule maturity.** The rule library evolves. A benchmark
   dated 2026-05 measures the 2026-05 ruleset.

## What we are not claiming

- Not claiming 30% reduction on every workload.
- Not claiming zero quality regression.
- Not claiming cache or routing savings here. Separate benchmarks.
- Not claiming the savings replicate at every provider price point.
- Not claiming production-equivalence. Benchmark = upper bound on
  confidence.

## Update cadence

Quarterly. Each quarter the benchmark re-runs on current model versions
and a dated report is published. Old reports remain accessible at
versioned URLs. Methodology version bumps are diff-tracked.

## Public review

This methodology document is open for public comment for 14 days at the
GitHub issues for this repo. Substantive critiques that change the
methodology are credited in the published benchmark.

---

*Methodology version 1.0. Locked 2026-05-04.*
*Contact: open an issue at github.com/finsavvyai/clawpipe-booster-benchmark/issues.*
