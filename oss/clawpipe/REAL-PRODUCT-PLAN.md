# ClawPipe — Real-Product Plan (SUPERSEDED 2026-05-02)

> **Superseded by `BOOSTER-WEDGE-PLAN.md`** (driven by `docs/planmay.md`).
> Kept here for history. The 9 tasks merged on 2026-05-02 (T02, T03, T05–T09, T13, T14) remain useful — see the new plan for how each maps into the Pro tier feature set.

Generated 2026-05-02 from `/developers` + `/finops` landing-page audits.
Goal: every claim on every landing page has working code + verifiable evidence.

## Hourly agent workflow

Every hour an isolated agent runs with this exact procedure:

1. Pull `main`. Read this file top-down. Find the first task whose checkbox is `- [ ]`.
2. Create branch `real/<task-id>` from `main`.
3. Implement the task fully:
   - Add/modify code under `gateway/src/`, `sdk/src/`, `landing-page/`, etc.
   - Add unit tests. Keep every source file ≤200 lines (CI rule).
   - Run `npm test` in each affected package. Block on red.
   - Update landing-page copy if the task changes a user-facing claim.
4. Commit one logical commit. Update this file: replace `- [ ]` with `- [x] (YYYY-MM-DD <branch>)`.
5. Open PR to `main` titled `real(<task-id>): <one-line summary>`.
6. Stop. Do **not** start the next task — that is the next hour's job.

Hard rules per agent run:

- Never weaken `/CLAUDE.md` portfolio rules (200-line cap, ≥90% coverage, security gates).
- Anti-bluff: never quote a metric without naming the artifact that produced it.
- If a task is blocked (missing secret, external account), comment on the task line with `BLOCKED: <reason>` and move to the next unblocked task.

## Phase 1 — Credibility blockers (ship first)

- [ ] **T01 — Replace mocked benchmarks with real provider runs.**
  `benchmarks/run-benchmark.ts` line 5 says "with a mocked gateway so no real API calls are made". Landing pages quote 57% / 30% / 35% / <1ms as "real". Use the existing `benchmarks/real-benchmark.ts` against ≥2 providers (OpenAI + DeepSeek). Cap spend at $5. Replace `benchmarks/results/summary.json`. Keep mock script for CI; rename to `simulated-benchmark.ts`. Update landing-page sources to point at the real-run artifact + commit hash.

- [x] **T02 — Per-project provider keys, encrypted at rest.** (2026-05-02 real/T02-provider-keys) — migration 017_provider_keys.sql; AES-256-GCM HKDF in provider-keys.ts; async getApiKey with per-project D1 lookup before env fallback; PUT/DELETE/GET routes; dashboard Provider API keys card; 885 tests pass
  Today `providers/registry.ts:getApiKey` reads global `env.OPENAI_API_KEY`. Add table `provider_keys (project_id, provider, encrypted_value, created_at)` (D1 migration `011_provider_keys.sql`). Encrypt with AES-GCM keyed off `env.PROVIDER_KEY_ENCRYPTION_SECRET`. Modify `getApiKey(provider, env, projectId)` to check the table first, fall back to env. Add `POST/DELETE /v1/projects/:id/provider-keys/:provider` routes. Add dashboard form for paste-key flow. This unblocks the FinOps "5 min, no eng" promise.

- [x] **T03 — True OpenAI drop-in proxy mode.** (2026-05-02 real/T03-openai-proxy)
  Add `POST /v1/chat/completions` route that accepts unmodified OpenAI SDK request shape, runs full pipeline, dispatches to selected provider, returns OpenAI-shaped response (incl. streaming SSE). Document `OPENAI_BASE_URL=https://api.clawpipe.ai/v1` swap. Update `/developers` "After" example to show this path next to the SDK path.

## Phase 2 — Feature parity with marketing copy

- [ ] **T04 — Default embedder for SemanticCache.**
  `sdk/src/semantic-cache.ts:42` — `if (!this.embed) return null;` makes the cache a no-op until caller wires an embedder. Ship default: gateway-hosted `text-embedding-3-small` proxy at `POST /v1/embeddings` (small, cheap, cached locally for 24h). SDK auto-uses it when project has `enable_semantic_cache=true`. Add cost-per-embedding accounting.

- [x] **T05 — End-of-month spend forecast.**
  `grep -rE "forecast|eom" gateway/src` returns 0. Add `forecastEomSpend(env, projectId)` to `gateway/src/budget.ts`: linear projection `mtd / dayOfMonth * daysInMonth`. Surface on `/v1/finops/overview` as `forecastEomUsd`. Add dashboard widget. Tested with synthetic mid-month data.

- [x] **T06 — Per-user request attribution.** (2026-05-02 real/T06-user-attribution)
  Stamp `user_id` on `requests` rows when API key is bound to a member (today only `project_id`/`team_id`). Migration adds `user_id TEXT NULL` column + index. `prompt-handler.ts` resolves user from API key. Adds `GET /v1/finops/by-user` route + dashboard table. Enables "tell who ships the feature that costs 40%" claim. Note: visibility limited to keys issued via member-bound flow; ad-hoc project keys produce NULL user_id (Unattributed).

- [x] **T07 — Microsoft Teams webhook digest.**
  Either build `gateway/src/teams-digest.ts` (MessageCard JSON, validated via `webhook.office.com` URL prefix) and wire alongside Slack, **or** remove "Teams" from `/finops` copy. Default to building it; add `projects.teams_webhook_url` column.

- [x] **T08 — Public status page.**
  Add `landing-page/status.html` plus `gateway/src/status.ts` `GET /v1/status` returning `{p50, p95, errorRate, uptime30d}`. Page polls every 30s. Powered by `requests` D1 aggregates. Linked from `/security` and `/finops`.

- [x] **T09 — Gateway-side audit log + retrieval API (Enterprise).** (2026-05-02 real/T09-audit-log)
  `audit_events (id, project_id, actor_user_id, action, target, metadata, created_at)`. Migration 020 + `GET /v1/projects/:id/audit/events` (RBAC: admin). Hooks wired: apikey.rotate, budget.cap.changed, member.joined. Deferred: auth.login (no project_id at OAuth time), team.created (FK requires project_id). Dashboard Settings tab gets Audit log card with "Enterprise" pill.

## Phase 3 — Polish + truth

- [ ] **T10 — Fix landing-page copy contradictions.** PARTIAL (2026-05-02): comparison table softened to "Built-in / Build yourself" framing with dated disclaimer; free-tier check confirmed all pages already say 1,000/day (false alarm from pasted draft). Remaining: drop-in example replacement once T03 ships.

- [ ] **T11 — Wire quality scorer end-to-end.**
  `sdk/src/scorer.ts` is 56 LOC. Build `gateway/src/quality-judge.ts`: opt-in per-project, samples N% of responses, runs LLM-judge prompt against a frontier model, writes score to `request_quality (request_id, score, reasoning)`. Tier-gated to Growth+. Surfaces in router weight updates.

- [ ] **T12 — Global router-weight sync.**
  Verify `weight-store.ts` persistence is global, not per-Worker-isolate. If in-memory only, add D1 table `route_weights_global`, scheduled flush every 5 min, read at router init. Test with two simultaneous Workers updating same task type.

- [x] **T13 — Java SDK: finish or remove.** (2026-05-02 main) — removed `java-sdk/` (128 files, 924K). No landing-page references touched (only false matches on "javascript").
  17 `.java` files vs Python 11 / Go 14 / Rust 8. Either bring to parity (booster + packer + cache + router + gateway client + tests) or remove `java-sdk/` from repo + drop any Java references in docs. Default: remove; landing only sells TS/Py/Go.

- [x] **T14 — Document "no prompts logged" with code evidence.** (2026-05-02 main) — added `tools/lint-prompt-storage.mjs` (scans every SQL file for `CREATE/ALTER TABLE requests` adding a raw `prompt` column), wired as `prompt-storage` stage in `pushci.yml`, cited rule on `/security`. Lint clean on 17 SQL files; red on synthetic violation.
  `grep -rE "INSERT INTO requests" gateway/src` should show only `prompt_hash`, never raw `prompt` text. Add a bluff-lint rule that fails CI if a column named `prompt` (without `_hash`) is added to the `requests` table. Cite the rule + grep on `/security` page.

## Out-of-scope for this loop (track, do not auto-run)

- Renegotiating LemonSqueezy → Stripe migration
- SOC 2 audit prep
- Kubernetes deploy alternative

## Progress

- Total tasks: 14
- Done: 9 (T02, T03, T05, T06, T07, T08, T09, T13, T14)
- Partial: 1 (T10 — drop-in example landed via T03)
- Pending (cost-incurring, deferred): T01 (real bench ~$5), T04 (default embedder), T11 (LLM-judge)
- Pending (no cost): T12 (router-weight sync verification)
- Blocked: 0
- Last update: 2026-05-02 (parallel-merge of 7 branches; gateway suite 979 pass / 2 skipped)
