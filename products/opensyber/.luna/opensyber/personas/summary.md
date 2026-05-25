# OpenSyber Personas — Executive Summary

## Overview

5 data-driven personas generated from codebase analysis of 7 billing tiers, 5 RBAC roles (34 permissions), 165 API routes, 23+ database entities, 6 IDE integrations, 7 cloud providers, and 6 compliance frameworks.

## Persona Lineup

| # | Name | Archetype | Plan | Revenue Weight |
|---|------|-----------|------|----------------|
| 1 | **Yael Navon** | Solo Security-Minded Developer | Free → Personal ($49) | 3% of MRR |
| 2 | **Marcus Reeves** | DevSecOps Team Lead | Team ($299) → Professional ($799) | 41% of MRR |
| 3 | **Dr. Amira Khalil** | Enterprise CISO | Enterprise ($2,499) → Mission Defender ($9,999) | 54% of MRR |
| 4 | **Tomás Herrera** | Security Skill Publisher | Pro ($149) | 2% of MRR |
| 5 | **Priya Mehta** | Cloud Security Engineer | Professional ($799) | Included in #2 |

## Key Insight: Revenue Concentration

**5% of users (Enterprise CISOs) generate 54% of revenue.** This means:

1. **Product Hunt launch** should target Yael (volume) — she's the viral loop
2. **Sales motion** should target Amira (revenue) — she's the growth engine
3. **Feature prioritization** should balance both: IDE monitoring hooks Yael, compliance evidence hooks Amira
4. **Marketplace success** depends on Tomás — without quality skills, both Yael and Marcus churn

## Aha Moments by Persona

| Persona | Aha Moment | Time to Aha |
|---------|-----------|-------------|
| Yael | "Cursor read my .env 14 times" | 5 minutes |
| Marcus | "I can see every file the team's agents touched" | 1 hour |
| Amira | "First compliance report passed audit review" | 6 weeks |
| Tomás | "First $100 in marketplace revenue" | 2 months |
| Priya | "Attack path connects cloud misconfiguration to agent behavior" | 1 week |

## Product Priorities Informed by Personas

### Must-Have for Launch (Yael + Marcus)
- IDE integration setup < 5 minutes
- Security score visible within first session
- Free tier genuinely useful (not crippled)
- Marketplace with 10+ quality free skills
- Slack/email alerting

### Must-Have for Revenue (Amira + Priya)
- SAML SSO + SCIM (non-negotiable for enterprise)
- Compliance report exports (SOC2, GDPR, NIST)
- Data residency enforcement (provable)
- 365-day+ audit retention
- Custom RBAC roles
- CSPM multi-cloud dashboard

### Must-Have for Ecosystem (Tomás)
- Fast, fair verification pipeline (< 3 days)
- Publisher analytics dashboard
- Transparent payout process
- Marketplace discovery algorithm

## Churn Signals to Monitor

| Signal | Persona | Severity |
|--------|---------|----------|
| No agent events after 24h | Yael | Critical |
| SIEM integration drops events | Marcus | High |
| SSO/SCIM downtime | Amira | Critical |
| Verification takes > 5 days | Tomás | High |
| CSPM scan misses known finding | Priya | Critical |
| Security score unchanged for 7 days | All | Medium |
| Zero marketplace skill installs | Yael, Marcus | High |

## Files Generated

```
.luna/opensyber/personas/
  personas.md                              # 5 detailed personas + comparison matrix
  summary.md                               # This file
  journeys/
    yael-navon-journey.md                  # Solo dev: Awareness → Expansion
    marcus-reeves-journey.md               # DevSecOps: Awareness → Expansion
    dr-amira-khalil-journey.md             # CISO: Awareness → Expansion
  empathy-maps/
    all-personas-empathy.md                # Think/Feel/Say/Do for all 5 personas
```
