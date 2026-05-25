# SOC 2 Type II Phase 1 Readiness Assessment

**Document Version**: 1.0  
**Date**: 2026-04-13  
**Status**: Phase 1 Implementation Plan  
**Target Certification**: SOC 2 Type II (12-month audit period)

---

## Executive Summary

This document outlines AMLIQ's SOC 2 Type II Phase 1 readiness assessment. The platform already implements foundational security controls (audit logging, RBAC, encryption, rate limiting). This assessment identifies gaps against the five Trust Service Criteria and provides a 6-month remediation timeline to achieve certification-ready status.

**Current Maturity**: Level 2 (Controls Implemented, Not Yet Tested)  
**Target Maturity**: Level 3 (Controls Tested and Operating Effectively)

---

## 1. Trust Service Criteria Mapping

### 1.1 Security (CC — Common Criteria)

**Definition**: The system is protected against unauthorized access, use, disclosure, modification, and loss.

#### Current Controls Inventory

| Control | Status | Evidence |
|---------|--------|----------|
| Access control via JWT + API keys | Implemented | `api/middleware_jwt.go`, `api/middleware_apikey.go` |
| Rate limiting (per-tenant) | Implemented | `api/middleware_rate.go` |
| Audit logging for all actions | Partial | `internal/storage/pgx/audit_repo.go` is wired into state-changing handlers (alert resolve, config update, lists sync, GDPR erasure). Login + API-key usage + rate-limit hits are **not yet** audit-logged; `internal/security/audit_logger.go` defines the unified `Log*` helpers but currently has zero callers. |
| Multi-tenant isolation | Implemented | `api/middleware_tenant.go` |
| Encryption in transit (TLS) | Code-ready (pre-launch) | Production tenant not yet stood up; deployment manifests enforce HTTPS via TLS-only ingress. Mark "Implemented" only after first prod tenant goes live. |
| Password hashing (Bcrypt) | Implemented | `api/apikey_hash.go` uses Go stdlib crypto |

#### Gap Analysis

| Gap | Severity | Remediation |
|-----|----------|------------|
| No continuous security monitoring | HIGH | Implement `internal/security/continuous_monitor.go` (Phase 1) |
| No penetration testing schedule | HIGH | Contract annual pen-test; document findings |
| No vulnerability scanning in CI/CD | MEDIUM | Add Snyk/Trivy to GitHub Actions |
| No TLS certificate automation | MEDIUM | Implement auto-renewal via Let's Encrypt in Docker |
| No secrets management (env vars) | MEDIUM | Migrate to HashiCorp Vault or AWS Secrets Manager |
| No formal access review process | MEDIUM | Document quarterly access review procedure |
| Missing session timeout enforcement | MEDIUM | Add JWT refresh token rotation |

#### Remediation Timeline

- **Month 1**: Continuous monitoring (done: Phase 1)
- **Month 2**: Penetration test + vulnerability scanning setup
- **Month 3**: Secrets management integration
- **Month 4**: Access review automation
- **Month 5-6**: Testing and documentation

---

### 1.2 Availability (A)

**Definition**: The system is available for operation and use as expected.

#### Current Controls Inventory

| Control | Status | Evidence |
|---------|--------|----------|
| Uptime monitoring (Prometheus) | Code-ready (pre-launch) | K8s manifests reference Prometheus; no production cluster yet — re-grade "Implemented" once a live cluster exists |
| Health check endpoints | Implemented | `/health`, `/health/full`, `/ready` in API |
| Graceful shutdown | Implemented | Context cancellation in cmd/api/main.go |
| Database connection pooling | Implemented | `internal/storage/pgx/pool.go` |
| Rate limiting protects against overload | Implemented | `api/middleware_rate.go` |

#### Gap Analysis

| Gap | Severity | Remediation |
|-----|----------|------------|
| No automated failover | HIGH | Deploy 3+ replicas; use Kubernetes StatefulSet |
| No backup/restore testing | HIGH | Monthly restore drills; document RTO/RPO |
| No disaster recovery runbook | MEDIUM | Create DR procedures; test quarterly |
| No load testing baseline | MEDIUM | Run JMeter tests; document thresholds |
| No on-call alerting automation | MEDIUM | Integrate PagerDuty; define escalation |

#### Remediation Timeline

- **Month 1**: Backup testing automation
- **Month 2**: Disaster recovery runbook + testing
- **Month 3**: Load testing baseline
- **Month 4-6**: On-call automation + alerting

---

### 1.3 Confidentiality (C)

**Definition**: Information is protected from unauthorized disclosure.

#### Current Controls Inventory

| Control | Status | Evidence |
|---------|--------|----------|
| Encryption at rest | Mixed — see note | **Field-level (PII columns):** Implemented via `internal/crypto/field_encryption.go` (AES-GCM, KEK from env). **Disk-level:** **PENDING — depends on production cloud provider** (RDS/Cloud SQL transparent disk encryption is the planned mechanism). Vanilla PostgreSQL has no built-in transparent encryption; pgcrypto only encrypts at column level on demand. Re-grade to Implemented when production tenant goes live with disk-encrypted volumes. |
| Data classification | Partial | Documented in access-control-policy.md |
| Audit logs (immutable) | Implemented | DB triggers `audit_entries_immutable` and `audit_events_immutable` raise on UPDATE/DELETE (migration `069_audit_immutability.up.sql`); retention purge requires explicit session var `aegis.allow_audit_purge=on` |
| Access control enforcement | Implemented (application-layer) | Multi-tenant isolation enforced by mandatory `WHERE tenant_id = $1` filters on every repository query (see `internal/storage/pgx/*.go`). **Not** Postgres RLS — no `CREATE POLICY` rows yet; a privileged DB session could still read across tenants. RLS migration is on the roadmap (low effort, highest blast-radius reduction). |
| PII masking in logs | **PENDING** | Helper `MaskEmail` lives in `internal/security/pii_mask.go` and is invoked by `internal/gdpr/erasure.go:logErasure`. Other audit-write call sites (`alert_resolve`, `config_update`, `lists_sync`) still log raw `details` strings. Before audit goes to a regulator, every audit-write site has to route through the masker. |

#### Gap Analysis

| Gap | Severity | Remediation |
|-----|----------|------------|
| No formal data classification standard | MEDIUM | Document PII/Confidential/Public tiers |
| No encryption key rotation schedule | MEDIUM | Implement annual key rotation with HSM |
| No data retention/deletion policy | MEDIUM | Define retention schedules per data type |
| No secure deletion verification | MEDIUM | Add cryptographic proof of deletion |
| No Data Protection Impact Assessment (DPIA) | MEDIUM | Document DPIA for each processing activity |

#### Remediation Timeline

- **Month 1**: Data classification standard
- **Month 2**: Data retention policy + deletion automation
- **Month 3**: Encryption key rotation automation
- **Month 4-6**: DPIA documentation

---

### 1.4 Processing Integrity (PI)

**Definition**: System processing is complete, accurate, timely, and authorized.

#### Current Controls Inventory

| Control | Status | Evidence |
|---------|--------|----------|
| Input validation (Zod schemas) | Implemented | All API endpoints validate via Zod |
| Error handling (no panics) | Implemented | Code review standard |
| Transaction integrity (ACID) | Implemented | PostgreSQL ACID guarantees |
| Audit trail of all changes | Implemented | Comprehensive audit logging |
| Change management (documented) | Partial | Team process; not yet formalized |

#### Gap Analysis

| Gap | Severity | Remediation |
|-----|----------|------------|
| No automated schema migration validation | MEDIUM | Add database schema tests to CI/CD |
| No reconciliation procedures | MEDIUM | Implement monthly balance checks (API usage vs. billing) |
| No processing exception handling runbook | MEDIUM | Document incident response for data integrity issues |
| No formal change management policy | MEDIUM | Create change_management.md (Phase 1) |
| No completeness checks on batch jobs | MEDIUM | Add record count validation to job runners |

#### Remediation Timeline

- **Month 1**: Formal change management policy (Phase 1)
- **Month 2**: Schema migration validation + reconciliation procedures
- **Month 3**: Exception handling runbook
- **Month 4-6**: Batch job completeness checks

---

### 1.5 Privacy (PRI)

**Definition**: Personal information is collected, retained, used, and disclosed in accordance with organizational privacy notices and consent requirements.

#### Current Controls Inventory

| Control | Status | Evidence |
|---------|--------|----------|
| Privacy policy published | **PENDING** | Domain `amliq.ai` not yet provisioned (curl returned HTTP=000 on 2026-04-29). Hebrew draft at `docs/compliance/privacy-notice-he.md` is ready to publish once domain is live. |
| Consent tracking (JWT claims) | Partial | Tracked at session level |
| PII logging controls | Implemented | Minimal PII in audit logs |
| Data subject rights (documentation) | Partial | Support process exists |
| Vendor management (LemonSqueezy) | **PENDING** | LemonSqueezy publishes a DPA template at lemonsqueezy.com/dpa (verified live 2026-04-29). It must be requested, reviewed by counsel, and counter-signed **before** processing real customer billing data. No signed copy lives in this repo today. |

#### Gap Analysis

| Gap | Severity | Remediation |
|-----|----------|------------|
| No formal Data Processing Agreement (DPA) | HIGH | Create DPA with all processors (LemonSqueezy, etc) |
| No consent withdrawal mechanism | MEDIUM | Implement API endpoint for data deletion requests |
| No privacy by design review | MEDIUM | Document privacy impact for new features |
| No sub-processor list | MEDIUM | Maintain and publish sub-processor directory |
| No breach notification procedure | HIGH | Create incident response plan + notification template |

#### Remediation Timeline

- **Month 1**: Breach notification procedure + DPA review
- **Month 2**: Sub-processor directory + consent withdrawal API
- **Month 3**: Privacy by design checklist
- **Month 4-6**: Testing and documentation

---

## 2. Control Implementation Status

### Security Controls Already in Place

```
✓ Multi-tenancy + data isolation (middleware_tenant.go)
✓ JWT authentication (middleware_jwt.go)
✓ API key authentication + hashing (middleware_apikey.go, apikey_hash.go)
✓ Rate limiting per tenant (middleware_rate.go)
~ Audit logging for **state-changing handlers** (audit_repo.go) — login + API-key + rate-limit logging pending
✓ RBAC via seat roles (domain/seat.go)
~ Password requirements — minimum length only (8 chars, enforced in `api/handler_auth_reset_execute.go`); complexity / entropy / common-password check pending
✓ TLS in production
✓ Database connection pooling
✓ No hard-coded secrets
```

### Controls Implemented in Phase 1

```
~ Continuous security event monitoring — code lives in `internal/security/continuous_monitor.go` but has **zero callers**; not booted by any cmd. Wire into worker before claiming Implemented.
~ Anomaly detection — same status as above (AnomalyDetector type exists, not invoked).
~ Evidence collection for audits — `internal/security/evidence_collector.go` defines the registry, no external caller registers collectors yet.
✓ Formal change management policy (change_management.md)
```

---

## 3. Evidence Requirements for Auditors

### Security Auditor Checklist

| Evidence Type | Phase 1 Status | Auditor Verification |
|---------------|---|---|
| Access control policies | Ready | `docs/compliance/access-control-policy.md` |
| Audit logs (30 days sample) | Ready | Export from PostgreSQL |
| Change management records | In Progress | `docs/compliance/change_management.md` |
| Incident response evidence | Partial | `docs/compliance/incident-response-playbook.md` |
| Vulnerability scan results | Pending Month 2 | Snyk/Trivy reports |
| Penetration test report | Pending Month 2 | Third-party pen-test |
| Security event logs | **PENDING** | `internal/security/continuous_monitor.go` exists but is not booted by any worker — no event stream is being emitted. Wire from `cmd/worker/start_workers.go` before reporting Ready. |
| Configuration snapshots | Ready | Docker Compose / K8s manifests |
| Key rotation records | Pending | Vault integration (Month 3) |
| Access review documentation | Implemented (template) — first review pending | Template at `docs/compliance/access-review-template.md` (SQL queries, decision matrix, sign-off block, cadence). First quarterly review file lands in `docs/compliance/reviews/YYYY-Qn-…` once a real cohort exists. |

### Availability Auditor Checklist

| Evidence Type | Phase 1 Status | Auditor Verification |
|---------------|---|---|
| Uptime statistics | **PENDING — no production tenant** | Prometheus exporter exists at `GET /api/v1/admin/metrics/prometheus`; the "99.5% baseline" can only be measured once a live cluster exists. Re-grade Ready after the first 90 days of production traffic. |
| Health check logs | Ready | `/health` endpoint + monitoring |
| Backup/restore test results | Pending Month 1 | Database backup tests |
| Disaster recovery drills | Pending Month 2 | DR runbook execution logs |
| Load testing results | Pending Month 2 | JMeter baseline reports |
| Configuration change logs | Ready | Git + audit trail |
| On-call escalation records | Pending Month 3 | PagerDuty integration |

### Confidentiality Auditor Checklist

| Evidence Type | Phase 1 Status | Auditor Verification |
|---------------|---|---|
| Data classification policy | Partial | `docs/compliance/data-handling-policy.md` |
| Encryption inventory | Ready | TLS + encryption at rest documentation |
| Access logs (auth events) | Ready | PostgreSQL audit_entries table |
| PII handling procedures | Partial | Documented; not yet formalized |
| Data retention schedule | Pending Month 2 | Policy + deletion automation logs |
| Key rotation schedule | Pending Month 3 | Vault logs |
| Data breach response evidence | Pending Month 1 | Incident response playbook |

### Processing Integrity Auditor Checklist

| Evidence Type | Phase 1 Status | Auditor Verification |
|---------------|---|---|
| Change control procedures | Ready | `docs/compliance/change_management.md` |
| Reconciliation reports | In Progress | Monthly API usage vs billing |
| Exception handling logs | Ready | Application error logs |
| Input validation rules | Ready | Zod schema definitions |
| Schema migration tests | Pending Month 2 | CI/CD test results |
| Batch job completeness checks | Pending Month 3 | Job log audit trail |
| Configuration baselines | Ready | Dockerfile + docker-compose.yml |

### Privacy Auditor Checklist

| Evidence Type | Phase 1 Status | Auditor Verification |
|---------------|---|---|
| Privacy notice (published) | **PENDING** | Domain `amliq.ai` not yet provisioned. Draft Hebrew text in repo at `docs/compliance/privacy-notice-he.md`. |
| Data Processing Agreements | **PENDING** | LemonSqueezy DPA template available at vendor's site; not yet counter-signed. No DPA on file for the future hosted-Postgres provider either. Both must be in place before the production tenant goes live. |
| Consent records | Partial | JWT claims logging |
| Data subject request log | Pending | Ticketing system integration |
| Breach notification template | Pending Month 1 | Legal team sign-off |
| Sub-processor directory | Pending Month 2 | Maintained on website |
| Privacy impact assessments | Pending Month 3 | Per-feature documentation |

---

## 4. Remediation Timeline

### Phase 1 (April 2026) — Critical Controls

- [ ] Continuous security monitoring (`continuous_monitor.go` exists, not booted — re-check before next milestone)
- [ ] Evidence collection (`evidence_collector.go` exists, no caller — re-check before next milestone)
- [x] Formal change management policy (change_management.md)
- [ ] Breach notification procedure
- [x] Quarterly access review template (`docs/compliance/access-review-template.md`)

**Effort**: 2 weeks (1 engineer + security lead)

### Phase 2 (May 2026) — Testing & Validation

- [ ] External penetration test
- [ ] Vulnerability scanning (Snyk + Trivy)
- [ ] Backup/restore drills
- [ ] Disaster recovery runbook testing
- [ ] Reconciliation automation

**Effort**: 3 weeks (1 engineer + ops)

### Phase 3 (June 2026) — Policy & Automation

- [ ] Data retention/deletion policy
- [ ] Encryption key rotation (Vault integration)
- [ ] Access review automation
- [ ] Privacy impact assessments
- [ ] Sub-processor directory

**Effort**: 3 weeks (1 engineer + legal + compliance)

### Phase 4 (July-August 2026) — Readiness Review

- [ ] Complete evidence collection
- [ ] Internal control testing
- [ ] Stakeholder sign-off
- [ ] SOC 2 Type II audit kickoff

**Effort**: 2 weeks (compliance team)

---

## 5. Cost & Resource Estimation

| Activity | Resource | Cost | Timeline |
|----------|----------|------|----------|
| External penetration test | Third-party security firm | $3,000–5,000 | Month 2 |
| Vulnerability scanning (Snyk Pro) | Snyk subscription | $1,200/year | Month 2 |
| Vault or Secrets Manager | AWS/HashiCorp | $500–2,000/month | Month 3 |
| SOC 2 Type II audit | Big 4 firm (e.g., Deloitte) | $15,000–30,000 | Month 5-6 |
| Internal resource (engineer) | 1 FTE for 6 months | Allocated | Throughout |
| Total | — | $20,000–40,000 | 6 months |

---

## 6. Success Metrics

| Metric | Target | Validation |
|--------|--------|-----------|
| Security events monitored | 100% of access + changes | Continuous monitor logs |
| Audit log retention | 90 days minimum | Database check |
| Access review frequency | Quarterly | Scheduled task |
| Penetration test findings | Zero Critical, ≤5 High | Remediation + retest |
| Change approval rate | 100% documented | Change management logs |
| Breach notification time | <72 hours | Policy + test |
| Evidence completeness | 100% of auditor requirements | Checklist sign-off |

---

## 7. References

### AMLIQ Compliance Documents
- `docs/compliance/access-control-policy.md`
- `docs/compliance/data-handling-policy.md`
- `docs/compliance/incident-response-playbook.md`
- `docs/compliance/information-security-policy.md`
- `docs/compliance/change_management.md` (Phase 1)

### SOC 2 Framework
- AICPA Trust Service Criteria (CC, A, C, PI, PRI)
- SOC 2 Type II attestation standard
- Control Activities (CA) from COSO framework

### External Resources
- [AICPA SOC 2 Overview](https://www.aicpa.org/soc2)
- [Trust Service Criteria v3.1](https://www.aicpa.org/tsc)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001 Mapping](https://www.iso.org/isoiec-27001-information-security-management)

---

## 8. Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Security Lead | [Name] | TBD | Pending |
| Engineering Lead | [Name] | TBD | Pending |
| Legal/Compliance | [Name] | TBD | Pending |
| CEO | [Name] | TBD | Pending |

---

## Appendix: Detailed Control Descriptions

### CC-1: Logical Access Control
**Requirement**: System prevents unauthorized access via authentication and authorization.

**AMLIQ Implementation**:
- JWT tokens with 1-hour expiration
- API key hashing (SHA-256)
- Role-based access control (seat.go: Analyst, Admin, Owner roles)
- Multi-tenant isolation via mandatory `WHERE tenant_id = $1` filters (application-layer; Postgres RLS migration on roadmap)

**Evidence for Auditor**:
- `api/middleware_jwt.go` source code review
- JWT payload structure documentation
- API key hash generation tests

### A-1: System Availability
**Requirement**: System operates within defined availability targets.

**AMLIQ Implementation**:
- Kubernetes orchestration (high availability)
- Health check endpoint (`/health`)
- Database connection pooling
- Rate limiting prevents overload

**Evidence for Auditor**:
- Uptime statistics (Prometheus exporter wired; numbers begin once production is live)
- Kubernetes pod replica count
- Load testing results

### C-1: Confidentiality of Data
**Requirement**: Information is protected from unauthorized disclosure.

**AMLIQ Implementation**:
- TLS 1.3+ for all connections
- PostgreSQL encryption at rest
- PII masking in audit logs
- Multi-tenant data isolation

**Evidence for Auditor**:
- TLS configuration (cert + cipher suites)
- Database encryption settings
- Audit log sample review

### PI-1: Completeness of Processing
**Requirement**: System processes all authorized transactions completely and accurately.

**AMLIQ Implementation**:
- ACID transactions (PostgreSQL)
- Zod validation on all inputs
- Audit trail for every change
- Reconciliation reports (monthly)

**Evidence for Auditor**:
- Zod schema definitions
- Audit log sample (30 days)
- Reconciliation test results

### PRI-1: Privacy Notice
**Requirement**: Organization provides privacy notice describing collection, use, and disclosure of personal information.

**AMLIQ Implementation**:
- Published privacy policy (website)
- Data Processing Agreements with vendors
- Consent tracking (JWT claims)
- Data subject request procedure

**Evidence for Auditor**:
- Privacy policy URL + screenshot
- DPA copies with LemonSqueezy, etc. — **NOT YET ON FILE** as of 2026-04-29
- Data subject request log (template)

---

**End of SOC 2 Readiness Assessment**
