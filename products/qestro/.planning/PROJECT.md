# Qestro

## What This Is

Qestro is the testing copilot for AI-assisted development: describe what to validate in plain language, generate runnable tests across browser, mobile, and API, and keep them maintainable with self-healing-style workflows. This repository is a brownfield monorepo (web clients, Cloudflare Workers APIs, CLI, MCP server, mobile app, orchestration) aligned with the public product at `qestro.app`.

## Core Value

Users can go from intent (“what should pass?”) to executed, trustworthy automated tests without drowning in boilerplate or constant selector churn.

## Requirements

### Validated

- ✓ Multi-surface TypeScript monorepo with deployable Workers APIs and React/Expo clients — existing (see `.planning/codebase/ARCHITECTURE.md`, `STACK.md`).
- ✓ Route-first APIs (Hono) with service-oriented domain logic — existing (`backend/src/`, `src/`, `apps/api/`).
- ✓ Auth surfaces (JWT + OAuth providers) and billing-related integrations — existing (`backend/src/routes/`, `backend/src/services/`).
- ✓ Test execution and orchestration paths (Playwright, Maestro, API runners) — existing per `README.md` and orchestrator packages.
- ✓ Drizzle/D1-oriented persistence patterns — existing (`drizzle/`, `backend/src/db/`).

### Active

- [ ] Stabilize and document canonical API ownership across `backend/`, `src/`, and `apps/api/` (reduce drift).
- [ ] Harden CI: one fast gate + full matrix; reduce flake and env mismatch across Workers vs Node paths.
- [ ] Close high-priority product gaps called out in `CLAUDE.md` (recording pipeline, display IDs, OAuth PKCE on edge, etc.) in priority order.
- [ ] Keep self-healing and AI generation paths reliable under provider and UI change.

### Out of Scope

- Rewriting the entire monoreto into a single runtime — deferred; incremental consolidation only where justified.
- Non-Qestro product lines — excluded unless explicitly merged into this repo’s mission.

## Context

- Codebase map: `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, INTEGRATIONS, CONVENTIONS, TESTING, CONCERNS).
- Product and ops notes: `CLAUDE.md`, `README.md`, `docs/` as needed.
- Deployment reality includes Cloudflare naming quirks (legacy `questro-*` vs `qestro-*`) documented in `CLAUDE.md`.

## Constraints

- **Runtime**: Mixed Cloudflare Workers and Node/tooling; not every npm dependency is Worker-safe — validate edge bundles.
- **Data**: D1/Postgres/Redis patterns coexist — env and binding discipline required.
- **Scope**: Prefer small, verifiable phases over big-bang rewrites.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat this init as **brownfield GSD** with inferred validated capabilities from the codebase map | Accurate planning requires acknowledging what already ships | — Pending |
| Default GSD workflow config: YOLO + parallel plans + committed `.planning/` | Matches `init new-project` defaults and typical automation | — Pending |

---

*Last updated: 2026-04-22 after GSD project initialization (brownfield)*
