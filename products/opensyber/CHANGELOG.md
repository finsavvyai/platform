# Changelog

All notable changes to OpenSyber are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Dogfood milestone — 2026-04-11

First real dogfood run with a working PushCI pre-push hook on opensyber.
Every previous `git push` in the project's history silently skipped the
hook because the pushci binary wasn't installed locally. That changed
today:

- PushCI binary rebuilt from source and `npm link`-ed globally
- `pushci.yml` rewritten to scope the push gate to the production
  critical path (install + 7 parallel test suites covering api, web,
  db, shared, ui, tokenforge, claw-sdk). The old template tried to
  install/build/test every package of the pnpm workspace separately
  and generated 77 bogus stages
- `packages/shared/src/tracing.ts` — dead `toFile()` method removed
  because its `node:fs` import was breaking every Next.js production
  build. It had zero callers anywhere in the codebase
- `apps/web/package.json` — `@opensyber/ui` was missing as a workspace
  dependency. Vitest worked because its config had an alias but
  Turbopack's production build couldn't find the module. Added the
  dep plus a `transpilePackages` entry in next.config.ts
- `packages/ui/tsconfig.json` — test files excluded from the `tsc`
  build so chart test assertions using `toBeInTheDocument` don't
  block the UI package's compilation
- Cloudflare Vectorize index `opensyber-skills` created — was
  referenced in wrangler.toml since Boost Round 1 but never actually
  provisioned, which had been silently breaking every deploy since
  `b158d85`

With those fixes in place, today's deploy successfully shipped 10
session commits (`b158d85` → `5ea5c01`) to production for the first
time. API worker live at `api.opensyber.cloud`, web live at
`opensyber.cloud`. The new user journey — deploy an agent, see the
ConnectAgentCard on the dashboard, copy the gateway token, run the
CLI locally, see events flow — is now reachable end-to-end.

### Added — LAM launch preparation (2026-04-10)

- Launch readiness audit at `.luna/opensyber/launch/AUDIT.md`
- `SECURITY.md` — responsible disclosure policy
- `CHANGELOG.md` — this file

## [0.9.0] — 2026-04-10 — Boost Round 2

### Added
- **KV-based embedding cache** — 24h TTL, eliminates ~60% of duplicate Cloudflare AI calls
- **Edge caching** on chart proxy route (60s client / 30s CDN / 5m stale-while-revalidate)
- **Webhook retry queue** — DLQ-backed exponential backoff for failed alert deliveries
- **Vector-based skill recommendations** with graceful fallback to rule engine
- **Sentry client error reporting** (`@sentry/nextjs`) with tunnel route for ad-blocker resilience
- **OpenTelemetry OTLP export** alongside Perfetto format — forward traces to Datadog, Jaeger, Tempo
- **Playwright visual regression test infrastructure** for dashboard, marketplace, admin pages

### Changed
- `TraceCollector.toOtelJson()` is non-destructive (doesn't flush the buffer, unlike `toJSON()`)

## [0.8.1] — 2026-04-09 — Sprint 24 Hardening

### Fixed
- **Critical**: Encrypted alert channel configs leaked on list endpoint
- **Critical**: RBAC bypass — alert channels used `agent.policy.*` permissions instead of `alert.*`
- **Critical**: AWS SigV4 HMAC parameter order (caught and fixed via reference test vector)
- Split `rbac.ts` (272 → 198 + 79 lines) for 200-line compliance
- Split 5 AWS test files into 10 focused test files

## [0.8.0] — 2026-04-09 — Swarm Wave 1

### Added
- **76 chart component tests** (Victory theme, gateway, security, admin)
- **62 API service tests** (vector-search, trace, multi-model consensus, traces route)
- **47 agent + SDK tests** (Tailscale, llamafile, Claw SDK providers)
- **Zod validation** on semantic-search and traces routes
- **Rate limiting** (10 req/min) on embedding-heavy endpoints
- **Platform audit logging** for search, reindex, and trace retrieval
- **docs/BOOST.md** — developer docs for all 8 boost integrations
- UI package test infrastructure (Vitest + @testing-library/react)

## [0.7.0] — 2026-04-08 — Boost Round 1 (8 Integrations)

### Added
- **Victory Charts** — 12 composable React chart components (gateway, security, admin)
- **Cloudflare Vectorize semantic search** — skill discovery + finding similarity via AI embeddings
- **Perfetto-compatible tracing** — per-request trace collection with KV storage and admin viewer
- **Flaky test detection CI** — nightly GitHub Actions stress-running all packages 5x
- **Tailscale mesh VPN** — encrypted agent-to-platform networking with SSRF protection
- **llamafile offline AI** — local inference fallback with localhost-only validation
- **Multi-model consensus triage** — parallel 3-model voting with confidence weighting (~40% fewer false positives)
- **3D attack graph visualization** — Canvas 2D perspective-projected force graph with zoom/rotate

### Security
- Tailscale auth key moved from CLI argument to `TS_AUTHKEY` env var (no /proc exposure)
- llamafile endpoint restricted to localhost (SSRF prevention)
- GitHub Actions workflow input sanitization (script injection fix)
- UUID validation on trace retrieval endpoint
- Error message sanitization on charts proxy route

## [0.6.x] — Earlier

See `git log` for full history. Notable pre-boost sprints include:
- Sprint 23: OpenAgent PLG
- Sprint 22: Platform Data
- Sprint 21: Platform Connect
- Sprint 20: Enterprise Exit Prep
- Sprint 19: Marketplace v2
- Sprint 11–18: CSPM, credential lifecycle, attack graph, AI intelligence, remediation, multicloud
- Sprint 1–10: Core platform (agent runtime, skills, dashboard, security, RBAC, SSO, hardening)

- Re-installed pre-push hook from ee1898f template (no timeout dep, stderr passthrough)
  (hook actually replaced this time)
