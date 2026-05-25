# User Journey: Marcus Reeves — DevSecOps Team Lead

## AWARENESS (Week -4 to 0)

### Discovery Channel
- VP of Engineering asks: "What's our security posture for AI coding agents?"
- Marcus realizes he has zero visibility — searches "AI agent security monitoring"
- Finds OpenSyber via `/blog/supply-chain-attacks-targeting-ai-agents`
- Cross-references with Gartner blog post on Guardian Agents

### Internal Trigger
- Developer on his team accidentally ran `rm -rf /` via an AI agent autocomplete suggestion
- Realized AI agents have the same permissions as developers — no privilege separation
- Existing tools (Snyk, SonarCloud, Datadog) don't cover runtime AI agent behavior

---

## CONSIDERATION (Week 0-2)

### Evaluation Criteria (security vendor checklist)
1. SSO support (SAML/OIDC)? ✅
2. RBAC with granular permissions? ✅ (34 permissions, 5 roles + custom)
3. SIEM integration? ✅ (Datadog, Splunk, Grafana, Syslog)
4. SOC2 evidence? ✅ (compliance reports + audit exports)
5. Multi-instance support? ✅ (Team: 3, Professional: 10)
6. Data residency? ✅ (4 regions)
7. API access? ✅ (API keys with scopes)

### Actions Taken
- Runs live demo → validates real-time event monitoring
- Reviews `/pricing` → Team plan ($299/mo, 3 instances) fits initial rollout
- Checks marketplace → sees 22+ verified skills with 4-stage verification pipeline
- Requests trial from management → approved (7-day free trial)

### Decision Process
- Creates comparison doc for VP Eng: OpenSyber vs. "just use Datadog"
- Key differentiator: Datadog has no AI agent telemetry format
- Budget approved for Team plan ($299/mo = $3,588/yr, less than one security hire's daily cost)

---

## ONBOARDING (Week 1, first 2 hours)

### Account Setup (15 min)
- Signs up via GitHub OAuth → creates organization "AcmeSec"
- Sets up SAML SSO with Okta → enables auto-provisioning with "Developer" default role
- Invites 3 senior developers first (pilot group)

### Integration Setup (45 min)
- Connects Datadog SIEM forwarding (10 min)
- Connects Slack alert channel #security-alerts (5 min)
- Connects Jira for incident ticketing (15 min)
- Deploys 3 agent instances (eu-central) for pilot team (15 min)

### Policy Configuration (30 min)
- Creates agent policy: "Block unverified skills"
- Creates agent policy: "Alert on credential access outside work hours"
- Configures 4 alert rules with custom thresholds
- Installs 8 marketplace skills across all instances

### First Results (30 min)
- Pilot developers start coding with monitored agents
- First hour: 47 agent events logged across 3 instances
- Security score aggregated: team average 68
- First alert fires: developer's Cursor accessed production DB credentials

### Aha Moment
> "In one hour, I can see every file my team's AI agents touched. We've been flying blind for 18 months."

---

## ACTIVATION (Week 1-4)

### Key Activation Actions
1. ✅ 3+ team members active with monitored agents
2. ✅ First incident created and assigned to a developer
3. ✅ SIEM integration receiving events (verified in Datadog)
4. ✅ First compliance report generated (SOC2 readiness)
5. ✅ Custom alert rule triggers on real event

### Week-by-Week
- **Week 1**: Pilot with 3 developers, resolve initial false positives
- **Week 2**: Expand to 8 developers, tune alert thresholds
- **Week 3**: First compliance report for VP Eng, demonstrate ROI
- **Week 4**: Full team rollout (15 developers)

---

## RETENTION (Month 2-12)

### Daily Routine (Marcus)
- 9:00 AM: Review overnight alerts in Slack → triage in `/dashboard/security/alerts`
- 10:00 AM: Check team agent activity → flag unusual patterns
- Weekly: Generate compliance report → share with VP Eng

### Monthly Activities
- Review and tune alert rules (reduce noise)
- Onboard new team members (auto-provisioned via SSO)
- Update agent policies based on new threat intelligence
- Run CSPM scan on AWS accounts

---

## EXPANSION (Month 6+)

### Upgrade Triggers
- **Month 4**: Team grows to 20 developers → 3 instances not enough → upgrades to Professional ($799/mo, 10 instances)
- **Month 6**: Compliance team demands 365-day audit retention → Professional delivers
- **Month 8**: Onboards AWS CSPM (5 accounts) → approaches 20-account limit
- **Month 10**: Requests PDF report exports for quarterly board presentations

### Expansion Pattern
- Team plan → Professional → potential Enterprise as company scales to 500+ people
- Becomes internal champion, presents at company all-hands on AI agent security posture
- LTV: $6,000-15,000/yr
