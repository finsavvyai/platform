# TenantIQ Threat Model — STRIDE on Graph API surface

For Microsoft 365 Certification Phase 5 evidence package.

Last updated: 2026-05-08
Approach: STRIDE per data flow.

## System overview

TenantIQ is a multi-tenant SaaS that:
1. Authenticates MSP staff via Microsoft OAuth
2. Receives admin consent from the MSP's customer tenants
3. Pulls Graph API data periodically (cron) and on-demand
4. Stores audit results in Cloudflare D1 scoped per `org_id`
5. Exposes a UI + API to the MSP for cross-tenant management
6. Optionally exposes posture data via MCP server to AI clients (Claude Desktop, Cowork)

## Data flow diagram (text)

```
┌─────────────┐     OAuth     ┌──────────────┐
│ MSP user    ├──────────────►│ Web (Pages)  │
│ (browser)   │   session     │ app.tenantiq │
└──────┬──────┘   cookie       └───────┬──────┘
       │                                │
       │  fetch /api/*                  │  static assets
       ▼                                ▼
┌──────────────────────────────────┐  ┌───────────┐
│ API (Workers)  api.tenantiq      │  │ R2 (CDN)  │
│   - JWT verify (HS+RS256, JTI)   │  └───────────┘
│   - tenantScopingMiddleware      │
│   - Graph API client (per tenant)│
└────┬───────────┬─────────┬───────┘
     │           │         │
     ▼           ▼         ▼
┌─────────┐  ┌──────┐  ┌──────────────┐
│ D1      │  │ KV   │  │ Microsoft    │
│ org-    │  │ TTL  │  │ Graph API    │
│ scoped  │  │ cache│  │ /v1.0/users  │
└─────────┘  └──────┘  │ /policies    │
                       │ /security    │
                       └──────────────┘
                       │
                       │
              ┌────────▼────────┐
              │ Customer M365   │
              │ tenant          │
              └─────────────────┘
```

External: AppSource Marketplace → /api/marketplace/webhook (Microsoft → TenantIQ).

## Trust boundaries

1. **Browser ↔ Web (Pages)** — TLS, HSTS, CSP enforced.
2. **Web ↔ API** — Same-site session cookie + JWT bearer fallback. CORS limits to `app.tenantiq.app`.
3. **API ↔ Microsoft Graph** — Per-customer-tenant access tokens, never shared. Token cache keyed by tenant ID.
4. **API ↔ AppSource Marketplace** — Microsoft-signed JWT (verified via marketplaceapi roundtrip), application token via client_credentials.
5. **API ↔ Anthropic** — Anthropic API key (Wrangler secret). Outbound only.
6. **MCP clients ↔ API** — Bearer `tiq_*` API key, SHA-256 hashed at rest. Per-key org + role binding.

---

## STRIDE analysis

### S — Spoofing identity

| Threat | Mitigation | Source |
|---|---|---|
| Attacker forges JWT to impersonate MSP user | HS256+RS256 dual-alg verify with `iss`+`aud` claims; JTI deny-list KV check | `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/auth-session.ts` |
| Attacker replays expired session cookie | Cookie expires server-side via `exp` claim + JTI revocation on logout | `apps/api/src/routes/auth.ts` |
| Customer admin clicks phishing consent link masquerading as TenantIQ | Microsoft Verified Publisher badge (Phase 1 of partner roadmap) shows `tenantiq.app` is verified | Phase 1 partner plan |
| Spoofed AppSource marketplace webhook | Verify operationId roundtrip with Microsoft's marketplace API; spoofs fail because Microsoft can't confirm a fake operation | `apps/api/src/lib/marketplace/microsoft-api.ts:verifyWebhookOperation` |
| MCP key reused across orgs | Each `tiq_*` key bound to a single `org_id` + role at issuance; SHA-256 hash stored, plaintext shown once | `apps/api/src/routes/mcp-keys.ts` |

### T — Tampering with data

| Threat | Mitigation | Source |
|---|---|---|
| SQL injection via API parameter | Drizzle ORM uses prepared statements; raw SQL in route files uses `?` bind parameters exclusively (audited) | `packages/db/src/queries/` |
| Cross-tenant read by manipulating `tenant_id` in URL | `tenantScopingMiddleware` adds `WHERE org_id = c.get('orgId')` to every query; verified by org-scoping tests | `apps/api/src/middleware/tenant-scoping.ts` |
| Tampering with audit log entries | Audit logger writes append-only with ISO timestamps; D1 has no `UPDATE` permissions on `audit_logs` (enforced by query layer) | `apps/api/src/lib/audit-logger.ts` |
| Modifying drift evidence to hide an attacker's changes | Drift snapshots are immutable per snapshot ID; new drifts create new rows; deletion requires admin role + leaves audit trail | `apps/api/src/lib/snapshots/` |
| MITM on API call | TLS 1.3 + HSTS preload; cert-pinning in mobile app (when shipped) | TLS layer |

### R — Repudiation

| Threat | Mitigation | Source |
|---|---|---|
| User denies they triggered a remediation | Every `runRemediation` writes to `remediation_log` with `actor_user_id`, `actor_email`, `tenant_id`, `timestamp`, `dry_run`, `outcome`, `rollback_id?` | `apps/api/src/lib/remediation/` |
| Admin denies they granted a tier upgrade | `platform_admin grant-tier` operations audit-logged with before/after billing plan | `apps/api/src/routes/platform/admin/credentials.ts` |
| Customer denies they consented to permissions | Microsoft's own consent screen records the consent event; we reflect it via Graph API `oauth2PermissionGrants` | Microsoft Identity audit trail |
| Drift reverter denies they applied a change | `agent_actions` table records every Claude-driven action with full payload + outcome; powers the live counter at `/leaderboard` | `apps/api/src/routes/agent-actions.ts` |

### I — Information disclosure

| Threat | Mitigation | Source |
|---|---|---|
| Cross-tenant data leak via missing scoping | Auto-enforced via `tenantScopingMiddleware`; manual SQL must include `org_id` predicate; lint rule on raw `prepare(` calls | Middleware + code review |
| Logs leak PII | Sentry scrubber strips emails, IPs, tenant IDs from breadcrumbs; logged JSON has named fields not blob dumps | `apps/api/src/lib/sentry.ts` |
| Stack traces in error responses leak file paths | Production error handler returns `{error, requestId}` only; full trace in Sentry, not response body | `apps/api/src/app/error-handler.ts` |
| Token leak via referrer header | `Referrer-Policy: strict-origin-when-cross-origin` set | Layout headers |
| Marketplace token replay | Tokens have short TTL; resolve endpoint short-cache (10 min) for landing-page UX, no longer | `apps/api/src/routes/marketplace.ts:/resolve` |
| Search engine indexing of sensitive pages | `meta robots noindex` on /marketplace/landing, /platform/admin/*, /settings | Meta tags in route components |
| Sub-processor change without disclosure | `scripts/check-cert-drift.ts` fails CI when sub-processors mentioned in code don't match `/privacy` page | Cert-drift check |

### D — Denial of service

| Threat | Mitigation | Source |
|---|---|---|
| Rate-limit bypass on public scan | KV-backed bucket per IP, 5/hr; exceeded returns 429 with retry-after | `apps/api/src/lib/rate-limit.ts` |
| Compute exhaustion via expensive AI calls | Anthropic calls have a 30s timeout + Smart Router fallback to cheaper models; KV-cached per-control explainers (24h TTL) | `apps/api/src/lib/ai-anthropic.ts`, `apps/api/src/lib/smart-router.ts` |
| D1 lock contention from cross-tenant cron jobs | Crons stagger via random jitter; per-tenant locks via KV `lock:` prefix with TTL | `apps/api/src/cron/` |
| Marketplace webhook flood | Microsoft delivers webhooks; rate-limit on /webhook by source IP via Cloudflare | Cloudflare WAF |
| MCP tool call flood from a single key | KV bucket per `mcp-key` SHA hash | `apps/api/src/lib/rate-limit.ts` |

### E — Elevation of privilege

| Threat | Mitigation | Source |
|---|---|---|
| Tenant_engineer escalates to platform_admin | Role enforced at middleware layer + checked again at sensitive routes; can't be set from client | `apps/api/src/middleware/auth.ts` |
| Customer admin escalates within their tenant | Out of scope — that's M365's responsibility; we don't re-check Microsoft's role assignments |
| MCP key escalation | Keys bind to a single role at creation; modifying role requires admin auth + audit-log entry | `apps/api/src/routes/mcp-keys.ts` |
| GDAP relationship escalation | Partner Center Graph endpoints honor delegated admin role IDs; we don't re-implement GDAP logic, we wrap Microsoft's | `apps/api/src/lib/partner-center/graph-client.ts` |
| AppSource webhook elevates an org tier without payment | Webhook only updates billing plan if Microsoft confirms operation via `verifyWebhookOperation`; no operationId = no plan change | `apps/api/src/routes/marketplace.ts:/webhook` |
| OAuth state CSRF | State parameter with KV-backed `oauth-state:` key; org-id stash carried through admin-consent flow | `apps/api/src/routes/auth-callback.ts` |

---

## Out-of-band threats

- **Malicious skill submission** (skill marketplace) — current skills are first-party only; third-party submission requires sandboxed execution + manual review (out of scope for v1).
- **Credential theft of Wrangler/CF API token** — would let attacker deploy to production. Mitigated by GitHub Actions OIDC for deploys + 2FA on the CF account. Not yet using OIDC; planned.
- **Compromised Anthropic API key** — would let attacker run inference on our budget. Mitigated by spend caps in Anthropic console + alerting.
- **Sub-processor compromise** (Cloudflare, Anthropic, Resend, Sentry) — accepted residual risk per the sub-processor list at `/privacy`.

## Continuous validation

- Daily prod smoke via GitHub Actions (`cert-status.yml`)
- 1590+ unit tests gating every PR
- No-bluf scans verify every commit's claims
- Cert-drift check fails CI on sub-processor list mismatches
- Monthly review of audit logs for anomalies (manual)

## Acceptance for M365 Certification

This threat model + the Publisher Attestation answers + SOC 2 Type 1 (Phase 4) + pen test report (Phase 4) form the evidence package for Phase 5 M365 Certification.
