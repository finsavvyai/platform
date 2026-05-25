# Qestro — Product Roadmap

**Last Updated:** April 9, 2026
**Status:** Early Access — Public Launch Prep
**Readiness:** 92%

---

## Vision

Qestro is the copilot for testing AI vibe coding. Developers ship fast with Cursor, Copilot, and AI assistants — Qestro is the safety net that catches what breaks. Paste a URL, describe what to test in plain English, and get production-ready test cases across browser, mobile, and API. Self-healing assertions fix themselves when your UI changes. Write tests once, run everywhere.

## Product Positioning

**Tagline:** Copilot for testing AI vibe coding — write tests once, run everywhere.

**Who it's for:** Developers, QA engineers, and teams who ship fast with AI-assisted development and need testing that keeps pace.

**What makes it different:**
- Natural language to test cases — no Playwright boilerplate
- Self-healing assertions — tests fix themselves, 80% less maintenance
- Unified platform — browser, mobile, and API from one dashboard
- MCP-native — Claude integration for AI-powered test orchestration
- Built on Cloudflare edge — sub-50ms latency globally

## Architecture Decision (Resolved)

Cloudflare Workers was chosen as the backend architecture in Q1 2026. The decision is final:
- Backend: Cloudflare Workers + Hono (api.qestro.app)
- Frontend: Vite + React on Cloudflare Pages (qestro.app)
- Database: Cloudflare D1 (Drizzle ORM)
- Auth: JWT + OAuth (GitHub, Microsoft, Google)

## What's Shipped (Q1 2026)

| Feature | Status |
|---------|--------|
| Real Playwright runner (Chromium/Firefox/WebKit) | Done |
| API test runner (REST/GraphQL, chaining, auth) | Done |
| Self-healing engine (selector, timing, assertion healers) | Done |
| CI/CD integration (GitHub Actions + GitLab CI) | Done |
| Analytics engine (trends, flakiness, slowest tests) | Done |
| Report generator (JUnit XML, HTML, Allure, JSON, CSV) | Done |
| Test scheduler (cron, parallel sharding, Bull queue) | Done |
| Frontend dashboard (test cases, runs, analytics) | Done |
| AI test generation (natural language → Playwright code) | Done |
| OAuth login (GitHub, Microsoft) | Done |
| 57 production test cases (OpenSyber.cloud) | Done |
| Production deployment (qestro.app + api.qestro.app) | Done |

## What's Next (Q2 2026 — Public Launch)

### High Priority
- Visual regression testing (pixel-perfect screenshot comparison)
- SSO/SAML (Azure AD, Okta) for enterprise customers
- Full Maestro mobile integration with screenshot comparison
- Onboarding flow for first-time users
- Usage-based billing via LemonSqueezy

### Medium Priority
- Cross-browser matrix testing in CI (Safari + Firefox)
- Performance monitoring (execution time trends)
- Slack/Discord notifications for test results
- Plugin marketplace (community test utilities)
- Desktop agent (Electron) for local device testing

### Low Priority
- Voice-powered test creation
- Test recording browser extension
- White-label offering for agencies
- On-premise deployment option

## Q3 2026 — General Availability

- 50+ pilot users with feedback loop
- Enterprise features (audit logs, data residency, SLA)
- Advanced AI (predictive analytics, test impact analysis)
- Community plugin ecosystem
- SOC 2 Type II compliance

## Q4 2026 — Market Expansion

- Industry partnerships (cloud providers, CI/CD platforms)
- APAC and EMEA expansion
- Advanced compliance (ISO 27001, GDPR)
- Custom integrations marketplace

## Pricing

| Tier | Price | Projects | Runs/mo | Platforms |
|------|-------|----------|---------|-----------|
| Free | $0 | 5 | 100 | Browser |
| Starter | $99/mo | 50 | 5,000 | Browser + API |
| Pro | $499/mo | 500 | 50,000 | All |
| Enterprise | Custom | Unlimited | Unlimited | All + on-prem |

## Competitors

| Feature | Qestro | Cypress | Playwright | Maestro | QA Wolf |
|---------|--------|---------|------------|---------|---------|
| AI test generation | Yes | No | No | No | No |
| Self-healing | Yes | No | No | No | Partial |
| Browser testing | Yes | Yes | Yes | No | Yes |
| Mobile testing | Yes | No | No | Yes | No |
| API testing | Yes | Limited | Limited | No | No |
| Natural language input | Yes | No | No | No | No |
| MCP integration | Yes | No | No | No | No |

## Success Metrics

- 50 active pilot users by end of Q2 2026
- 80%+ activation rate (first test within 24h)
- NPS > 40 from early adopters
- < 5s average test generation time
- 99.9% API uptime

---

*This is a living document. Last major update: April 9, 2026.*
