# OpenSyber — Project Classification & Analysis

**Generated**: 2026-04-08
**Project**: OpenSyber — Managed AI Agent Hosting Platform
**Stack**: TypeScript | Next.js 16 | Hono | Cloudflare Workers | D1/KV/R2/DO | Drizzle ORM
**Domain**: Security SaaS / DevTool / AI Platform

## Classification

| Dimension | Value |
|-----------|-------|
| Primary Domain | Security SaaS (CNSP/CSPM) |
| Secondary Domain | AI Agent Platform + Marketplace |
| Stack | TypeScript monorepo (Turborepo + pnpm) |
| Runtime | Cloudflare Edge (Workers, D1, KV, R2, Durable Objects) |
| Frontend | Next.js 16 + React 19 + Tailwind 4 |
| Backend | Hono 4.12 on CF Workers (8 apps) |
| Database | D1 (SQLite) — 103 tables, 39 migrations |
| AI | Claw Gateway (Anthropic/OpenAI/Workers AI) + 24 skills |
| Auth | Auth.js with 4 OAuth providers |
| Payments | LemonSqueezy (4 tiers) |
| Testing | Vitest + Playwright (538 test files) |

## Codebase Scale

- **31K+ TypeScript files** across 8 apps, 12 packages, 24 skills
- **263 API route files**, 158 service files
- **165 React components**, 43 page directories
- **538 test files** (unit + integration + e2e)
- **39 DB migrations** covering 103 tables

## Strengths

1. **Security-first architecture** — TokenForge device binding, RBAC, SAML SSO, audit logging
2. **Edge-native** — entire stack runs on Cloudflare edge (global <50ms latency)
3. **Skill marketplace** — 24 verified skills with submission/approval workflow
4. **Multi-provider AI** — Claw Gateway abstracts Anthropic/OpenAI/Workers AI
5. **Comprehensive testing** — 538 test files with Vitest + Playwright

## Identified Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No data visualization library | **High** | Dashboard charts are basic/missing — critical for security posture UX |
| No vector/semantic search | **Medium** | Skill discovery and incident search rely on SQL LIKE queries |
| No performance tracing/APM | **Medium** | Custom monitors exist but no structured trace analysis |
| No flaky test detection | **Low** | 538 tests but no stress testing for intermittent failures |
| No offline AI capability | **Low** | All AI requires cloud connectivity |
| No 3D visualization | **Low** | Attack graphs could benefit from 3D network topology |

## Domain Match Scores

| Tool Category | Match Score | Rationale |
|---------------|-------------|-----------|
| Charts (Victory) | **95%** | Security dashboards need rich, composable charts |
| Vector Search (RuVector) | **85%** | Semantic skill search + threat intelligence retrieval |
| Perf Tracing (Perfetto) | **80%** | Trace AI skill execution and API latency |
| Flaky Tests (flakestress) | **75%** | Stress-test 538 test suite for reliability |
| Mesh VPN (Tailscale) | **70%** | Secure agent-to-platform communication |
| Offline AI (llamafile) | **60%** | Agent-local inference for air-gapped environments |
| 3D Mesh (LLaMA-Mesh) | **40%** | Attack graph 3D visualization (nice-to-have) |
| Repo Analytics (GitNexus) | **35%** | Dev velocity tracking (low priority) |
