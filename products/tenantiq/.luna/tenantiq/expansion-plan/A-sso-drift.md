# Phase A — SSO Hardening + Drift Attribution

**Goal:** Unlock $50k+ ACV enterprise deals. Existing SSO works; close gaps that block sales engineering review.

**Effort:** 3 weeks (15 working days). Solo eng.

## Verified Current State

| File | LOC | Notes |
|------|-----|-------|
| `apps/api/src/routes/sso.ts` | 97 | CRUD list/create/update/delete |
| `apps/api/src/routes/sso-callback.ts` | 180 | SAML+OIDC callback handlers |
| `apps/api/src/routes/sso-handlers.ts` | 164 | shared handlers |
| `apps/api/src/routes/sso-login.ts` | 94 | initiate login |
| `apps/api/src/routes/sso-jit.ts` | 55 | just-in-time provision |
| `apps/api/src/routes/sso-schemas.ts` | 21 | zod: provider in {saml, oidc} |
| `packages/db/migrations/0004_sso_connections.sql` | — | sso_connections table |
| `packages/db/migrations/0009_sso_cert_expires_at.sql` | — | cert expiry tracking |
| `apps/web/src/routes/settings/sso/+page.svelte` | — | admin UI exists |
| `apps/api/src/lib/snapshots/drift-detector.ts` | 87 | drift detection wired |
| `apps/api/src/lib/snapshots/diff.ts` | 72 | category diff |
| `apps/api/src/routes/config-drifts.ts` | — | drift API surface |
| Cron: `0 4 * * *` | — | SSO cert expiry monitor |
| Cron: `0 3 * * *` | — | drift detection daily |

## Honest Gaps

1. **No SCIM 2.0 provisioning** — grep `scim` returns 0 hits. Required by Okta/Entra for auto-deprovisioning.
2. **No real-IdP test fixtures** — only mocked DB rows in `sso-callback.test.ts`. No Okta/Entra metadata XML.
3. **No drift change attribution** — `drift-detector.ts` records before/after but doesn't cross-ref M365 audit logs to find actor.
4. **No drift diff viewer UI verified** — `/audit/history` page exists but side-by-side diff component absent (need verify).
5. **Cert rotation** — `sso_cert_expires_at` exists; alert path on expiry-soon not verified end-to-end.

## Tasks (atomic commits)

### A1 — SCIM 2.0 endpoint (5d)
- [ ] A1.1 Migration `0013_scim_tokens.sql` — `scim_bearer_tokens(id, org_id, token_hash, scopes_json, created_at, last_used_at, revoked_at)`
- [ ] A1.2 `apps/api/src/routes/scim/users.ts` — GET/POST/PATCH/DELETE per RFC 7644 (≤200 LOC)
- [ ] A1.3 `apps/api/src/routes/scim/groups.ts` — group CRUD
- [ ] A1.4 `apps/api/src/lib/scim/serializer.ts` — User/Group → SCIM JSON
- [ ] A1.5 `apps/api/src/middleware/scim-auth.ts` — Bearer token verify, org-scoped
- [ ] A1.6 Admin UI `/settings/sso/scim` — generate/revoke tokens
- [ ] A1.7 Unit tests: pagination, filter parsing, partial PATCH, deactivation
- [ ] A1.8 Integration test against real Okta sandbox (manual verification, document steps)

**Commit:** `feat(sso): SCIM 2.0 user/group provisioning endpoint`

### A2 — Multi-IdP test fixtures (2d) — REVISED scope

**Original plan** said SAML XML metadata + OIDC discovery JSON. **Code review showed** sso-callback.ts:
- SAML path delegates to `workos.sso.getProfileAndToken()` — XML metadata never touches our code
- OIDC path uses `decodeJwt(idToken)` only — discovery JSON not consumed

**Honest scope:** OIDC id_token claim-shape fixtures per IdP. Tests our real `decodeJwt` + email/displayName extraction path. SAML XML fixtures dropped (would test WorkOS, not us).

Tasks:

- [x] A2.1 `apps/api/src/test/fixtures/sso/okta-id-token.ts` — Okta-shaped id_token claims (`email`, `name`, `preferred_username`, `groups`)
- [x] A2.2 `apps/api/src/test/fixtures/sso/entra-id-token.ts` — Entra ID claims (`email`, `name`, `preferred_username`, `oid`, `tid`)
- [x] A2.3 `apps/api/src/test/fixtures/sso/auth0-id-token.ts` — Auth0 claims (`email`, `name`, `nickname`, `https://app.tenantiq.io/roles` namespaced claim)
- [x] A2.4 New tests in `sso-callback.test.ts` exercising each provider's id_token via `id_token` query param path
- [x] A2.5 README in fixtures dir documenting how to add new IdP fixtures

**Commit:** `test(sso): OIDC id_token fixtures for Okta/Entra/Auth0`

### A3 — Drift attribution (4d)

- [x] A3.1 `apps/api/src/lib/audit/m365-audit-fetcher.ts` — pulls `auditLogs/directoryAudits` only; `signIns` deferred (categorically separate, additive later)
- [x] A3.2 `apps/api/src/lib/snapshots/attribution.ts` — matches drift event timestamp ±5min to audit entries; bucketed by category (CATEGORY_AUDIT_MAP)
- [x] A3.3 Migration `0014_drift_attribution.sql` — added `attributed_to TEXT, attributed_at TEXT, audit_log_id TEXT` to `config_drifts` + index on `audit_log_id`
- [x] A3.4 Wire `runAttribution` into `drift-detector.ts` post-detection step (graphFetch optional; backward compatible)
- [x] A3.5 25 unit tests covering window matching, category bucketing, multi-actor disambiguation, edge cases, end-to-end runAttribution

**Commit:** `feat(drift): cross-ref M365 audit logs to attribute config changes`

### A4 — Drift diff viewer UI (3d)
- [ ] A4.1 Verify `/audit/history` actual current state (read file)
- [ ] A4.2 `apps/web/src/lib/components/drift/DiffViewer.svelte` — side-by-side JSON diff w/ syntax highlight
- [ ] A4.3 `apps/web/src/lib/components/drift/AttributionBadge.svelte` — actor + timestamp + audit-log link
- [ ] A4.4 Wire into `/audit/history/+page.svelte`
- [ ] A4.5 Component tests (vitest + svelte-testing-library)

**Commit:** `feat(web): drift diff viewer with attribution badge`

### A5 — Cert expiry alert E2E verify (1d)
- [ ] A5.1 Read existing `apps/api/src/cron/sso-cert-expiry-monitor.ts` (or wherever 04 cron lives)
- [ ] A5.2 Add Playwright test: seed cert expiring in 7 days → run cron → assert alert created + email queued
- [ ] A5.3 If gap found: fix and add unit test

**Commit:** `test(sso): cert expiry → alert pipeline E2E verification`

## Acceptance Gates

- [ ] Okta sandbox can provision/deprovision a test user via SCIM in <5s round-trip
- [ ] All three IdP fixtures parse + verify in unit tests
- [ ] Real M365 tenant: weaken a CA policy → drift detected → attributed to correct admin within 24h
- [ ] Diff viewer renders ≥3 categories side-by-side w/ keyboard nav
- [ ] Cert expiring in <14d generates alert routed to org owners

## Risks / Unknowns

- **Okta SCIM cert review** — Okta requires HTTPS endpoint w/ valid cert before they'll test. Deploy to staging first; allow 1-2d for Okta cert handshake.
- **M365 audit log latency** — `directoryAudits` can lag 30-60min. Attribution may be best-effort, not real-time. Document this.
- **SAML signature edge cases** — Entra rotates IdP cert quarterly. Need cert rotation runbook (Phase A5 partial cover only).
- **SCIM PATCH parsing** — RFC 7644 PATCH ops are notoriously tricky. Budget extra debug time on A1.2.

## NOT In Scope

- WS-Federation / legacy SAML 1.1 (deprecated, customer would be tiny)
- LDAP / Active Directory direct sync (use Entra ID Connect bridge)
- SSO for end-customer M365 tenants (this phase = MSP admin SSO only)
- Drift remediation auto-rollback (Phase A5 only verifies alert; no execution)
- Audit-log retention beyond 30d (M365 default, not our problem)

## Files Touched (Concrete)

```
NEW:
  packages/db/migrations/0013_scim_tokens.sql
  packages/db/migrations/0014_drift_attribution.sql
  apps/api/src/routes/scim/users.ts
  apps/api/src/routes/scim/groups.ts
  apps/api/src/lib/scim/serializer.ts
  apps/api/src/middleware/scim-auth.ts
  apps/api/src/lib/audit/m365-audit-fetcher.ts
  apps/api/src/lib/snapshots/attribution.ts
  apps/api/src/test/fixtures/sso/{okta-metadata,entra-metadata}.xml
  apps/api/src/test/fixtures/sso/auth0-oidc-discovery.json
  apps/web/src/lib/components/drift/{DiffViewer,AttributionBadge}.svelte
  apps/web/src/routes/settings/sso/scim/+page.svelte

MODIFIED:
  apps/api/src/lib/snapshots/drift-detector.ts (call attribution post-detect)
  apps/api/src/routes/sso-callback.test.ts (parse real fixtures)
  apps/web/src/routes/audit/history/+page.svelte (mount diff viewer)
  apps/api/src/cron/* (verify cert-expiry alert path)
```
