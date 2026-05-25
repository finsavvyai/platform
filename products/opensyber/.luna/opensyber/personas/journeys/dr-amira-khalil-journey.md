# User Journey: Dr. Amira Khalil — Enterprise CISO

## AWARENESS (Month -3 to 0)

### Discovery Channel
- EU AI Act compliance requirements land on her desk (Q1 2026)
- Legal team asks: "How do we govern AI agent usage across the organization?"
- VP Security finds OpenSyber during vendor landscape research
- Sees `/blog/eu-ai-act-compliance-for-agent-platforms` — signals regulatory awareness

### Internal Trigger
- 200+ developers adopted AI coding agents (Copilot, Cursor, Claude) organically — zero governance
- Board asks: "What's our AI risk exposure?" — she has no data to answer
- FCA (Financial Conduct Authority) inquiry hints at upcoming AI governance requirements

---

## CONSIDERATION (Month 0-3)

### Evaluation Criteria (enterprise procurement)
1. SOC2 Type I/II certification? (SOC2 Type I expected Q3 2026)
2. Data residency enforcement? ✅ (eu-central region, provable)
3. SAML SSO + SCIM provisioning? ✅ (Okta, Azure AD, custom OIDC)
4. 5-year audit log retention? ✅ (Enterprise: 1825 days)
5. Custom RBAC roles? ✅ (34 granular permissions)
6. Compliance framework support? ✅ (SOC2, GDPR, NIST, HIPAA, PCI, OASF)
7. On-premise option? (Roadmap item)
8. SLA guarantees? ✅ (SLA monitoring + export)
9. Dedicated support? ✅ (Priority support on Enterprise+)
10. Penetration test report available? (Request from vendor)

### Actions Taken
- Security team runs 30-day evaluation on Enterprise trial ($2,499/mo)
- Connects 50 developers in London office as pilot
- Runs compliance report → validates against existing SOC2 controls
- Legal reviews privacy policy and data processing agreement
- Red team attempts to bypass agent policies → validates enforcement

### Decision Process
- 3-month evaluation cycle (standard enterprise procurement)
- RFP response from OpenSyber vs. 2 other vendors
- Final decision: OpenSyber wins on AI agent-specific features (others are generic CASB/DLP)
- Annual contract signed: Enterprise ($29,988/yr)

---

## ONBOARDING (Month 1, first 2 weeks)

### Week 1: Infrastructure
- SSO configured via Azure AD (SAML) with auto-provisioning
- SCIM groups mapped: Engineering → Developer role, Security → Security role, Leadership → Viewer role
- Data residency enforced: eu-central for all EU entities
- 3 custom roles created: "Compliance Analyst", "Regional Security Lead", "Incident Commander"

### Week 2: Rollout
- Phase 1: 50 developers in London (monitored)
- Phase 2: 80 developers in Frankfurt (week 3)
- Phase 3: 70 developers in Dubai (week 5)
- SIEM integration: Splunk + Azure Sentinel (dual forwarding)
- Ticketing: Jira Enterprise with custom workflows

### First Results
- 200 developers monitored within 5 weeks
- 12,000+ agent events per day
- Security posture baseline established: org average score 61
- First compliance report delivered to board: "AI Agent Governance — Current State"

---

## ACTIVATION (Month 2-3)

### Key Activation Actions
1. ✅ 200+ developers monitored across 3 regions
2. ✅ SSO + SCIM fully operational (zero manual provisioning)
3. ✅ First quarterly compliance report delivered to board
4. ✅ Data residency audit passed (eu-central enforcement verified)
5. ✅ Custom RBAC roles in production (3 custom roles)
6. ✅ Incident response playbook integrated with OpenSyber alerts

---

## RETENTION (Month 3-12)

### Monthly Routine (delegated to Security Operations team)
- Weekly: compliance posture review
- Monthly: board report on AI agent security metrics
- Quarterly: full compliance evidence export (SOC2, GDPR)
- Annual: penetration test of OpenSyber integration

### Dr. Amira's Direct Usage
- Monthly dashboard review (15 min/month)
- Quarterly board presentation prep (uses PDF exports)
- Annual vendor review and contract renewal

---

## EXPANSION (Year 2+)

### Upgrade Triggers
- **Month 8**: Organization grows to 400+ developers → Mission Defender ($9,999/mo) for unlimited capacity
- **Month 10**: Acquisitions bring new subsidiaries → needs multi-org management
- **Year 2**: Expands to HIPAA compliance (US healthcare division)

### Strategic Value
- OpenSyber becomes part of the "AI Governance Stack" alongside DLP, CASB, and SIEM
- Referenced in annual security report to board
- Used as evidence in regulatory filings
- LTV: $60,000-120,000/yr
