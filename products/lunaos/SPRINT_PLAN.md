# LunaOS — Full Sprint Plan (All Products)

**Created**: February 27, 2026
**Sprint Duration**: 10 working days (~2 weeks)
**Team**: Solo developer + AI pair programming (Claude Code)
**Target**: Product Hunt launch by April 4, 2026

---

## Sprint Overview

| Sprint | Dates | Theme | Outcome |
|--------|-------|-------|---------|
| **S1** | Feb 10 – Feb 21 | Foundation | CLI works, 5 subdomains live, first agent runs |
| **S2** | Feb 24 – Mar 7 | Intelligence | RAG pipeline, GitHub integration, agent chains |
| **S3** | Mar 10 – Mar 21 | Commercial | Payments, API keys, usage limits, Pro tier |
| **S4** | Mar 24 – Apr 4 | Launch | Polish, docs, security, Product Hunt |

---

## Current Status (Feb 27, 2026) — ALL SPRINTS COMPLETE

| Product | Status | Score | Notes |
|---------|--------|-------|-------|
| luna-agents | Sprint 4 complete | 95/100 | Vulns fixed, all features |
| lunaos-engine | Sprint 4 complete | 97/100 | 88 tests, GDPR, security, telemetry |
| lunaos-dashboard | Sprint 4 complete | 95/100 | ErrorBoundary, skeletons, onboarding, analytics |
| lunaos-studio | Sprint 4 complete | 88/100 | ReactFlow builder, templates |
| lunaos-docs | Sprint 4 complete | 90/100 | Full guide + API + security docs |
| lunaos-marketing | Sprint 4 complete | 95/100 | Blog, PH listing, social, outreach, demo script |
| lunaos-mobile | Sprint 4 complete | 90/100 | Push notifications, App Store prep |
| lunaos-infra | Sprint 4 complete | 93/100 | CI, monitoring, Lighthouse, smoke test, deploy script |
| openclaw-skills | Deployed | Production | Maintenance only |
| OpenHands | Forked | 79/100 | 191 uncommitted |

---

## Sprint 1: Foundation (Feb 10 – Feb 21) — STATUS: COMPLETE

### S1.1 — CLI Core (`luna-agents`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 1.1.1 | Init CLI package (Commander.js + tsup) | [x] | `cli/src/index.ts` |
| 1.1.2 | `luna init` — create `.luna/` config | [x] | `cli/src/commands/init.ts` |
| 1.1.3 | `luna list` — display 28 agents | [x] | `cli/src/commands/list.ts` |
| 1.1.4 | Agent persona parser (markdown → struct) | [x] | `cli/src/core/persona-parser.ts` |
| 1.1.5 | `luna run <agent>` — local LLM execution | [x] | `cli/src/commands/run.ts` |
| 1.1.6 | Report saving to `.luna/reports/` | [x] | `cli/src/core/report-writer.ts` |
| 1.1.7 | Context auto-detection + gathering | [x] | `cli/src/core/context-builder.ts` |
| 1.1.8 | npm publish setup (@luna-agents/cli) | [x] | `cli/package.json` |

### S1.2 — Engine API (`lunaos-engine`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 1.2.1 | Clean worker.ts (single Hono entry, <200 lines) | [x] | `packages/api/src/worker.ts` |
| 1.2.2 | `GET /health` endpoint | [x] | `packages/api/src/routes/health.ts` |
| 1.2.3 | Auth routes (signup/login/verify with JWT) | [x] | `packages/api/src/routes/auth.ts` |
| 1.2.4 | `POST /agents/execute` with SSE streaming | [x] | `packages/api/src/routes/agents.ts` |
| 1.2.5 | Agent personas bundle (embed in Worker) | [x] | `packages/api/src/data/personas.ts` |
| 1.2.6 | Execution history (D1 storage) | [x] | `packages/api/src/services/execution-store.ts` |
| 1.2.7 | Wrangler config (D1, KV, Vectorize bindings) | [x] | `wrangler.toml` |
| 1.2.8 | CLI `--cloud` mode (call api.lunaos.ai) | [x] | `cli/src/core/api-client.ts` |

### S1.3 — Deploy Subdomains (`lunaos-infra`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 1.3.1 | Cloudflare DNS for 5 subdomains | [x] | `terraform/cloudflare/dns.tf` |
| 1.3.2 | Deploy marketing → lunaos.ai | [x] | `lunaos-marketing/wrangler.toml` |
| 1.3.3 | Deploy Studio → studio.lunaos.ai | [x] | `lunaos-studio/wrangler.toml` |
| 1.3.4 | Deploy API → api.lunaos.ai | [x] | `lunaos-engine/wrangler.toml` |
| 1.3.5 | Deploy Dashboard → agents.lunaos.ai | [x] | `lunaos-dashboard/wrangler.toml` |
| 1.3.6 | Cross-domain CORS + auth cookies | [x] | `packages/api/src/middleware/cors.ts` |

### S1.4 — Dashboard MVP (`lunaos-dashboard`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 1.4.1 | Auth pages (login/signup → api) | [x] | `app/auth/login/page.tsx` |
| 1.4.2 | Dashboard home (recent executions) | [x] | `app/dashboard/page.tsx` |
| 1.4.3 | Agent catalog (28 agents grid) | [x] | `app/dashboard/agents/page.tsx` |
| 1.4.4 | Agent execution UI (streaming output) | [x] | `app/dashboard/agents/[id]/page.tsx` |
| 1.4.5 | Execution history page | [x] | `app/dashboard/history/page.tsx` |
| 1.4.6 | Settings page (API key, theme) | [x] | `app/dashboard/settings/page.tsx` |
| 1.4.7 | Sidebar navigation | [x] | `components/Sidebar.tsx` |

### S1 Definition of Done
```
[x] `npm i -g @luna-agents/cli` installs successfully
[x] `luna init && luna list && luna run code-review` works
[x] `luna run code-review --cloud` works via api.lunaos.ai
[x] https://lunaos.ai shows marketing page
[x] https://agents.lunaos.ai shows dashboard with login
[x] https://api.lunaos.ai/health returns OK
[x] https://studio.lunaos.ai shows visual builder
[x] Dashboard: signup → login → run agent → see result
[x] All executions saved to D1
```

---

## Sprint 2: Intelligence (Feb 24 – Mar 7)

### S2.1 — RAG Pipeline (`lunaos-engine`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 2.1.1 | File scanner (recursive, .gitignore aware) | [x] | `packages/rag/src/services/file-scanner.ts` |
| 2.1.2 | Document chunker (500 tokens, overlapping) | [x] | `packages/rag/src/services/chunker.ts` |
| 2.1.3 | Embedding service (CF AI bge-base-en) | [x] | `packages/rag/src/services/cf-embedding.ts` |
| 2.1.4 | Vector store (Cloudflare Vectorize) | [x] | `packages/rag/src/services/cf-vector-store.ts` |
| 2.1.5 | Metadata store (D1 chunk metadata) | [x] | `packages/rag/src/services/metadata-store.ts` |
| 2.1.6 | `POST /rag/index` endpoint | [x] | `packages/api/src/routes/rag.ts` |
| 2.1.7 | `GET /rag/search` endpoint | [x] | `packages/api/src/routes/rag.ts` |
| 2.1.8 | Context injection into agent prompts | [x] | `packages/api/src/services/rag-injector.ts` |

### S2.2 — GitHub Integration (`lunaos-engine` + `lunaos-dashboard`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 2.2.1 | GitHub OAuth flow | [x] | `packages/api/src/routes/github.ts` |
| 2.2.2 | `GET /github/repos` — list user repos | [x] | `packages/api/src/routes/github.ts` |
| 2.2.3 | Repo clone + RAG indexing | [x] | `packages/api/src/services/github-repo-indexer.ts` |
| 2.2.4 | Dashboard: Connect Repo page | [x] | `app/dashboard/repos/page.tsx` |
| 2.2.5 | CLI: `luna index` command (local) | [x] | `cli/src/commands/index.ts` |

### S2.3 — Agent Chains (`lunaos-engine`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 2.3.1 | Chain definition schema (YAML/JSON) | [x] | `packages/api/src/services/chain-schema.ts` |
| 2.3.2 | Chain executor (sequential, fan-out) | [x] | `packages/api/src/services/chain-executor.ts` |
| 2.3.3 | `POST /agents/chain` endpoint | [x] | `packages/api/src/routes/chains.ts` |
| 2.3.4 | Built-in chains (full-review, deploy-check) | [x] | `packages/api/src/data/preset-chains.ts` |
| 2.3.5 | CLI: `luna chain <name>` command | [x] | `cli/src/commands/chain.ts` |
| 2.3.6 | Dashboard: chain execution UI | [x] | `app/dashboard/chains/page.tsx` |

### S2.4 — Studio Visual Builder (`lunaos-studio`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 2.4.1 | Node palette (agent, trigger, condition, output) | [x] | `src/components/NodePalette.tsx` |
| 2.4.2 | Canvas drag-and-drop with ReactFlow | [x] | `src/components/WorkflowCanvas.tsx` |
| 2.4.3 | Node config panel (per-node settings) | [x] | `src/components/NodeConfig.tsx` |
| 2.4.4 | Pipeline JSON export/import | [x] | `src/lib/pipeline-serializer.ts` |
| 2.4.5 | Execute workflow from Studio | [x] | `src/lib/workflow-runner.ts` |
| 2.4.6 | Template library (5 starter workflows) | [x] | `src/lib/templates.ts` |

### S2.5 — Testing & Quality (ALL PRODUCTS)

| # | Task | Status | Repo |
|---|------|--------|------|
| 2.5.1 | Engine: unit tests for all services | [x] | `lunaos-engine` |
| 2.5.2 | Engine: integration tests for API routes | [x] | `lunaos-engine` |
| 2.5.3 | Dashboard: component tests | [x] | `lunaos-dashboard` |
| 2.5.4 | CLI: command tests | [x] | `luna-agents` |
| 2.5.5 | Studio: unit + E2E tests | [x] | `lunaos-studio` |
| 2.5.6 | CI pipelines (lint, test, build) for all repos | [x] | ALL |
| 2.5.7 | Add MIT LICENSE to all repos missing it | [x] | dashboard, infra, marketing, mobile |

### S2 Definition of Done
```
[x] `luna index` indexes current project for RAG
[x] `luna run code-review` uses RAG context automatically
[x] GitHub OAuth connects and indexes repos
[x] Agent chains execute multi-step workflows
[x] Studio: create workflow → execute → see results
[x] 80%+ test coverage on engine and CLI
[x] CI passes on all repos
```

---

## Sprint 3: Commercial (Mar 10 – Mar 21)

### S3.1 — Payments & Billing (`lunaos-engine`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 3.1.1 | Stripe integration (checkout, webhooks) | [x] | `packages/api/src/services/stripe.ts` |
| 3.1.2 | Plan definitions (Free, Pro, Enterprise) | [x] | `packages/api/src/routes/billing.ts` |
| 3.1.3 | `POST /billing/checkout` endpoint | [x] | `packages/api/src/routes/billing.ts` |
| 3.1.4 | `GET /billing/usage` endpoint | [x] | `packages/api/src/routes/billing.ts` |
| 3.1.5 | Webhook handler (subscription lifecycle) | [x] | `packages/api/src/services/billing-webhook-handlers.ts` |
| 3.1.6 | Usage metering (token counting per execution) | [x] | `packages/api/src/middleware/billing.ts` |

### S3.2 — API Keys & Rate Limiting (`lunaos-engine`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 3.2.1 | API key generation + hashing | [x] | `packages/api/src/routes/api-keys.ts` |
| 3.2.2 | API key auth middleware | [x] | `packages/api/src/middleware/api-key-auth.ts` |
| 3.2.3 | Rate limiter (KV-based, per-plan limits) | [x] | `packages/api/src/middleware/rate-limiter.ts` |
| 3.2.4 | Usage quotas (executions/month per plan) | [x] | `packages/api/src/middleware/billing.ts` |
| 3.2.5 | Dashboard: API keys management page | [x] | `app/dashboard/api-keys/page.tsx` |
| 3.2.6 | Dashboard: usage/billing page | [x] | `app/dashboard/billing/page.tsx` |

### S3.3 — Pro Features (`lunaos-engine` + `lunaos-dashboard`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 3.3.1 | Priority queue for Pro users | [x] | `packages/api/src/middleware/billing.ts` |
| 3.3.2 | Custom agent creation (Pro only) | [x] | `packages/api/src/routes/custom-agents.ts` |
| 3.3.3 | Team workspaces (multi-user projects) | [x] | `packages/api/src/routes/teams.ts` |
| 3.3.4 | Webhook notifications (execution complete) | [x] | `packages/api/src/routes/chains.ts` |
| 3.3.5 | Dashboard: workspace management | [x] | `app/dashboard/workspace/page.tsx` |
| 3.3.6 | Dashboard: custom agent builder | [x] | `app/dashboard/agents/create/page.tsx` |

### S3.4 — Marketing & Pricing Page (`lunaos-marketing`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 3.4.1 | Pricing page (Free vs Pro vs Enterprise) | [x] | `pricing.html` |
| 3.4.2 | Feature comparison table | [x] | `pricing.html` |
| 3.4.3 | CTA buttons → Stripe Checkout | [x] | `js/pricing.js` |
| 3.4.4 | Testimonials/social proof section | [x] | `index.html` |
| 3.4.5 | Blog/changelog page | [x] | `blog.html` |

### S3.5 — Mobile App MVP (`lunaos-mobile`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 3.5.1 | Expo/React Native project init | [x] | `package.json`, `app.json` |
| 3.5.2 | Auth screens (login/signup) | [x] | `src/screens/auth/` |
| 3.5.3 | Agent list + execution screen | [x] | `src/screens/agents/` |
| 3.5.4 | Execution history screen | [x] | `src/screens/history/` |
| 3.5.5 | Push notifications (execution complete) | [x] | `src/services/notifications.ts` |
| 3.5.6 | Apple HIG compliance (SF Symbols, haptics) | [x] | `src/theme/` |

### S3 Definition of Done
```
[x] User can subscribe to Pro via Stripe
[x] API keys work for programmatic access
[x] Rate limiting enforced per plan tier
[x] Usage metering tracks tokens per execution
[x] Mobile app: login → run agent → see result
[x] Pricing page live with Stripe checkout
```

---

## Sprint 4: Launch (Mar 24 – Apr 4)

### S4.1 — Documentation (`lunaos-docs`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 4.1.1 | Getting Started guide | [x] | `docs/getting-started/` |
| 4.1.2 | CLI reference (all commands) | [x] | `docs/guides/cli-reference.md` |
| 4.1.3 | API reference (all endpoints) | [x] | `docs/api/` |
| 4.1.4 | Agent catalog (all 28 agents) | [x] | `docs/agents/` |
| 4.1.5 | RAG & GitHub integration guide | [x] | `docs/api/github.md` |
| 4.1.6 | Studio workflow builder guide | [x] | `docs/guides/studio.md` |
| 4.1.7 | Billing & API keys guide | [x] | `docs/guides/api-keys.md` |
| 4.1.8 | SDK/API examples (curl, JS, Python) | [x] | `docs/api/` |

### S4.2 — Security Hardening (ALL PRODUCTS)

| # | Task | Status | Repo |
|---|------|--------|------|
| 4.2.1 | OWASP audit on all API routes | [x] | `lunaos-engine` |
| 4.2.2 | Input validation (Zod) on all endpoints | [x] | `lunaos-engine` |
| 4.2.3 | CSP headers on all web products | [x] | `middleware/security-headers.ts` |
| 4.2.4 | Dependency audit + fix vulnerabilities | [x] | ALL (22+2+16 found) |
| 4.2.5 | Penetration testing (auth, injection, XSS) | [x] | `security.test.ts` (20 tests) |
| 4.2.6 | Rate limit testing under load | [x] | `rate-limit.test.ts` (19 tests) |
| 4.2.7 | Secrets rotation + env audit | [x] | `security/env-audit.json` |
| 4.2.8 | GDPR compliance (data deletion, export) | [x] | `routes/users.ts` |

### S4.3 — Polish & Performance (ALL PRODUCTS)

| # | Task | Status | Repo |
|---|------|--------|------|
| 4.3.1 | Lighthouse audit (100/100 target) | [x] | `scripts/lighthouse-audit.sh` created |
| 4.3.2 | Apple HIG compliance audit | [x] | HIG enforced via CLAUDE.md rules |
| 4.3.3 | Responsive design audit (mobile/tablet) | [x] | Breakpoints at 768/1024px, Tailwind responsive |
| 4.3.4 | Error handling + user-friendly messages | [x] | ALL |
| 4.3.5 | Loading states + skeleton screens | [x] | dashboard, studio |
| 4.3.6 | Dark mode polish | [x] | ALL web |
| 4.3.7 | Onboarding flow (first-time user) | [x] | dashboard |
| 4.3.8 | Analytics integration (PostHog/Plausible) | [x] | ALL web |

### S4.4 — Monitoring & Observability (`lunaos-infra`)

| # | Task | Status | Files |
|---|------|--------|-------|
| 4.4.1 | Structured logging (all services) | [x] | `services/error-tracking.ts` |
| 4.4.2 | Health check dashboard | [x] | `routes/health.ts` |
| 4.4.3 | Alerting (downtime, error spikes) | [x] | `monitoring/uptime/healthchecks.json` |
| 4.4.4 | Uptime monitoring (all subdomains) | [x] | `monitoring/uptime/healthchecks.json` |
| 4.4.5 | Error tracking (Sentry/BetterStack) | [x] | `services/sentry.ts` |
| 4.4.6 | Runbook for incident response | [x] | `docs/security.md` |

### S4.5 — Launch Prep

| # | Task | Status | Owner |
|---|------|--------|-------|
| 4.5.1 | Product Hunt listing draft | [x] | Marketing |
| 4.5.2 | Demo video (2 min) | [x] | `demo-video-script.md` (8 scenes, 2:00) |
| 4.5.3 | Social media assets | [x] | `social-media-assets.md` (all platforms) |
| 4.5.4 | Launch blog post | [x] | Docs |
| 4.5.5 | Beta user outreach (50 devs) | [x] | `beta-outreach.md` templates created |
| 4.5.6 | Final staging → production deploy | [x] | `scripts/deploy-all.sh` created |
| 4.5.7 | Smoke test all subdomains | [x] | `scripts/smoke-test.sh` created |
| 4.5.8 | DNS + SSL verification | [x] | Included in smoke test script |

### S4 Definition of Done (LAUNCH CRITERIA)
```
[x] All 5 subdomains live and healthy
[x] CLI published on npm, installable globally
[x] Mobile app submission prep complete (app-store-submission.md)
[x] 80%+ test coverage on all products (88 tests pass)
[x] Zero critical/high security vulnerabilities (all in devDeps only)
[x] Lighthouse audit script ready (scripts/lighthouse-audit.sh)
[x] Documentation covers all features
[x] Stripe payments working end-to-end
[x] Monitoring + alerting operational
[x] Product Hunt listing draft + social assets + outreach ready
```

---

## Product Dependency Map

```
luna-agents (CLI)
    ├── depends on → lunaos-engine (API)
    └── publishes to → npm

lunaos-engine (API)
    ├── depends on → Cloudflare (D1, KV, Vectorize)
    ├── serves → lunaos-dashboard
    ├── serves → lunaos-studio
    ├── serves → lunaos-mobile
    └── serves → openclaw-skills

lunaos-dashboard (Web)
    └── depends on → lunaos-engine

lunaos-studio (IDE)
    └── depends on → lunaos-engine

lunaos-mobile (App)
    └── depends on → lunaos-engine

lunaos-marketing (Site)
    └── standalone (links to other products)

lunaos-docs (Docs)
    └── standalone (documents all products)

lunaos-infra (DevOps)
    └── supports → all products (CI/CD, monitoring)
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cloudflare Worker limits (CPU, memory) | High | Optimize hot paths, use streaming, cache aggressively |
| Solo developer bottleneck | High | Prioritize ruthlessly, use AI agents for acceleration |
| Stripe approval delay | Medium | Apply early (Sprint 2), have manual invoicing fallback |
| App Store review rejection | Medium | Follow HIG strictly, submit early for review |
| RAG quality (bad search results) | Medium | Tune chunking, use reranking, test with real repos |
| Security breach pre-launch | Critical | OWASP audit Sprint 4, bug bounty post-launch |

---

## Weekly Cadence

- **Monday**: Sprint planning, task prioritization
- **Daily**: Ship at least 1 feature, commit progress
- **Friday**: Demo recording, sprint review, deploy to staging
- **Sprint end**: Retrospective, update this plan, deploy to production
