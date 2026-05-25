# ClawPipe — 14-Day Kill-or-Commit Plan (v3, FINAL)

> ## ⚠️ STATUS: WINDOW EXPIRED 2026-05-15
> The decision date (2026-05-09) and end date (2026-05-15) both passed without a benchmark run. Provider + Cloudflare AI Gateway + HF keys never landed in `.env`, so Days 4–6 (Bucket A/B/C runs) and Day 7 (compute) never executed; no `DECISION.md` was written.
>
> **As of 2026-05-16, plan is paused pending new wall date.** Two paths are open:
> 1. **Honor the rules.** Drop the missing keys, run smoke ($1), run Bucket A ($15), apply the decision rule on the measured number, write `DECISION.md`. Plan rule #5 ("the decision rule is the decision rule") still applies — no rounding, no commit branch without measurement.
> 2. **Formally extend.** Write a one-paragraph amendment below this banner stating the new wall date and the reason for the slip. Anything else is plan rule #6 ("no parallel work") being violated in slow motion.
>
> Do not read the day-by-day section below as if the plan is in flight. It is not.

**Source:** `docs/planmay.md` v3 — strategy + research-validated revision + day-by-day execution.
**Created:** 2026-05-02 (Saturday — Day 1).
**Decision date:** 2026-05-09 (Saturday — Day 8). **MISSED.**
**End date:** 2026-05-15 (Friday — Day 14). **MISSED.**
**Supersedes:** v1 `REAL-PRODUCT-PLAN.md`, v2 of this file.

## Thesis

Run the benchmark. Decide. Move on. Two weeks. No scope creep.

**The deliverable is the decision, not the product.** This is a discipline plan, not a build plan.

## The decision rule (set BEFORE running)

| Bucket A delta over **Baseline B** (provider with prompt caching) | Action |
|---|---|
| ≥ 25% | **Commit.** Six-month sprint on agent-infrastructure niche. |
| 10–25% | **Library.** Ship `@clawpipe/booster` npm only. No managed gateway. |
| < 10% | **Archive.** Salvage patterns into OpenSyber. Stop. |

If the Day 8 number is 22–27, **do not round up**. The rule is the rule.

## The 6 rules for 14 days

1. **No new ClawPipe features.** Not one. The benchmark measures what exists. Mid-benchmark feature work is founder cope.
2. **No customer outreach until Day 11.** Outreach before the number forces you to soft-pedal claims you haven't validated.
3. **Total spend cap: $200.** ~$50 benchmark, rest for emergencies (extra runs, embedding costs).
4. **Time cap: 60 hours over 14 days** (≈4 hr/day). Going over = scope creep.
5. **The decision rule is the decision rule.** Day 8 argument with the rule = the meta-pattern repeating in real time.
6. **No parallel work** on OpenSyber, TenantIQ, AMLIQ, or anything else for 14 days. The discipline is the deliverable.

## Week 1 — Build the benchmark, not the product

### Day 1 — Saturday 2026-05-02 (TODAY)

- [x] **D1.1** — Created `github.com/finsavvyai/clawpipe-booster-benchmark` (MIT). README + DECISION-RULE locked.
- [x] **D1.2 (scaffold)** — Three workload buckets scaffolded; PROVENANCE.md with licenses for every source.
- [~] **D1.3 (partial)** — Pull scripts written for all 6 sources. Pulled tonight: `corpora/a/synth-codeagent.jsonl` (1500) and `corpora/c/mmlu.jsonl` (2500). Day 2 morning: retry SWE-bench (HF rate-limited tonight), pull Aider + OpenHands (stubs ready), pull LMSYS (needs HF_TOKEN + accepted terms).
- [x] **No new ClawPipe code touched.** Confirmed.

### Day 2 — Sunday 2026-05-03

Wire the four baselines. End-of-day: all four pipelines callable from one script.

- [x] **D2.1** — **Baseline A** — `baselines/raw.ts`. Raw provider calls, no caching.
- [x] **D2.2** — **Baseline B** — `baselines/cached.ts`. Anthropic `cache_control` + OpenAI `prompt_cache_key` + DeepSeek auto-cache + Google systemInstruction.
- [x] **D2.3** — **Baseline C** — `baselines/cf-gateway.ts`. CF AI Gateway with `cf-aig-cache-ttl=3600`.
- [x] **D2.4** — **D — ClawPipe** — `baselines/clawpipe.ts`. POST /v1/prompt with booster+cache pinned on.
- [x] **D2.5** — `bench/run.ts --smoke --bucket=X --baseline=Y --run=ID`. Writes per-baseline-per-bucket JSONL + summary.json. $80 spend cap, hard kill at $100. Verified end-to-end with no-key dry run.
- [~] Carry-over D1.3 partial: SWE-bench_Lite 300 ✓, Aider exercism 140 ✓ (only 140 exercises exist), Bucket A still under 5000 — Day 3 decision: bump synth or add MBPP/HumanEval. LMSYS still pending (needs HF agreement). OpenHands stub.

### Day 3 — Monday 2026-05-04

Quality validation. Verify on 50 requests before committing to 15,000.

- [x] **D3.1** — Shadow-call wired in `bench/quality.ts:scoreQuality`.
- [x] **D3.2** — Byte-equality + JSON normalize + whitespace collapse for Buckets A + C.
- [x] **D3.3** — `tripleJudge()` calls GPT-5 + Claude Opus 4.7 + Gemini 2.5 Pro in parallel; AGREE/DISAGREE first line; `isRegression` = ≥2 disagree.
- [ ] **D3.4** — 50-req smoke against real keys (~$1) — pending: needs OPENAI/ANTHROPIC/GOOGLE/DEEPSEEK keys + CF gateway + ClawPipe key in `.env`.
- [x] **METHODOLOGY.md v1.0 locked, public-comment window open until 2026-05-18** ([issue #1](https://github.com/finsavvyai/clawpipe-booster-benchmark/issues/1)).
- [x] **Bucket A real-corpus top-up:** added MBPP (374) + SWE-Gym (1,000). Now 3,314 total, synth share down to 45%.

### Day 4 — Tuesday 2026-05-05

- [ ] **D4.1** — Run **Bucket A** (agent traffic). 5,000 requests × 3 independent runs. Cost ~$15.
- [ ] **D4.2** — While it runs: clean up methodology document (`benchmarks/booster/METHODOLOGY.md`) using `docs/planmay.md` lines 76–248 as the draft. Add the four corrected baselines.

### Day 5 — Wednesday 2026-05-06

- [ ] **D5.1** — Run **Bucket B** (RAG / chat). 5,000 × 3. Cost ~$15.
- [ ] **D5.2** — Look at Bucket A results. **First signal.** If Bucket A delta over Baseline B is <10%, you can stop here — the answer is in. Document the early call in `benchmarks/booster/results/early-signal.md`.

### Day 6 — Thursday 2026-05-07

- [ ] **D6.1** — Run **Bucket C** (structured extraction). 5,000 × 3. Cost ~$15.
- [ ] **D6.2** — Total benchmark spend snapshot at end of day. Should be $45–$50.

### Day 7 — Friday 2026-05-08

- [ ] **D7.1** — Compute final numbers per bucket per baseline, with 95% confidence intervals across the three runs.
- [ ] **D7.2** — Publish raw outputs as JSONL to `benchmarks/booster/results/raw/`.
- [ ] **D7.3** — Publish summary table at `benchmarks/booster/results/summary.md`. **Do not write marketing copy. Just the numbers.**

## Week 2 — Decide, then act on the decision

### Day 8 — Saturday 2026-05-09 — DECISION DAY

- [ ] **D8.1** — Look at Bucket A delta over Baseline B honestly.
- [ ] **D8.2** — Apply the table at the top of this file. Write the binary outcome at `benchmarks/booster/DECISION.md`. One paragraph: branch chosen + measured number + the rule applied.
- [ ] **D8.3** — Commit and push the decision. From this point everything below is branch-conditional.

### Day 9 — Sunday 2026-05-10 — WRITE

Write only. No code.

- [ ] **D9-Commit** — Rewrite homepage from `docs/planmay.md` lines 250–376 with the measured number. Hero acknowledges prompt caching. Clean methodology. Outline agent-infra GTM (Cursor / Claude Code shops).
- [ ] **D9-Library** — Write one blog post: *"We measured the deterministic skip rate on agent traffic. Here's what we found."* Prep `@clawpipe/booster` for npm publish (MIT). No gateway pitch.
- [ ] **D9-Archive** — Write the post-mortem. What I'd do differently. Public if I have the stomach; private if not.

### Day 10 — Monday 2026-05-11 — PUBLISH

- [ ] **D10-Commit** — Push methodology doc to public repo with 14-day comment window. Update homepage live. Schedule Show HN for Day 14.
- [ ] **D10-Library** — `npm publish @clawpipe/booster`. Blog post live. Single Show HN about the benchmark + library, scheduled Day 14. No company pitch.
- [ ] **D10-Archive** — Archive `clawpipe`, `clawpipe-sdk` on GitHub with README pointer to where ideas live now (OpenSyber, TokenForge). Cancel LemonSqueezy product. Cancel domain renewal calendar reminders.

### Days 11–13 — Tue/Wed/Thu 2026-05-12 to 05-14 — DISTRIBUTE

Branch-dependent.

- [ ] **D11-13-Commit** — Reach out to 10 specific Cursor / Claude Code-using engineering teams via Tel Aviv network. Warm intros only. Goal: 3 conversations booked for Week 3 with the benchmark as the opener.
- [ ] **D11-13-Library** — Submit LangChain4j upstream PR adding `@clawpipe/booster` as a pre-call hook. Submit Spring AI integration sample. Get listed in `awesome-ai-model-routing` repo. One-time distribution moves that pay for months.
- [ ] **D11-13-Archive** — Move to OpenSyber. Run the 8-hour competitive-research gate. Write the one-page document. Decide if OpenSyber passes the gate before writing any new OpenSyber code.

### Day 14 — Friday 2026-05-15 — SHOW HN

- [ ] **D14-Commit** — Post on HN, r/MachineLearning, r/LocalLLaMA. Title: *"Show HN: We measured how often LLM requests can skip the model entirely."* Lead with the number; link to raw data.
- [ ] **D14-Library** — Same post, framed as the library, not the company.
- [ ] **D14-Archive** — OpenSyber competitive-research-gate document due. ClawPipe is past tense.

## What carries over from earlier work

The 9 tasks merged on Day 0 (T02, T03, T05–T09, T13, T14) are frozen. They are not the wedge. They map to the Pro tier IF the Commit branch fires; they are salvage value into OpenSyber IF the Archive branch fires.

| Old task | If Commit | If Library | If Archive |
|---|---|---|---|
| T02 BYOK encrypted keys | Pro feature | n/a | Pattern → OpenSyber secrets vault |
| T03 OpenAI drop-in proxy | Core | n/a | n/a |
| T05 EOM forecast | Pro feature | n/a | Pattern → AMLIQ FinOps |
| T06 Per-user attribution | Pro headline | n/a | Pattern → AMLIQ |
| T07 MS Teams digest | Pro feature | n/a | n/a |
| T08 Status page | Free | n/a | n/a |
| T09 Audit log | Pro / Enterprise | n/a | Pattern → OpenSyber |
| T13 Java SDK dropped | Done | Done | Done |
| T14 Prompt-storage lint | Trust copy | Trust copy | Pattern reused |

## The honest prediction (from the source memo)

> Bucket A lands at 18–24%. Library branch. Ship `@clawpipe/booster` as an npm package, get a few hundred GitHub stars, generate inbound interest, learn that agent-infra customers want a full solution not a library, and by Week 3 the deterministic-skip ideas move into OpenSyber where they have a better structural home. That's a fine outcome.

If it surprises high → Commit. If it surprises low → Archive. Either way, **on May 15 there is an answer instead of a question.**

## Progress

- Day 1: 3 / 3
- Day 2: 5 / 5
- Day 3: 4 / 4 + methodology locked + comment window open
- Days 4-6: **0 / 0 — SCHEDULE SLIP, no benchmark runs happened.** Block: provider + CF + HF keys never landed in `.env`.
- Day 7 (today, 2026-05-08): summarize w/ Wilson 95% CIs + 8/8 quality tests + fake-results dry runner + STATUS.md + pull-all orchestrator + RULE-COVERAGE.md (30 modules / ~125 rules mapped per bucket). Harness verified end-to-end against synthetic JSONL. Real-vs-synth split tracked through pipeline.
- Day 8 (decision, 2026-05-09): **at risk** — cannot decide without numbers. Three options surfaced to user: (A) drop keys today and collapse runs into ~6hr tonight; (B) slide decision ~4 days; (C) capitulate to friend's prediction without verification (plan rule #5 says don't).
- Day 3: 0 / 4
- Day 4: 0 / 2
- Day 5: 0 / 2
- Day 6: 0 / 2
- Day 7: 0 / 3
- Day 8 (DECISION): 0 / 3
- Days 9–14: branch-conditional
- Spend so far: $0 / $200 cap
- Hours so far: 0 / 60 cap
- Last revision: 2026-05-02 evening — v3 final, kill-or-commit framing locked

## What this plan is NOT

- Not a build plan. The benchmark is the deliverable.
- Not negotiable on the decision rule.
- Not extendable past 14 days. May 15 is the wall.
- Not parallel to any other project. 14 days, one thing.
