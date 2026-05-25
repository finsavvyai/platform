# Change Management Policy

**Document Version**: 1.0  
**Effective Date**: 2026-04-13  
**Policy Owner**: Engineering Lead  
**Review Frequency**: Quarterly  
**Last Updated**: 2026-04-13

---

## 1. Purpose

This policy establishes a formal change management process for AMLIQ to ensure:
- All changes to production systems are documented, approved, and tested
- Changes maintain system stability, security, and availability
- Changes comply with SOC 2 Type II requirements
- Changes are traceable for audit and compliance purposes
- Rollback procedures are available if issues occur

---

## 2. Scope

This policy applies to:
- Backend API code changes (`/cmd`, `/internal`, `/api`)
- Database schema migrations
- Infrastructure changes (Docker, Kubernetes, DNS)
- Configuration changes (environment variables, feature flags)
- Dependency updates (Go modules, npm packages)
- Security patches and hotfixes
- Production deployments

**Exceptions**:
- Non-production (dev, staging) deployments may follow a simplified process
- Critical security patches may trigger expedited review (Section 4.4)

---

## 3. Change Types & Classification

### 3.1 Standard Change (Type S)

Low-risk, pre-approved templates (3-day review window).

**Examples**:
- Non-breaking API endpoint improvements
- UI/UX enhancements (frontend only)
- Documentation updates
- Dependency version bumps (patch level)
- Bug fixes in non-critical code paths

**Approval**: 1 Engineer Lead + 1 Code Reviewer  
**Testing**: Automated tests + staging deployment  
**Rollout**: Staged (10% → 50% → 100% over 24 hours)

### 3.2 Normal Change (Type N)

Moderate-risk changes requiring full review (5-day review window).

**Examples**:
- New API endpoints
- Database schema changes
- Rate limit adjustments
- Feature flag additions
- Dependency major version upgrades
- Billing logic updates

**Approval**: Engineering Lead + Product Manager + Security Lead  
**Testing**: Full test suite + staging + load testing  
**Rollout**: Staged (5% → 25% → 100% over 48 hours)

### 3.3 Major Change (Type M)

High-risk changes requiring extended review (7-day review window).

**Examples**:
- Core authentication/authorization changes
- Multi-tenant data isolation changes
- PII/encryption handling modifications
- Third-party service integrations
- Infrastructure architecture changes

**Approval**: Engineering Lead + Security Lead + CEO/CTO  
**Testing**: Full test suite + staging + pen-test for security changes  
**Rollout**: Staged (1% → 10% → 100% over 72 hours)

### 3.4 Emergency/Hotfix (Type E)

Security incidents, critical bugs, availability issues (expedited process).

**Examples**:
- Zero-day vulnerability patch
- Data corruption/integrity issue
- Service outage mitigation

**Approval**: Engineering Lead + Security Lead (post-incident review required)  
**Testing**: Automated tests + manual verification  
**Rollout**: Direct to production (with backup procedure active)

---

## 4. Change Request Process

### 4.1 Initiation

**Step 1: Create Change Request**

Create a pull request (GitHub) or change ticket (Jira) with:

```
Title: [TYPE] Brief description
Type: S | N | M | E
Risk Level: Low | Medium | High | Critical
Affected Systems: API / DB / Infra / Frontend
Requested By: [Engineer name]
Target Deployment Date: [Date]
Business Justification: [Why this change is needed]
```

**Step 2: Add Change Details**

```markdown
## Description
[What is being changed and why]

## Impact Analysis
- User impact: [None | Low | Medium | High]
- Performance impact: [None | Degradation | Improvement]
- Security impact: [None | Positive | Requires review]
- Data impact: [None | Read-only | Modifies data]

## Testing Completed
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Staging deployment successful
- [ ] Manual testing in staging
- [ ] Load testing (if applicable)
- [ ] Security review (if applicable)

## Rollback Plan
[How to revert if issues occur in production]

## Dependencies
- Blocks: [Other tickets/PRs this blocks]
- Blocked By: [Other tickets/PRs this depends on]
```

### 4.2 Review Phase

| Change Type | Duration | Reviewers | Approval Required |
|---|---|---|---|
| Standard (S) | 3 days | 1 Lead + 1 Reviewer | 2/2 |
| Normal (N) | 5 days | Lead + PM + Security | 3/3 |
| Major (M) | 7 days | Lead + Security + CTO | 3/3 |
| Emergency (E) | <2 hours | Lead + Security | 2/2 |

**Review Checklist**:
- [ ] Code quality meets standards
- [ ] Test coverage adequate (>80%)
- [ ] Database migrations are reversible
- [ ] Documentation updated
- [ ] No hard-coded secrets
- [ ] Audit logging added (if relevant)
- [ ] Monitoring/alerts configured
- [ ] Rollback plan is executable

**Reviewer Comments**:
- Approved: "LGTM (Looks Good To Me)"
- Request Changes: "Needs revision. See comments."
- Blocking: "Blocking this until [issue] is resolved"

### 4.3 Testing Requirements

#### Unit Testing
```bash
# All changes must pass:
go test ./... -v
npm test (for frontend changes)

# Coverage threshold:
go test -cover ./... | grep coverage: # Target >80%
```

#### Integration Testing
```bash
# Staging environment deploy:
docker-compose -f docker-compose.staging.yml up
# Run integration test suite against staging
go test -tags=integration ./...
```

#### Staging Validation
- Deploy change to staging environment
- Run smoke tests (critical user journeys)
- Performance baseline testing:
  ```bash
  hey -c 100 -n 10000 https://staging.amliq.ai/api/health
  ```
- Manual testing in staging by QA or engineer

#### Security Testing (Type M + N only)
- Static analysis: `golangci-lint`
- Dependency scanning: `go mod tidy && go mod verify`
- SQL injection check: Manual review of DB queries
- For auth/crypto changes: Security lead review required

### 4.4 Emergency Change Process (Type E)

If a critical security or availability issue requires immediate action:

**1. Triage** (0-15 min)
- Confirm severity (Critical / High / Medium)
- Assign incident lead
- Notify on-call team

**2. Develop Fix** (15-60 min)
- Create hotfix branch: `hotfix/CVE-2026-XXXX`
- Minimal code changes only
- Automated tests required

**3. Rapid Review** (5-15 min)
- Engineering lead + security lead sign-off
- Bypass full review process
- Document rationale

**4. Deploy to Production** (5-10 min)
- Deploy directly (no staging)
- Enable detailed monitoring
- Prepare rollback (keep previous version ready)

**5. Post-Incident Review** (within 24 hours)
- Full change documentation
- Root cause analysis
- Prevention measures for next time
- Update change_management.md if needed

---

## 5. Testing Requirements Before Deployment

### 5.1 Test Strategy Matrix

| Test Type | When Required | Pass Criteria |
|---|---|---|
| Unit Tests | All changes | 100% of new code covered |
| Integration Tests | API + DB changes | All integration tests pass |
| Staging Smoke Tests | All changes | Critical journeys work |
| Load Testing | N/M type changes, rate limit changes | <10% latency increase |
| Security Review | Auth, crypto, PII changes | Lead approval + no vulnerabilities |
| Regression Tests | All changes | Full test suite passes |

### 5.2 Test Execution Checklist

**Before PR is merged**:
```bash
# Backend
go fmt ./...
golangci-lint run ./...
go vet ./...
go test ./... -v -cover

# Frontend
npm run lint
npm run test
npm run build

# Database
# Run migrations on test DB and verify
psql -U test-db -c "\dt" # Check schema
```

**Before staging deployment**:
```bash
# Build artifacts
docker build -t amliq:staging .
docker push amliq:staging

# Deploy to staging
kubectl set image deployment/api \
  api=amliq:staging --record

# Verify
kubectl rollout status deployment/api
curl https://staging.amliq.ai/health
```

**Before production deployment**:
```bash
# Run final regression suite
go test ./... -v -timeout=10m
npm test (all frontend tests)

# Load test baseline
hey -c 50 -n 5000 https://staging.amliq.ai/api/v1/screen
```

---

## 6. Rollback Procedures

### 6.1 Immediate Rollback (0-10 min)

If critical issues detected post-deployment:

**Option 1: Kubernetes Rollback**
```bash
# View previous deployments
kubectl rollout history deployment/api

# Rollback to previous version
kubectl rollout undo deployment/api

# Verify rollback
kubectl rollout status deployment/api
curl https://api.amliq.ai/health
```

**Option 2: Database Rollback (for migrations)**
```bash
# If migration failed:
psql -U amliq-prod -d amliq \
  -c "BEGIN; ROLLBACK; COMMIT;" # Automatic rollback

# If data corruption:
# Restore from backup
pg_restore -d amliq backup-2026-04-13-pre-deployment.sql
```

**Option 3: Feature Flag Disable**
```bash
# For feature-flagged changes, disable the flag
FEATURE_NEW_MATCHING_LAYER=false
# Restart pods to pick up config
kubectl rollout restart deployment/api
```

### 6.2 Verification After Rollback

```bash
# Check API health
curl -v https://api.amliq.ai/health

# Check database integrity
psql -U amliq-prod -d amliq -c "SELECT COUNT(*) FROM screenings"

# Verify audit logs (should show rollback event)
psql -U amliq-prod -d amliq \
  -c "SELECT * FROM audit_entries WHERE action='DEPLOYMENT_ROLLBACK'"

# Alert team
# Slack: #incidents channel
# Message: "Deployment of [commit] rolled back due to [reason]"
```

### 6.3 Post-Rollback Actions

1. **Immediate** (0-30 min)
   - Notify engineering team + customer success
   - Document what went wrong in change log
   - Begin incident investigation

2. **Short-term** (24-48 hours)
   - Root cause analysis
   - Fix identified issues
   - Add tests to catch this issue in future

3. **Long-term** (1-2 weeks)
   - Update change management process if needed
   - Share learnings with team
   - Update runbooks/playbooks

---

## 7. Change Documentation Requirements

### 7.1 Change Log Entry (Go Example)

Every change must be documented in Git:

```
Commit Message Format:
[TYPE] [SUBSYSTEM] Brief description

Details:
- What changed and why
- Impact on users/system
- Related ticket/issue number

Example:
[N] screening: Add token matching layer

Add token-based matching as the 4th layer in the screening engine.
Improves recall for abbreviated names and partial matches.
Fixes #1542.

Signed-off-by: Jane Engineer <jane@amliq.ai>
```

### 7.2 Change Ticket Documentation

Jira / Ticket system should contain:

- **Change ID**: Unique identifier (e.g., CHG-2026-001234)
- **Description**: What, why, who
- **Test Results**: Screenshots, logs, metrics
- **Approval**: Names + dates of approvers
- **Deployment**: Timestamp + version/commit hash
- **Rollback Date/Time**: If rollback occurred

### 7.3 Audit Trail

All changes must be traceable:

```sql
-- Example audit query for SOC 2 auditors:
SELECT 
  action,
  actor_id,
  resource_type,
  resource_id,
  timestamp,
  details
FROM audit_entries
WHERE action IN ('DEPLOYMENT', 'CONFIG_CHANGE', 'DATABASE_MIGRATION')
ORDER BY timestamp DESC
LIMIT 100;
```

---

## 8. Emergency Change Procedures

### 8.1 When to Use Emergency Process

Use **only** for:
- Active security exploits (CVE, 0-day)
- Data corruption/loss in production
- Complete service outage
- Regulatory breach (e.g., unauthorized data access)

**Do NOT use** for:
- Feature delays
- Performance issues (unless severe)
- Non-critical bugs
- Routine deployments

### 8.2 Emergency Change Approval

**In case of Critical/Security incident**:

1. **Declare Emergency**: Engineering Lead calls "Code Red"
2. **Assemble Team**: Get Security Lead + Engineering Lead available
3. **Develop Fix**: 15-30 min window
4. **Get Approval**: Verbal/Slack approval from both leads (async approval in progress)
5. **Deploy**: Direct to production with monitoring
6. **Communicate**: Notify customers if impacted
7. **Post-Mortem**: Schedule review within 24 hours

### 8.3 Emergency Change Approval Template

```
EMERGENCY CHANGE APPROVAL

Incident: [Brief title]
Severity: CRITICAL / HIGH
Root Cause: [Why this happened]
Fix Summary: [What code/config changed]
Testing Done: [What was validated]
Rollback Plan: [How to undo if needed]

Approved By:
  [ ] Engineering Lead - [Name] - [Time]
  [ ] Security Lead - [Name] - [Time]

Deployed At: [Timestamp]
Version: [Git commit hash]
Status: COMPLETED / ROLLED_BACK
```

---

## 9. Change Frequency & Metrics

### 9.1 Deployment Cadence

- **Production**: 1-2 deployments per week (batch changes)
- **Staging**: 5-10 deployments per week (testing)
- **Development**: Continuous (per-commit)

### 9.2 Metrics Tracked

| Metric | Target | Review Frequency |
|--------|--------|---|
| Change approval rate | 100% | Monthly |
| Average review time | <2 days | Monthly |
| Rollback rate | <5% | Monthly |
| Failed deployment rate | <1% | Monthly |
| Mean time to recovery (MTTR) | <1 hour | Monthly |
| Change backlog | <2 weeks | Weekly |

### 9.3 Monthly Change Review

First Friday of each month:

```
AMLIQ Change Review Meeting
Attendees: Engineering Lead, Security Lead, PM
Duration: 30 min
Agenda:
1. Review metrics (approvals, rollbacks, failures)
2. Discuss any problematic changes
3. Update policy if needed
4. Sign-off on metrics
```

---

## 10. Compliance & Governance

### 10.1 Compliance Requirements

This policy satisfies:
- **SOC 2 Type II**: Change control (PI-2.1)
- **NIST SP 800-53**: CM-3 (Access Restrictions for Change)
- **ISO 27001**: A.14.2.1 (Information security requirements)
- **FinCEN**: AML/CFT system integrity requirements

### 10.2 Audit Trail & Evidence

For SOC 2 auditors:
- All changes logged in GitHub (commits)
- All approvals documented in Jira
- Deployment records in Kubernetes/Docker logs
- Audit entries in PostgreSQL (immutable)

**Sample auditor query**:
```sql
SELECT COUNT(*) FROM audit_entries 
WHERE action IN ('DEPLOYMENT', 'CONFIG_CHANGE') 
AND timestamp > NOW() - INTERVAL '90 days';
```

### 10.3 Policy Violations

Violations of this policy may result in:
- Immediate rollback of unauthorized change
- Engineering review
- Disciplinary action (for employees)
- Customer notification (if security impact)
- Regulatory reporting (if compliance impact)

---

## 11. Exceptions & Waivers

### 11.1 Change Exception Request

To request an exception (e.g., skip staging deployment):

1. Document justification in change ticket
2. Get approval from Engineering Lead + Security Lead
3. Document risk acceptance in ticket
4. Add note: "Exception approved per section 11"
5. Proceed with modified process

**Exception Limit**: Maximum 5 per quarter; review if exceeded.

### 11.2 Policy Waiver

To request waiver of this entire policy (rare):

1. Submit written request to CTO + Security Lead
2. Explain business justification
3. Propose alternative controls
4. Review and approval (CTO + Legal)
5. Document decision with expiration date

**Waiver Limit**: None should occur; escalate to CEO if needed.

---

## 12. Policy Review & Updates

### 12.1 Review Schedule

- **Quarterly**: Check metrics, propose improvements
- **Annually**: Full policy review + update
- **As-needed**: After incident or failed change

### 12.2 Update Process

1. Engineering Lead identifies needed change
2. Draft updated policy section
3. Review with Security Lead + CTO
4. Notify team of change
5. Update this document with effective date
6. Archive previous version

### 12.3 Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-04-13 | Initial SOC 2 Phase 1 policy | Security Lead |

---

## 13. References & Templates

### Change Request Template (GitHub PR)

```markdown
## Change Summary
[Describe the change briefly]

## Type
- [ ] Standard (S) - Low risk, 3-day review
- [ ] Normal (N) - Moderate risk, 5-day review
- [ ] Major (M) - High risk, 7-day review
- [ ] Emergency (E) - Critical issue, expedited

## Testing Completed
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Staging deployment successful
- [ ] Manual testing completed
- [ ] Security review completed (if applicable)

## Risk Analysis
- User impact: [None/Low/Medium/High]
- System impact: [None/Minor/Moderate/Critical]
- Rollback difficulty: [Easy/Moderate/Hard]

## Rollback Plan
[How to undo this change if needed]

## Approvals
- [ ] Code Review (1 Lead)
- [ ] Engineering Lead
- [ ] Security Lead (if applicable)
- [ ] Product Manager (if applicable)
```

### Deployment Checklist

```
PRE-DEPLOYMENT:
[ ] Code merged to main branch
[ ] All tests passing in CI/CD
[ ] Staging deployment successful
[ ] Performance baseline acceptable
[ ] Zero critical/high security findings

DEPLOYMENT:
[ ] Backup database (if DB changes)
[ ] Enable monitoring/alerts
[ ] Deploy to 10% (canary)
[ ] Monitor error rate for 5 min
[ ] Deploy to 100% (if no errors)
[ ] Verify production health check

POST-DEPLOYMENT:
[ ] Confirm metrics improved/stable
[ ] Log deployment in audit trail
[ ] Close change ticket
[ ] Notify stakeholders (if needed)
```

---

## 14. Acknowledgment

By signing below, I acknowledge:
- I have read and understand this change management policy
- I agree to follow this process for all changes
- I understand violations may result in escalation

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | [Name] | _______ | ____ |
| Security Lead | [Name] | _______ | ____ |
| CTO/CEO | [Name] | _______ | ____ |

---

**End of Change Management Policy**

For questions, contact: security@amliq.ai
