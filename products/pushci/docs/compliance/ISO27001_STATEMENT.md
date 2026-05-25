# ISO/IEC 27001:2022 Alignment Statement

**Version:** 1.0 — 2026-04-11
**Status:** PushCI is **implementing controls aligned with** ISO/IEC 27001:2022.
PushCI is **not yet certified** against ISO/IEC 27001. A formal certification
audit is scoped for 2026–2027 depending on enterprise demand.
**License:** CC-BY-4.0

---

## Purpose

This statement describes how PushCI's Information Security Management
System (ISMS) maps to the themes of **Annex A** of ISO/IEC 27001:2022.
It is intended to support customer procurement teams that need to
document due diligence on security controls, without implying a
certification that does not yet exist.

Where a control is implemented, this document points to the concrete
engineering artefact (file, module, or runbook). Where a control is
partial or in progress, that is stated explicitly.

## Relationship to SOC 2

The PushCI control environment was designed primarily against the AICPA
Trust Services Criteria (see [`SOC2_CONTROLS.md`](./SOC2_CONTROLS.md)).
ISO 27001 Annex A is used here as a **cross-reference** rather than a
parallel control set — almost every Annex A theme maps to one or more
SOC 2 controls we already implement.

## Scope of the ISMS

- **Information assets in scope:** source code repositories, pipeline
  definitions, CI/CD run logs, user authentication data, audit trails,
  billing metadata, API keys and secrets stored in the CLI vault.
- **Services in scope:** the hosted PushCI API (Cloudflare Workers), the
  dashboard, the managed runner fleet, the CLI distribution.
- **Out of scope:** customer self-hosted runners running on customer
  infrastructure (covered by the customer's own ISMS), third-party
  integrations (covered by their own certifications).

---

## Annex A themes (ISO 27001:2022 uses four themes rather than 14 domains)

ISO/IEC 27001:2022 reorganised Annex A from 114 controls in 14 domains
(the 2013 version) down to 93 controls in **four themes**:

- **A.5 — Organizational controls** (37)
- **A.6 — People controls** (8)
- **A.7 — Physical controls** (14)
- **A.8 — Technological controls** (34)

The table below maps each theme to PushCI's implementation.

---

## A.5 — Organizational controls

| Annex A control theme                                 | PushCI implementation                                                                                      | Evidence                                                                       |
|-------------------------------------------------------|------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| **A.5.1** Policies for information security           | Written information security policy, reviewed annually, owned by the founder.                             | Internal policy library (available on request).                               |
| **A.5.2** Information security roles                  | Documented roles and RACI for security, incident response, and compliance.                                | `docs/PROJECT_GOVERNANCE.md`.                                                 |
| **A.5.7** Threat intelligence                         | Subscription to CVE feeds and Cloudflare threat intel; quarterly review.                                  | Internal threat-intel runbook.                                                |
| **A.5.9** Inventory of information and other assets   | Asset register covering all repos, infrastructure, and data stores.                                        | Internal asset register.                                                      |
| **A.5.10** Acceptable use                              | Acceptable-use policy signed by all contributors.                                                          | HR records.                                                                   |
| **A.5.15** Access control                              | JWT-based auth on every API endpoint; role-based permissions at project level.                           | `api/src/middleware.ts`, `api/src/types.ts` `ProjectRole`.                     |
| **A.5.16** Identity management                        | OAuth with GitHub/GitLab/Bitbucket/Google/Microsoft/LinkedIn/Facebook as identity providers.              | `api/src/auth.ts`, OAuth routes in `core-routes.ts`.                          |
| **A.5.17** Authentication information                 | Short-lived JWTs (7d) with sliding refresh; no passwords stored.                                          | `api/src/middleware.ts` `refreshTokenIfNeeded`.                               |
| **A.5.23** Information security for use of cloud services | Cloudflare chosen as primary provider; subprocessors reviewed in `GDPR_DPA.md`.                         | `docs/compliance/GDPR_DPA.md` Section 6.                                      |
| **A.5.24** Information security incident management planning | Documented incident response plan; 48h breach notification SLA to customers.                          | `docs/compliance/GDPR_DPA.md` Section 10.                                     |
| **A.5.30** ICT readiness for business continuity      | Daily audit chain verification job, Cloudflare multi-region failover.                                     | `api/src/audit-immutable.ts` `verifyAuditChain`.                              |
| **A.5.34** Privacy and protection of PII              | GDPR right-to-erasure endpoint, minimal PII collected.                                                    | `api/src/compliance.ts`.                                                      |
| **A.5.37** Documented operating procedures            | Runbooks maintained for all recurring operations; changes via PR.                                         | Internal runbook repo.                                                        |

**Status:** most organizational controls are implemented; A.5.7 threat
intel and A.5.34 privacy impact are formally documented but would
benefit from a dedicated privacy engineer in 2026.

---

## A.6 — People controls

| Annex A control theme                  | PushCI implementation                                                                  | Evidence                                    |
|----------------------------------------|----------------------------------------------------------------------------------------|---------------------------------------------|
| **A.6.1** Screening                    | Background checks on all PushCI employees before granting production access.          | HR records.                                 |
| **A.6.2** Terms and conditions of employment | Confidentiality and IP assignment clauses in employment contracts.                   | HR records.                                 |
| **A.6.3** Information security awareness, education and training | Annual secure-coding training; quarterly phishing drills.                  | Training tracker.                           |
| **A.6.4** Disciplinary process         | Documented disciplinary process for security policy violations.                        | HR policy.                                  |
| **A.6.5** Responsibilities after termination or change of employment | Offboarding checklist revokes all access and OAuth sessions.           | Offboarding runbook.                        |
| **A.6.6** Confidentiality / non-disclosure agreements | NDAs with all staff and contractors.                                              | HR records.                                 |
| **A.6.7** Remote working               | Remote-work policy requiring encrypted disks, MFA, VPN to sensitive systems.          | Remote work policy.                         |
| **A.6.8** Information security event reporting | Security incidents reportable 24/7 via `security@pushci.dev`.                   | `security.txt`.                             |

**Status:** implemented. Gap: A.6.3 training currently tracked in a
spreadsheet — moving to a formal LMS is on the 2026 roadmap.

---

## A.7 — Physical controls

PushCI operates **no physical data centres** — all compute and storage
runs on Cloudflare's global edge. Physical security for the hosted
service is inherited from Cloudflare, which maintains its own ISO 27001,
SOC 2, and PCI attestations.

| Annex A control theme                  | PushCI implementation                                                                  | Evidence                                                    |
|----------------------------------------|----------------------------------------------------------------------------------------|-------------------------------------------------------------|
| **A.7.1** Physical security perimeters | Inherited from Cloudflare.                                                             | Cloudflare Trust Center.                                    |
| **A.7.2** Physical entry               | Inherited from Cloudflare.                                                             | Cloudflare Trust Center.                                    |
| **A.7.3** Securing offices, rooms and facilities | PushCI offices (remote-first) have locked cabinets for any printed sensitive material. | Office security procedure. |
| **A.7.4** Physical security monitoring | Inherited from Cloudflare.                                                             | Cloudflare Trust Center.                                    |
| **A.7.5** Protecting against physical and environmental threats | Inherited from Cloudflare.                                         | Cloudflare Trust Center.                                    |
| **A.7.6** Working in secure areas       | Not applicable (no secure-area facilities).                                             | N/A                                                         |
| **A.7.7** Clear desk and clear screen   | Clear-screen policy enforced on company laptops via MDM.                                | MDM policy.                                                 |
| **A.7.8** Equipment siting and protection | Company laptops encrypted (FileVault / BitLocker) with auto-lock.                     | MDM enforcement report.                                     |
| **A.7.9** Security of assets off-premises | Laptop-only asset policy; lost devices remotely wiped.                                | MDM enforcement.                                            |
| **A.7.10** Storage media                | No removable media permitted to handle customer data.                                   | Acceptable use policy.                                       |
| **A.7.11** Supporting utilities        | Inherited from Cloudflare.                                                             | Cloudflare Trust Center.                                    |
| **A.7.12** Cabling security            | Inherited from Cloudflare.                                                             | Cloudflare Trust Center.                                    |
| **A.7.13** Equipment maintenance       | Inherited from Cloudflare.                                                             | Cloudflare Trust Center.                                    |
| **A.7.14** Secure disposal or re-use of equipment | Company laptops wiped before disposal according to NIST 800-88.                | Disposal log.                                               |

**Status:** all controls implemented directly or inherited. Note that
customers running self-hosted runners are responsible for the physical
security of those runners.

---

## A.8 — Technological controls

| Annex A control theme                  | PushCI implementation                                                                                         | Evidence                                                                   |
|----------------------------------------|---------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------|
| **A.8.1** User endpoint devices        | MDM-managed laptops with FileVault, auto-lock, EDR.                                                          | MDM report.                                                                |
| **A.8.2** Privileged access rights     | Admin endpoints require role=`admin` membership check.                                                        | `api/src/compliance.ts` `isPlatformAdmin`.                                 |
| **A.8.3** Information access restriction | Per-project RBAC; seven distinct roles.                                                                     | `api/src/types.ts` `ProjectRole`.                                          |
| **A.8.4** Access to source code        | GitHub branch protection; CODEOWNERS; signed commits required.                                                | Git history.                                                               |
| **A.8.5** Secure authentication        | OAuth 2.0 with mainstream identity providers; JWTs with rolling expiry.                                       | `api/src/auth.ts`.                                                         |
| **A.8.6** Capacity management          | Cloudflare Workers auto-scale; usage caps per plan.                                                           | `api/src/usage.ts`.                                                        |
| **A.8.7** Protection against malware   | Secrets scanning on every pipeline; pipeline audit rejects `curl \| sh`.                                      | `api/src/secrets-scan.ts`, `api/src/pipeline-audit.ts`.                    |
| **A.8.8** Management of technical vulnerabilities | Dependabot on all repos; CVE gating in pipelines (Go + TS).                                          | Dependabot alerts.                                                         |
| **A.8.9** Configuration management     | Infrastructure as code; migrations in `api/migrations/`.                                                      | Git history.                                                               |
| **A.8.10** Information deletion        | GDPR erasure endpoint; retention sweeper.                                                                     | `api/src/compliance.ts`.                                                   |
| **A.8.11** Data masking                | No PII in dashboards; `actor_sub` used as pseudonymous identifier.                                            | Dashboard source.                                                          |
| **A.8.12** Data leakage prevention     | Secrets scanner blocks secret strings in pipeline logs and commits.                                           | `api/src/secrets-scan.ts`.                                                 |
| **A.8.13** Information backup          | Cloudflare D1 point-in-time recovery; daily KV export.                                                         | Backup schedule.                                                           |
| **A.8.14** Redundancy of information processing facilities | Cloudflare global anycast across 300+ POPs.                                                       | Cloudflare docs.                                                           |
| **A.8.15** Logging                     | Request logging middleware, append-only `audit_logs` table, hash-chained.                                     | `api/src/audit-immutable.ts`.                                              |
| **A.8.16** Monitoring activities       | Cloudflare analytics; rate-limit counters; daily chain verification.                                           | Cloudflare dashboard.                                                      |
| **A.8.17** Clock synchronisation       | Cloudflare Workers use NTP-synced time; `created_at` uses `datetime('now')`.                                  | `api/src/db.ts`.                                                           |
| **A.8.18** Use of privileged utility programs | Restricted via role and logged in `audit_logs`.                                                        | `audit_logs` entries.                                                      |
| **A.8.19** Installation of software on operational systems | Infrastructure as code only; no ad-hoc installs.                                               | Git history.                                                               |
| **A.8.20** Networks security           | Cloudflare WAF + managed DDoS protection; HTTPS only.                                                          | Cloudflare WAF rules.                                                      |
| **A.8.21** Security of network services | TLS 1.2+ with HSTS; no plaintext services exposed.                                                           | Cloudflare TLS report.                                                     |
| **A.8.22** Segregation of networks     | Per-tenant logical isolation in D1; no cross-tenant queries allowed in code review.                           | Code review record.                                                        |
| **A.8.23** Web filtering                | N/A — PushCI does not operate a user-facing web proxy.                                                        | N/A                                                                        |
| **A.8.24** Use of cryptography         | AES-256-GCM for secrets, TLS 1.2+ in transit, SHA-256 for audit chain.                                        | `api/src/audit-immutable.ts` `computeEntryHash`.                           |
| **A.8.25** Secure development life cycle | SDL policy: threat-model, code review, SAST, SCA, penetration test.                                         | `docs/SECURITY_AUDIT.md`.                                                  |
| **A.8.26** Application security requirements | Functional and non-functional security requirements tracked per feature.                                 | Internal spec docs.                                                        |
| **A.8.27** Secure system architecture and engineering principles | Least privilege, defence in depth, fail closed.                                          | `api/src/middleware.ts`.                                                   |
| **A.8.28** Secure coding               | OWASP Top 10 training; linting; code review.                                                                   | PR review history.                                                         |
| **A.8.29** Security testing in development and acceptance | 465+ Go + TS tests; vitest suite runs on every commit.                                             | `api/src/*.test.ts`.                                                       |
| **A.8.30** Outsourced development       | No outsourced development.                                                                                     | N/A                                                                        |
| **A.8.31** Separation of development, test and production environments | Separate D1 databases and KV namespaces per environment.                       | `api/wrangler.toml`.                                                       |
| **A.8.32** Change management           | PR + approval workflow; protected branches.                                                                    | Git history.                                                               |
| **A.8.33** Test information            | Tests use synthetic data; no production data in test.                                                          | `api/src/*.test.ts`.                                                       |
| **A.8.34** Protection of information systems during audit testing | Audit reads use dedicated `auditor` role with no mutating permissions.              | `api/src/types.ts` `ProjectRole`.                                          |

**Status:** the overwhelming majority of technological controls are
implemented. Gaps are noted in the SOC 2 matrix change log.

---

## Implementation roadmap toward certification

| Phase        | Target date | Deliverable                                                              |
|--------------|-------------|--------------------------------------------------------------------------|
| Phase 1      | Q2 2026     | Formal Statement of Applicability (SoA) reviewed by internal auditor.    |
| Phase 2      | Q3 2026     | Internal ISMS audit; corrective action log.                              |
| Phase 3      | Q4 2026     | Stage-1 ISO 27001 audit with accredited certification body.              |
| Phase 4      | Q1–Q2 2027  | Stage-2 audit; initial certification.                                    |
| Phase 5      | Annually    | Surveillance audits; recertification every three years.                  |

## Revocation & feedback

If any of the claims in this document are found to be inaccurate, please
open an issue at `https://github.com/finsavvyai/pushci/issues` or email
`security@pushci.dev`.
