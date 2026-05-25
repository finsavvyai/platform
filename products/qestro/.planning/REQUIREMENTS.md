# Requirements: Qestro

**Defined:** 2026-04-22  
**Core Value:** Users can go from intent to executed, trustworthy automated tests without drowning in boilerplate or constant selector churn.

## v1 Requirements

### Platform & reliability

- [ ] **PLAT-01**: Engineers can run a documented local dev path (install, compose, dev scripts) without undocumented manual steps beyond env templates.
- [ ] **PLAT-02**: CI runs a fast deterministic check on every change (lint/typecheck/unit subset) before heavier suites.
- [ ] **PLAT-03**: Production deploy path is documented per target (e.g. Cloudflare Workers/Pages naming and branches) and matches live traffic routing.

### API clarity

- [ ] **API-01**: Each major HTTP surface has a stated owner (`backend/` vs `src/` vs `apps/api/`) and new routes follow that ownership.
- [ ] **API-02**: Public API errors return consistent JSON shape and status codes for auth, validation, and server errors on primary surfaces.

### Testing

- [ ] **TEST-01**: Core user flows have automated coverage at the appropriate layer (unit, integration, or E2E) with stable fixtures.
- [ ] **TEST-02**: Playwright (or equivalent) E2E suite can run in CI with documented secrets/env and retry policy for flakes.

### Product (high priority themes from project docs)

- [ ] **PROD-01**: Test creation from natural language remains usable end-to-end (generate → save → run → result visible).
- [ ] **PROD-02**: OAuth/session flows behave correctly across cold starts and provider keys present in the live Worker (no “works on my machine” only).
- [ ] **PROD-03**: Recording/artifact pipeline gaps called out in `CLAUDE.md` are either fixed or explicitly deferred with tracked REQ follow-ups.

### Security & data

- [ ] **SEC-01**: Secrets are not committed; production secrets are set on the correct Cloudflare resources; env templates list required keys.
- [ ] **SEC-02**: Authenticated routes enforce authorization consistently (no IDOR on project/test resources by user/team scope).

## v2 Requirements

### Enterprise & depth

- **ENT-01**: Deeper enterprise SSO features (SCIM, group sync) — deferred until enterprise motion.
- **ENT-02**: Advanced analytics/reporting beyond current dashboards — deferred.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full monorepo consolidation into one API binary | Too large; incremental boundaries preferred |
| Non-testing product lines | Not Qestro core |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 3 | Pending |
| PROD-01 | Phase 3 | Pending |
| PROD-02 | Phase 3 | Pending |
| PROD-03 | Phase 4 | Pending |
| SEC-01 | Phase 4 | Pending |
| SEC-02 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 12 total  
- Mapped to phases: 12  
- Unmapped: 0 ✓  

---

*Requirements defined: 2026-04-22*  
*Last updated: 2026-04-22 after initial definition*
