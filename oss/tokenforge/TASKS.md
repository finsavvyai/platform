# TokenForge — Ordered Task List

Drives the hourly autonomous agent. Picks the first unchecked `[ ]` task,
implements + tests + commits + marks `[x]` + stops. Resumes next hour.

**Source spec:** the in-tree DBSC spec (formerly `CISCO-dua.md`), summarized
in `PHASE-PROGRESS.md`. Stale plan archived at
`docs/archive/EXECUTION_PLAN.legacy.md`.

**Hard rules** (portfolio CLAUDE.md):
- Max 200 lines per source file (`src/`, `app/`, `lib/`).
- ≥90% line / ≥85% branch / ≥90% func coverage on every package touched.
- 100% coverage on auth / crypto / policy / security paths.
- No merge on red CI; every change ships with tests.
- Follow existing TS strict + DBSC wire format; do not deviate from `@tokenforge/protocol` types.

**Per-task workflow (agent must do all of these, in order):**
1. Read this file. Pick the first unchecked task.
2. Read `PHASE-PROGRESS.md` for context.
3. Implement. Keep files ≤200 lines (split if needed).
4. Write tests. Run `pnpm -r test` and `pnpm -r typecheck`.
5. If all green, `git add` only the changed paths (no `-A`). Commit with
   message: `phase X.Y: <one-line summary>`.
6. Update `PHASE-PROGRESS.md` (status row + coverage if regenerated).
7. Mark this task `[x]` in `TASKS.md`.
8. Commit the doc updates: `docs: mark task <id> done`.
9. Stop. Do not start the next task — the next hour's agent will.

**If a task fails (red CI, blocked, ambiguous):**
- Do NOT mark it done.
- Append a `> note:` line under the task with the blocker.
- Commit any partial WIP on a branch named `wip/<task-id>` (do not merge to main).
- Stop. Surface the blocker for the human to resolve.

---

## A. Follow-ups (close partial phases)

### Phase 6.1 — Dashboard production wiring

- [ ] **6.1a** — Drizzle/D1 adapter for `DashboardStore` (mirror `MemoryDashboardStore` API). Path: `apps/dashboard/src/lib/server/store-d1.ts`. Add Wrangler D1 binding. Keep file ≤200 lines (split if needed). Tests via miniflare.
- [ ] **6.1b** — Better Auth full integration on the dashboard. Email/password + magic link via Resend. Replace any stub session reads. Path: `apps/dashboard/src/lib/server/auth.ts` + hooks. Tests cover signup → email verify → login → session.
- [ ] **6.1c** — LemonSqueezy webhook handler at `apps/dashboard/src/routes/api/billing/webhook/+server.ts`. Verify HMAC, upsert `tenants.plan`, write `audit_events`. Tests cover signature verify + plan upgrade/downgrade/cancel.

### Phase 7.1 — Webhook delivery hardening

- [ ] **7.1a** — Cloudflare Queues binding for at-least-once webhook delivery. Move dispatcher from inline-fetch to producer/consumer Workers. `apps/api/src/queues/webhook-consumer.ts`. Wrangler queue config. Tests cover enqueue + retry + DLQ.
- [ ] **7.1b** — D1 persistence for webhook subscriptions + delivery log. Tables `webhooks`, `webhook_deliveries`. Drizzle schema + migration. Replace in-memory store. Tests cover CRUD + delivery audit.

### Phase 9.1 — Workforce mode UI + persistence

- [ ] **9.1a** — Dashboard IdP-config UI at `/apps/[id]/idp`. OIDC discovery URL + client_id + client_secret (encrypted at rest). Test connection button. Tests: form validation + happy path.
- [ ] **9.1b** — Per-app `policies` table wiring. Replace in-memory policyResolver with D1-backed lookup. Drizzle schema (already in `schema.ts`) → adapter → resolver. Tests cover insert/list/eval against fixtures.
- [ ] **9.1c** — TokenForge-driven OAuth redirect helper. Optional `/v1/sso/:appId/start` that issues redirect URL with PKCE + state. For customers who don't want to run OAuth themselves. Tests cover state CSRF + PKCE round-trip.

### Phase 10.1 — Workforce dashboard polish

- [ ] **10.1a** — SCIM-style user provisioning hook. Webhook event + dashboard UI to map IdP `sub` → internal subject. Tests cover create/update/deprovision.
- [ ] **10.1b** — Per-policy diff viewer on `/apps/[id]/policies/[id]/history`. Track each policy edit in audit log; render JSON-diff between versions. Tests cover diff render + revert flow.
- [ ] **10.1c** — Signed compliance manifest. CSV/JSON export endpoints sign output with TokenForge's ES256 key + publish JWKS at `/.well-known/tokenforge/jwks` (already exists — reuse). Tests cover sig verify with public key.

---

## B. Phase 11 — SAML + SCIM

- [ ] **11a** — SAML SP via `samlify`. Routes: `POST /v1/sso/:appId/saml/acs` + `GET /v1/sso/:appId/saml/metadata`. AppId-scoped IdP cert + entityID stored in `apps.idpConfig`. Tests cover metadata XML + assertion verify + `sub` mapping. Keep route file ≤200 lines.
- [ ] **11b** — SCIM 2.0 endpoints under `/v1/scim/v2/{Users,Groups}`. Bearer auth via app API key with `scim` scope. Implement Users CRUD + Groups membership. Tests cover full SCIM compliance test vectors.

---

## C. Phase 12 — Polish + launch prep

- [ ] **12a** — Marketing site at `apps/marketing` (SvelteKit, mdsvex). Hero, problem/solution, two-modes split, pricing table for both, docs link, CTA. Apple HIG compliance (calm, content-first). A11y AA min. Tests: link-check + a11y axe.
- [ ] **12b** — mdsvex docs site under `apps/marketing/src/routes/docs/`. Pages: Quickstart, Protocol, SDK API, Hono middleware, Dashboard, Workforce mode, Threat model. Generated from `docs/` markdown. Tests: link-check.
- [ ] **12c** — OpenAPI 3.1 spec autogen from Hono routes + Zod schemas using `@hono/zod-openapi`. Output `apps/api/openapi.json`. CI fails if drift. Tests cover schema-equivalence to manual fixtures.
- [ ] **12d** — npm publish prep for `@tokenforge/browser`, `@tokenforge/hono`, `@tokenforge/protocol`. Each gets: `package.json` clean (license MIT, repository URL, files allowlist), `CHANGELOG.md`, `README.md`, dual ESM+CJS via tsup or unbuild, types via `.d.ts`. Dry-run `npm publish --dry-run` passes. Do NOT actually publish — that's a human action.
- [ ] **12e** — Status page at `apps/marketing/src/routes/status/+page.svelte`. Pulls Cloudflare healthcheck endpoint + last 30 days of incident log from `audit_events`-derived `incidents` view. Tests cover render + degraded-state styling.

---

## Manual prereqs (NOT for the agent — human only)

These block Phase 1 from being marked ✅ but cannot be done by an automated agent:

- [ ] Register `tokenforge.dev` (or chosen domain).
- [ ] Cloudflare account + D1 + KV + Queues provisioned.
- [ ] Wrangler secrets set: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `LEMON_SQUEEZY_KEY`, `LEMON_SQUEEZY_WEBHOOK_SECRET`, `OPENAI_API_KEY` (if used).
- [ ] GitHub repo created, remote pushed, CI secrets set: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] DNS for `api.tokenforge.dev`, `dashboard.tokenforge.dev`, `tokenforge.dev`.
- [ ] Confirm spec §14 open questions: cookie strategy, free-tier limits, workforce GTM, brand split, AMLIQ/OpenSyber webhook formats.

The agent should NOT attempt any of these. If a task is blocked on one, halt and surface.

---

## Total

- A: 9 tasks
- B: 2 tasks
- C: 5 tasks
- **= 16 hourly slots**, plus the inevitable retry/blocked hours.
