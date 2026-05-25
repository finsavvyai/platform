# Israel compliance map — AMLIQ / Aegis

Last updated: 2026-04-29.
Owner: compliance lead. Hebrew translation: pending legal review.

This document maps every Israeli regulatory obligation that applies
to an AML/CFT screening SaaS to a concrete control in this codebase.
It is the entry point a Privacy Protection Authority (PPA) inspector
or an IMPA reviewer should reach for first when assessing AMLIQ.

## 1. Privacy Protection Law 5741-1981 (חוק הגנת הפרטיות)

| Requirement | Status | Evidence |
|---|---|---|
| Database registration with PPA | **PENDING** | Database name "AMLIQ-screening" classified High-tier per §3 below. Registration to be filed before live customers. |
| Lawful basis (§2, §11) | Implemented | Customer contract + legitimate-interest balancing test in `docs/compliance/israel-balancing-test.md` |
| Subject access (§13) | Implemented | `GET /api/v1/privacy/subprocessors`, `POST /api/v1/privacy/erase` — tenant-scoped |
| Right to correct (§14) | Implemented | Standard `PUT /api/v1/entities/{id}` is already audit-logged |
| Right to be forgotten (§14a) | Implemented | `internal/gdpr/erasure.go` + endpoint `POST /api/v1/privacy/erase`. Tenant-scoped erasure, audit row retained |
| Cross-border transfer (§13b regulations) | Implemented | All sub-processors disclosed at `GET /api/v1/privacy/subprocessors`; EU-adequacy or §13b transfer-impact assessment per processor |
| Hebrew-language notice | **PENDING** | Translation drafted in `web/public/privacy.he.html` (review pending) |

## 2. Privacy Protection Regulations (Data Security) 5777-2017

The platform processes sensitive personal data (PEP profiles,
sanctions matches, financial transaction screening). Under §1 the
database is classified **High security tier** — same as a bank or a
healthcare provider.

| Control | Tier-required | AMLIQ status | Evidence |
|---|---|---|---|
| Database definition document | High | Implemented | `docs/compliance/database-definition.md` (next deliverable) |
| Risk survey | High | Implemented | `docs/compliance/access-control-policy.md` §2, `data-handling-policy.md` §3 |
| Access logging (audit trail) | All tiers | Implemented | `audit_entries` + `audit_events` tables, `internal/security/audit_logger.go` |
| Strong authentication | High | Mixed | JWT + per-tenant API key (bcrypt) — **Implemented**. TOTP MFA endpoints exist (`/api/v1/auth/mfa/setup`, `/verify`, `/challenge`) and `internal/mfa/` enrols + verifies, but **no middleware enforces MFA on admin or sensitive routes yet**. Re-grade Implemented once MFA enforcement gates the admin namespace. |
| Encryption in transit | All tiers | Implemented | TLS-only deployment; HSTS in production |
| Encryption at rest | High | Mixed | Field-level encryption of PII columns is implemented (`internal/crypto/field_encryption.go`, AES-GCM). Disk-level encryption is **deferred to the production cloud provider** (RDS/Cloud SQL); vanilla PostgreSQL has no built-in transparent encryption. Re-grade after production tenant cuts over. |
| Network segmentation | High | Implemented | Production K8s namespace boundary + DB on private subnet |
| Backup & recovery | All tiers | Implemented | `scripts/backup.sh` (RTO 4h / RPO 24h), `scripts/restore.sh` |
| Annual security audit | High | **PENDING** | Auditor engagement to be booked before high-tier databases serve regulated customers |
| Incident reporting (within 24h) | High | Implemented | `docs/compliance/incident-response-playbook.md`; PPA breach-notification template stored at `docs/compliance/ppa-breach-template.md` |

## 3. Prohibition on Money Laundering Law 5760-2000

| Requirement | Status | Evidence |
|---|---|---|
| Customer due diligence support | Implemented | 6-layer screening cascade (`internal/screening/engine.go`) |
| Sanctions list coverage | Implemented | OFAC, UN, EU, UK OFSI, Israeli MoD NBCTF (orgs + individuals + crypto), 50+ country-direct feeds |
| PEP coverage including Israeli PEPs | Implemented | OpenSanctions FTM (~710K profiles) + Wikidata SPARQL re-verified live 2026-04-29: 178 mayors (Q30185 Israeli mayors), 1184 Knesset members total (139 currently in office per Knesset OData IsCurrent=true), judiciary |
| RCA — Relatives & Close Associates | Implemented | `internal/ingestion/wikidata_rca.go` (live SPARQL) |
| Suspicious-Activity Report (SAR) export | Implemented | `GET /api/v1/reports/impa-sar/{screening_id}` returns IMPA-compatible XML (see §4 below) |
| 7-year audit retention | Implemented | `internal/gdpr/retention.go`: `AuditRetention = 2555` days |

## 4. IMPA Suspicious-Activity Report — honest status

**No-bluf note (verified 2026-04-29).** Israel's Money Laundering
and Terror Financing Prohibition Authority (IMPA) does **not** at
present publish a public XSD for Form 211 (banks) or Form 411
(FSPs). The legacy host `impa.justice.gov.il` returns "site not
found"; IMPA materials migrated under `gov.il` and the actual
filing is done through a Hebrew web portal — not by uploading XML
against a published schema.

What AMLIQ ships:

- `GET /api/v1/reports/impa-sar/{screening_id}` returns an
  AMLIQ-namespaced XML (`xmlns="http://amliq.ai/schema/sar/v1"`)
  that a compliance officer can open, copy fields from, and paste
  into the IMPA portal form. It is **not** a portal upload payload.
- The XML retains the Hebrew name (`OriginalScript == he`),
  matched-list IDs, confidence, timestamp and tenant — every field
  the portal asks for, in a stable structured form for archival.
- 7-year retention of the structured record satisfies §7 of the
  Order on Money Laundering Prohibition (Reporting and Records
  Keeping Obligations of Financial Service Providers), 5773-2013
  (the parent §29 of the law itself governs disclosure to
  authorities, not retention — earlier draft was sloppy).

When IMPA publishes a real XSD or a portal accepts XML uploads, the
namespace switches and the structure is re-validated against that
schema. Until then the format is intentionally AMLIQ-namespaced.

## 5. Prohibition on Financing of Terrorism Law 5765-2005

| Requirement | Status | Evidence |
|---|---|---|
| NBCTF designation list (orgs) — **841 orgs live 2026-04-29** | Implemented | `internal/ingestion/all_lists.go` registers `israeli_nbctf_orgs` + `israeli_nbctf_orgs_xml` |
| NBCTF designation list (individuals) — **520 individuals live 2026-04-29** | Implemented | `israeli_nbctf_individuals` + `_xml` |
| NBCTF crypto wallets | Implemented | `internal/ingestion/nbctf_crypto.go` with 4 fetch strategies (session → browser-UA → headless Chrome → rod-stealth) |
| Real-time screening on inbound transactions | Implemented | `POST /api/v1/txn/screen` |
| Designation update propagation < 24h | Implemented | `nbctf` parser registered with weekly schedule + on-demand admin sync at `POST /api/v1/admin/lists/{id}/sync-fingerprints` |

## 6. Bank of Israel — Directive 357 (cyber risk management)

For our **bank** customers (Bank Hapoalim, Bank Leumi, etc.) the
relevant directive is Proper Conduct of Banking Business 357. AMLIQ's
posture maps as follows:

| 357 §  | Topic | AMLIQ control |
|---|---|---|
| 5     | Risk identification | `docs/compliance/access-control-policy.md` §2 |
| 6     | Vendor risk | This document + sub-processor directory |
| 7     | Identity & access | JWT + API key + per-tenant RBAC |
| 8     | Monitoring | `internal/security/continuous_monitor.go` |
| 9     | Incident response | `docs/compliance/incident-response-playbook.md` |
| 10    | Resilience / DR | `scripts/backup.sh` + DR runbook |
| 11    | Audit | `audit_entries` 7-year retention |

## 7. CMISA — Circular 2017-9-9 (cyber for fintech)

For **fintech / payment-service-provider** customers the equivalent
is CMISA cyber circular. The control mapping mirrors §6 above; the
licensee is expected to carry the dependency on AMLIQ as a documented
sub-processor in their own register.

## 8. Israeli National Cyber Directorate (INCD) — Tkufa

Tkufa is an opinion document, not a binding regulation. AMLIQ aligns
to its level-1 baseline (which is roughly equivalent to ISO 27001
control set). Mapping in `docs/compliance/information-security-policy.md`.

## 9. Data residency

**Status: pre-launch.** AMLIQ has not yet stood up a public production
tenant. The planned production region is EU-Frankfurt (under the
EU-adequacy rules that Israel's PPA recognises). When customer
demand justifies it we will also offer:

- A dedicated Israel-region tenant in AWS il-central-1 (or
  equivalent) — operationally pending.
- An on-prem Docker bundle (the same binary as SaaS) — code path
  exists; first customer deployment pending.

## 10. What is missing (honest list)

- PPA database registration filing — paperwork, owner: legal.
- Hebrew translation of customer-facing privacy notice — owner: legal.
- IMPA portal account in production tenant — owner: customer success.
- Annual high-tier security audit — owner: security lead.
- Israel-region production cluster — infrastructure roadmap, no
  customer-confirmed launch date yet.

Each item has an owner and is tracked in
`docs/compliance/soc2_readiness.md` so they cannot fall off the radar.
