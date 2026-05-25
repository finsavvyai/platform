# PushCI SOC 2 Type II Control Matrix

**Status:** SOC 2 Type II audit **in progress** with an independent CPA firm.
This document is PushCI's **self-assessed control mapping** against the AICPA
Trust Services Criteria (TSC 2017, revised 2022). It is the primary artefact
we hand to customer security teams during procurement review.

**Scope:** PushCI API (Cloudflare Workers), PushCI Dashboard, PushCI CLI,
managed runner fleet, and the data stores that back them (Cloudflare D1, KV,
R2). On-premise / self-hosted runners are **out of scope** of the hosted
service boundary and are covered by the customer's own controls.

**Version:** 1.0 — 2026-04-11
**Owner:** PushCI Security & Compliance
**License:** CC-BY-4.0

---

## How to read this document

Each row maps a Trust Services Criterion to:

1. A **PushCI control** (what we actually do).
2. The **implementation location** (file, module, or runtime component).
3. Where to find **evidence** that the control is operating.

Evidence pointers reference files in this repository (`api/src/...`,
`docs/...`) and runtime artefacts exposed by our compliance API at
`GET /api/compliance/soc2/evidence`.

The evidence pack is **HMAC-SHA-256 signed** over a canonical JSON
serialisation of the payload so auditors can verify integrity after export.

---

## Control matrix

| Control ID | Criterion                               | Description                                                                                                                | Implementation                                                                                                       | Evidence location                                                                         |
|------------|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| CC1.1      | Control environment — Integrity & ethics | Company Code of Conduct and security acceptable-use policy signed by all contributors before commit access.                | `docs/PROJECT_GOVERNANCE.md`; onboarding checklist in internal runbook.                                               | Signed onboarding records in HR system; CODEOWNERS on protected branches.                 |
| CC1.2      | Board oversight                          | Founder + advisor reviews security posture quarterly; decisions recorded in governance log.                                | Quarterly review meeting + risk register.                                                                            | `docs/PROJECT_GOVERNANCE.md`, governance meeting minutes.                                 |
| CC1.3      | Organisational structure                 | Documented roles for engineering, security, and compliance; RACI matrix for incident response.                             | Internal org chart and RACI.                                                                                         | Internal wiki (shared on request).                                                        |
| CC1.4      | Competence of personnel                  | Engineers complete annual secure-coding training; OWASP Top 10 refresher.                                                  | Training tracker.                                                                                                    | Training completion exports.                                                              |
| CC1.5      | Accountability                           | Individual commit signing + per-user JWT tokens so every action is attributable.                                           | `api/src/auth.ts` (`createJwt`/`verifyJwt`), git signed commits.                                                     | `audit_logs.actor_sub` on every mutating action.                                          |
| CC2.1      | Information & communication              | Security incidents reported to customers within 24h via status page + email; publication template in runbook.              | Status page + email templates.                                                                                       | `docs/SECURITY_AUDIT.md`.                                                                 |
| CC2.2      | Internal communication                   | Architecture decisions (ADRs) published in repo; security-sensitive changes flagged in PR.                                 | PR template + ADR folder.                                                                                            | `docs/` + PR review history.                                                              |
| CC2.3      | External communication                   | Public security contact, vulnerability disclosure policy, and SLA for triage published.                                    | `SECURITY.md`, `security.txt`.                                                                                       | Published at `https://pushci.dev/.well-known/security.txt`.                               |
| CC3.1      | Risk assessment                          | Annual risk assessment covering confidentiality, integrity, availability; quarterly delta review.                          | Risk register.                                                                                                       | Risk register export (on request).                                                       |
| CC3.2      | Fraud risk                                | Separation-of-duties enforced on deploy policy; at least two distinct subs required for prod releases.                     | `api/src/deploy-policy.ts` `require_separation_of_duties`.                                                           | `audit_logs` entries for `deploy.approve` from independent subs.                          |
| CC4.1      | Monitoring — control activities          | Continuous log monitoring; anomaly detection on auth failures via rate limiter.                                            | `api/src/middleware.ts` `authRateLimitMiddleware`; Cloudflare Workers analytics.                                     | Cloudflare dashboard + `audit_logs` rate-limit events.                                    |
| CC4.2      | Monitoring — deficiencies                | Vulnerability scanning (`secrets-scan.ts`) runs on every pipeline; findings routed to governance queue.                    | `api/src/secrets-scan.ts`.                                                                                           | Secrets scan results surfaced in audit trail.                                             |
| CC5.1      | Control activities — selection           | Defence-in-depth: JWT auth, plan gating, per-project RBAC, rate limiting, policy engine, runner isolation.                 | `api/src/middleware.ts`, `api/src/policy-engine.ts`, `api/src/team-auth.ts`.                                         | Code review, automated tests (`*.test.ts`).                                               |
| CC5.2      | Technology general controls              | Infrastructure as code via Wrangler + migrations committed to repo; no manual console changes.                             | `api/wrangler.toml`, `api/migrations/`.                                                                              | Git history.                                                                              |
| CC5.3      | Policies & procedures                    | Written policies for data handling, key rotation, incident response; reviewed annually.                                    | Internal policy library.                                                                                             | Policy document set (on request).                                                         |
| CC6.1      | Logical & physical access — restrictions | **Every** `/api/*` endpoint is guarded by `requireAuth` JWT middleware; public endpoints are explicitly whitelisted.       | `api/src/middleware.ts` `requireAuth`; `api/src/index.ts` route registration.                                        | Auth guard list in `index.ts`; evidence pack `access_reviews` array.                      |
| CC6.2      | Authentication                           | OAuth 2.0 with GitHub, GitLab, Bitbucket, Google, Microsoft, LinkedIn, Facebook; tokens stored as JWTs with 7-day expiry.  | `api/src/auth.ts`, provider routes under `api/src/core-routes.ts`.                                                   | `audit_logs` entries for `auth.login`.                                                    |
| CC6.3      | Authorisation — RBAC                     | Project-level roles: admin, maintainer, release_manager, deploy_approver, developer, viewer, auditor.                      | `api/src/types.ts` `ProjectRole`; `api/src/project-auth.ts`.                                                         | `project_memberships` table; surfaced in SOC 2 pack under `access_reviews`.               |
| CC6.4      | Physical access                          | PushCI hosted on Cloudflare global edge + EU D1 region; physical security inherited from Cloudflare SOC 2 / ISO 27001.     | Cloudflare compliance matrix.                                                                                        | Cloudflare Trust Center attestation.                                                      |
| CC6.5      | Logical access — removal                 | Offboarding revokes OAuth sessions and flags user as erased; right-to-erasure endpoint scrubs PII.                         | `api/src/compliance.ts` `DELETE /gdpr/erase/:userSub`.                                                               | `audit_logs` entries for `gdpr.erase`.                                                    |
| CC6.6      | Encryption of data at rest               | Secrets in CLI vault use AES-256-GCM with machine-bound keys; D1 / KV / R2 encrypted at rest by Cloudflare.                | PushCI CLI `cmd/pushci/secrets.go`; Cloudflare platform encryption.                                                  | Cloudflare key management docs; CLI vault tests.                                          |
| CC6.7      | Transmission of data                     | TLS 1.2+ enforced end-to-end; HSTS on all responses; no plaintext HTTP allowed for API or dashboard.                       | Cloudflare TLS config; `corsMiddleware` only accepts HTTPS origins.                                                  | `curl` probe of any endpoint; Cloudflare TLS report.                                      |
| CC6.8      | Malware / untrusted code                 | Pipeline audit flags `curl \| sh`, unpinned versions, `sudo`, env dumps.                                                   | `api/src/pipeline-audit.ts`.                                                                                         | `api/src/pipeline-audit.test.ts`.                                                         |
| CC7.1      | System operations — anomaly detection    | Rate limiting on all mutating endpoints; anomaly threshold on auth failures triggers block.                                | `api/src/middleware.ts`.                                                                                             | KV key `rl:*` counts.                                                                     |
| CC7.2      | System monitoring — **immutable audit**  | Every mutating action is appended to a **hash-chained audit log**; tampering breaks the chain and is detected on verify.  | `api/src/audit-immutable.ts` (`computeEntryHash`, `appendAuditHashChain`, `verifyAuditChain`).                       | Audit pack sample + `GET /api/compliance/soc2/evidence` hash-chain verification.          |
| CC7.3      | Audit log retention                      | Audit logs retained for **7 years** by default (Norlys pilot requirement); configurable per tenant.                        | `api/src/compliance.ts` `RetentionPolicy.audit_log_years = 7`.                                                       | `GET /api/compliance/retention-policy`.                                                   |
| CC7.4      | Incident response                        | Documented incident response runbook; 24h customer notification SLA for confirmed breaches.                                | Internal runbook.                                                                                                    | `docs/SECURITY_AUDIT.md`.                                                                 |
| CC7.5      | Recovery                                  | D1 point-in-time recovery enabled; cross-region backups retained 30 days.                                                  | Cloudflare D1 backups.                                                                                               | D1 backup export timestamps.                                                              |
| CC8.1      | Change management                        | All changes via pull request with at least one approver; protected branch enforcement; CODEOWNERS.                         | GitHub branch protection; `api/src/deploy-policy.ts` `require_protected_branch`.                                     | Git PR history + `audit_logs` `deploy.request`.                                           |
| CC9.1      | Risk mitigation — business disruption    | Multi-region Cloudflare deployment; health-check endpoint; automated failover.                                             | `GET /health`.                                                                                                       | Uptime monitor export.                                                                    |
| CC9.2      | Risk mitigation — vendors                | Subprocessors reviewed before onboarding; contracts require SOC 2 or ISO 27001.                                            | `docs/compliance/GDPR_DPA.md` subprocessor list.                                                                     | DPA subprocessor annex.                                                                   |
| A1.1       | Availability — capacity planning         | Cloudflare Workers auto-scale; synthetic load test before major releases.                                                  | Load-test scripts in `scripts/`.                                                                                     | Load-test reports.                                                                        |
| A1.2       | Availability — infrastructure monitoring | Health endpoint + Cloudflare analytics; page + PagerDuty alerts on 5xx rate.                                               | `GET /health`; PagerDuty integration.                                                                                | Uptime report; `audit_logs` `incident.*` events.                                          |
| A1.3       | Availability — recovery testing          | Quarterly DR drill: restore D1 from backup into a staging tenant and run integration tests.                                | DR runbook.                                                                                                          | DR drill report.                                                                          |
| C1.1       | Confidentiality — classification         | Data tiers: public, internal, confidential (customer data), restricted (secrets). Each tier has handling rules.            | Data classification policy; secrets scanner.                                                                         | `api/src/secrets-scan.ts`.                                                                |
| C1.2       | Confidentiality — disposal                | GDPR right-to-erasure scrubs `actor_login` to `"ERASED"` on request, preserving referential integrity.                     | `api/src/compliance.ts` `DELETE /gdpr/erase/:userSub`, `ERASED_MARKER`.                                              | `audit_logs` tombstone entries for erasure.                                               |

---

## Continuous monitoring

- **Audit chain verification job** runs daily across the last 24h of
  `audit_logs` via `verifyAuditChain(db, from, to)`. Any `valid: false` result
  pages on-call and halts further writes to the tenant until investigated.
- **Access review** surface is re-computed on every `/soc2/evidence` call —
  auditors get a snapshot of all `project_memberships` ordered by most
  recently updated.
- **Retention enforcement** is driven by the `RetentionPolicy` stored in KV;
  a scheduled Worker sweeps expired rows on a daily cadence (out of scope
  for hosted runners).

## Gaps & remediation in progress

- **CC1.4 training tracker** is currently in a spreadsheet; planned move
  to a formal LMS before the Type II observation window closes.
- **CC7.5 cross-region backups** currently rely on Cloudflare's managed
  D1 backup; we intend to add an additional R2 nightly snapshot for extra
  defence in depth.
- **A1.3 DR drill** cadence is quarterly but the first drill is scheduled
  for Q2 2026.

## Change log

| Date       | Change                                                        |
|------------|---------------------------------------------------------------|
| 2026-04-11 | Initial control matrix drafted for Norlys pilot.              |
