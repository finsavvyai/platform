# sdlc-platform — Project Classification

Generated: 2026-05-01 (post Claude Team launch wave).

## What it is

Zero-trust AI compliance gateway. Sits between customer apps and
Anthropic / OpenAI / Bedrock / Vertex / Azure with inline DLP
redaction, per-tenant RBAC, immutable audit, and per-tenant BYOK.
Doubles as a multi-tenant RAG + connector platform.

## Stack

| Surface | Tech | Notes |
|---|---|---|
| Gateway (primary) | Go 1.24 + Chi | DLP / RBAC / audit / policies / OPA / OpenAPI3 |
| RAG | Python 3.11 + FastAPI | pgvector + long_context fit_to_context |
| LLM Gateway | Go (inside main gateway) | Anthropic + OpenAI + Bedrock + Vertex + Azure FallbackChain |
| Admin UI | Next.js 14 + Radix + TanStack | **Recharts** already in deps |
| Document Processor | Node.js + Bull v3 + Tesseract | env-driven backpressure |
| Realtime | Fastify + ws + ioredis | ProgressBroadcaster fans Redis pub/sub to WS |
| Vector core | Rust + pgvector bindings | not yet runtime-active |
| Edge workers | Cloudflare Workers | proxy / gateway / landing |
| DB | Postgres + pgvector | 30 migrations including DLP / audit / SCIM / BYOK / drift |
| Cache | Redis | rate-limit + tokenize maps |

## Domain classification

- Primary: **DevTool / Compliance / SaaS**
- Secondary: **AI/ML infrastructure** (gateway, not training)

## What's already shipped (last 7 days)

- 15-class PII detection pack (AWS / GCP / GitHub / Slack / Stripe /
  sk-ant- / sk- secrets in addition to ssn / itin / mrn / cc / email)
- Reversible tokenization (`<EMAIL_001>` round-trip)
- Per-tenant BYOK with AES-256-GCM seal (migration 027)
- Anthropic-compat `/v1/messages` drop-in (non-streaming + pass-
  through SSE; inline DLP on stream is the open task)
- 4 policy templates (HIPAA / PCI / GDPR / SOC2) with one-click apply
- GDPR Article 15 per-user redaction view
- Compliance evidence export with SHA-256 hash chain
- Drift detector (2σ deviation → webhook fan-out)
- ~80 behavior tests added in the last week
- No-bluff watcher routine running hourly against `origin/main`

## Active gaps

| Gap | Severity | Owner |
|---|---|---|
| Inline DLP on SSE stream | High | Eng (in flight) |
| OCR for image content | Medium | Eng / week-3 |
| SOC 2 Type II cert | High | Compliance Q2 2026 |
| Pen test report | High | External |
| DPA template + subprocessors page | Medium | Legal |
| k6 load-test against staging | Medium | Ops (no staging URL) |
| DR drill against real Postgres | Medium | Ops |
| Docker-in-CI for E2E | Low | Ops |
