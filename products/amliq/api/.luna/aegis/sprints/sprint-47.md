# Sprint 47: SOC 2 Prep & Security Hardening

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: G13
**Depends On**: None
**Status**: Not Started

---

## Objective

Prepare for SOC 2 Type II certification. Enterprise buyers require this. Implement security controls, encryption, audit procedures, and compliance documentation.

## Tasks

### T1: Data encryption at rest
- [ ] Encrypt PII fields in database: entity names, DOBs, identifiers, screening queries
- [ ] Use AES-256-GCM with per-tenant encryption keys
- [ ] Key management: store encrypted keys in separate table, master key from env var
- [ ] **File**: `internal/crypto/field_encryption.go` (new, <100 lines)
- [ ] **File**: `internal/crypto/key_manager.go` (new, <80 lines)
- [ ] **Migration**: `036_add_encrypted_fields.up.sql`

### T2: Enhanced access logging
- [ ] Log every API access: who, when, what endpoint, from where, success/failure
- [ ] Separate security audit log (not same as business audit trail)
- [ ] Retention: configurable, default 1 year
- [ ] **File**: `api/middleware_security_log.go` (new, <60 lines)
- [ ] **Migration**: `037_create_security_logs.up.sql`

### T3: Session management hardening
- [ ] JWT token rotation: access token (15 min) + refresh token (7 days)
- [ ] Session invalidation: revoke all sessions for user
- [ ] Concurrent session limit: configurable per tenant
- [ ] **File**: `api/middleware_session.go` (new, <80 lines)

### T4: Rate limiting and DDoS protection
- [ ] Per-tenant rate limiting (already exists — verify and harden)
- [ ] IP-based rate limiting for auth endpoints (stricter: 10 req/min)
- [ ] Account lockout after 5 failed login attempts (30 min cooldown)
- [ ] **File**: `api/middleware_auth_rate_limit.go` (new, <60 lines)

### T5: Vulnerability scanning setup
- [ ] Add `gosec` to CI pipeline for Go security analysis
- [ ] Add `npm audit` to CI for frontend dependencies
- [ ] Add `trivy` for Docker image scanning
- [ ] Document findings and remediation process
- [ ] **File**: `Makefile` (add security targets)
- [ ] **File**: `.github/workflows/security.yml` (new)

### T6: Compliance documentation
- [ ] Information Security Policy document
- [ ] Data Handling and Classification policy
- [ ] Incident Response playbook
- [ ] Business Continuity plan
- [ ] Access Control policy
- [ ] **Directory**: `docs/compliance/` (new)

### T7: Penetration test preparation
- [ ] Document all API endpoints with auth requirements
- [ ] Set up staging environment for pen testing
- [ ] Create test accounts with various privilege levels
- [ ] **File**: `docs/compliance/pentest-scope.md` (new)

## Acceptance Criteria

- [ ] PII encrypted at rest with AES-256-GCM
- [ ] Security audit log captures all API access
- [ ] JWT rotation with refresh tokens implemented
- [ ] Account lockout after failed login attempts
- [ ] Security scanning in CI pipeline
- [ ] All 6 compliance documents written
- [ ] Staging environment ready for penetration testing
