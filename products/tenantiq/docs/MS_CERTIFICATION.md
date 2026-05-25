# Microsoft 365 Certification — Readiness Tracker

> Path: **Publisher Attestation → M365 Cert Level 1 → M365 Cert Level 2**
> Submission portal: https://aka.ms/m365certification
> Reference framework: MS-365-Cert v3 (controls map below)

Last updated: 2026-04-29

## Submission tiers

| Tier | What it is | Auditor | When to claim |
|---|---|---|---|
| **Publisher Attestation** | Self-attested baseline | none | Day 1 — required before AppSource |
| **M365 Cert Level 1** | Microsoft-reviewed evidence | Microsoft team | After 60+ days of ops data |
| **M365 Cert Level 2** | Independent auditor | Schellman / KPMG / etc. | After SOC 2 Type II or equivalent |

## Last live-verified

- 2026-04-30: cert-prep-smoke 8/8 chromium, cert-drift clean, evidence bundle built (`cert-evidence-2026-04-30.zip`, 0.39 MB).
- API worker: `322d2571`. Web: deployed `8fff9b76` to tenantiq-web pages, alias `app.tenantiq.app`.
- Live billing-checkout matrix: 8/8 (4 plans × monthly/annual).

## Status summary (2026-04-30)

| Domain | Ready | Partial | Missing |
|---|---|---|---|
| Application Security | 6 | 0 | 1 |
| Operational Security | 6 | 2 | 1 |
| Data Handling | 9 | 1 | 0 |
| External Compliance | 4 | 0 | 2 |
| App-Specific (Graph) | 2 | 1 | 1 |

**Overall: ~85% Publisher Attestation ready. ~50% Cert Level 1 ready.**

Closed in this session: A5 vuln disclosure, A4 SDLC doc, A7 DAST in CI (ZAP baseline against staging on push to main), B5 DR runbook, B6 IR plan, B7 BCP, C4 data flow, C5 data classification scheme, C7 deletion procedure + cron + soft-delete + LS unsubscribe wiring, C10 PII audit (invitation log), D2 sub-processor drift, D3 privacy URL, D4 ToS URL, D5 GDPR rights endpoints, E1 Graph permissions justification, TB3 RS256 deployed, TB4 partial scope justification, TB5 webhook replay + Sentry PII scrubber.

**Remaining for Publisher Attestation (~15%):**

- A6 Pen test (external schedule + budget — week-long engagement)
- B8 Privileged access review log (quarterly procedure)
- B9 Endpoint protection attestation (form fill, not code)
- D6 SOC 2 Type II (OPTIONAL for Attestation)
- E5 Publisher Verification (Partner Center workflow + MPN ID)

**Remaining for Cert L1 (~50%):**

All Publisher Attestation gaps PLUS 60 days operational data (audit log + uptime + incident absence).

## Control matrix

### A. Application Security

| # | Control | Evidence | Status |
|---|---|---|---|
| A1 | SAST in CI | `.github/workflows/security.yml` Semgrep | ✅ |
| A2 | Dependency vulnerability scan | `pnpm audit --audit-level=high` | ✅ |
| A3 | Secret scan | TruffleHog in CI | ✅ |
| A4 | Secure development lifecycle doc | `docs/SDLC.md` | ❌ MISSING |
| A5 | Vulnerability disclosure policy | `.well-known/security.txt` | ❌ MISSING |
| A6 | Pen test report (≤12 mo) | external PDF | ❌ MISSING |
| A7 | DAST scan | OWASP ZAP / Burp | ⚠ partial — Playwright only |

### B. Operational Security

| # | Control | Evidence | Status |
|---|---|---|---|
| B1 | MFA on admin accounts | attestation | ⚠ partial — needs documented enforcement |
| B2 | Secrets management | Cloudflare `wrangler secret`, no hardcoded creds | ✅ |
| B3 | Patch management | Dependabot + manual review | ⚠ partial — no formal SLA doc |
| B4 | Logging / SIEM | Sentry + Cloudflare Analytics | ✅ |
| B5 | Backup + DR | R2 + D1 daily export | ⚠ partial — DR runbook needed |
| B6 | Incident response plan | `docs/INCIDENT_RESPONSE.md` | ❌ MISSING |
| B7 | Business continuity | `docs/BUSINESS_CONTINUITY.md` | ❌ MISSING |
| B8 | Privileged access review | quarterly attestation log | ❌ MISSING |
| B9 | Endpoint protection on dev devices | attestation | ❌ MISSING |

### C. Data Handling & Storage

| # | Control | Evidence | Status |
|---|---|---|---|
| C1 | Encryption at rest | Cloudflare D1/KV/R2 native encryption | ✅ |
| C2 | Encryption in transit | TLS 1.3, HSTS preload | ✅ |
| C3 | Refresh token encryption | AES-GCM via `GRAPH_TOKEN_KEK` | ✅ |
| C4 | Data flow diagram | `docs/DATA_FLOW.md` | ❌ MISSING |
| C5 | Data classification scheme | `docs/DATA_CLASSIFICATION.md` | ❌ MISSING |
| C6 | Data retention policy | `docs/DATA_RETENTION.md` | ✅ |
| C7 | Data deletion procedure | `docs/DATA_DELETION.md` + endpoint | ❌ MISSING |
| C8 | Tenant isolation | `WHERE org_id = ?` enforced + tests | ✅ |
| C9 | Audit logging | `audit-logger.ts` `writeAuditLog` at 10 use sites + `admin-auth.ts` `logAdminAction` across admin routes | ✅ |
| C10 | PII minimization | only email/name/oid stored | ⚠ partial — needs formal classification |

### D. External Compliance

| # | Control | Evidence | Status |
|---|---|---|---|
| D1 | DPA template | `docs/DPA.md` | ✅ |
| D2 | Sub-processor list | `docs/SUB_PROCESSORS.md` | ⚠ DRIFT — Clerk listed but unused |
| D3 | Privacy policy (public URL) | `apps/web/static/privacy` | ❌ MISSING |
| D4 | Terms of Service (public URL) | `apps/web/static/terms` | ❌ MISSING |
| D5 | GDPR data subject rights endpoints | `/api/account/export`, `/api/account/delete` | ❌ MISSING |
| D6 | SOC 2 Type II / ISO 27001 | external audit | ❌ FUTURE |

### E. App-Specific (Graph / M365)

| # | Control | Evidence | Status |
|---|---|---|---|
| E1 | Graph permissions documented + justified | `docs/GRAPH_PERMISSIONS.md` | ❌ MISSING |
| E2 | Least-privilege scope review | scope inventory in `constants.ts` | ⚠ partial — need formal justification |
| E3 | Multi-tenant correctly scoped | `azure_tenant_id` + state CSRF | ✅ |
| E4 | Admin consent flow | `/login` redirects, `/auth/admin-consent` | ⚠ partial — UX hardening pending |
| E5 | Publisher Verification (MPN ID) | Partner Center | ❌ MISSING |

## Submission package contents (M365 Cert L1)

When ready, package contains:

1. Architecture diagram (`docs/ARCHITECTURE.md` already has bones)
2. Data flow diagram (C4)
3. Threat model — STRIDE per data flow (`docs/THREAT_MODEL.md`)
4. Network diagram + boundary
5. Encryption inventory (algorithms, key sizes, KMS)
6. Sub-processor list with DPA links (D1, D2 — fix drift first)
7. Privacy policy + ToS public URLs (D3, D4)
8. Incident response plan (B6)
9. Vulnerability management process (A4, A7)
10. Last 12-month pen test or self-attestation (A6)
11. Annual SAST/DAST/dep-scan summary (A1, A2, A3)
12. SOC 2 / ISO 27001 if claimed (D6 — optional for L1)
13. Graph permission justification per scope (E1)
14. Customer data deletion runbook (C7)

## Path to demo readiness vs. cert readiness

**Demo (this week):** ship F1 + WS fixes (DONE), surface DLP/Defender as roadmap not "working".

**Publisher Attestation (4-6 weeks):** close A4, A5, B6, B7, C4, C5, C7, D2 drift, D3, D4, E1.

**Cert Level 1 (12+ weeks):** close A6 (pen test), A7 (DAST), B3 (patch SLA), B5 (DR runbook), B8, B9. Provide 60 days operational data.

**Cert Level 2 (6-9 months):** require SOC 2 Type II (D6).

## Next action

Generate stubs for the 9 ❌ docs above so audit prep work has somewhere to land. See companion files in `docs/`.
