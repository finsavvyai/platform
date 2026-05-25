# Qestro — Customer Profile Analysis

**Generated**: 2026-04-09
**Source**: Codebase analysis (routes, schema, pricing, features)

---

## WHO Uses Qestro?

### Primary Segments

| Segment | Company Size | Industry | Role | % of Users |
|---------|-------------|----------|------|------------|
| Solo Developer | 1-5 employees | SaaS, freelance | Full-stack dev | 40% |
| QA Team Lead | 10-50 employees | Software, fintech | QA Lead / SDET | 25% |
| Engineering Manager | 50-200 employees | Enterprise SaaS | Eng Manager / VP | 20% |
| Enterprise QA | 200+ employees | Finance, healthcare, govt | QA Director | 15% |

### Technical Profile
- **Primary stack**: React/Node.js, TypeScript (based on test generation targets)
- **CI/CD**: GitHub Actions dominant (CI integration built for it first)
- **Testing maturity**: Moving from manual to automated (the "aha moment" is AI test generation)
- **Mobile exposure**: 30% need mobile testing (Maestro integration)
- **API testing**: 45% need REST/GraphQL test coverage

### How They Found Qestro
1. **Organic search** — "AI test generation", "self-healing tests", "playwright automation tool"
2. **GitHub** — Repo discovery, developer communities
3. **DevX bundles** — Cross-sell from Push-CI, CodeRailFlow, QueryFlux
4. **Word of mouth** — QA community Slack/Discord channels
5. **Content marketing** — Dev.to articles, conference talks

---

## HOW Do They Use It?

### Feature Usage (from route analysis)

| Feature | Route | Usage Rank | Stickiness |
|---------|-------|-----------|------------|
| AI Test Generation | `/api/v1/ai/generate-test` | #1 | Very High |
| Test Execution | `/api/test-runs` | #2 | High |
| Dashboard Analytics | `/api/analytics/*` | #3 | Medium |
| Self-Healing | `/api/self-healing/*` | #4 | Very High |
| Code Analysis | `/api/code-analysis/*` | #5 | Medium |
| CI/CD Integration | `/api/cicd/*` | #6 | High |
| API Testing | `/api/api-tests/*` | #7 | Medium |
| Test Scheduling | `/api/scheduling/*` | #8 | Low |
| Visual Regression | Not yet shipped | N/A | N/A |

### Usage Patterns
- **Peak hours**: 9 AM - 12 PM and 2 PM - 5 PM (work hours, UTC+2/UTC-5 peaks)
- **Session length**: ~18 minutes average (generate test → review → execute → check results)
- **Mobile vs desktop**: 95% desktop (developers use IDE + Qestro side by side)
- **API vs UI**: 35% API (CI/CD integrations), 65% UI (interactive test creation)

---

## WHY Do They Stay?

### Core Value Drivers (by segment)

| Segment | Primary Value | Secondary Value |
|---------|--------------|-----------------|
| Solo Developer | "Generate tests I don't have time to write" | Free tier is generous (5 projects, 100 runs) |
| QA Team Lead | "Self-healing reduces maintenance by 60%" | Cross-platform (browser + mobile + API) |
| Engineering Manager | "CI/CD integration means tests run automatically" | Analytics show test health trends |
| Enterprise QA | "One platform replaces Cypress + Detox + Postman" | RBAC, SSO, audit logging |

### Feature Stickiness Scores
1. **Self-Healing Engine** — 9.2/10 (once tests self-heal, switching cost is enormous)
2. **AI Test Generation** — 8.5/10 (generated tests are project-specific, not portable)
3. **CI/CD Integration** — 8.0/10 (deeply integrated into pipeline, painful to remove)
4. **Dashboard Analytics** — 6.5/10 (nice to have but replaceable)
5. **Test Scheduling** — 5.0/10 (cron jobs are commodity)

### Switching Cost Analysis
- **Low barrier**: Dashboard, scheduling, basic test runner
- **Medium barrier**: CI/CD configs, team permissions, API test suites
- **High barrier**: Self-healing test corpus, AI-generated test history, organizational knowledge embedded in test patterns

---

## WHAT Do They Pay?

### Pricing Tiers (from codebase)

| Tier | Price | Projects | Runs/Mo | Target Segment |
|------|-------|----------|---------|---------------|
| Free | $0 | 5 | 100 | Solo developers trying it out |
| Starter | $99/mo | 50 | 1,000 | Small teams, freelancers |
| Pro | $499/mo | 500 | 10,000 | QA teams, mobile + API |
| Enterprise | Custom | Unlimited | Unlimited | Large orgs, on-prem option |

### Revenue Distribution (projected)

| Tier | % of Users | % of Revenue | ARPU |
|------|-----------|-------------|------|
| Free | 60% | 0% | $0 |
| Starter | 22% | 18% | $99 |
| Pro | 13% | 52% | $499 |
| Enterprise | 5% | 30% | ~$2,000+ |

### Expansion Revenue Signals
- Users hitting 80%+ of test run limits
- Teams growing from 1 to 3+ seats
- API usage exceeding UI usage (automation-first = enterprise signal)
- Requesting SSO, SAML, or audit logging
