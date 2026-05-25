# OpenSyber User Personas

> Generated from codebase analysis: auth flows, billing tiers (7 plans), RBAC (5 roles + custom), 165 API routes, 23+ DB entities, 6 IDE integrations, 7 cloud providers, 6 compliance frameworks.

---

## Persona 1: Yael Navon — Solo Security-Minded Developer

| Field | Detail |
|-------|--------|
| **Age** | 29 |
| **Role** | Full-Stack Developer |
| **Company** | Solo freelancer / early-stage startup (1-3 people) |
| **Location** | Tel Aviv, Israel |
| **Plan** | Free → Personal ($49/mo) |
| **Technical Level** | High (writes code daily, comfortable with CLI) |
| **Devices** | MacBook Pro, VS Code + Cursor, iPhone |

### Goals
- Ship features fast without worrying about AI agent security blind spots
- Have a "set and forget" security layer that watches Cursor/Copilot actions
- Get a security score she can show clients as proof of professional practice
- Stay on the free tier as long as possible, upgrade only when value is clear

### Pain Points
- AI coding agents access her `.env`, SSH keys, and cloud credentials — she has no visibility into what they actually do
- Can't afford dedicated security tooling; needs something that "just works" with her IDE
- Heard about the Trivy attack on Hacker News and realized she has zero protection
- Existing security tools (Snyk, SonarCloud) only cover dependencies and static code — not runtime agent behavior

### Key Workflows
1. `/dashboard` → check security score each morning
2. `/dashboard/getting-started` → set up VS Code + Cursor integration (first 5 minutes)
3. `/marketplace` → browse free skills → install "Credential Monitor" and "File Integrity"
4. `/dashboard/settings/api-keys` → generate API key for CI integration
5. `/score/{id}` → share security scorecard badge in GitHub README

### Features Used Most
- Security score dashboard
- IDE agent monitoring (VS Code/Cursor)
- Free marketplace skills (3 skill limit)
- Scorecard badge embed
- Achievement system (motivated by gamification)

### Upgrade Triggers
- Hits 3-skill limit and wants "Supply Chain Guard"
- Needs more than 7 days audit retention for a client compliance report
- Wants a second agent instance for a new project
- Personal plan at $49/mo feels justified after first blocked credential access

### Churn Risks
- If onboarding takes more than 10 minutes
- If the free tier feels too limited to demonstrate value
- If security score feels arbitrary or hard to improve
- If competitor offers same IDE monitoring for free

### Quote
> "I don't have a security team. I don't have a budget. But I also can't afford to be the developer whose client data got leaked because Copilot ran `curl` to an exfil domain."

---

## Persona 2: Marcus Reeves — DevSecOps Team Lead

| Field | Detail |
|-------|--------|
| **Age** | 35 |
| **Role** | DevSecOps Lead / Platform Engineer |
| **Company** | Series B SaaS company (80-200 people) |
| **Location** | Austin, Texas |
| **Plan** | Team ($299/mo) → Professional ($799/mo) |
| **Technical Level** | Expert (infrastructure, security, automation) |
| **Devices** | MacBook Pro, JetBrains IDEs, Linux workstations |

### Goals
- Centralize visibility over all AI agents used by his 15-person engineering team
- Enforce security policies before incidents happen — not after
- Integrate OpenSyber alerts into existing Slack + Datadog + Jira workflow
- Justify the security budget to VP of Engineering with concrete metrics and compliance reports

### Pain Points
- Developers on his team use 4 different AI agents (Copilot, Cursor, Claude Code, Continue) — no unified monitoring
- Current SIEM (Datadog) has no AI agent telemetry; it's a blind spot in their security posture
- Spent 3 days investigating a suspicious `npm install` triggered by an AI agent — had no logs
- Needs SOC2 evidence for AI agent usage but has nothing to show auditors

### Key Workflows
1. `/dashboard/agents/team` → daily review of team agent activity across all members
2. `/dashboard/agents/policies` → create and enforce agent execution policies
3. `/dashboard/agents/alert-channels` → configure Slack + PagerDuty alerting
4. `/dashboard/security/incidents` → triage and assign incidents to team members
5. `/dashboard/security/compliance` → generate SOC2 readiness report quarterly
6. `/dashboard/team/settings` → manage RBAC, onboard new developers with "Developer" role
7. `/dashboard/integrations` → connect Datadog SIEM + Jira ticketing

### Features Used Most
- Team dashboard with cross-member agent monitoring
- RBAC (assigns Developer role to engineers, Security role to senior devs)
- Policy engine (blocks unverified skill execution, restricts network egress)
- Alert rules (custom thresholds for credential access, file integrity)
- SIEM integration (Datadog forwarding)
- Compliance reports (SOC2, NIST evidence exports)

### Upgrade Triggers
- Team grows beyond 3 instances → needs Professional (10 instances)
- Needs 365-day audit retention for compliance (vs 90 days on Team)
- Wants PDF report exports for board presentations
- CSPM for 20+ cloud accounts (Professional allows 20, Team allows 5)

### Churn Risks
- If SIEM integration is unreliable or drops events
- If policy engine is too rigid and blocks legitimate developer workflows
- If alert fatigue from too many false positives
- If a competitor offers native Datadog/Splunk integration with less setup

### Quote
> "My job is to make security invisible to developers while keeping everything locked down. I need a platform that gives me control without creating friction for the team."

---

## Persona 3: Dr. Amira Khalil — Enterprise CISO

| Field | Detail |
|-------|--------|
| **Age** | 44 |
| **Role** | Chief Information Security Officer |
| **Company** | Regulated enterprise — fintech or healthcare (500-5,000 people) |
| **Location** | London, UK (with teams in Frankfurt and Dubai) |
| **Plan** | Enterprise ($2,499/mo) → Mission Defender ($9,999/mo) |
| **Technical Level** | Strategic (doesn't write code, reads dashboards and reports) |
| **Devices** | MacBook Air, iPad Pro, Microsoft Teams |

### Goals
- Govern AI agent adoption across the organization — 200+ developers using AI assistants
- Achieve SOC2 Type II and demonstrate AI governance to regulators and auditors
- Enforce data residency (EU data stays in `eu-central`, MENA data in compliant regions)
- Zero trust posture: every AI agent action is logged, auditable, and policy-controlled

### Pain Points
- Board is asking "What are our AI agents doing?" and she has no answer
- Regulators (FCA, GDPR) are starting to ask about AI agent data handling — she needs evidence
- 200+ developers adopted Copilot/Cursor/Claude before any security review happened
- Current CASB and DLP tools don't understand AI agent behavior — they only see HTTP traffic
- SSO/SCIM provisioning is mandatory; anything that requires manual user management is a non-starter

### Key Workflows
1. `/dashboard/security/compliance` → monthly compliance posture review (SOC2, GDPR, NIST)
2. `/dashboard/agents/policies` → review and approve enterprise-wide agent policies
3. `/dashboard/cloud` → multi-cloud CSPM oversight (AWS + Azure + GCP)
4. `/dashboard/team/sso` → configure SAML SSO with Okta/Azure AD
5. `/dashboard/team/residency` → enforce `eu-central` data residency
6. `/dashboard/logs` → audit log review for quarterly compliance evidence
7. `/admin` → (if platform admin) usage metrics, billing oversight

### Features Used Most
- SAML/OIDC SSO with auto-provisioning
- SCIM user/group sync from identity provider
- Data residency enforcement
- Compliance framework dashboards (SOC2, GDPR, NIST, HIPAA)
- 5-year audit log retention (1825 days)
- PDF compliance reports for board and auditors
- Custom RBAC roles (creates "Compliance Analyst" and "Regional Security Lead" roles)
- Attack path analysis for crown jewel identification
- SLA monitoring with export capability

### Upgrade Triggers
- Starts on Enterprise ($2,499) for evaluation with 50 developers
- Moves to Mission Defender ($9,999) when rolling out to 200+ developers
- Custom contract negotiation for dedicated support, SLA guarantees, and on-premise options

### Churn Risks
- If SSO/SCIM integration fails or has downtime
- If compliance reports don't meet auditor expectations
- If a competitor achieves SOC2 Type II certification first
- If data residency enforcement is not provably enforced
- If incident response SLA is not met during a real event

### Quote
> "I don't need another dashboard. I need evidence. When the regulator asks 'How do you govern AI agent behavior?', I need a printable answer."

---

## Persona 4: Tomás Herrera — Security Skill Publisher

| Field | Detail |
|-------|--------|
| **Age** | 31 |
| **Role** | Independent Security Researcher / Open-Source Contributor |
| **Company** | Self-employed consultant + open-source maintainer |
| **Location** | Barcelona, Spain |
| **Plan** | Pro ($149/mo, uses marketplace features) |
| **Technical Level** | Expert (writes security tools, reverse engineers malware) |
| **Devices** | ThinkPad (Linux), Neovim, multiple VMs |

### Goals
- Build and publish security skills on the OpenSyber marketplace for passive income
- Earn revenue from the 70/30 split on premium skill sales
- Establish reputation as a trusted security skill publisher
- Use OpenSyber's verification pipeline to validate his tools have no supply chain issues

### Pain Points
- Hard to monetize open-source security tools — donations don't pay the bills
- No existing platform specifically for AI agent security skills (npm/PyPI are too generic)
- Verification process (4-stage review) is thorough but slow — wants faster turnaround
- Needs better analytics on who's installing his skills and how they perform

### Key Workflows
1. `/dashboard/skills/submit` → submit new skill version with manifest + source
2. `/dashboard/marketplace` → monitor install count, ratings, and revenue
3. `/marketplace/{slug}` → check public listing, reviews, and competitor skills
4. `/dashboard/settings` → manage publisher profile, payout settings
5. `/dashboard/bundles/{bundleId}` → create curated skill bundles

### Features Used Most
- Skill publishing workflow (submit → scan → review → approve)
- Version management and update distribution
- Publisher payout tracking (gross, platform share, publisher share)
- Marketplace analytics (installs, ratings, featured placement)
- Bundle creation (packages multiple skills together)
- Skill recommendation engine (drives organic installs)

### Upgrade Triggers
- Free tier won't let him install unverified skills (needs Pro for testing his own in-progress skills)
- Wants 90-day audit retention to debug skill execution issues
- Needs policy engine access to test skill behavior under different policies

### Churn Risks
- If payout process is delayed or unreliable
- If verification pipeline rejects skills without clear, actionable feedback
- If marketplace discovery algorithm buries his skills below featured/certified ones
- If a competing marketplace (e.g., Hugging Face agents, Replit skills) offers better revenue terms

### Quote
> "I've been giving away security tools for free on GitHub for 6 years. OpenSyber is the first platform where my skills can actually earn me a living. But only if the marketplace gets real traffic."

---

## Persona 5: Priya Mehta — Cloud Security Engineer

| Field | Detail |
|-------|--------|
| **Age** | 33 |
| **Role** | Senior Cloud Security Engineer |
| **Company** | Mid-market SaaS (200-500 people), multi-cloud (AWS + Azure) |
| **Location** | Bangalore, India (works with US-based team) |
| **Plan** | Professional ($799/mo) |
| **Technical Level** | Expert (AWS/Azure certified, IaC, security automation) |
| **Devices** | MacBook Pro, VS Code, multiple cloud consoles |

### Goals
- Unified CSPM view across AWS and Azure — currently using 2 separate tools
- Correlate cloud misconfigurations with AI agent behavior (agents accessing misconfigured resources)
- Reduce MTTR on cloud security findings from days to hours
- Automate remediation workflows: finding → Jira ticket → Slack alert → developer assignment

### Pain Points
- AWS Security Hub and Azure Sentinel give different severity scales — no unified view
- 3 CSPM accounts on Team plan wasn't enough; upgraded to Professional for 20
- AI agents are deploying infrastructure (via Terraform) without security review — needs policy enforcement
- Alert fatigue: gets 200+ CSPM findings per scan, needs smart prioritization

### Key Workflows
1. `/dashboard/cloud` → multi-cloud CSPM dashboard (unified AWS + Azure view)
2. `/dashboard/cloud/setup` → connect cloud accounts with IAM role ARN / service principal
3. `/dashboard/cloud/findings` → triage findings by severity, resource type, compliance framework
4. `/dashboard/attack-paths` → blast radius analysis for critical misconfigurations
5. `/dashboard/security/alerts` → configure alert rules for critical CSPM findings
6. `/dashboard/integrations` → set up Jira + Slack for automated remediation workflow
7. `/dashboard/oasf` → OASF evidence collection for cloud security posture

### Features Used Most
- CSPM multi-cloud dashboard (AWS, Azure, GCP accounts)
- CSPM scan scheduling (daily automatic scans)
- Finding management (open, resolved, muted statuses)
- Attack path analysis (crown jewel paths, blast radius graphs)
- Alert rules with CSPM-specific thresholds
- Compliance framework mapping (findings → SOC2/NIST/PCI controls)
- Jira integration (bi-directional sync for finding remediation)
- SLO monitoring for security metrics

### Upgrade Triggers
- Started on Team (5 CSPM accounts), upgraded to Professional (20 accounts) when onboarding Azure
- Needs PDF reports for quarterly security reviews
- 365-day audit retention required by internal compliance team

### Churn Risks
- If CSPM scanner misses critical findings that AWS Security Hub catches
- If scan frequency is too slow (wants real-time, currently gets daily)
- If attack path analysis produces too many false paths
- If Wiz/Orca/Prisma Cloud releases AI agent monitoring, making OpenSyber's CSPM redundant
- If cloud account credential rotation causes scan failures

### Quote
> "I need one pane of glass for cloud security AND AI agent security. Right now, those are two completely different worlds. OpenSyber is the only platform that connects them."

---

## Persona Comparison Matrix

| Dimension | Yael (Solo Dev) | Marcus (DevSecOps) | Dr. Amira (CISO) | Tomás (Publisher) | Priya (Cloud Sec) |
|-----------|-----------------|-------------------|-------------------|-------------------|-------------------|
| **Plan** | Free → Personal | Team → Professional | Enterprise → Mission Defender | Pro | Professional |
| **Team Size** | 1 | 15 | 200+ | 1 | 8 |
| **Decision** | Self | VP Eng approval | Board + procurement | Self | Security Director |
| **Sales Cycle** | Instant | 2-4 weeks | 3-6 months | Instant | 2-4 weeks |
| **Primary Value** | IDE protection | Team governance | Compliance evidence | Revenue | Cloud posture |
| **Key Metric** | Security score | MTTR | Audit readiness | Skill installs | Finding closure rate |
| **Biggest Fear** | Credential leak | Blind spot | Regulatory fine | No marketplace traffic | Cloud breach |
| **Support Need** | Community/docs | Email | Priority + SLA | Community + docs | Email + priority |
| **MRR** | $0-49 | $299-799 | $2,499-9,999 | $149 | $799 |
| **LTV Estimate** | $588/yr | $6,000/yr | $60,000/yr | $1,788/yr | $9,588/yr |

---

## Revenue Distribution Model

```
Persona Mix (estimated at 1,000 customers):

  Yael (Solo Dev):     60% of users = 600 × $25 avg = $15,000/mo
  Marcus (DevSecOps):  20% of users = 200 × $550 avg = $110,000/mo
  Dr. Amira (CISO):     5% of users =  50 × $5,000 avg = $250,000/mo
  Tomás (Publisher):     5% of users =  50 × $149 avg = $7,450/mo
  Priya (Cloud Sec):   10% of users = 100 × $799 avg = $79,900/mo

  Total estimated MRR at 1,000 customers: ~$462,350/mo
  ARR: ~$5.5M

  Revenue concentration:
  - Enterprise (5% of users) = 54% of revenue
  - Professional + Team (30% of users) = 41% of revenue
  - Free + Personal (60% of users) = 3% of revenue
  - Publisher (5% of users) = 2% of revenue
```

---

*Generated from OpenSyber codebase: 7 billing tiers, 5 RBAC roles, 165 API routes, 23+ database entities, 6 IDE integrations, 7 cloud provider integrations, 6 compliance frameworks.*
