# OpenSyber — Enterprise Product Requirements Document (PRD)

**Version:** 1.0
**Author:** Shachar
**Target Market:** Enterprise (500–50,000+ employees)
**Category:** AI-Native Cloud & SaaS Security Platform
**Positioning:** The autonomous security control plane for modern enterprises

---

## 1. Executive Vision

OpenSyber is an AI-native enterprise cybersecurity platform that provides:

- Cloud Security Posture Management (CSPM)
- SaaS Security Posture Management (SSPM)
- Secrets & Credential Lifecycle Governance
- Identity Risk Intelligence
- Attack Graph Modeling
- Automated Remediation (SOAR-lite)
- AI Agent Security Monitoring
- Enterprise Compliance Automation
- Real-time Risk Scoring Engine

Unlike Wiz (visibility-first) and CyberArk (identity-first), OpenSyber is:

> **A programmable security platform with AI agents as first-class citizens.**

---

## 2. Product Principles

1. AI-native by design (not bolted on)
2. Event-driven architecture
3. Skill-based extensibility
4. Every action audit logged
5. Secure-by-default infrastructure
6. Multi-tenant isolation
7. Enterprise compliance from day one

---

## 3. Core Modules

---

### 3.1 Cloud Security Posture (CSPM)

**Objective**

Detect misconfigurations across AWS, Azure, GCP.

**Functional Requirements**

- Connect cloud accounts via IAM role assumption
- Support:
  - AWS Organizations
  - Azure Subscriptions
  - GCP Projects
- Execute security scans via:
  - Prowler integration
  - Native API inspection
- Store findings in normalized schema
- Risk score per resource
- Risk score per account
- Risk score per organization
- Continuous re-scan (cron + event-driven)
- Detect drift from baseline configuration

**Non-Functional**

- Scan 10k+ resources per account
- Parallel execution
- Scan results within <5 min for 1000 resources
- No long-lived cloud credentials stored

---

### 3.2 SaaS Security (SSPM)

**Integrations**

- Microsoft 365
- Google Workspace
- GitHub
- Slack
- Salesforce
- Okta

**Functional**

- OAuth-based integration
- Permission inventory extraction
- App installation monitoring
- High-risk OAuth app detection
- Suspicious login detection
- Shadow IT detection
- Token over-permissioning analysis

---

### 3.3 Credential & Secrets Lifecycle

**Integrations**

- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- GCP Secret Manager

**Functional**

- Secret discovery
- Secret age tracking
- Rotation policy enforcement
- Automatic rotation trigger
- Detect plaintext secrets in:
  - Repos
  - Logs
  - Environment variables

---

### 3.4 Risk Intelligence Engine

**Core Capabilities**

- Risk score per:
  - Finding
  - Resource
  - Identity
  - SaaS App
  - Business Unit
- Dynamic risk recalculation
- Graph-based risk propagation

**Formula**

```
Risk Score =
  BaseSeverity
  × ExploitabilityWeight
  × ExposureWeight
  × IdentityPrivilegeMultiplier
  × BusinessCriticality
```

**Must Support**

- Manual override
- Risk deltas
- Historical risk trend
- Risk timeline graph

---

### 3.5 Attack Graph Engine

**Requirements**

- Build graph:
  - Nodes: identity, resource, SaaS app
  - Edges: privilege, access, trust, token
- Use graph traversal (BFS/DFS)
- Identify:
  - Privilege escalation paths
  - Lateral movement paths
  - Data exfiltration chains
- Show blast radius
- Show shortest path to crown jewel asset

---

### 3.6 AI Intelligence Layer

**Requirements**

- LLM-based threat explanation
- Auto-triage:
  - Is this real risk?
  - Is it compensating control?
- Natural language query:
  - "Show me all public S3 buckets with admin IAM access"
- AI-based remediation suggestion
- Threat narrative generation
- Compliance narrative generation

---

### 3.7 Remediation Engine

**Requirements**

- Manual remediation workflow
- One-click fix (where possible)
- SOAR-like DAG execution engine
- Approval gates
- Rollback capability
- Change simulation mode

---

### 3.8 Compliance Automation

**Frameworks**

- SOC2
- ISO 27001
- GDPR
- PCI-DSS
- HIPAA
- NIST CSF

**Requirements**

- Control mapping
- Evidence collection automation
- Continuous compliance score
- Audit report PDF generation
- Control drift detection

---

### 3.9 AI Agent Security Monitoring

**Target**

Monitor AI coding agents such as:

- OpenHands
- OpenClaw
- Custom LLM agents

**Requirements**

- Container sandboxing
- Agent activity logging:
  - file edits
  - bash commands
  - network calls
- Detect suspicious patterns:
  - secret exfiltration
  - unauthorized API calls
- Auto-suspend container
- Alert SOC team

---

## 4. Enterprise Requirements

---

### 4.1 Multi-Tenancy

- Org-level isolation
- Sub-org support
- RBAC roles:
  - Admin
  - Security Analyst
  - Auditor
  - Read-only
- Attribute-based access control (ABAC)

---

### 4.2 Scalability

- 10k+ findings per org
- 1M+ resources supported
- Horizontal scaling
- Stateless APIs
- Event queue architecture

---

### 4.3 Audit Logging

Every state change must record:

| Field | Description |
|---|---|
| `actor_id` | Who performed the action |
| `org_id` | Organization scope |
| `action` | Action type |
| `resource_id` | Target resource |
| `before_state` | State before change |
| `after_state` | State after change |
| `timestamp` | When it happened |
| `ip` | Source IP address |

Immutable log storage required.

---

### 4.4 Security Hardening

- Zero trust architecture
- Encrypted at rest (AES-256)
- TLS 1.3 enforced
- WAF enabled
- Rate limiting
- Secrets never logged
- Signed webhook validation
- Dependency scanning enforced

---

## 5. Architecture Requirements

---

### 5.1 Core Stack

**Backend:**
- TypeScript + Hono
- Drizzle ORM
- D1 or Postgres
- Redis (caching)
- Cloudflare Workers

**Graph:**
- graphology

**Queue:**
- Cloudflare Queues or Kafka

**Auth:**
- Clerk or enterprise SSO (SAML/OIDC)

**LLM:**
- Anthropic / OpenAI / Self-hosted

---

### 5.2 Design Patterns

- Repository
- Adapter
- Strategy
- Observer/Event
- Command
- Saga
- DAG pipeline

---

## 6. API Requirements

All APIs must:

- Be versioned (`/api/v1/`)
- Use OpenAPI 3.0
- Support pagination
- Enforce RBAC
- Return consistent error structure

**Standard error format:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions",
    "request_id": "uuid"
  }
}
```

---

## 7. UI/UX Requirements

- Apple HIG level design polish
- Dark mode
- Attack graph visualization
- Real-time dashboard
- Risk heatmaps
- Drag-and-drop dashboard builder
- PDF export
- Multi-language ready

---

## 8. Performance SLAs

| Metric | Target |
|---|---|
| API p95 latency | < 200ms |
| Dashboard load | < 2s |
| Risk recalculation (< 10k findings) | < 1s |
| Uptime | 99.9% |

---

## 9. Marketplace & Skill Ecosystem

OpenSyber must support:

- Skill SDK
- Third-party skill packaging
- Skill validation pipeline
- Skill marketplace
- Revenue share model (70/30 — developer gets 70%)
- Signed skill manifests
- Skill permission sandboxing

---

## 10. Data Model (High-Level)

**Core Tables:**

| Table | Purpose |
|---|---|
| `organizations` | Tenant isolation |
| `users` | Identity |
| `cloud_accounts` | Connected cloud accounts |
| `findings` | Security findings (normalized) |
| `resources` | Cloud/SaaS resources |
| `identities` | IAM identities, SaaS users |
| `saas_apps` | Connected SaaS applications |
| `risk_scores` | Per-resource/identity/org scores |
| `audit_logs` | Immutable action log |
| `skill_runs` | Skill execution history |
| `compliance_controls` | Framework control mappings |
| `remediation_workflows` | DAG-based playbooks |
| `attack_graph_edges` | Graph edges for traversal |

---

## 11. Monetization Model

| Tier | Includes |
|---|---|
| **Starter** | CSPM only, limited findings |
| **Pro** | CSPM + SSPM, risk engine, AI explanations |
| **Enterprise** | Full platform: remediation, compliance, marketplace, AI agent monitoring |

See CLAUDE.md for full pricing tiers.

---

## 12. Roadmap Milestones

### Phase 1 — Foundation
- CSPM core
- Risk engine
- Basic dashboard

### Phase 2 — Intelligence
- Attack graph
- AI triage
- SaaS integrations (M365, Google, GitHub, Slack, Salesforce, Okta)

### Phase 3 — Automation
- Remediation engine
- Compliance automation (SOC2 → ISO 27001 → GDPR → PCI-DSS → HIPAA → NIST CSF)
- Marketplace launch

### Phase 4 — Enterprise Scale
- AI agent monitoring
- Multi-cloud expansion
- Enterprise SOC features

### Phase 5 — Enterprise Hardening (Sprints 23+)
- SCIM provisioning
- AWS Secrets Manager / Azure Key Vault / GCP Secret Manager integration
- OpenAPI 3.0 spec auto-generation
- Multi-region deployment
- Advanced compliance: PCI-DSS Level 1, HIPAA BAA, NIST CSF

---

## 13. Success Metrics

| Metric | Target |
|---|---|
| Time to first scan | < 10 minutes |
| MTTR reduction | Measurable per customer |
| % automated remediation | Track sprint over sprint |
| Compliance score improvement | Track per customer |
| Customer churn | < 5% |
| NPS | > 60 |

---

## 14. Competitive Positioning

| Competitor | Strength | Weakness vs OpenSyber |
|---|---|---|
| **Wiz** | Strong visibility, cloud graph | Weak automation, not AI-native |
| **CyberArk** | Identity-first, PAM strong | Limited cloud posture |
| **Suridata** | SaaS misconfiguration | Narrow scope |
| **OpenSyber** | AI-native, skill platform, attack graph + remediation + compliance unified | — |

> "We ship what CyberArk + Wiz + Suridata charge $500K/year for, at $399/mo."

---

## 15. Definition of Enterprise-Ready

Product is enterprise-ready **only if**:

- [ ] Multi-region deployment
- [ ] SOC2 controls implemented
- [ ] 80%+ code coverage (90% for TokenForge)
- [ ] Full audit logging on all state changes
- [ ] SLA monitoring in place
- [ ] DR plan tested
- [ ] SSO + SCIM supported
- [ ] Zero critical or high unresolved vulnerabilities
- [ ] OpenAPI 3.0 spec published
- [ ] Signed skill manifests enforced

---

## Gap Analysis vs Current Sprint Plan (Sprints 11–22)

The following requirements from this PRD are **not yet covered** by Sprints 11–22 and are mapped to **Phase 5 (Sprints 23+)**:

| PRD Requirement | Current Coverage | Gap |
|---|---|---|
| GDPR, NIST CSF, ISO 27001, PCI-DSS, HIPAA | Sprint 20: SOC2 only | Phase 5 sprint |
| AWS Secrets Manager, Azure Key Vault, GCP Secret Manager | Sprint 12: CF KV only | Phase 5 sprint |
| GitHub, Slack, Salesforce, Okta SaaS connectors | Sprint 15: M365 + Google only | Phase 5 sprint |
| SCIM provisioning | Sprint 9: SSO (SAML/OIDC) only | Phase 5 sprint |
| OpenAPI 3.0 spec generation | Not planned | Phase 5 sprint |
| Multi-region deployment | Not planned | Phase 5 sprint |
| Drag-and-drop dashboard builder | Not planned | Phase 5 sprint |
| Signed skill manifests | Not in skill catalog | Add to Sprint 19 Marketplace |

---

*OpenSyber isn't just viable. It's architected to dominate.*
