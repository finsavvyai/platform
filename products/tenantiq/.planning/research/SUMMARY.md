# Project Research Summary

**Project:** TenantIQ — Competitor-Parity Milestone
**Domain:** M365 MSP SaaS on Cloudflare Workers (brownfield feature additions)
**Researched:** 2026-04-22
**Confidence:** HIGH

## Executive Summary

TenantIQ is a brownfield M365 MSP SaaS platform that is architecturally more complete than its feature list implies. Research confirmed that the Copilot Readiness assessment engine, storage scanner, drift detector, and all D1 schema tables are already fully implemented in the backend. The remaining work is overwhelmingly frontend wiring and one net-new backend feature: the Enterprise SSO authentication flow (login initiation + SAML ACS + OIDC callback + JIT provisioning). This changes the build estimate significantly — most of this milestone is UI completion against working APIs, not backend engineering.

The single release-blocking gap is Enterprise SSO. All three direct competitors (CoreView, Syskit Point, BetterCloud) offer SAML/OIDC SSO, and 92% of enterprises require it on procurement checklists. The SSO CRUD layer and `sso_connections` D1 table are complete; only the authentication flow endpoints are missing. The recommended implementation uses `@workos-inc/node-sdk` for MVP (fast to ship, edge-compatible, eliminates XML parsing risk on Workers) with a self-hosted fallback using `@xmldom/xmldom` + `jose` if WorkOS unit economics deteriorate at scale ($125/connection/month becomes prohibitive past ~15 orgs). The `jose` library is already in the project and handles OIDC token validation natively on Workers.

The key production risks are multi-tenant data isolation (a missing `org_id` clause causes a data breach), SAML certificate expiry causing complete org lockout, a confirmed storage scanner CPU-limit defect (sequential Graph calls will terminate at ~30-40 users), and KV eventual consistency creating a stale-token window after tenant revocation. All four have well-defined mitigations. Critically, no new D1 migrations are required for this entire milestone — every table is already defined.

## Key Findings

### Recommended Stack

The existing stack (Cloudflare Workers + Hono + D1 + KV + SvelteKit 5 + `jose`) handles all features in this milestone without new runtime dependencies for anything except SSO. The SSO library choice is a business-model decision, not a technical one.

**Core technologies:**

- `@workos-inc/node-sdk` ^7.x: Managed SAML/OIDC broker — recommended for MVP; edge-compatible (fetch-based); eliminates XML parsing on Workers; $125/connection/month becomes cost-prohibitive past ~15 enterprise orgs
- `samlify` >=2.10.0 + `@xmldom/xmldom` ^0.8.x: Self-hosted SAML fallback — use only if WorkOS economics break; **never use samlify <2.10.0** (CVE-2025-47949, CVSS 9.9 signature wrapping bypass)
- `jose` ^5.x (already installed): OIDC JWT validation + JWKS — already in project; Workers-native; no new install needed for OIDC path
- `semgrep/semgrep-action@v1`: SAST scanning — free OSS, TypeScript + Node.js rulesets, faster than CodeQL for Workers/SvelteKit monorepo (CodeQL requires paid GitHub Advanced Security for private repos)
- `audit-ci` ^6: Dependency CVE gating — threshold-based blocking (`--high`), avoids constant noise from raw `pnpm audit`
- `gitleaks/gitleaks-action@v2`: Secret scanning — <5 second scan, 150+ patterns, correct tool for per-PR CI (TruffleHog is better on weekly scheduled scans)
- `@playwright/test` ^1.52.x (already installed): E2E — must run against `wrangler pages dev` port 8788, not `vite preview` (vite preview misses KV/D1 bindings, produces false-green tests)

**Critical version constraint:** `samlify` MUST be pinned to `>=2.10.0`. Versions below have a CVSS 9.9 authentication bypass (XML signature wrapping). This will be caught by `audit-ci` once CI is hardened.

### Expected Features

TenantIQ covers 8 of 10 table stakes features today. Enterprise SSO is the only hard procurement blocker. Copilot Readiness is a closing market window (Copilot Wave 3 announced March 2026; Syskit already has a dedicated dashboard; CoreView does not yet).

**Must have (table stakes — currently missing):**
- Enterprise SSO (SAML + OIDC, Okta + Entra tested) — P0 sales blocker; 75-80% of enterprise deals blocked without it; all three competitors have it
- Storage analytics + quota management — Syskit and BetterCloud both cover this; backend complete, UI missing

**Should have (differentiator — backend complete, UI incomplete):**
- Copilot Readiness Assessment — high demand; TenantIQ differentiates by tying readiness to actual security posture score, not just a checklist; backend + PDF route fully implemented
- Config snapshot diff viewer — CoreView has config backup/rollback but no visual diff; this is a standout demo feature; backend fully implemented in `lib/snapshots/diff.ts`
- Drift alert dashboard widget — `/api/config-drifts/summary` returns the exact shape needed; zero backend work required
- PDF report export for Copilot Readiness — `copilot-readiness-pdf.ts` route already implemented; UI CTA button only

**Defer to v2+:**
- SCIM provisioning — enterprise-tier only, not needed at launch
- Access reviews (owner-driven) — complex approval workflow, post-launch
- Entra app governance, Power Platform governance, Shadow IT — low MSP demand or out of M365 scope
- Native mobile app, Google Workspace, self-hosted deployment — explicit anti-features; none of the three competitors crossed these boundaries in v1

### Architecture Approach

The backend is substantially more complete than the feature list implies. All five feature areas have existing D1 tables, route files, and library modules. The only net-new backend code is three files: `sso-login.ts`, `sso-callback.ts`, and `sso-jit.ts`. All other backend work is a single performance fix (storage scanner batching) and CI hardening. The frontend work is five pages/components wiring against already-functional APIs.

**Major components and their status:**

1. **SSO CRUD layer** (`routes/sso.ts`, `sso-handlers.ts`, `sso-schemas.ts`) — Complete; D1 `sso_connections` table fully defined with all required columns
2. **SSO auth flow** (`sso-login.ts`, `sso-callback.ts`, `sso-jit.ts`) — Missing; only net-new backend work in the milestone; bridges to existing `issueJwt()` helper after assertion validated
3. **Copilot Readiness engine** (`lib/copilot/readiness-engine.ts`, `readiness-checks.ts`, `routes/copilot-readiness.ts`, `copilot-readiness-pdf.ts`) — Complete; all 7 scoring categories implemented, Graph endpoints wired, PDF export route exists, KV cache at `copilot:{tenantId}:latest` (2h TTL)
4. **Storage scanner** (`lib/storage/storage-scanner.ts`, `routes/storage-analytics.ts`) — Complete with one confirmed defect: sequential per-user Graph calls will hit Workers 30s CPU limit at ~30-40 users; fix by batching with `Promise.all` in groups of 10
5. **Drift detector + routes** (`lib/snapshots/drift-detector.ts`, `routes/config-drifts.ts`) — Complete; `/api/config-drifts/summary` returns `{ total, critical, warning, info, unacknowledged }` — exact shape needed for dashboard widget
6. **Frontend pages** (Storage Analytics, Copilot Readiness, Drift Widget, Snapshot Diff Viewer) — Missing; pure SvelteKit wiring against complete APIs
7. **CI security gates** (SAST, dep audit, secret scan, license compliance) — Missing from `ci.yml`; required by portfolio CLAUDE.md; release-blocking

**No D1 migrations required.** All tables (`sso_connections`, `copilot_assessments`, `storage_analytics`, `config_drifts`, `config_snapshots`, `platform_users` with `auth_provider` column) are fully defined. One optional SSO relay state nonce is better handled in KV (`sso:state:{nonce}` TTL 300s) to avoid a migration.

### Critical Pitfalls

1. **Multi-tenant isolation failure (Pitfall 1)** — Any D1 query missing `AND org_id = ?` causes cross-tenant data exposure. Every new route and cron/queue processor must assert `c.get('orgId')` before any database access. Return 404 (not 403) on org boundary violations to avoid existence disclosure. Severity: data breach + regulatory violation.

2. **SAML cert expiry complete org lockout (Pitfall 2)** — IdPs rotate signing certs on 1-3 year cycles. Must store metadata URL alongside cert, run daily cert-expiry cron alerting org admins at 60/30/7 days, and support dual-cert validation during IdP transition. Must be in place before any org enables SSO — not a post-launch concern.

3. **JIT provisioning race condition (Pitfall 3)** — Concurrent SAML assertions for the same new user create duplicate accounts, breaking RBAC. Prevention: `CREATE UNIQUE INDEX uq_org_member_email ON org_members(org_id, email)` before SSO launch + `INSERT ... ON CONFLICT DO UPDATE` pattern for all JIT inserts.

4. **Storage scanner CPU limit (Pitfall 9)** — Current `scanOneDriveUsage()` is sequential; hits Workers 30-second limit at ~30-40 users, leaving incomplete scan records. Fix confirmed: `Promise.all` in groups of 10, or offload large-tenant scans to the existing Cloudflare Queue.

5. **KV stale token after revocation (Pitfall 7)** — KV eventual consistency means deleted Graph tokens can still be served ~60 seconds after revocation. Mitigation: write a `graph_token_revoked:{tenantId}` sentinel key on tenant disconnect; check sentinel before returning cached token; treat Graph 401 responses as revocation signal.

## Implications for Roadmap

Based on the architecture reality (most backend is complete), the roadmap should front-load the one true backend gap (SSO flow), run frontend completions in parallel, fix the storage scanner defect, then close with hardening.

### Phase 1: SSO Backend — Login Flow, Callback, JIT

**Rationale:** This is the only feature with zero existing authentication flow and the P0 sales blocker. SSO is also the feature with the highest external risk surface (XML parsing on Workers, cert validation security, JIT race conditions). It must be unblocked first so SSO frontend wiring can proceed and so the SAML cert monitoring cron can be implemented before any customer enables SSO.

**Delivers:** Working SAML and OIDC login flows (`sso-login.ts`, `sso-callback.ts`, `sso-jit.ts`); JIT provisioning with race-condition-safe upsert; OIDC `state` CSRF protection; SAML cert expiry monitoring cron; SSO Settings tab in web UI

**Addresses:** Enterprise SSO (P0 table stake), SAML cert expiry lockout prevention, JIT race condition prevention, OIDC CSRF prevention

**Avoids:** Pitfall 2 (cert expiry), Pitfall 3 (JIT race), Pitfall 11 (OIDC CSRF state validation)

**Research flag:** MEDIUM — if using self-hosted SAML, `@xmldom/xmldom` + `xml-crypto` Workers compatibility must be validated in `wrangler dev` before committing. WorkOS SDK is the zero-risk fallback that eliminates this validation step entirely.

### Phase 2: Frontend Completions (Parallel Sprint)

**Rationale:** Four frontend features wire against already-complete APIs. They share no blocking dependencies on each other and can be built in parallel. Storage Analytics UI depends on the Phase 1 storage scanner performance fix (which can run in parallel as it is a single-file backend change with no frontend dependency).

**Delivers:**
- `DriftSummaryWidget.svelte` on dashboard home — wires to `/api/config-drifts/summary`
- `SnapshotDiffViewer.svelte` — wires to `/api/config-snapshots` diff endpoint
- `/security/copilot` Copilot Readiness page — assessment trigger, score ring, category breakdown, PDF download CTA
- `/governance/storage` Storage Analytics page — quota visualization (bar charts per user/site), recommendations display, inactive user detection

**Addresses:** Config snapshot diff viewer (demo-ready differentiator), Copilot Readiness UI (hot market window), Storage Analytics (P1 parity gap), Drift alerting (dashboard completeness)

**Avoids:** Pitfall 13 (Svelte 5 `$effect` infinite loops — use event handlers for data mutations, not `$effect`; `$derived` for computed values)

**Research flag:** LOW — all APIs return documented shapes; pure SvelteKit 5 / Svelte 5 work following established project patterns; no new libraries required

### Phase 3: Storage Scanner Performance Fix

**Rationale:** The storage scanner has a confirmed CPU-limit defect that makes the Storage Analytics UI non-functional on real tenants past ~30 users. This fix is a single-file backend change but is separated to make the dependency explicit: Storage Analytics UI can be built optimistically in Phase 2, but the feature is not shippable to production until this fix lands.

**Delivers:** Batched `Promise.all` groups of 10 in `scanOneDriveUsage()` and `scanSharePointUsage()`; optional Queue offload for large-tenant scans using the existing Cloudflare Queue infrastructure

**Addresses:** Storage Analytics production reliability

**Avoids:** Pitfall 9 (Workers 30s CPU limit), Pitfall 6 (D1 contention from heavy analytical queries)

**Research flag:** LOW — the fix is a well-documented Workers batching pattern; single-file change

### Phase 4: E2E Coverage + CI Security Hardening

**Rationale:** Four CI security scan jobs (SAST, dep audit, secret scan, license compliance) are required by the portfolio CLAUDE.md security rules but are absent from `ci.yml`. These are release-blocking. E2E specs for SSO login, Copilot Readiness, and Storage Analytics are the highest-priority new Playwright additions. The Pages/Workers deploy sequencing must add a smoke test gate to prevent stale-frontend/new-API mismatches.

**Delivers:** `semgrep`, `audit-ci`, `gitleaks` jobs in `ci.yml` as release-blocking status checks; Playwright specs (`sso-config.spec.ts`, `copilot-readiness.spec.ts`, `storage-analytics.spec.ts`); API version smoke test gate before Pages deploy trigger; auth JWT fixture in `tests/e2e/fixtures/auth.ts`

**Addresses:** Portfolio CLAUDE.md security compliance, E2E coverage breadth, CVE detection (catches samlify <2.10.0 if accidentally downgraded)

**Avoids:** Pitfall 14 (stale frontend against new API schema), CVE-2025-47949 detection

**Research flag:** LOW — Semgrep, audit-ci, and gitleaks are well-documented with copy-paste GitHub Actions configurations; Playwright config for `wrangler pages dev` is confirmed correct pattern

### Phase Ordering Rationale

- SSO backend is first because it is the only net-new backend feature with meaningful external risk (Workers XML parsing, security-critical cert validation, JIT race conditions). Every other backend item in the milestone is a single-file fix.
- Frontend completions are grouped as a parallel sprint because they wire against complete APIs and share no inter-dependencies. Any engineer can pick up any B-task independently.
- Storage scanner fix is separated from the frontend phase to make the dependency explicit and avoid shipping a UI backed by a defective scanner.
- CI hardening closes the milestone because it is a release gate — it requires the other phases to be code-complete to run meaningful E2E tests and coverage checks.

### Research Flags

**Needs validation during implementation:**
- **Phase 1 (SSO Backend):** `samlify` + `@xmldom/xmldom` + `xml-crypto` edge-runtime compatibility requires `wrangler dev` validation before committing to self-hosted path. WorkOS SDK eliminates this risk entirely and is the recommended MVP path.
- **Phase 2 (Copilot UI):** `GET /admin/copilot/apps` (agent inventory) GA status is MEDIUM confidence (MC1173195 message center, not official Learn doc). Verify endpoint accessibility in test tenant before including in readiness checks.

**Standard patterns — skip research-phase:**
- **Phase 2 (other frontend tasks):** All APIs are complete with documented response shapes. Established SvelteKit 5 + Svelte 5 patterns.
- **Phase 3 (storage fix):** Standard Workers batching. Single-file change.
- **Phase 4 (CI hardening):** All tools have official GitHub Actions with documented configurations.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | WorkOS and jose are official CF Workers integrations; CVE-2025-47949 verified on NVD; Semgrep/audit-ci/gitleaks are widely used CI standards |
| Features | HIGH | Competitor analysis from official product sites + G2; SSO as enterprise blocker from multiple independent sources; Copilot API GA status from Microsoft official changelog |
| Architecture | HIGH | Based on direct source code inspection of the actual TenantIQ codebase; all existing implementations confirmed; missing files identified by exact name |
| Pitfalls | HIGH | D1/Workers/KV limits from official Cloudflare docs; SAML cert expiry from production incident analysis; AADSTS700016 corroborated by team's own remit.co.il production experience |

**Overall confidence:** HIGH

### Gaps to Address

- **SAML on Workers runtime validation:** `@xmldom/xmldom` is confirmed Workers-compatible; `xml-crypto` 3.x SubtleCrypto path is documented but not yet tested in this project's miniflare environment. Validate with `wrangler dev` in Phase 1. If it fails, switch to WorkOS immediately — do not attempt to polyfill.
- **WorkOS vs self-hosted unit economics:** Break-even depends on TenantIQ's enterprise ARPU. WorkOS at $125/connection/month is correct for MVP launch; re-evaluate before scaling past 10-15 enterprise orgs.
- **Copilot agent inventory API GA:** `GET /admin/copilot/apps` is MEDIUM confidence for GA status. Do not block Phase 2 on this — implement the other 7 readiness categories and add agent inventory as an optional signal once verified in test tenant.
- **D1 compound indexes:** ARCHITECTURE.md and PITFALLS.md both flag the need for `org_id` + filter-column compound indexes before storage analytics queries add analytical load. Audit `schema-d1.ts` against the indexes listed in PITFALLS.md Pitfall 6 before Phase 3 ships.

## Sources

### Primary (HIGH confidence)
- [jose — Cloudflare Workers support](https://github.com/panva/jose)
- [WorkOS Cloudflare SAML integration docs](https://workos.com/docs/integrations/cloudflare-saml)
- [CVE-2025-47949 — samlify signature wrapping bypass (CVSS 9.9)](https://github.com/advisories/GHSA-r683-v43c-6xqv)
- [microsoft/m365-copilot-automated-readiness-assessment](https://github.com/microsoft/m365-copilot-automated-readiness-assessment)
- [getMicrosoft365CopilotUsageUserDetail v1.0 GA](https://office365itpros.com/2025/10/10/copilot-usage-report-api-ga/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare KV — how KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Microsoft Graph throttling](https://learn.microsoft.com/en-us/graph/throttling)
- [Microsoft Graph quota resource](https://learn.microsoft.com/en-us/graph/api/resources/quota?view=graph-rest-1.0)
- [Microsoft Graph delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [audit-ci — IBM GitHub](https://github.com/IBM/audit-ci)
- [gitleaks-action](https://github.com/gitleaks/gitleaks-action)
- [CoreView features](https://www.coreview.com/microsoft-365-governance-lifecycle-management)
- [CoreView — Corey AI Agent GA March 2026](https://www.coreview.com/news/coreview-corey-ai-agent-for-microsoft-365)
- [Syskit Point — Copilot Readiness](https://www.syskit.com/use-cases/copilot-readiness/)
- [BetterCloud — M365 integration](https://www.bettercloud.com/integrations/microsoft365/)
- [@xmldom/xmldom npm](https://www.npmjs.com/package/@xmldom/xmldom)

### Secondary (MEDIUM confidence)
- [Copilot agent inventory API GA — MC1173195](https://mc.merill.net/message/MC1173195) — agent inventory endpoint GA status
- [WorkOS pricing](https://workos.com/pricing) — $125/connection/month at research date; subject to change
- [SAML cert expiry in production — Scalekit](https://www.scalekit.com/blog/saml-certificates-the-hidden-reason-enterprise-sso-breaks)
- [Semgrep vs CodeQL comparison](https://konvu.com/compare/semgrep-vs-codeql)
- [AADSTS700016 troubleshooting — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2145974/unable-to-authenticate-to-graph-api-using-client-c)
- [G2 — CoreView vs BetterCloud](https://www.g2.com/compare/bettercloud-vs-coreview)
- [SSO as enterprise sales blocker](https://guptadeepak.com/the-enterprise-ready-dilemma-navigating-authentication-challenges-in-b2b-saas/)
- [Cloudflare D1 in production — DEV Community](https://dev.to/whoffagents/cloudflare-d1-sqlite-at-the-edge-after-6-months-in-production-551j)

---
*Research completed: 2026-04-22*
*Ready for roadmap: yes*
