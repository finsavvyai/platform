# Qestro GTM Positioning — 1-Page Playbook

> **Date**: 2026-04-17. Based on 9-competitor analysis.

## Who to target FIRST

**ICP v1 (attack this wedge for next 90 days)**:
- **Role**: Senior engineer, tech lead, or eng manager
- **Team size**: 3-20 engineers
- **Company stage**: Seed to Series B
- **Stack**: Uses AI coding tools (Cursor, Claude Code, Copilot). Ships weekly or faster.
- **Pain**: "We ship fast but our test suite either doesn't exist, is flaky, or is a Cypress suite nobody wants to maintain."
- **Budget**: Expense on corporate card ($99-$499/mo is below procurement threshold)

**Why this ICP first**:
- Below radar of Testim/Mabl/QA Wolf enterprise sales
- Not yet locked into Cypress enterprise contracts
- Already sold on AI-in-dev-workflow, so pitch is short
- Will give us word-of-mouth in the AI-coding community

**ICPs to defer**:
- Fortune 500 QA departments (mabl wins, we can't compete on track record yet)
- Pure QA engineers with 1000+ existing tests (they're on Testim/Mabl already)
- Regulated enterprise with on-prem requirements (come back in 12 months)

---

## The core message (under 15 words)

**"The testing copilot for teams shipping with AI."**

Secondary variants to A/B test:
- "Your AI writes the code. Qestro writes the tests."
- "Self-healing tests for vibe coders."
- "Browser, mobile, API — tested in plain English."

---

## Pricing lever for GTM

**Keep free tier generous enough to become the default**:
- 5 projects, 100 runs/mo is good. Consider expanding to 200 runs to remove friction.
- $99/mo Starter is the right entry price — under the corp-card threshold.
- **Do not discount Pro ($499/mo)** — it's priced correctly for the value of mobile + API + CI/CD. Discounting signals low confidence.
- Offer: "3 months free for teams migrating from Cypress/Testim" — targeted migration incentive.

---

## Content themes (what to publish for next 90 days)

1. **"Why your Cypress suite is flaky" series** — technical teardown of selector rot, screenshots of healing in action. Target: Cypress users reconsidering.
2. **"Testing code written by Claude/Cursor"** — blog posts showing Qestro validating AI-generated features. Target: r/ClaudeAI, HN, Dev.to.
3. **"Browser + Mobile + API in one tool" comparison** — side-by-side with Cypress + Postman + Maestro showing the consolidation story.
4. **"Self-healing explained" technical deep-dive** — how our engines work. Target: engineers who mistrust AI black boxes.
5. **MCP-native content** — positioning Qestro as the canonical testing MCP server for Claude agents.

---

## 3 headlines to A/B test

**Option A — Functional, clear**:
> "Production-ready tests across browser, mobile, and API — written in plain English, self-healing when your UI changes."

**Option B — Emotional, punchy**:
> "Your AI writes the code. Qestro writes the tests. Ship faster. Break less."

**Option C — Category-defining**:
> "The testing copilot for AI vibe coding. Paste a URL, describe the test, get Playwright code."

Recommended starter: **C** for Product Hunt / HN. **A** for the landing page above the fold. **B** for cold email subject lines.

---

## 3 taglines to A/B test on PH / social

1. **"Ship fast with AI. Don't break production."** — tight, risk-averse framing.
2. **"Tests that write themselves. And heal themselves."** — product-forward.
3. **"Stop maintaining tests. Start shipping them."** — pain-first.

---

## Key objection handlers

| Objection | Response |
|---|---|
| "We already use Cypress" | Keep it. Add Qestro for mobile + API. Or point Qestro at your Cypress suite to heal flaky selectors. |
| "We're not ready for AI testing" | Free tier exists for a reason. Try 5 tests. Cancel if it doesn't work. |
| "Playwright is free, why pay?" | How much is your CI setup, selector maintenance, mobile runner, and dashboard costing you? More than $99. |
| "Is this production-ready?" | 56/56 E2E tests passing as of April 2026. Public commits on GitHub. Yes. |
| "What if you shut down?" | Tests are standard Playwright code in your repo. Take them anywhere. |

---

## 90-day GTM milestones

1. **Day 0-30**: Launch on Product Hunt, Hacker News (Show HN), Dev.to post series. Target 100 free signups.
2. **Day 30-60**: Publish 3 comparison landing pages (vs Cypress, vs Testim, vs Playwright). Start paid 14-day trial offer for teams with 2+ paid seats.
3. **Day 60-90**: First 10 paying customers case studies. Launch MCP-native marketing ("use Qestro from Claude"). Target $5K MRR.

---

## What good looks like at day 90

- 500+ free signups
- 15-25 paying customers ($3K-$8K MRR)
- 1-2 comparison pages ranking for "[competitor] alternative"
- 2-3 customer testimonials citing "shipped with Cursor, tested with Qestro"
- Clear signal on whether we should double down on dev-native or pivot toward QA-team sales
