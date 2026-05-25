# Qestro — Ideal Customer Profile (ICP)

**Generated**: 2026-04-09

---

## Firmographics

| Attribute | Ideal Range |
|-----------|------------|
| Company size | 10-200 employees |
| Industry | SaaS, fintech, developer tools, e-commerce |
| Revenue | $1M-$50M ARR |
| Funding | Seed to Series B |
| Engineering team | 5-50 developers |
| Tech stack | TypeScript/JavaScript, React, Node.js |
| Infrastructure | Cloud-native (AWS, GCP, Cloudflare) |
| CI/CD | GitHub Actions, GitLab CI, CircleCI |

---

## Buyer Persona

### Primary: QA Lead / SDET
- **Title**: QA Lead, Senior QA Engineer, SDET, Test Automation Engineer
- **Reports to**: VP Engineering or CTO
- **Budget authority**: $500-$2,000/mo (can approve without exec sign-off)
- **Decision timeline**: 2-4 weeks (free trial → team evaluation → purchase)
- **Pain points**:
  - Writing and maintaining test suites takes 40% of sprint time
  - Tests break on every UI change (selector drift)
  - No mobile testing coverage
  - Manual test creation doesn't scale

### Secondary: Engineering Manager / CTO
- **Title**: Engineering Manager, VP Engineering, CTO
- **Budget authority**: $2,000-$10,000/mo
- **Decision timeline**: 4-8 weeks (security review, compliance check)
- **Pain points**:
  - Test coverage is below targets
  - QA is a bottleneck in the release process
  - Need consolidated testing platform (not 4 tools)
  - Want AI to accelerate test creation

---

## Behavioral Signals (Upgrade-Ready)

### Strong Buy Signals
- Uses CI/CD pipeline (GitHub Actions preferred)
- Has 5+ developers pushing code weekly
- Ships releases weekly or faster
- Already uses Playwright, Cypress, or similar
- Has a QA team or dedicated tester
- Active on GitHub (public repos, PRs)
- Mentions "test automation" in job postings

### Medium Signals
- Uses AI tools in development workflow
- Growing team (2+ engineering hires in last quarter)
- Active in developer communities (Discord, Slack)
- Attended testing or DevOps conferences

---

## Disqualifiers

| Signal | Reason |
|--------|--------|
| Less than 3 developers | Won't generate enough tests to see value |
| No cloud infrastructure | Can't use CI/CD integration (core feature) |
| Waterfall process | Testing happens at end, not continuously |
| Regulated industry (on-prem only) | No on-prem option yet (enterprise roadmap) |
| PHP/Java monolith | Primary value is in modern JS/TS ecosystem |
| No automated testing today | Too big a jump; need manual-first users |

---

## Look-Alike Targeting

### Find more ICPs by:
1. **GitHub**: Repos with Playwright/Cypress in dependencies + active CI configs + TypeScript
2. **Job boards**: Companies posting for "QA Automation Engineer" or "SDET" roles
3. **Conferences**: Attendees of TestJS Summit, Playwright Conference, DevOps Days
4. **Communities**: Playwright Discord, Testing Guild Slack, r/QualityAssurance
5. **Tech blogs**: Companies writing about test automation challenges
6. **Competitors**: Users of Cypress Cloud, BrowserStack, LambdaTest who want AI features

---

## Persona Quotes

> "I spend more time fixing broken selectors than writing new features." — Solo Developer

> "We need one tool that covers web, mobile, AND API — not three separate products." — QA Team Lead

> "If AI can generate 80% of our tests, that frees the team to focus on edge cases." — Engineering Manager

> "Self-healing tests would save us 2 hours per day of maintenance." — Enterprise QA Director
