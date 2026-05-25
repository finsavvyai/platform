# Playwright Auto-Remediation — Architecture Decision

## Context

TenantIQ wants to auto-fix CIS and Hardening controls that have no Microsoft Graph REST equivalent by driving the Microsoft 365 admin portal in a headless browser. Examples:

- SharePoint external sharing toggles (admin UI only)
- Legacy tenant settings buried in classic admin centers
- Flows that require a user session (Purview label pickers, some conditional access flows)

## Constraint

Cloudflare Workers **cannot run Chromium**. Any Playwright execution must happen off-Workers.

## Prior art — Qestro

`/portfolio/qestro/backend/src/services/`:

- **`PlaywrightBridge.ts`** — Worker-side HTTP client to a separate container.
- **`PlaywrightExecutorService.ts`** — EventEmitter, full session API (chromium/firefox/webkit, headless toggle, artifacts).
- **`PlaywrightCodegen.ts`** — generates scripts from recorded actions.

Qestro deploys the Playwright controller as a Node.js + Chromium container on Fly.io / AWS ECS / DigitalOcean App Platform. Workers POST to `http://controller/sessions`.

## Decision for TenantIQ

**Two-phase rollout:**

### Phase 1 — Shared bridge package (~1 day)

1. Extract Qestro's `PlaywrightBridge.ts` + `PlaywrightExecutorService.ts` into `packages/playwright-bridge` (sibling to the shared-auth / shared-billing / shared-* packages).
2. Import from both Qestro and TenantIQ:
   ```ts
   import { playwrightBridge } from '@portfolio/playwright-bridge';
   ```
3. One controller container serves both products.

### Phase 2 — TenantIQ remediation playbooks (~1 day)

1. `apps/api/src/lib/cis/remediation-playbooks/` — one file per control with the click-script:
   - `mfa-enforcement.ts`
   - `block-legacy-auth.ts`
   - `restrict-external-sharing.ts`
   - `block-external-forwarding.ts`
   - `mailbox-audit.ts`
   - `revoke-risky-sessions.ts`
2. Each playbook exports `{ name, steps, rollback }`.
3. `POST /api/cis-benchmark/remediate` with `mode: 'browser'` routes to `playwrightBridge.runPlaybook(playbookName, { tenantId, adminCreds })`.

### Credential model

- Customer grants us a **short-lived delegated access token** via OAuth (not stored creds).
- Controller container uses the token to authenticate to the admin portal (equivalent of signing in as the user).
- Token scoped to the remediation duration; revoked immediately after.
- All actions logged to `remediation_log` table (schema already in place) with before/after state for rollback.

### Rollback

Each playbook defines a `rollback` function that reverses its changes. Stored as serialized state in `remediation_log.before_state` and `after_state`.

## Cost estimate

- Fly.io tier: **$5/mo** (shared CPU, 256MB RAM, always-on). Scales to `$0.09/hour` on demand if we use suspend-on-idle.
- Per-remediation: ~30-60 seconds of browser time.
- Expected monthly: 500-1000 remediations × 45s = ~6-12 hours of browser time.

## Out of scope for v1

- Visual test recording (Qestro's use case — TenantIQ only needs scripted playbooks)
- Multi-region browser execution (single region OK)
- Browser farm orchestration (single container OK)

## Next actions (when ready to ship)

1. Create `packages/playwright-bridge` by extracting from Qestro.
2. Stand up controller container on Fly.io.
3. Wire `CLOUDFLARE_WORKERS → PLAYWRIGHT_CONTROLLER_URL` env var.
4. Implement first 3 playbooks (MFA enforcement, block legacy auth, restrict external sharing).
5. Flip `/api/cis-benchmark/remediate` browser mode from 202 stub to real call.

Current stub returns: `202 Accepted` with "Browser remediation is in beta and not yet wired to Cloudflare Browser Rendering." That message will update to "Remediation queued — see /audit for status" once Phase 2 ships.
