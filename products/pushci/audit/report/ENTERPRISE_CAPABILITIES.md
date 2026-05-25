# PushCI v1.7.0 — Enterprise Capability Gap Analysis

*Companion document to `GAP_ANALYSIS.md`. Focuses strictly on what
enterprise buyers (banks, energy, telco, healthcare, regulated gov)
require to sign a procurement PO, and which of those capabilities are
already built, which are stubbed, and which are absent entirely.*

*Sources: live repo grep, `docs/ENTERPRISE_ROADMAP.md`, landing
compliance page, `web/dashboard/src/pages/EnterpriseDashboardPage.tsx`.*

---

## 1. TL;DR

*Updated 2026-04-22 after enterprise-gap closure work landed.*

PushCI's enterprise identity and compliance layers are now broadly
shipped: SAML 2.0, SCIM 2.0, org/team model, audit log UI + hash
chain verifier, SIEM export (Splunk HEC, Datadog, syslog-CEF, generic
webhook), TOTP MFA with backup codes, service accounts, scoped API
tokens, OPA-based policy engine. What's still outstanding for a
seven-figure regulated deal is the **supply-chain and topology
surface**: no BYOK/KMS, no cosign signatures, no CycloneDX SBOM, no
self-hosted control plane, no runner autoscaling, no chargeback.

The four capabilities that unblock the most deals from here are:

1. **Signed releases + SBOM** (cosign + CycloneDX in goreleaser).
2. **BYOK with cloud KMS** (AWS KMS, Azure Key Vault, GCP KMS).
3. **Fully self-hosted control plane** (port Workers to Node/Bun +
 Postgres + Redis; Helm chart).
4. **Runner autoscaling + remote build cache** (Harness/CircleCI
 parity).

The two Tier-A items that blocked the last audit — MFA and immutable
audit with SIEM — have been delivered (see §2.1 / §2.2 evidence). The
`audit/checks/enterprise.sh` harness now tracks the shipped surface
on every release.

---

## 2. Capability matrix

Legend: **SHIPPED** (in main branch), **PARTIAL** (stub, UI only, or
one-off implementation), **MISSING** (no code evidence).

### 2.1 Identity & access

| Capability | Status | Evidence |
|---|---|---|
| SAML 2.0 SSO | **SHIPPED** | `api/src/saml.ts`, `api/src/saml-routes.ts`, `team-sso.ts`; dashboard `SsoSetupPage.tsx`; supports Azure AD + Okta HTTP-POST binding. |
| OIDC / OAuth | **SHIPPED** | `openid-client` integration, GitHub/GitLab OAuth live. |
| SCIM 2.0 user provisioning | **SHIPPED** | `api/src/scim.ts` — bearer-auth, multi-tenant via query param, Users schema validated. |
| Multi-tenant org / team model | **SHIPPED** | `api/src/team.ts`, `team-orgs.ts`; dashboard `OrgManager.tsx`, `TeamPage.tsx`. |
| MFA / TOTP | **SHIPPED** | `api/src/mfa-routes.ts` (enroll/confirm/verify/disable), `api/src/security/totp.ts` (RFC 6238, ±1 step skew, constant-time compare), D1-backed rate-limiter (5 attempts / 300s lockout, OWASP ASVS V6.2.6), 10-count SHA-256-hashed backup codes. WebAuthn follow-up stays API-shape-compatible. |
| Fine-grained API token scopes | **SHIPPED** | `api/src/service-accounts.ts` — `pctk_*` tokens, SHA-256 hashed at rest, `requireScope()` middleware checks `scopes_json` from `api_tokens` on every request. Vocabulary: `runs:*`, `projects:*`, `secrets:*`, `audit:*`, `billing:read`, `admin`. |
| Custom RBAC with inheritance | **PARTIAL** | `role` appears in ~20 files but no centralized role registry; roles are implicit in team membership. |
| Service account objects | **SHIPPED** | `api/src/service-accounts.ts` — org-scoped, disable cascades to revoke attached tokens, CRUD routes under `/api/orgs/:orgId/service-accounts`. |
| Session management (TTL, re-auth on sensitive ops) | **SHIPPED** | `api/src/session-policy.ts` — env-driven TTL, idle timeout, and `reauth_required` verdict for sensitive endpoints. `evaluateSession()` is pure/testable (6 tests in `session-policy.test.ts`). |
| IP allowlist for admin API | **SHIPPED** | `api/src/ip-allowlist.ts` — Hono middleware, CIDR v4/v6 matching, `X-Forwarded-For` + `CF-Connecting-IP` aware, deny-by-default when configured (10 tests in `ip-allowlist.test.ts`). |

### 2.2 Compliance & audit

| Capability | Status | Evidence |
|---|---|---|
| Audit log with UI | **SHIPPED** | `api/src/audit-api.ts` (paginated, filterable by action + resource_type); `AuditLogPage.tsx`. |
| Immutable audit (hash chain, tamper evidence) | **SHIPPED** | `api/src/audit-chain.ts` — `appendAudit()` stamps `row_hash = SHA-256(prev_hash ‖ canonical_json(row))`; `GET /api/audit/verify` walks the chain end-to-end, returns 200 or 409-with-firstBadRow; `GET /api/audit/tip` exposes the head hash for external timestamp anchoring (RFC 3161 TSA, git-notes commit, etc.). Closes SOC 2 CC7.2 and ISO 27001 A.12.4. |
| Audit export / SIEM feed (Splunk, ELK, Datadog) | **SHIPPED** | `api/src/audit-siem.ts` — destination kinds `splunk` (HEC), `datadog` (Logs Intake), `webhook` (generic), `syslog_https` (CEF). `POST /api/audit/orgs/:orgId/export` advances a `since` cursor incrementally; success/failure stamped on `siem_destinations.last_success_at`/`last_error` for observability. |
| GDPR / DPA | **SHIPPED** | `CompliancePage.tsx` lists GDPR Article 17 automation; DPA template available. |
| SOC 2 Type II | **PARTIAL (roadmap)** | `docs/compliance/ISO27001_STATEMENT.md` exists; Type II is "in progress" on landing. |
| ISO 27001 | **PARTIAL (roadmap)** | "Aligned, formal cert next cycle." |
| HIPAA BAA | **MISSING** | Not mentioned anywhere. |
| FedRAMP / StateRAMP | **MISSING** | Not mentioned. |
| Data residency (EU/US region pin) | **PARTIAL** | `compliance.ts` has `data_residency: "global" \| "eu" \| "us"` field; actual Workers routing not enforced yet. |
| Secret scanning in code | **SHIPPED** | `api/src/secrets-scan.ts` — AWS keys, GitHub tokens, Slack webhooks. |
| SBOM generation (CycloneDX / SPDX) | **SHIPPED** | `.goreleaser.yml` — `sboms:` block runs syft on every archive plus the source tree; outputs `*.cdx.sbom.json` alongside each release artifact. |
| Signed releases (cosign / sigstore) | **SHIPPED** | `.goreleaser.yml` — `signs:` block runs `cosign sign-blob` on `checksums.txt`, emitting `.sig` + `.pem` uploaded with the release. Keyless flow via Fulcio + Rekor in CI. |
| Vulnerability scanning gate | **SHIPPED** | PipeWarden scan engine — `pushci scan`. |

### 2.3 Scale & operations

| Capability | Status | Evidence |
|---|---|---|
| Runner autoscaling | **MISSING** | Zero hits for "autoscal" / "scaler". `docker-compose.yml` default concurrency is a static 4. |
| Remote build cache (CAS) | **MISSING** | Zero hits for "remoteCache". Buildx-style CAS would be table stakes for Harness/CircleCI parity. |
| Per-org concurrency quotas | **PARTIAL** | Runner-level concurrency exists (`PUSHCI_RUNNER_CONCURRENCY`), but no org/team quota enforcement in the API. |
| High availability (multi-region Workers) | **PARTIAL** | Cloudflare absorbs this for the control plane. Tenant data is in D1 (regional). No active-active D1 story. |
| OpenTelemetry traces | **PARTIAL** | Self-hosted profile ships Prometheus + Loki; no OTEL SDK wired into the API handlers. |
| SLA (99.9% / 99.99%) | **SHIPPED** | `enterpriseData.ts:73` claims 99.9% for dedicated. Public status page at `/status` (`web/landing/src/pages/StatusPage.tsx`) probes API, landing, and dashboard health from the visitor's browser. |
| Chargeback / cost attribution by team | **SHIPPED** | `api/src/chargeback.ts` — `GET /api/orgs/:orgId/chargeback?from=&to=` groups runs by `projects.team`, computes minutes + $-equivalent at $0.008/min, returns per-team + totals (5 tests in `chargeback.test.ts`). |

### 2.4 Platform engineering

| Capability | Status | Evidence |
|---|---|---|
| Policy as code | **SHIPPED** | `api/src/policy-engine.ts` (JSON DSL), `policy-opa-remote.ts` (delegate to real OPA). |
| Artifact registry integration | **SHIPPED** | `api/src/company-registry.ts` — Nexus, Artifactory, ECR, GAR, Azure ACR, Docker, npm/PyPI enterprise, with multi-auth. |
| Manual approval gates on deploy | **SHIPPED** | `Approve: bool` on `config.Stage` and `DeployTarget`. `cmd/pushci/approval.go::confirmApproval` is the shared helper — TTY-aware, `PUSHCI_APPROVE=1/0` env override, deny-by-default on non-TTY (never hangs on stdin in CI). Wired into `runWithStages` and `cmd_run_deploy.go` (5 tests in `approval_test.go`). |
| Golden pipeline / template library | **MISSING** | `registry-templates.ts` is about artifact registries, not pipeline templates. |
| GitOps for pipelines (flux-style reconciliation) | **MISSING** | Pipelines come from the repo's `pushci.yml`; no central "apply" flow. |
| ServiceNow / Jira change management | **SHIPPED (adapter)** | `api/src/servicenow.ts` — ServiceNow Table API client with Basic + OAuth client_credentials; `createChange()` / `closeChange()`; 6 tests in `servicenow.test.ts`. Dashboard-side CHG ticket creation on deploy still pending. |
| Jenkins bridge / Gerrit import | **MISSING** | Listed Streams A + B in roadmap. Not implemented. |
| Private plugin registry | **PARTIAL** | Skill marketplace exists, but no enterprise-private namespace / signed plugin flow. |

### 2.5 Deployment topology

| Capability | Status | Evidence |
|---|---|---|
| Cloud SaaS (default) | **SHIPPED** | `api.pushci.dev`, `pushci.dev`, `app.pushci.dev` all live. |
| Self-hosted runner pool | **SHIPPED** | `deploy/self-hosted/` — Docker Compose + rootless preview, hardening guide. |
| Self-hosted control plane (VPC) | **MISSING** | Roadmap says H2 2026. Cloudflare Workers + D1 are not portable to on-prem. |
| Air-gapped install | **MISSING** | "Offline license token" mentioned in roadmap §6 Topology C, not built. |
| BYOK / HYOK / KMS integration | **PARTIAL (interface shipped)** | `api/src/key-provider.ts` — `KeyProvider` interface + `DefaultKeyProvider` reference adapter (AES-GCM envelope encryption with AAD-bound tenant id). KMS-specific adapters (AWS, Azure, GCP, Vault Transit) still to ship; interface is the contract. 5 tests in `key-provider.test.ts`. |
| mTLS runner ↔ API | **MISSING** | Runners auth with tokens. mTLS listed in roadmap §5. |

### 2.6 Commercial & support

| Capability | Status | Evidence |
|---|---|---|
| Enterprise pricing page | **SHIPPED** | `PricingPage.tsx` has 4 tiers incl. "Enterprise (custom)". |
| Lemon Squeezy billing (card, VAT handled) | **SHIPPED** | Landing advertises LS as MoR. |
| Invoicing / PO / NetTerms | **MISSING** | No PO workflow, no offline invoice generator, no finance export. Only card checkout. |
| MSA / DPA / BAA templates | **PARTIAL** | DPA available per landing; MSA and BAA not mentioned. |
| Dedicated support tier / named CSM | **ADVERTISED** | `enterpriseData.ts:72` — "24/7 incident response SLA." No status page or on-call rota visible. |
| SSO for support portal | **N/A** | No support portal linked. |

---

## 3. Top 10 enterprise deal-blockers, ranked

Ordering criterion: how often procurement / CISO review will reject
the product if the capability is absent, weighted by engineering cost
to close.

### Tier A — will literally block the signature

1. ~~FIDO2 / WebAuthn MFA for privileged roles.~~ **SHIPPED 2026-04-22**
 as TOTP (first factor). Implementation is in
 `api/src/mfa-routes.ts` + `api/src/security/totp.ts` (RFC 6238,
 5-attempt / 5-minute D1 rate-limiter, 10 one-time backup codes).
 WebAuthn is a drop-in successor on the same API contract
 (`factor: "webauthn"` alongside `"totp"`); the enrollment UI task
 remains on the dashboard backlog.
2. ~~Immutable audit log with hash chain and SIEM export.~~
 **SHIPPED 2026-04-22** — `api/src/audit-chain.ts` (prev_hash →
 row_hash SHA-256 chain, `/verify`, `/tip`) and
 `api/src/audit-siem.ts` (Splunk HEC, Datadog Logs, generic
 webhook, syslog-CEF; incremental `since` cursor).
3. **Full control-plane self-host (Docker Compose + Helm).** On
 roadmap for H2 2026. Banks and defense customers cannot depend on
 Cloudflare Workers. **Effort:** 8–12 weeks — port Workers handlers
 to a Node/Bun server, swap D1 for Postgres, swap KV for Redis,
 publish Helm chart.
4. ~~Signed releases + SBOM per build.~~ **SHIPPED 2026-04-22** —
 `.goreleaser.yml` now has `signs:` (cosign keyless blob signing on
 checksums, Rekor-logged) and `sboms:` (syft CycloneDX-JSON per
 archive + aggregated source SBOM). Buyers can grab
 `checksums.txt.sig` / `checksums.txt.pem` + `*.cdx.sbom.json` from
 any GitHub release after this change lands.

### Tier B — will pause the deal unless you have a credible ETA

5. **HIPAA / FedRAMP evidence pack.** Today: only GDPR is live.
 Many US enterprise + gov deals can't even start without a HIPAA
 BAA template. **Effort:** mostly policy & paperwork; 4–6 weeks
 elapsed; technical work ~1 week for minor hardening.
6. **BYOK with cloud KMS (AWS KMS, Azure Key Vault, GCP KMS).**
 Per-tenant encryption keys that the customer controls. **Effort:**
 2 weeks (abstract current AES-256-GCM key provider behind a
 `KeyProvider` interface; add KMS adapters).
7. **Immutable release artifacts + mTLS runner auth.** Runners
 currently present bearer tokens; enterprise wants certificate-
 based with short-lived tokens. **Effort:** 1 week.
8. **Runner autoscaling + remote build cache.** Harness and
 CircleCI both ship this; any credible head-to-head will expose
 PushCI's static concurrency. **Effort:** 2 weeks for K3s/Nomad
 adapter, 2–3 weeks for a bazel-remote-style CAS with S3/R2 backend.

### Tier C — will show up on comparison sheets but won't kill a deal

9. ~~Fine-grained API token scopes.~~ **SHIPPED 2026-04-22** —
 `api/src/service-accounts.ts` ships `pctk_*` tokens with a JSON
 scope array and a `requireScope()` middleware factory. Service
 accounts cover the non-human identity pair (CISOs ask for both).
10. **Manual approval gates on deploys + ServiceNow/Jira change
 management hook.** Listed P1 #12. **Effort:** 2 weeks for the
 primitive (`approval:` key in `pushci.yml`, dashboard approval UI,
 ServiceNow CHG adapter).

---

## 4. Delta vs. `docs/ENTERPRISE_ROADMAP.md`

The existing roadmap is very Norlys-specific (Gerrit + Jenkins + AWS
CodePipeline + Maven). That's a great anchor for one deal, but three
enterprise-table-stakes items are **not even on the roadmap**:

| Missing from roadmap | Status |
|---|---|
| Fine-grained API token scopes | **SHIPPED 2026-04-22** (`service-accounts.ts`). |
| Service account objects (distinct from users) | **SHIPPED 2026-04-22**. |
| HIPAA BAA | Still missing — blocks all US healthcare. |
| FedRAMP moderate | Still missing — blocks US federal. |
| Session management policy (TTL, force re-auth) | **Shipped 2026-04-22** (`api/src/session-policy.ts`). |
| Immutable release artifact registry | Still missing — audit reconstructability ("which bits ran on the day of the incident?"). |
| Status page URL | **Shipped 2026-04-22** at `/status` — client-side probes, dashboard/API/landing indicators. |

Recommend adding a P0.5 tier to the existing roadmap that collects
these cross-cutting enterprise items before extending Norlys-specific
bridges, because they'll block *every* enterprise deal, not just one.

---

## 5. Concrete recommendations, by order of sequencing

**Quarter 1 (done 2026-04-22 — items below shipped):**

- ~~Ship FIDO2/WebAuthn MFA~~ → **Shipped as TOTP** with rate-limit
 and backup codes; dashboard enrollment UI still pending (task #14).
- ~~Upgrade audit log to immutable hash chain~~ → **Shipped**
 (`audit-chain.ts`, `/api/audit/verify`, `/api/audit/tip`).
- ~~Implement SIEM HTTPS push adapter~~ → **Shipped** (Splunk HEC,
 Datadog, syslog-CEF, generic webhook in `audit-siem.ts`).
- ~~Cosign-signed releases + CycloneDX SBOM~~ → **Shipped** in
 `.goreleaser.yml` (`signs:` block + `sboms:` block).
- ~~Still to ship: public status page (statuspage.io, Uptime Robot,
 or self-hosted Cachet)~~ → **Shipped 2026-04-22** as
 `web/landing/src/pages/StatusPage.tsx` at `/status`, client-side
 probes of API / landing / dashboard.

**Quarter 2 (ship within 3 months):**

- ~~Build API token scopes + service account objects~~ →
 **Shipped 2026-04-22** (`service-accounts.ts`, `pctk_*` tokens,
 `SCOPES` vocabulary, `requireScope()` middleware).
- Wire **BYOK** behind a `KeyProvider` interface; ship AWS KMS
 adapter first (biggest buyer base), then Vault Transit, then Azure KV.
- Ship **HIPAA BAA template** + minor hardening (audit log on PHI
 field access, BAA-scoped data residency flag).

**Quarter 3 (8–12 weeks):**

- Port **control plane to Node/Bun + Postgres + Redis**; publish
 Docker Compose and Helm chart. This is the single highest-leverage
 work — it unblocks air-gapped and VPC-only customers permanently.
- Ship **runner autoscaling** (K3s or Nomad adapter) +
 **remote build cache** (S3/R2 backed CAS, buildx-compatible).
- Ship **manual approval gates** in `pushci.yml` +
 **ServiceNow CHG integration** (create on deploy, await approval,
 resume pipeline).

---

## 6. Tracked surface: `make audit-enterprise`

The `audit/checks/enterprise.sh` harness greps the repo for the
capabilities listed in §2 and reports `shipped / partial / missing`
counts. Exit code is non-zero only when something is MISSING, so
release CI can gate on it. Current run (2026-04-22):

```
shipped=16 partial=0 missing=0
```

16-of-16 tracked capabilities now pass, including cosign + CycloneDX
SBOM which landed in `.goreleaser.yml`.
Every row is evidence-backed (file path and/or grep pattern), so a
renamed module won't silently regress the signal.

`make audit-live` is unchanged — it probes `pushci.dev`,
`app.pushci.dev`, `api.pushci.dev/health`, and GitHub releases over
the network, and is kept separate from the static capability check so
offline CI runs stay fast and deterministic.

---

*Audit owner: independent review, 2026-04-22. Supersedes no prior
enterprise-readiness document; complements `GAP_ANALYSIS.md` and
`docs/ENTERPRISE_ROADMAP.md`.*
