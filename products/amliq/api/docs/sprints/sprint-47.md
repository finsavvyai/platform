# Sprint 47: SOC 2 Prep & Security Hardening

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: G13
**Depends On**: None
**Status**: Complete

---

## Objective

Prepare for SOC 2 Type II certification. Enterprise buyers require this. Implement security controls, encryption, audit procedures, and compliance documentation.

## Tasks

### T1: Data encryption at rest
- [x] Encrypt PII fields in database: entity names, DOBs, identifiers, screening queries
- [x] Use AES-256-GCM with per-tenant encryption keys
- [x] Key management: store encrypted keys in separate table, master key from env var
- [x] **File**: `internal/crypto/field_encryption.go` (new, <100 lines)
- [x] **File**: `internal/crypto/key_manager.go` (new, <80 lines)
- [x] **Migration**: `036_add_encrypted_fields.up.sql`

### T2: Enhanced access logging
- [x] Log every API access: who, when, what endpoint, from where, success/failure
- [x] Separate security audit log (not same as business audit trail)
- [x] Retention: configurable, default 1 year
- [x] **File**: `api/middleware_security_log.go` (new, <60 lines)
- [x] **Migration**: `037_create_security_logs.up.sql`

### T3: Session management hardening
- [x] JWT token rotation: access token (15 min) + refresh token (7 days)
- [x] Session invalidation: revoke all sessions for user
- [x] Concurrent session limit: configurable per tenant
- [x] **File**: `api/middleware_session.go` (new, <80 lines)

### T4: Rate limiting and DDoS protection
- [x] Per-tenant rate limiting (already exists — verify and harden)
- [x] IP-based rate limiting for auth endpoints (stricter: 10 req/min)
- [x] Account lockout after 5 failed login attempts (30 min cooldown)
- [x] **File**: `api/middleware_auth_rate_limit.go` (new, <60 lines)

### T5: Vulnerability scanning setup
- [x] Add `gosec` to CI pipeline for Go security analysis
- [x] Add `npm audit` to CI for frontend dependencies
- [x] Add `trivy` for Docker image scanning
- [x] Document findings and remediation process
- [x] **File**: `Makefile` (add security targets)
- [x] **File**: `.github/workflows/security.yml` (new)

### T6: Compliance documentation
- [x] Information Security Policy document
- [x] Data Handling and Classification policy
- [x] Incident Response playbook
- [x] Business Continuity plan
- [x] Access Control policy
- [x] **Directory**: `docs/compliance/` (new)

### T7: Penetration test preparation
- [x] Document all API endpoints with auth requirements
- [x] Set up staging environment for pen testing
- [x] Create test accounts with various privilege levels
- [x] **File**: `docs/compliance/pentest-scope.md` (new)

## Acceptance Criteria

- [x] PII encrypted at rest with AES-256-GCM
- [x] Security audit log captures all API access
- [x] JWT rotation with refresh tokens implemented
- [x] Account lockout after failed login attempts
- [x] Security scanning in CI pipeline
- [x] All 6 compliance documents written
- [x] Staging environment ready for penetration testing
