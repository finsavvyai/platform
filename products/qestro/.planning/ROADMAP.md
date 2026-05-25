# Roadmap: Qestro (GSD)

## Overview

Ship incremental, verifiable improvements: first make dev/CI/deploy paths boring and documented, then reduce API drift and test instability, then tighten product flows (generation, run, OAuth), then close security/recording gaps called out in project memory.

## Phases

- [ ] **Phase 1: Dev/CI/deploy baseline** — Local and CI entrypoints documented; fast gate green; deploy docs match live Cloudflare reality.
- [ ] **Phase 2: API boundaries & test foundations** — Ownership clarity; consistent errors; baseline automated coverage for core flows.
- [ ] **Phase 3: Core product path** — NL → test → run → results; OAuth/session behavior validated on Workers.
- [ ] **Phase 4: Hardening & backlog closure** — Recording/artifacts, SEC items, and deferred `CLAUDE.md` items executed or formally tracked.

## Phase Details

### Phase 1: Dev/CI/deploy baseline

**Goal**: Contributors and automation share one clear path from clone to green checks and known deploy targets.

**Depends on**: Nothing (first phase)

**Requirements**: PLAT-01, PLAT-02, PLAT-03

**Success Criteria** (what must be TRUE):

1. A new contributor can follow docs only (plus `.env.example` style files) to run the primary app/dev stack.
2. CI runs a fast gate on PRs that fails on obvious breakage without requiring full E2E every time.
3. Deploy documentation names the Workers/Pages projects and branches that receive production traffic.

**Plans**: TBD (create via `$gsd-plan-phase 1`)

Plans:

- [ ] 01-01: TBD — document and script dev bootstrap
- [ ] 01-02: TBD — fast CI gate definition
- [ ] 01-03: TBD — deploy doc alignment with Cloudflare reality

### Phase 2: API boundaries & test foundations

**Goal**: Reduce cross-surface drift; establish consistent API error behavior; stabilize automated tests.

**Depends on**: Phase 1

**Requirements**: API-01, API-02, TEST-01

**Success Criteria** (what must be TRUE):

1. Each primary API surface has documented ownership and routing rules.
2. Representative authenticated and unauthenticated requests get predictable JSON errors.
3. Core flows have automated tests with stable fixtures and minimal flake.

**Plans**: TBD

Plans:

- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Core product path

**Goal**: NL test creation and execution path works end-to-end on hosted infra; OAuth/session behavior is validated.

**Depends on**: Phase 2

**Requirements**: PROD-01, PROD-02, TEST-02

**Success Criteria** (what must be TRUE):

1. User can create, save, and run a test from the UI and see results.
2. OAuth providers configured in production respond as documented; session persists as expected for primary flows.
3. E2E (or equivalent) suite runs in CI with clear env contract.

**Plans**: TBD

Plans:

- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Hardening & backlog closure

**Goal**: Close or explicitly track remaining high-risk items (recording pipeline, PKCE on edge, SEC reviews).

**Depends on**: Phase 3

**Requirements**: PROD-03, SEC-01, SEC-02

**Success Criteria** (what must be TRUE):

1. Top `CLAUDE.md` launch blockers addressed or converted into tracked follow-ups with owners.
2. Secrets and production bindings validated; no duplicate `.env` footguns documented without mitigation.
3. Authz checks prevent cross-tenant resource access on representative routes.

**Plans**: TBD

Plans:

- [ ] 04-01: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dev/CI/deploy baseline | 0/TBD | Not started | - |
| 2. API boundaries & test foundations | 0/TBD | Not started | - |
| 3. Core product path | 0/TBD | Not started | - |
| 4. Hardening & backlog closure | 0/TBD | Not started | - |
