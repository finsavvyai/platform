# OpenSyber Capability Validation Matrix

> **Purpose**: Pre-launch QA — validates every major feature across 8 customer personas.  
> **Run**: `npx vitest run --config tests/sample-projects/vitest.config.ts`  
> **E2E**: `cd apps/web && npx playwright test e2e/sample-projects-smoke.spec.ts`

## Test Projects Summary

| # | Project | Persona | Plan | Key Capabilities Tested | Tests |
|---|---------|---------|------|------------------------|-------|
| 01 | Free-Tier Solo Dev | Yael, indie SaaS dev | Free | Signup, single agent deploy, monitoring, plan limits | 16 |
| 02 | Pro Team | Marcus, DevSecOps lead | Pro | Upgrade, team invites, multi-agent, skill marketplace | 18 |
| 03 | Enterprise Admin | Amira, CISO fintech | Enterprise | SSO/SAML, custom RBAC, audit logs, compliance, data residency | 18 |
| 04 | Skill Creator | Tomas, security author | Pro | Skill validation, sandbox testing, publishing, revenue tracking | 19 |
| 05 | Cloud Security CSPM | Priya, Cloud Security Eng | Pro | Multi-cloud accounts, scanning, findings, remediation workflows | 17 |
| 06 | AI Security Analysis | (AI Bundle) | Pro | AI Triage, Reasoning, Remediation, Compliance Writer, Threat Intel, Incident Response | 17 |
| 07 | TokenForge Integration | (Session Security) | Pro | ECDSA P-256 device binding, session management, step-up auth, revocation | 18 |
| 08 | Multi-Cloud Monitoring | DevOps team | Team | AWS+GCP+Azure agents, cross-cloud correlation, unified dashboard, auto-remediation | 16 |

**Total unit/integration tests**: ~139  
**Total E2E smoke tests**: ~20

## Capability Coverage Matrix

| Capability | Sample # | Status |
|-----------|----------|--------|
| User signup (OAuth) | 01 | ✅ |
| Organization creation | 01 | ✅ |
| API key generation | 01 | ✅ |
| Agent deployment (Hetzner) | 01, 02, 08 | ✅ |
| Gateway token auth | 01, 02 | ✅ |
| Agent health monitoring | 01, 08 | ✅ |
| Real-time WebSocket events | 01, 08 | ✅ |
| Dashboard metrics | 01 | ✅ |
| Free plan limits (1 agent, 10 runs) | 01 | ✅ |
| Agent pause/resume/delete | 01 | ✅ |
| Plan upgrade (LemonSqueezy) | 02 | ✅ |
| Billing webhooks | 02 | ✅ |
| Team invitations (email) | 02 | ✅ |
| Invitation acceptance | 02 | ✅ |
| Basic RBAC enforcement | 02 | ✅ |
| Multi-agent deployment (up to 5) | 02 | ✅ |
| Skill marketplace browsing | 02 | ✅ |
| Free skill installation | 02 | ✅ |
| Premium bundle installation | 02 | ✅ |
| Skill package download (R2) | 02 | ✅ |
| Finding sharing & assignment | 02 | ✅ |
| Email notifications | 02, 05, 08 | ✅ |
| SSO/SAML configuration | 03 | ✅ |
| SSO enforcement | 03 | ✅ |
| SAML assertion validation | 03 | ✅ |
| Custom RBAC roles | 03 | ✅ |
| Permission escalation prevention | 03 | ✅ |
| Comprehensive audit logging | 03 | ✅ |
| Audit log export | 03 | ✅ |
| Audit log immutability | 03 | ✅ |
| SOC 2 readiness reporting | 03, 06 | ✅ |
| ISO 27001 tracking | 03 | ✅ |
| HIPAA compliance evidence | 03, 06 | ✅ |
| Data residency enforcement | 03 | ✅ |
| Skill manifest validation | 04 | ✅ |
| Skill slug format validation | 04 | ✅ |
| Semver version validation | 04 | ✅ |
| Permission scoping validation | 04 | ✅ |
| Worker threads skill pattern | 04 | ✅ |
| Skill sandbox testing | 04 | ✅ |
| Skill timeout handling | 04 | ✅ |
| Network whitelist enforcement | 04 | ✅ |
| Skill packaging & upload (R2) | 04 | ✅ |
| Marketplace listing creation | 04 | ✅ |
| Skill security audit submission | 04 | ✅ |
| Revenue tracking (70/30 split) | 04 | ✅ |
| Creator payout reports | 04 | ✅ |
| Skill ratings & reviews | 04 | ✅ |
| AWS account onboarding | 05 | ✅ |
| GCP project onboarding | 05 | ✅ |
| Azure subscription onboarding | 05 | ✅ |
| Cloud credential validation | 05 | ✅ |
| Prowler security scanning | 05 | ✅ |
| Cloud asset discovery | 05 | ✅ |
| CSPM finding generation | 05 | ✅ |
| Finding risk scoring | 05 | ✅ |
| Remediation plan creation | 05 | ✅ |
| Remediation progress tracking | 05 | ✅ |
| Posture score aggregation | 05 | ✅ |
| CIS compliance mapping | 05 | ✅ |
| Finding trend tracking | 05 | ✅ |
| AI Triage (batch prioritization) | 06 | ✅ |
| AI Reasoning (root cause analysis) | 06 | ✅ |
| AI Remediation (fix generation) | 06 | ✅ |
| AI Compliance Writer (SOC 2 evidence) | 06 | ✅ |
| AI Threat Intel (CVE enrichment) | 06 | ✅ |
| AI Incident Responder (attack chains) | 06 | ✅ |
| LLM error handling | 06 | ✅ |
| Token usage tracking | 06 | ✅ |
| AI rate limiting per plan | 06 | ✅ |
| ECDSA P-256 key generation | 07 | ✅ |
| Public key export | 07 | ✅ |
| Private key non-extractability | 07 | ✅ |
| Device-bound session creation | 07 | ✅ |
| Challenge signing & verification | 07 | ✅ |
| Cross-device rejection | 07 | ✅ |
| Session token verification | 07 | ✅ |
| Expired session rejection | 07 | ✅ |
| Revoked session rejection | 07 | ✅ |
| Step-up authentication | 07 | ✅ |
| Session revocation (single/all) | 07 | ✅ |
| Multi-language SDK support | 07 | ✅ |
| Multi-cloud account connection | 08 | ✅ |
| Per-cloud agent deployment | 08 | ✅ |
| Cloud-specific agent config | 08 | ✅ |
| Cross-cloud finding correlation | 08 | ✅ |
| Cross-cloud attack graph | 08 | ✅ |
| Lateral movement detection | 08 | ✅ |
| Unified posture scoring | 08 | ✅ |
| Cross-cloud compliance reports | 08 | ✅ |
| Cloud-specific alert routing | 08 | ✅ |
| Alert deduplication | 08 | ✅ |
| Auto-remediation rules | 08 | ✅ |
| Agent heal loop | 08 | ✅ |

## How to Run

```bash
# Run all sample project integration tests
npx vitest run --config tests/sample-projects/vitest.config.ts

# Run a specific sample project
npx vitest run --config tests/sample-projects/vitest.config.ts tests/sample-projects/01-free-tier-solo-dev.test.ts

# Run E2E smoke tests against opensyber.cloud
cd apps/web && npx playwright test e2e/sample-projects-smoke.spec.ts

# Run E2E against local dev
cd apps/web && E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/sample-projects-smoke.spec.ts
```
