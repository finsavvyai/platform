# Cypress (cypress.io)

> **Category**: Incumbent / JS-first browser testing framework + Cypress Cloud SaaS
> **Threat level to Qestro**: **HIGH** — largest established player in the developer-first testing niche

## 1. One-sentence positioning
"Browser testing for modern teams — create tests, debug failures, and improve quality faster than ever."

## 2. Core product capabilities
- End-to-end browser testing (Chromium, Firefox, Edge, Electron, WebKit)
- Component testing (React, Vue, Angular, Svelte)
- Time-travel debugging / DOM snapshots
- Cypress Studio: record-and-replay test authoring
- AI features: Studio AI, natural language test creation, AI-powered summaries, flake detection, self-healing
- Cypress Cloud: parallelization, test replay, analytics, MCP server
- Integrations: GitHub, GitLab, Bitbucket, Jenkins, Circle CI, Jira, Slack, MS Teams
- 49.6k GitHub stars, actively released (v15.14.0 on 2026-04-16)

## 3. What they do BETTER than Qestro
- **Market presence**: 49.6k GitHub stars vs Qestro's ~0. Developer mindshare is massive.
- **Free framework side**: open-source framework is the default install for thousands of teams — no switching cost means high inertia.
- **Mature time-travel debugging**: the DOM-snapshot-per-command UX is still best-in-class and Qestro doesn't match it.
- **Component testing**: Qestro is E2E-first and doesn't compete here.
- **Cypress Studio** is more polished than any Qestro authoring surface today.

## 4. What Qestro does BETTER than them
- **Mobile + API in one platform**. Cypress is browser-only (requires Maestro + Postman separately). Qestro unifies Playwright + Maestro + API runners under one dashboard with one set of credentials and one billing line.
- **AI test generation from plain English**. Cypress has AI features bolted on; Qestro is built AI-first — paste a URL, describe in English, get production Playwright code. Cypress's "natural language test creation" is a Studio plugin, not the primary authoring model.
- **Self-healing as a first-class engine**. Cypress has AI flake detection; Qestro has a dedicated SelfHealingEngine with selector/timing/assertion/API healers.
- **Cheaper entry**: Qestro free tier = 100 runs, Starter = $99/mo. Cypress Team = $67/mo but scoped to 120K results/year — Qestro's price/run at Pro tier ($499 for 50K runs) is comparable but bundles mobile + API.
- **Playwright-based** means we inherit Playwright's faster execution, better parallel story, and broader browser support without maintaining Cypress's bespoke runner.

## 5. Tech stack signals
- Cypress framework: Node.js, TypeScript (OSS, MIT license)
- Cypress Cloud: likely hosted on AWS, Redis + Postgres, React dashboard
- GitHub: github.com/cypress-io/cypress (49.6k stars, 1.2k open issues, 391 releases)

## 6. Pricing tiers
| Tier | Price | Seats | Results/year | Notes |
|---|---|---|---|---|
| Starter (Free) | $0 | 50 | 6,000 (500/mo) | No CC required, 100 AI prompts/user/hr |
| Team | $67/mo ($799/yr) | 50 | 120,000 | Flake detection, Jira, email support |
| Business | $267/mo ($3,199/yr) | 50 | 120,000 | SSO, spec prioritization, GH/GL Enterprise |
| Enterprise | Contact | Unlimited | Custom | Dedicated support, roadmap portal |

- Overage: $5-6 per 1,000 additional test results.

## 7. Target customer
Developer-led teams at Series A–enterprise scale. Heavy on frontend-first orgs (React/Vue shops). Strong adoption in fintech, SaaS, and e-commerce. Used by both solo devs (free framework) and enterprise (Cloud Business tier).

## 8. Recent signals
- **Latest release**: v15.14.0, 2026-04-16 — actively maintained.
- **AI push**: rolled out Studio AI, Cloud MCP, and natural language test creation in 2025-2026 — clearly reacting to the AI testing wave.
- **2026 PR**: acquired by unknown (check needed — the Tricentis acquisition rumor was Testim, not Cypress).
- Cypress Cloud MCP launched — they're integrating with Claude-style agents. Qestro should watch this closely.

## 9. Qestro's winning angle vs Cypress

**Don't fight Cypress on browser-only developer-first testing. That's their home turf and they own it.** Instead, position Qestro as the **cross-platform AI-native successor**:

"Cypress is a great browser testing framework if you only test browsers and you have engineers with time to maintain selectors. Qestro assumes you're shipping to browser + mobile + API, you're using Cursor/Claude to write the code, and you don't want to maintain selectors at all. Write tests in plain English, run them across Playwright + Maestro + API runners, and let self-healing fix selectors when your UI changes."

**Key wedge plays vs Cypress**:
1. "Your Cypress suite is flaky because selectors rot. Point Qestro at it and we'll heal the selectors."
2. "Already have Cypress? Keep it. Add Qestro for mobile + API coverage."
3. "Switching from Cypress Cloud? Same price point, but you also get mobile testing and self-healing for free."
