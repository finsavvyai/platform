# TenantIQ — Product-level CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules).
This file may **add** stricter rules. It may **not** weaken any portfolio
rule. The upstream TenantIQ engineering doc was preserved as
`CLAUDE.source.md` (367 lines, exceeds the 200-line cap) for reference;
this file is the canonical product-level CLAUDE.md.

## Product mission & target user

- **Mission:** AI governance and remediation for Microsoft 365 — AI
  remediation plans, OAuth governance, blast-radius simulation, and MSP
  governance workflows.
- **Target user:** MSP operators managing 9–250+ M365 tenants
  concurrently, plus security/compliance leads inside single-tenant
  enterprises that need defensible posture evidence.
- **Definition of value:** every risky OAuth grant caught before it
  causes a tenant compromise; every remediation plan that turns "the AI
  agent did something" into a reviewable, reversible change set.

## Product-specific architecture constraints

- TenantIQ is **one API surface + two consumption surfaces** (desktop web
  app + mobile shell). Both consumption surfaces live under
  `products/tenantiq/` and share the same backend.
  - `apps/api/` — Cloudflare Workers + Hono (TypeScript)
  - `apps/web/` — SvelteKit 5 desktop console (from upstream `tenantiq`)
  - `web/` — Capacitor 8 + SvelteKit mobile shell (from upstream
    `tenantiq.frontend`). Reconciliation with `apps/web/` is a
    consolidation ticket.
- All Microsoft Graph access flows through `packages/graph/`. No direct
  Graph calls from routes or components. This is a hard rule because
  Graph scopes are the audit trail.
- All DB writes go through `packages/db/` (Drizzle). Every query must be
  tenant-scoped (`WHERE org_id = …`) via the `tenantScopingMiddleware`.
  A query without tenant scoping is a release-blocking bug.
- M365 OAuth consent is **read-only by default**. Write scopes are
  per-action, scoped consent only, and recorded in the audit log with a
  human-approval reference.

## Product-specific test matrix

Portfolio baseline: lines ≥ 90 %, branches ≥ 85 %, functions ≥ 90 %.

TenantIQ raises the bar on the critical path:

| Surface | Coverage requirement |
|---|---|
| OAuth grant analysis (grant → risk score → recommendation) | **100 %** line + branch |
| Blast-radius calculation (affected users, scopes, data) | **100 %** line + branch |
| Remediation plan generation (plan → diff → reversible apply) | **100 %** line + branch |
| Audit-log emit on every consent change / remediation step | **100 %** line + branch |
| Tenant scoping middleware (`WHERE org_id = …` enforcement) | **100 %** line + branch |
| Account-deletion cascade (33-table contract) | ≥ 95 % line + contract test |
| Cron jobs (26 schedulers) | ≥ 90 % line |
| Web routes / Svelte components | portfolio baseline |

Every bug in OAuth governance, blast-radius, or remediation logic must
ship a failing test first, then the fix.

## Product-specific security controls (release-blocking)

- **M365 access is read-only by default.** Write operations require:
  (a) scoped consent grant from the customer admin,
  (b) per-action audit record,
  (c) explicit rollback path documented.
- **Tenant isolation:** every DB query carries `org_id`. A contract test
  scans the codebase for `db.select(`/`db.insert(`/`db.update(` calls
  that bypass the scoping middleware and fails CI if any are found.
- **OAuth consent integrity:** consent state mirrored to D1 with a
  signed snapshot. Drift between Microsoft's view and our view triggers
  an alert and a re-consent flow — never a silent reconciliation.
- **PII handling:** user identifiers stored hashed at rest where
  feasible. Audit records carry `actor_id` (admin subject), `resource`
  (hashed tenant + resource id), and never raw email bodies or document
  contents.
- **Secrets:** pulled from Cloudflare secret store. Never in Git,
  container images, KV plain-text, or logs.
- **Dependency vulnerability scan:** any **Critical** or **High** in
  `apps/api/`, `apps/web/`, `web/`, or any `packages/*` blocks release.
  No waiver.
- **Rate limiting:** all routes carry rate limits keyed by
  `(org_id, actor_id, endpoint_class)`. Public prospect-scan endpoint
  rate-limited 5/hr/IP via KV.

## Audit log requirements (TenantIQ-specific, mandatory)

Every consent change, remediation step, and admin action MUST emit
exactly **one** audit record per round-1 shape with TenantIQ extensions:

```
{
  ts:        ISO-8601,
  actor_id:  admin subject (oauth) or platform principal,
  event:     "tenantiq.oauth.consent.granted" | "tenantiq.remediation.applied" |
             "tenantiq.cis.scan.completed" | "tenantiq.account.deleted" | ...,
  resource:  "<orgIdHash>:<tenantIdHash>:<resourceType>:<resourceIdHash>",
  decision:  "applied" | "blocked" | "rolled_back" | "noop",
  reason:    short stable code (e.g. "blast_radius_exceeds_threshold"),  // NO PII
  meta: {
    blastRadius:    { usersAffected: n, scopes: [...] },
    policyVersion:  string,
    correlationId:  string,
    sourceIp:       string
  }
}
```

Audit emit failure blocks the action — release-blocking.

## Authentication

- All API calls require JWT verified by `@finsavvyai/auth` (round-1
  hardened module) once the migration of TenantIQ's bespoke auth path
  (jose HS256/RS256) is complete. Until then, the local auth path stays
  in place but its `verifyJwt` function is held to the **100 % line +
  branch** coverage bar above.
- M365 admin OAuth handled via Microsoft's standard flow; tokens stored
  encrypted at rest.

## Product-specific release checklist

- [ ] CI green: unit + integration + smoke + e2e Playwright.
- [ ] Coverage thresholds (table above) met; report archived.
- [ ] Security scans clean (SAST, deps, secrets, licence).
- [ ] Tenant-scoping contract test passes (no unscoped DB query).
- [ ] Account-deletion 33-table cascade contract test passes.
- [ ] OAuth consent snapshot signing verified end-to-end.
- [ ] Apple HIG accessibility checks on `apps/web/` and `web/` (contrast,
      keyboard nav, screen-reader labels).
- [ ] Mobile shell (`web/`) tested on physical iOS + Android device.
- [ ] Cron job state validated post-deploy (26 schedulers register).
- [ ] Rollback plan validated.

## File size

- Portfolio 200-line cap applies to all new code added under
  `products/tenantiq/`. Migrated upstream code that exceeds 200 lines is
  exempt **only** until the first non-trivial edit; first edit ⇒ split.

## Allowed overrides

- Stricter coverage on OAuth, blast-radius, remediation, tenant-scoping.
  ✅
- Stricter audit-log shape — emit failure blocks the action. ✅
- Stricter dep-vuln gating (Critical/High = block, no waiver). ✅
- M365 read-only-by-default mandated. ✅

## Disallowed overrides

None applied. Nothing here lowers a portfolio rule.
