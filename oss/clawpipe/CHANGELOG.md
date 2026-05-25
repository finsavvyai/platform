# Changelog

All notable changes to `clawpipe-ai` (SDK) and `clawpipe-mcp-server` (MCP).

## 3.7.0 — 2026-04-30

A large hardening + discovery cycle. SDK gains provider failover; gateway
gains 11 features around durability, observability, and AI-agent
discovery. Branch + line coverage now meet the portfolio gates on every
package.

### clawpipe-ai (SDK 3.6.1 → 3.7.0)

- **Provider failover chain** (`failover.ts`, 83 lines, 22 tests): on a
  retryable upstream error (HTTP 408/425/429/5xx, timeout, network) the
  pipeline transparently retries the next-best fallback model from a
  per-router health-tracked candidate list. Stops on the first
  non-retryable error and rethrows.
- **Per-Router health map** (`Router.health`): provider failures decay
  linearly over 60 s; recent failures penalize the next routing
  decision, capped at 1.0.
- **`Router.fallbacks(primary, prompt, count)`**: returns up to N
  next-best routes excluding the primary, ranked with the same
  complexity-aware scoring used for `route()`.
- **Savings client** (`savings-client.ts`): `pipe.getSavings()` and
  `pipe.shareSavings(channel)` — typed client around the new
  `GET /v1/savings` endpoint with TTL cache and timeout-fallback to
  `null`.
- **Share helper** (`share.ts`): builds platform URLs (twitter,
  linkedin, hn, reddit, copy, email) for an "I saved $X via ClawPipe"
  share message.
- **Pipeline finalize split** (`pipeline-finalize.ts`): extracted
  `initMeta()` + `finalizeResult()` from the main `ClawPipe` class so
  `index.ts` stays under the 200-line cap.
- **Default model catalog moved** to `router-models.ts` (and re-exported
  from `router.ts`) — same list, just relocated.
- **`PipelineMeta.savings`**: optional `SavingsMeta | null` populated
  from the savings client.
- **Vitest 1.6 → 3.2.4**: SDK + tests now run on the latest line.
  `npm audit` reports 0 findings.
- **v4 deprecation lane** (`DEPRECATIONS.md` +
  `deprecation-lint.test.ts`): the framework for future `@deprecated`
  APIs is wired before any actual deprecations land.
  `tools/migrate-v3-to-v4.mjs` ships the codemod runner skeleton.

Tests: 781/781 (was 756). Coverage: 93.93% line / 90.08% branch.

### Gateway (1.0.0 → 1.1.0)

API hardening:
- **Idempotency-Key middleware** (12 tests): `POST /v1/prompt` honors
  `Idempotency-Key` and replays the cached 2xx response within 24 h
  with `Idempotency-Replay: HIT`. Validates `[A-Za-z0-9_.-]{1,200}`.
- **RFC 9239 RateLimit headers** (9 tests): every authenticated response
  carries `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
  computed from the project's tier ceiling.
- **W3C Trace Context** (`tracing.ts`, 15 tests): `traceparent`
  parse/format, `withSpan(parent, name, fn)` emits OTel-compatible JSON
  span logs.

Durability:
- **Webhook DLQ + retry queue** (migration 016, `webhook-dlq.ts`):
  every outbound webhook is recorded in `webhook_deliveries` and
  retried via exponential backoff (1m / 5m / 30m / 2h / 12h). Parked
  as `dead` after 5 attempts. `GET /v1/webhooks/dlq` lists pending +
  dead; `POST /v1/webhooks/dlq/{id}/replay` resets a row to pending.
  Cron `*/5 * * * *` drains due retries.

Streaming:
- **SSE Last-Event-ID resume** (`stream-sse.ts`, 11 tests):
  `/v1/stream` re-emits each upstream event with `id: <n>`; clients
  reconnecting with `Last-Event-ID` get only events past the last
  received id. Heartbeats every 15 s.

Discovery:
- **Self-served OpenAPI 3.1** (`openapi-route.ts`, 8 tests):
  `GET /v1/openapi.json` (no auth) — version pinned to `GATEWAY_VERSION`,
  documents Idempotency-Key + Last-Event-ID + RateLimit headers.
- **Public stats** (`clawpipe-index.ts`): `GET /v1/index` (no auth) —
  anonymized aggregate stats across all projects, 1 h KV cache.
- **Per-project savings** (`savings-route.ts`): `GET /v1/savings` —
  saved USD aggregates this month + lifetime + percent.
- **Free-tier attribution**: free-tier responses include
  `meta.attribution`. Paid tiers return clean payload.
- **Per-response brand headers**: `X-Powered-By` and
  `X-ClawPipe-Version` on every response.

Edge:
- **D1 read replication** (`wrangler.toml`): EU/APAC reads route to
  the nearest replica.
- **KV cache warming** (`kv-warming.ts`, 8 tests): scheduled cron
  loads the top 25 prompt hashes from the last hour into KV.

Coverage + tests:
- Gateway test suite **402 → 861 passing** (+459) across 48 new test
  files.
- **Coverage 39.05% → 90.15% line / 74.39% → 85.85% branch.** Both
  gates in `/CLAUDE.md` (≥90% line, ≥85% branch) now pass.
- Vitest 3.2.4. 0 npm audit findings (was 5 moderate dev-only).

Drive-by fixes:
- `routes.ts:18` was `new Request('')` — invalid URL threw
  `ERR_INVALID_URL` whenever `/v1/analytics/quality` was hit.

### MCP server (3.2.0 — no SDK changes)

- **Manifest parity tests** (13 tests): asserts `mcp.json`,
  `server.json`, `package.json`, and the landing-page
  `.well-known/mcp.json` agree on version + the 12 registered tools.
- **Vitest 1.6 → 3.2.4**. Audit clean.

### Landing + AI discovery

- **`og-cover.svg`** (1200 × 630): brand-aligned pipeline diagram
  referenced by `og:image` and `twitter:image`.
- **JSON-LD parity fixes**: FAQ "$49/month" → "$79/month"; provider
  count 8 → 21. Adds WebSite schema with SearchAction and
  BreadcrumbList.
- **`/llms.json` + `/llms-full.txt` parity fixes**: tier quotas
  corrected to match `gateway/src/billing/types.ts` (Dev 25k → 15k,
  Growth 250k → 150k, Scale 1M → 1.5M).
- **`/agents.txt`** (new): action-oriented spec for autonomous AI
  agents.
- **`/.well-known/ai.txt`** (new): training-data preference signal.
- **`/humans.txt`** (new): standard credit file.
- **`robots.txt`**: explicit allow for 12 AI training crawlers.
- **Sitemap** expanded 15 → 31 entries.
- **Dashboard HIG accessibility pass**: focus rings on every
  interactive element, "Skip to main content" link.
- **`landing-page/blog/index.html`** (new): resolves the 404 from the
  footer "Changelog" link.

### Docs

- **`docs/audit/SAST-REPORT.md`**: refreshed — 0 findings across all
  three packages including dev deps.
- **`docs/audit/LANDING-CONVERSION-AUDIT.md`** (new): 0 critical, 2
  high (resolved this cycle), 4 medium, 5 low.
- **`docs/promotion/launch-kit/`** gains `twitter-x.md`, `linkedin.md`,
  `reddit.md`, `launch-day-runbook.md`.
- **`docs/promotion/articles/`** (new): 3 long-form drafts — Medium
  founder narrative, Dev.to router-math deep-dive, Dev.to MCP tutorial.
- **`CLAUDE.md` Anti-Bluff Guardrails**: 7 rules for honest release
  notes.
- **`tools/lint-bluff.mjs`** (new): regex linter for
  hyperbole-without-evidence in markdown.

## 3.6.1 — 2026-04-22
### clawpipe-ai (SDK)
- Patch release: version bump only; no SDK behavior changes.

### Integrations
- **Spring AI integration** (`integrations/spring-ai`): `ClawPipeChatModel` adapter so JVM/Spring Boot apps can use ClawPipe through the standard Spring AI `ChatModel` interface.
- **Elixir SDK** (`elixir-sdk`): thin SDK wrapper for Elixir/Phoenix apps, mirroring the TS client surface.

### Tests
- Fix: `tests/api.spec.ts` updated to point at the live gateway URL and corrected CORS assertion so the E2E suite passes against production.

## 3.6.0 — 2026-04-21
### clawpipe-ai (SDK)
- **Router global learning** (`RouterConfig.globalLearning`): opt-in push/fetch of learned weights to the ClawPipe gateway. Weights are merged using call-count-weighted averages across instances. `router.route()` is now async (breaking change for direct Router users).
- **LLM-as-judge scorer** (`scorer.ts`): `scoreResponse(prompt, response, config)` calls a configurable judge model (default `gpt-4o-mini`), returns 0–1 quality score with 10 s timeout and 0.5 safe fallback.
- **Quality score push** (`router.pushQualityScore()`): sends scored results back to gateway `POST /v1/quality` after fire-and-forget sampling (configurable `scoringSampleRate`, default 10%).
- **PromptClient** (`prompt-client.ts`): `promptVersion(name, variables, options)` fetches and renders versioned prompt templates from the gateway with TTL-based in-memory cache (default 300 s).
- **Gateway sync helpers** extracted to `router-sync.ts` to keep `router.ts` under 200 lines.
- `scoreResponse` and `PromptClient` exported from SDK barrel.

### Gateway
- **Bedrock provider**: full AWS SigV4 signing via `crypto.subtle` — supports Anthropic, Titan, and generic Bedrock models. API key format: `REGION|ACCESS_KEY_ID|SECRET_ACCESS_KEY`.
- **Vertex AI provider**: RS256 JWT auto-refresh from service account key via `crypto.subtle.importKey`. API key format: `PROJECT_ID|LOCATION|BASE64_SERVICE_ACCOUNT_JSON`.
- **Semantic cache**: `SemanticCache` + `makeCFEmbeddingFn` — zero-config with Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`), module-level singleton to persist across requests within a Worker isolate.
- **Quality score storage**: `quality_scores` D1 table, `POST /v1/quality`, `GET /v1/analytics/quality` (grouped by day + model).
- **Prompt versioning**: `prompts` + `prompt_versions` D1 tables in `schema.sql`; `POST /v1/prompts/:id/versions` (create), `GET /v1/prompts/:id/versions` (list).
- `request_id` included in every prompt response for quality score correlation.
- Gateway `lint` (`tsc --noEmit`) now clean — zero TS errors.

### Landing page
- **ROI calculator**: interactive spend/provider-mix/use-case sliders → live savings breakdown with Booster/Cache/Routing bars and recommended tier.
- **Pricing redesign**: 5-tier value-based pricing (Free / Dev $79 / Growth $299 / Scale $799 / Enterprise $2,500+) with annual billing toggle (20% off) — CSS-only price swap, no JS DOM manipulation.
- `roi.js` pure savings projection module (`projectSavings`, `recommendTier`, `fmtUsd`).
- All CTA links include `utm_source=landing&utm_medium=cta&utm_campaign=*`.
- Analytics event tracking via `navigator.sendBeacon` (non-blocking).

## 3.5.1 — 2026-04-20
### clawpipe-ai
- **M365 intent classifier**: `classifyM365Intent()` recognizes 7 query
  classes (license_summary, mfa_status, inactive_users, guest_audit,
  user_summary, security_misconfig, cis_score) for MSP tools. Ported
  from TenantIQ's internal `claw-booster.ts`.
- Fix: `classifyM365Intent` properly exported through the main barrel.

## 3.5.0 — 2026-04-20
### clawpipe-ai
- M365 intent rules module (internal — 3.5.1 adds the public export).

## 3.4.0 — 2026-04-19
### clawpipe-ai
- **Sessions**: `ClawSession.create / .resume / .ask` with multi-turn
  state. Pluggable `SessionStore` interface (MemorySessionStore default;
  D1/KV/Durable Object/Redis as drop-ins). Per-session telemetry.
  Ported from OpenSyber's ClawSession pattern.
- **DLP Guard pack**: 12 PII plugins (SSN, CC, phone, email, IP, IPv6,
  IBAN, passport, api-key-leak, DOB) with redact + block variants.
  Ported from sdlc.cc's `packages/dlp/`.

### clawpipe-mcp-server 3.2.0
- **6 AI security skills**: reasoning, triage, remediation, compliance,
  threat-intel, incident — each routed through ClawPipe's full pipeline
  so skill executions get cost optimization automatically. Ported from
  OpenSyber's premium AI bundle.

## 3.3.1 / 3.3.0 — 2026-04-19
### clawpipe-ai
- **Cross-provider tool calling**: `toolsForProvider()` / `parseToolCalls()` /
  `runToolCall()` translate one canonical Tool shape to OpenAI /
  Anthropic / Gemini / Mistral / Groq / DeepSeek wire formats.
- **Booster: 188 → 246 rules** across 8 new packs: geometry (11),
  string-extra (12), math-extra (11), physics (7), chemistry (5),
  music (5), finance-extra (7), misc (11). + prior: regex, format,
  color, dev, time, science, logic, iso, crypto, aws, markup.

## 3.2.0 — 2026-04-18
### clawpipe-ai
- **Tier-2 primitives**: `Result<T,E>`, Guard Registry (15 default
  plugins), Conditional Router, Config-as-header parser, rate-limit
  policy grammar, Fair-share rate limiter, recursive target resolver,
  Prompt Store, Budget Hierarchy.

## 3.1.0 — 2026-04-18
### clawpipe-ai
- Tier-1 wins: cache-status header + force-refresh, custom properties
  via `x-clawpipe-property-*`, session grouping, spend-log truncation,
  tag-based routing.

## 3.0.1 — 2026-04-17
### clawpipe-mcp-server
- **Official MCP Registry**: `io.github.finsavvyai/clawpipe-mcp-server`
  published with SHA-256 auth, Jira + Notion tools, stats, booster
  check, analyze cost.

## 3.0.0 — 2026-04-16
- Initial public release. Agent Booster, Packer, Cache, Router,
  Gateway, Swarm, Guard, Budget, RateLimiter, CircuitBreaker,
  Allowlist, Audit, Tracer, Voice, RAG, OpenAI-compat endpoint.
- MIT license. 21 provider support. *(Original release notes cited
  "57.3% cost reduction on a 400-prompt benchmark" — that figure is
  from an in-house synthetic benchmark against a mocked gateway. It
  is preserved at `benchmarks/results/summary.json` for transparency.
  Measured benchmark is in progress at
  github.com/finsavvyai/clawpipe-booster-benchmark.)*
