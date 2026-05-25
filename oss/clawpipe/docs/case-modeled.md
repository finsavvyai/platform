# ClawPipe — Modeled Savings Case Study (Public Workload)

**Status:** DRAFT 2026-05-17 · **NOT customer-measured.** Every number below is *modeled* from public data + provider list prices. The public measured benchmark is in progress at [github.com/finsavvyai/clawpipe-booster-benchmark](https://github.com/finsavvyai/clawpipe-booster-benchmark).

This document exists so a reader can audit the math themselves. We are publishing assumptions, not a customer outcome. When the measured benchmark lands, this page will be replaced by — or annotated against — real numbers.

---

## Profile (the "design partner")

Composite mid-market AI product modeled from public chat-LLM usage patterns. Not a real customer.

| Attribute | Value | Source / assumption |
|---|---|---|
| Product type | B2B SaaS with embedded assistant | LMSYS-Chat-1M conversation length distribution → assistant pattern |
| Calls / day | 500,000 | Round number; mid-market scale |
| Avg input tokens | 1,200 | LMSYS-Chat-1M sample median (system + user + last 5 turns) |
| Avg output tokens | 400 | LMSYS-Chat-1M assistant turn median |
| Baseline model | `gpt-4o-mini` | Common default for cost-sensitive B2B AI |
| Provider | OpenAI | List price; no enterprise discount |
| Reporting period | 30 days | Standard month |

### Baseline cost (no ClawPipe)

OpenAI `gpt-4o-mini` list price (Apr 2026):
- Input: `$0.150 per 1M tokens`
- Output: `$0.600 per 1M tokens`

Per-call cost = `(1,200 / 1,000,000) × $0.150 + (400 / 1,000,000) × $0.600` = `$0.00018 + $0.00024` = **`$0.00042` per call**

Monthly baseline = `500,000 × 30 × $0.00042` = **`$6,300 / month`**

---

## Modeled savings under ClawPipe

Each pipeline stage applies independently. The compounded savings depend on what fraction of traffic each stage actually affects. **The percentages below are modeled assumptions, not measurements.** The public benchmark in progress is designed to measure them per workload bucket with 95% Wilson CIs.

| Stage | Modeled assumption | Range | Source for assumption |
|---|---|---|---|
| **Booster** (skip LLM entirely) | 8% of B2B chat traffic matches deterministic rules (math, JSON format, date math, regex) | 5–15% | Inspection of LMSYS-Chat-1M turns; high-confidence shape recognition |
| **Semantic cache** (after exact-match dedup) | 15% additional hit rate on paraphrased repeats | 10–25% | LMSYS turn-to-turn similarity analysis; conservative for embedded assistants |
| **Router** (substitute cheaper model that still meets quality) | 12% of remaining calls route to a cheaper model with measured ≤1% quality regression | 5–20% | Conservative — Anthropic prompt caching captures most easy wins on Anthropic; substitution is incremental |
| **Packer** (token compression on non-boosted calls) | 6% input-token reduction | 3–10% | RAG-context dedup + trailing-whitespace; conservative |

### Pipeline math (single month)

Starting from 500,000 calls/day × 30 days = **15M calls** at baseline `$6,300`.

**Step 1 — Booster.** 8% × 15M = 1.2M calls × `$0.00042` = `$504` skipped.
Remaining: 13.8M calls, `$5,796`.

**Step 2 — Cache.** 15% of remaining = 2.07M calls × `$0.00042` = `$869` deduplicated.
Remaining: 11.73M calls, `$4,927`.

**Step 3 — Router substitution.** 12% of remaining → cheaper model. If substituted to `gpt-4o-mini-nano` at ~50% of list price (modeled): savings = `0.12 × 11.73M × $0.00042 × 0.5` = `$296`.

**Step 4 — Packer.** 6% input-token reduction on the remaining 88% of step 3.
Remaining 88% × 11.73M = 10.32M calls. Input cost share per call = `$0.00018`. 6% × `$0.00018` × 10.32M = `$112`.

**Total modeled savings:**
```
Booster :  $504
Cache   :  $869
Router  :  $296
Packer  :  $112
        --------
Total   :  $1,781 / month
```

**Modeled cost reduction:** `$1,781 / $6,300` = **28.3%** of baseline (point estimate).

### Range under stated assumption ranges

- **Low case** (Booster 5%, Cache 10%, Router 5%, Packer 3%): ~$1,030 / month → **16.3%**
- **High case** (Booster 15%, Cache 25%, Router 20%, Packer 10%): ~$3,180 / month → **50.5%**

**Modeled monthly savings range: $1,030 – $3,180.** Point estimate: **$1,781.**

---

## What this case study is NOT

- Not a real customer engagement. No design partner is on production traffic.
- Not measured savings. Every stage rate is an assumption stated in the table above. The whole point of [clawpipe-booster-benchmark](https://github.com/finsavvyai/clawpipe-booster-benchmark) is to replace these assumptions with measured per-bucket numbers.
- Not enterprise-priced. List prices used; large customers get discounts that compress the absolute dollar savings.
- Not adjusted for quality regression. The pipeline's quality scorer is not yet wired end-to-end (`REAL-PRODUCT-PLAN.md` T11 pending). Router-substitution savings assume ≤1% regression which is also unmeasured.

## What you should do with this

- **Read the assumptions table.** Decide if the ranges for *your* workload would be higher or lower.
- **Run the math on your numbers.** Replace 500K calls/day, $0.00042/call, and the stage percentages with values from your billing data.
- **Wait for the measured benchmark.** It will replace the modeled stage rates with per-bucket measured rates plus confidence intervals. Comment window for methodology closed on 2026-05-18 (methodology locked) at [issue #1](https://github.com/finsavvyai/clawpipe-booster-benchmark/issues/1).

## Methodology footnotes

1. LMSYS-Chat-1M token length statistics: computed from public-sample 10,000-conversation subset. Full dataset access requires HF terms agreement.
2. OpenAI `gpt-4o-mini` pricing: <https://openai.com/api/pricing> as of 2026-04-30. We use list prices; enterprise rates vary.
3. Booster rule coverage on LMSYS sample: 32 rule modules in `sdk/src/booster-rules/`, 246 deterministic rule definitions. Per-bucket rule coverage map at <https://github.com/finsavvyai/clawpipe-booster-benchmark/blob/main/RULE-COVERAGE.md>.
4. Cache hit-rate assumption: ShareGPT and LMSYS analyses show ~15–25% similar-question rate in B2B conversational contexts. The cache is embedding-based (Cloudflare Workers AI BGE-small), so paraphrased prompts within a similarity threshold dedup.
5. Router substitution: assumes calls that don't require flagship reasoning route to a cheaper SKU at ~50% of list price. Reality depends on quality scorer + user tolerance.
6. Packer assumption: trailing-whitespace + duplicate context-line removal typically saves 3–10% of input tokens; we use 6% as a middle estimate.

## Reproducibility

Every step in this case study is computable from the four inputs (calls/day, avg input/output tokens, provider price, stage percentages). The math is intentionally simple so anyone can audit it.

```
baseline_per_call = (input_tokens/1e6 × price_in_per_1M) + (output_tokens/1e6 × price_out_per_1M)
monthly_baseline  = calls_per_day × 30 × baseline_per_call

remaining = 1.0
savings   = 0.0
for stage_rate in [booster_rate, cache_rate]:
    savings   += monthly_baseline × remaining × stage_rate
    remaining *= (1 - stage_rate)

router_savings = monthly_baseline × remaining × router_rate × (1 - cheaper_model_ratio)
savings       += router_savings
remaining     *= 1   # router doesn't remove calls

packer_savings = monthly_baseline × remaining × (1 - router_rate) × input_share × packer_rate
savings       += packer_savings
```

Where `input_share = $0.00018 / $0.00042 ≈ 0.43`.

---

**Last revision:** 2026-05-17. **Next revision:** when the measured benchmark lands (target: after 2026-05-18 (comment window now closed)).
