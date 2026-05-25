# TenantIQ — Drift Detection + Staged Environment + SSO Plan
> Created: 2026-04-21 | Owner: Shahar | Status: IN PROGRESS

## Context
Everything is built (~1,938 lines of drift/snapshot/SSO code). Zero code-from-scratch needed.
Live tenants: remit.co.il (managed) + 1 managing org.

## Goal
Full end-to-end drift detection running in staged environment with demo tenants + validated on live tenant.

---

## Phase 0 — Fix Email Stub [IMMEDIATE] ~30min
**Problem:** provisioning/setup.ts:145 has `console.log` instead of real email send.
**Fix:** Wire `sendEmail()` from `lib/email-service.ts` with invitation template.

Files:
- `apps/api/src/services/provisioning/setup.ts` — replace console.log
- `apps/api/src/lib/email-service.ts` — add `sendInvitationEmail()` template

---

## Phase 1 — Staging Environment [DAY 1] ~1h
**Goal:** Separate D1 + KV for staging, wrangler.toml `[env.staging]` block.

Steps:
1. `npx wrangler d1 create tenantiq-staging` → get staging DB ID
2. `npx wrangler kv:namespace create tenantiq-kv-staging` → get staging KV ID
3. Add `[env.staging]` to wrangler.toml with staging IDs
4. `npx wrangler d1 migrations apply tenantiq-staging --env staging` — apply all migrations
5. Verify: `npx wrangler d1 execute tenantiq-staging --env staging --command "SELECT name FROM sqlite_master WHERE type='table'"`

---

## Phase 2 — Demo Tenant Seed Data [DAY 1] ~2h
**Goal:** 5+ demo orgs with realistic snapshots + drift + alerts pre-seeded.

Script: `scripts/seed-demo.mjs`

Demo tenants:
| Org | Tenant Name | Drift State |
|-----|-------------|-------------|
| AlphaCorp MSP | alpha-tenant-1..5 | 2 critical drifts (conditional access disabled) |
| BetaLtd | beta-tenant-1 | 1 warning (named location added) |
| GammaSec | gamma-tenant-1..3 | clean (baseline matches current) |
| DeltaHealth | delta-tenant-1 | 3 critical (MFA disabled, security defaults off) |
| Remit Demo | remit-demo-1 | mirror of real remit.co.il structure |

Each tenant gets:
- org + subscription (professional tier)
- platform_users record (admin)
- 2x config_snapshots (baseline + current)
- config_drifts records per snapshot diff
- security_alerts for critical drifts
- sso_connections (OIDC via Entra) pre-configured

---

## Phase 3 — Wire Live Tenant (remit.co.il) [DAY 1] ~1h
**Goal:** remit.co.il connected to managing org, first real snapshot taken.

Steps:
1. Confirm managing org ID + admin user ID in production D1
2. Create tenant record for remit.co.il in managing org
3. Set `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` for remit.co.il in KV
4. Hit `POST /api/tenants/:id/snapshots/capture` → first snapshot
5. Mark snapshot as baseline
6. Verify snapshot categories captured (10 categories from config-reader.ts)

Required Graph app permissions (all read-only):
- `Policy.Read.All`
- `RoleManagement.Read.Directory`
- `InformationProtection.Read.All`
- `Directory.Read.All`

---

## Phase 4 — SSO Setup for Managing Tenant [DAY 1-2] ~2h
**Goal:** Microsoft Entra OIDC SSO working for managing tenant login.

Steps:
1. Register app in Azure AD (remit.co.il tenant)
2. Note: clientId, issuerUrl = `https://login.microsoftonline.com/{tenantId}/v2.0`
3. `POST /api/sso` → create OIDC connection (domain: remit.co.il)
4. `POST /api/sso/:id/test` → verify config passes all 4 checks
5. Update `status = 'active'` on connection
6. Test login flow: SSO redirect → Entra → callback → session cookie

Entra app registration settings:
- Redirect URI: `https://app.tenantiq.app/auth/callback`
- Scopes: `openid`, `profile`, `email`
- Token type: ID token

---

## Phase 5 — E2E Drift Detection Test [DAY 2] ~2h
**Goal:** Prove end-to-end drift cycle works on remit.co.il.

Test sequence:
1. Snapshot A (baseline) → capture via API
2. Make a real config change in Entra (add named location, or toggle policy)
3. Snapshot B → capture via API
4. Verify: `GET /api/tenants/:id/drifts` returns new drift records
5. Verify: `GET /api/tenants/:id/drifts/summary` shows count > 0
6. Verify: alert created in security_alerts
7. Acknowledge drift → verify `acknowledged = 1`
8. Suppress rule → verify suppressed path not flagged next cycle
9. Trigger cron manually: `POST /api/cron/compliance-scan` (or via wrangler cron trigger)

---

## Phase 6 — Cron Validation [DAY 2] ~30min
**Goal:** Verify 3am drift cron is wired to `detectDrift()`.

Check: `apps/api/src/cron/` — find the compliance-scan handler.
Expected: calls `captureSnapshot()` → drift triggers automatically.
Fix if missing: wire cron handler to call snapshot capture per scheduled tenant.

---

## Phase 7 — UI Walkthrough Validation [DAY 2] ~1h
Pages to verify end-to-end:
- `/backups/config` — snapshot list, capture button, diff view
- `/backups/config/compare` — diff viewer between two snapshots
- `/settings/sso` — create/test/delete SSO connection
- Alerts page — drift-generated alerts appear
- Dashboard — drift summary widget shows counts

---

## Parallel Agent Assignments

| Agent | Phase | Task |
|-------|-------|------|
| Agent A | Phase 0 | Fix email stub → wire sendInvitationEmail |
| Agent B | Phase 2 | Build seed-demo.mjs script |
| Agent C | Phase 1 | Add staging wrangler config + instructions |
| Agent D | Phase 6 | Audit + fix cron handler for drift |

---

## Success Criteria
- [ ] 5+ demo tenants seeded with realistic drift data
- [ ] remit.co.il snapshot taken + baseline set
- [ ] Drift detected after config change in remit.co.il
- [ ] SSO login working for managing tenant (Entra)
- [ ] Drift dashboard shows correct counts + severity
- [ ] Cron verified to trigger drift at 3am
- [ ] Email invitation sent on provisioning (not console.log)
- [ ] All new tests green

---

## Blockers / Open Questions
1. What is the managing tenant's org ID in production? Need to set tenant record for remit.co.il
2. Does remit.co.il Azure app registration exist? Need clientId + secret
3. Staging D1 IDs (run wrangler commands to create)
