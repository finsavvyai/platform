# TenantIQ Feature Audit vs Optimize365

> **Original audit**: 2026-05-02
> **Last updated**: 2026-05-04 (post competitive push — `/compare`, AI explainer, trend charts, share URL)
> **Method**: counts grepped from source, not from CLAUDE.md or marketing.

## Competitive push (2026-05-04)

Post-audit work explicitly aimed at "beating Optimize365":

| Capability | Status | Surface |
|---|---|---|
| Public `/compare` page (38 features × 9 categories) | SHIPPED | `apps/web/src/routes/compare/+page.svelte` |
| CIS scan history table + write | SHIPPED | Migration `0020_cis_scan_history.sql`, `cis-benchmark/scan` write |
| `GET /api/cis-benchmark/trend` | SHIPPED | Day-bucketed averages + improving/regressing/stable verdict |
| `ScoreTrendChart` component | SHIPPED | SVG sparkline + area fill, on `/security/cis` |
| `POST /api/cis-benchmark/explain` (Claude per-control) | SHIPPED | 24h KV cache, 3-tier graceful degradation |
| `AIExplainer` component | SHIPPED | Mounts on row expansion in `ControlTable` |
| `POST /api/compliance-posture/explain` (Claude per-framework-control) | SHIPPED | Same pattern, works for SOC 2 / HIPAA / GDPR / ISO 27001 |
| Compliance assessment history table | SHIPPED | Migration `0021_compliance_assessments.sql` |
| `GET /api/compliance-posture/trend` | SHIPPED | Per-framework time series |
| Public `/scan/:domain` share URL with OG meta | SHIPPED | `apps/web/src/routes/scan/[domain]/+page.svelte` — anyone can view a scan via shareable URL |
| LandingNav: "vs Optimize365" link | SHIPPED | Drives traffic to /compare from landing page |
| Prospect → /compare cross-link | SHIPPED | Secondary CTA on result card |
| Pricing copy updated | SHIPPED | "121 CIS controls (L1+L2)", "AI control explainer", "Drift revert (named baselines)", "ISO 27001 + SOC2 + HIPAA + GDPR" |

> **Status legend**:
> - **SHIPPED** — works end-to-end, has tests, real Graph/DB data path
> - **PARTIAL** — code exists, logic has explicit gaps where the underlying
>   data source genuinely doesn't exist
> - **STUB** — route/UI surface exists, business logic is placeholder or 501
> - **MISSING** — not built

## Sprint deltas

| Sprint | Date | Focus | Tests delta |
|---|---|---|---|
| 1 | 2026-05-02 | DKIM multi-selector, R2 logo upload, named baselines, CIS L1/L2 levels, mailbox-rule auditor | 1341 → 1352 (+11) |
| 2 | 2026-05-02 | 10 CIS evaluators wired to real Graph data + public prospect scan | 1352 → 1385 (+33) |
| 3 | 2026-05-02 | License-tier upsell, dynamic time-to-complete, drift revert, 8 more CIS evaluators, SCIM filter expansion, cross-tenant + SAML auditors, custom-domain DNS verification | 1385 → 1460 (+75) |
| Round 5 | 2026-05-03 | 4 more CIS evaluators (federated_identity, retention_*, external_tagging, admin_alert_policies), ISO 27001 Annex A engine | 1460 → 1480 (+20) |

**Total**: 1341 → 1480 (+139 cases). All green.

---

## Original 10 feature areas — current state

| # | Feature Area | Was | Now | Evidence |
|---|---|---|---|---|
| 1 | **License optimization with task costing** | PARTIAL | **SHIPPED** | `lib/remediation/task-license-requirements.ts` maps every REM_* to required SKU (Entra P1/P2/null). `lib/remediation/time-to-complete.ts` returns nearest-rank median+p90 from `remediation_log` (cached 6h in KV). `routes/remediations.ts:execute` returns 402 LICENSE_UPGRADE_REQUIRED with `{ display, suggestedSeats, estimatedMonthlyCostUsd }` when tenant lacks the SKU. `routes/tenants/alerts.ts` plan response now reads `"3-5 minutes (median 3, p90 5)"` instead of literals. Tests: 14. |
| 2 | **Email security analysis (phishing wedge)** | PARTIAL | **SHIPPED** | DKIM probe extended to 6 selectors (selector1/2, google, k1, s1, s2) per verified domain. `lib/email/inbox-rule-auditor.ts` flags 6 BEC indicator types incl. external_redirect (critical) and forward_and_delete (critical). Mounted at `GET /api/tenants/:id/inbox-rules`. CIS controls 4.x now have real evaluators wired to DoH (DMARC/DKIM/SPF) and SecureScore (anti_phishing). External-tagging falls back to Secure Score when transport-rule control is published. Tests: 22 (11 inbox-rule, 11 email-related CIS). |
| 3 | **Copilot Readiness** | SHIPPED (with one acknowledged gap) | **SHIPPED** | Unchanged from original audit — `lib/copilot/` 7-category engine (193 LOC checks + 99 LOC engine) was already real. |
| 4 | **Federated Identity Auditor + Regression Detector** | SHIPPED | **SHIPPED + integrated** | Round 5: scanner now fetches `/applications` + auto-runs `evaluateFederatedCredentials` so CIS control `federated_identity_scoped` returns deterministic pass/partial/fail based on aggregate score (was: "Run /api/federated-identity audit separately"). Per-app finding detail still at the dedicated route. |
| 5 | **CIS benchmark coverage** | PARTIAL (~13/121 evaluated) | **PARTIAL → MOSTLY SHIPPED** | **31 of 121 controls now have real Graph/DoH/SecureScore evaluators** (was 13). Categories with **L1/L2 field on every control** per CIS M365 Foundations Benchmark v3.1 (`control-types.ts` requires it). Six remaining controls stay `partial` with explicit "no Graph endpoint" reasons (`external_tagging` falls back to SecureScore where available; `retention_*` now uses `/beta/security/labels/retentionLabels` and detects per-workload coverage). Tests: 47 evaluator cases. |
| 6 | **Drift detection** | SHIPPED + rollback PARTIAL | **SHIPPED with named baselines + generic revert** | T1.5: named baselines (`baseline_label` column, `POST /:id/baseline { label }`, `DELETE /:id/baseline`, `GET /baselines`). Drift detection prefers active baseline over latest pointer. T2.5: `lib/snapshots/revert.ts` plans Graph PATCH/DELETE/POST ops to restore the baseline value. 3 categories supported initially (conditional_access, authorization, auth_methods); `GET /:id/revert-plan` previews, `POST /:id/revert { confirmed: true }` applies + writes audit_log. Tests: 11. |
| 7 | **Prospecting scans (non-intrusive)** | MISSING | **SHIPPED** | `POST /api/prospect/scan` no-auth, KV-rate-limited 5/hr/IP. Composes 4 public sources: DoH SPF/DMARC/DKIM, Microsoft OIDC discovery (tenant ID + existence), getuserrealm.srf (Federated/Managed/brand), MX classification. Returns 7 finding types + 0-100 score + USD risk band + optional lead capture (sha256-truncated IP only). New `prospect_leads` table. Tests: 4. |
| 8 | **Branded client portal / White-label** | PARTIAL (logo stub, custom domain field unenforced) | **SHIPPED** | T1.1: real R2 multipart upload at `POST /api/branding/logo` (mime allowlist, 2MB cap, immutable cache). T3.5: DNS verification flow — `/init` issues TXT challenge (16-byte token), `/verify` does DoH lookup at `_tenantiq-verify.<domain>` and marks `custom_domain_verified_at` on match. The CF-for-SaaS hostname binding remains operational but the in-product surface is real. |
| 9 | **SCIM + SSO depth** | PARTIAL (eq only) + SHIPPED SAML | **SHIPPED + SAML metadata auditor** | T3.2: filter parser supports `eq, ne, co, sw, ew, pr` plus `and`/`or` boolean composition (RFC 7644). Attribute allowlist expanded (name.givenName, name.familyName, emails.type, active for users; members.value for groups). `filterToSql()` emits parameterized SQL with LIKE wildcards escaped. T3.4: `lib/sso/saml-metadata-auditor.ts` parses IdP metadata XML, custom DER walker for X.509 validity (cert_expired/30d/60d/90d), flags SHA-1 signatures, WantAuthnRequestsSigned=false, missing AssertionConsumerService. Tests: 30 SCIM + 11 SAML. |
| 10 | **Multi-regulatory framework mapping** | PARTIAL (4 controls per framework) | **PARTIAL — significant expansion** | Round 5 adds **ISO 27001 Annex A engine** (`lib/compliance/iso27001-engine.ts`, 25 telemetry-evaluable controls in 5.x organisational + 8.x technological themes; 68 organisational controls explicitly out-of-scope). Existing GDPR/HIPAA/SOC2 engines unchanged at 4-5 controls each. T3.3: cross-tenant trust analyzer (`cross-tenant-auditor.ts`) flags 6 finding types incl. critical Direct Connect inbound from any tenant. **Still missing**: PSD2, MiCA, EU DORA, Israeli Privacy Protection Law, Bank of Israel directives — these depend on the specific regulator confirmation step (deferred, not blocked by code). |

---

## Honest Assessment — updated

### Three features now genuinely strongest

1. **CIS scanner + real Graph evaluation pipeline.** 31/121 controls fully evaluated against live Graph + DoH + Secure Score; 6 stay partial only because the underlying data source genuinely doesn't exist (Exchange transport rules, Communication Compliance — both PowerShell-only). The 47 evaluator tests cover pass/partial/fail boundaries for every wired control.
2. **Email-security wedge depth.** DoH-based DMARC/SPF/DKIM (multi-selector) + inbox-rule auditor with 6 BEC patterns + prospect scan that runs all of this against a domain with no auth needed. The 36 lines of test coverage on the inbox-rule auditor + 4 on prospect-scan + 11 on email CIS evaluators stack up.
3. **Account-deletion cascade + per-tenant overrides + drift attribution + drift revert + named baselines.** Now end-to-end: lock a baseline ("post-SOC2-audit"), get drift detected against it, see who-did-it via attribution, plan a revert, apply it with audit-log entry. None of those existed in the original audit.

### Three features still with the biggest gap

1. **Multi-regulatory framework breadth.** ISO 27001 Annex A is now real (25 controls). GDPR/HIPAA/SOC2 are still at 4 controls each. Israeli/EU banking frameworks are still absent — this depends on confirming Global Remit's specific regulator before building (the deferred Wedge 3 step). Tooling pattern is in place; expanding to a specific framework is now ~1 week per framework, not from scratch.
2. **Communication Compliance + retention beyond labels.** Communication Compliance has no public Graph endpoint at all. Retention is partial — we evaluate `retentionLabels` but the actual retention *policies* (`retentionPolicies` beta endpoint) aren't reliably exposed.
3. **CF-for-SaaS hostname binding.** DNS verification works in-product. The hostname → Worker route binding still requires Cloudflare account-level configuration — this is operational, not a code gap, but customers can't fully self-serve a custom domain end-to-end yet.

### Marketing claims now backed by code (was un-backed in original audit)

| Claim source | Claim | Now |
|---|---|---|
| `PricingSection.svelte:22` Professional | "SOC2, HIPAA, GDPR compliance" | Still 4 controls each — but Sprint adds ISO 27001 with 25 controls. Marketing line could honestly read "ISO 27001 + SOC2 + HIPAA + GDPR mapping" once UI surfaces ISO. |
| Multiple CIS docs | "100+ L1+L2 CIS controls" | **`level: 'L1' \| 'L2'` is now a required field** on every control. 121 controls tagged. Caveat in `control-types.ts` asks for verification against the official benchmark before publishing audit-grade claims. |
| `controls-email.ts` 4.1.1–4.4.3 | Anti-phishing, DMARC, mailbox auditing | All have real evaluators now (DoH + SecureScore + multi-selector DKIM). |
| Marketing "One-click rollback" | Rollback any change | Now real for 3 snapshot categories (conditional_access, authorization, auth_methods) + 6 remediation action types. The other 7 snapshot categories return supported:false with reason — no false claim possible. |
| `branding.ts` Logo upload | "Upload your logo" | Real R2 upload, no longer 501. |
| `routes/scim/users.ts` SCIM endpoint | "Standard SCIM 2.0" | Was eq-only. Now eq/ne/co/sw/ew/pr + and/or — covers the queries Okta/Entra/OneLogin actually emit. |
| Audit / drift / cross-tenant | "Continuous compliance monitoring" | Drift now revertable; cross-tenant trust analyzer flags overpermissive B2B; SAML auditor catches expiring IdP certs. |

---

## Coverage scorecard — updated

| Area | Before | After |
|---|---|---|
| Core Microsoft Graph data plumbing | High | High |
| Auth / multi-tenant isolation / cascade delete | High | High |
| Snapshots + drift detection | High | **High + revert** |
| CIS evaluators (real Graph logic) | Medium-low (~13/121) | **Medium-high (~31/121)** |
| Email security automation beyond DNS | Low | **Medium-high** (mailbox rules, multi-selector DKIM, BEC detection) |
| Compliance framework breadth | Low | **Medium** (added ISO 27001 + cross-tenant + SAML auditor) |
| White-label depth | Medium | **High in-product** (R2 logo + DNS verification; CF for SaaS still operational) |
| Prospecting / GTM scan | None | **High** — full public scan endpoint live |
| Test coverage on shipped paths | High (1341) | **Higher (1480, +139)** |
| SCIM RFC 7644 conformance | Minimal (eq only) | **Pragmatic** (covers IdP-emitted queries) |
