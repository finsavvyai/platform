# Status — 14-day kill-or-commit window

**As of 2026-05-08 (Day 7 of 14)**

## Where we are

| Day | Plan | Reality |
|---|---|---|
| 1 (2026-05-02) | Set up harness + corpora | Done |
| 2 (2026-05-03) | Wire 4 baselines | Done |
| 3 (2026-05-04) | Quality validation + methodology lock | Done; methodology v1.0 open for comment until 2026-05-18 |
| 4 (2026-05-05) | Run Bucket A (~$15) | **Did not run** — provider keys not yet in `.env` |
| 5 (2026-05-06) | Run Bucket B (~$15) | **Did not run** — same |
| 6 (2026-05-07) | Run Bucket C (~$15) | **Did not run** — same |
| 7 (today) | Compute + publish results | No results to compute; harness improvements + reviewer polish instead |
| 8 (2026-05-09) | DECISION DAY | **At risk** without runs |
| 9–14 (2026-05-10 to 05-15) | Branch-conditional execution | Pending Day 8 |

## Corpora pulled so far

| Bucket | Sources | N | Target |
|---|---|---|---|
| A | SWE-bench_Lite (300) + Aider/exercism (140) + MBPP (374) + SWE-Gym (1000) + HumanEval (164) + synth (1500) | 3,478 | 5,000 |
| B | LMSYS-Chat-1M (pending HF terms acceptance) | 0 | 5,000 |
| C | MMLU (2,500); Banking77 attempted, HF rate-limited | 2,500 | 5,000 |

Synth share in Bucket A: 43%. Surfaced in summary output.

## What works without keys

- `npm run pull:corpora` — orchestrates all pulls in sequence with cooldowns + clear failure modes.
- `npm test` — quality unit suite (8/8 pass on `node:test`).
- `npm run lint` — TypeScript strict no-emit check.
- `npm run summarize` — folds JSONL outputs into markdown summary with Wilson 95% CIs and decision-relevant deltas.
- `bench/run.ts` runner accepts `--smoke --bucket=X --baseline=Y` flags; respects `BENCH_SPEND_CAP_USD` with hard kill at 25% over.

## What's blocked

The benchmark itself. Needs the following in `.env` (see `.env.example`):

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`
- `HF_TOKEN` after accepting LMSYS-Chat-1M terms at <https://huggingface.co/datasets/lmsys/lmsys-chat-1m>
- `CF_ACCOUNT_ID`, `CF_AI_GATEWAY_ID`, `CF_API_TOKEN` (a Cloudflare AI Gateway must exist)
- `CLAWPIPE_API_KEY`, `CLAWPIPE_PROJECT_ID`

## Once keys land

Estimated end-to-end:

- 50-req smoke per bucket per baseline: ~$1, ~10 min total — verifies live wiring before the real spend.
- Full bench (3 buckets × 4 baselines × 3 independent runs): ~$80, ~6 hours wall clock.
- Compute + summarize: < 5 min.
- Decision per `DECISION-RULE.md`: minutes.

## Public-comment window

Methodology v1.0 is open for comment at
<https://github.com/finsavvyai/clawpipe-booster-benchmark/issues/1>
until **2026-05-18**.

After that the methodology version freezes for this benchmark run; any
changes go in v1.1 with a dated diff.
