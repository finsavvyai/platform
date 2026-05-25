# Testim (testim.com, acquired by Tricentis)

> **Category**: Incumbent / AI-assisted record-and-replay, acquired by Tricentis (2021)
> **Threat level to Qestro**: **MEDIUM** — established AI testing player, but enterprise-heavy sales motion limits their SMB/dev reach

## 1. One-sentence positioning
AI-powered codeless test automation — record, replay, and self-heal end-to-end tests for web and Salesforce apps. Now bundled into the Tricentis platform as "Tricentis Testim."

## 2. Core product capabilities
- Record-and-replay test authoring (primarily codeless)
- AI-based "Smart Locators" / self-healing selectors (their original 2016 differentiator)
- Cross-browser test execution (Chrome, Firefox, Safari, Edge)
- Salesforce-specific testing (separate Testim Salesforce SKU)
- CI/CD integrations (Jenkins, CircleCI, GitHub Actions)
- Test data management + parameterization
- Reporting + analytics dashboard
- Part of Tricentis Tosca / qTest suite ecosystem

## 3. What they do BETTER than Qestro
- **Pioneered AI self-healing** in 2016 — longest track record in the space.
- **Salesforce testing specialization**: dedicated SKU for Salesforce orgs that Qestro doesn't address.
- **Tricentis enterprise distribution**: bundled into a suite that sells into Global 2000 accounts.
- **Mature codeless authoring**: ~10 years of UX iteration on the recorder.

## 4. What Qestro does BETTER than them
- **AI-native generation vs record-first**. Testim's core flow is *record a flow, then AI helps maintain it*. Qestro's core flow is *describe what you want in English, AI generates it*. Different starting point, massively faster for new tests.
- **Developer-friendly code output**. Testim tests are JSON-ish steps inside Testim's proprietary format. Qestro generates readable Playwright code that engineers can own, edit, and version in git.
- **Modern stack**. Qestro runs on Cloudflare Workers + D1, Playwright 1.59, Hono — fast, cheap, edge-native. Testim feels 2018-era.
- **Transparent pricing**. Qestro: $99/$499 public tiers. Testim: contact-sales only.
- **Mobile + API included**. Testim Salesforce is a separate SKU; Qestro's mobile + API runners are unified.
- **Self-serve**. Testim requires a demo call; Qestro onboards in minutes.

## 5. Tech stack signals
- Web app (no public GitHub — closed source)
- Proprietary DSL for tests (JSON-based step definitions)
- Owned by Tricentis (parent is Austrian; Tricentis is a big enterprise testing vendor)
- Tricentis IPO'd via SPAC-rumored path; heavy enterprise ops

## 6. Pricing tiers
**Not publicly listed. Contact sales only.** Third-party review sites estimate Testim starts in the $20K-$100K+/year range for enterprise seats. No free tier beyond a demo/trial.

## 7. Target customer
Enterprise QA teams at Global 2000 orgs, heavily weighted to Salesforce-first shops and regulated industries (finance, healthcare). Dedicated QA engineers + manual testers, not dev-led workflows.

## 8. Recent signals
- Acquired by Tricentis 2021, rebranded "Tricentis Testim" — still living inside the Tricentis suite.
- Last standalone Testim blog posts are sparse — most content now flows through Tricentis.
- Actively listed on Gartner, G2, Capterra — they are deeply entrenched in procurement flows.

## 9. Qestro's winning angle vs Testim

**Testim sells to QA directors who buy on RFP. Qestro sells to engineering managers who buy on a 14-day trial.** This is the entire differentiation in one sentence.

"Testim's self-healing is real, but you have to get past a 6-month enterprise procurement to find out. Qestro gives you self-healing, plus mobile, plus API, plus AI test generation from English, for $99/mo on a credit card — today."

**Key wedge plays vs Testim**:
1. **Speed-to-value**: Qestro's "paste URL, describe, get tests" is sub-5-minute. Testim needs a PoC.
2. **Own your code**: Testim lock-in is the proprietary format. Qestro outputs standard Playwright code you can take with you.
3. **Developer buyer vs QA buyer**: target the VP of Engineering, not the QA Director. Our buyer is not Testim's buyer, and our price is sub-procurement threshold.
4. **AI vibe coding narrative**: "Your team is using Cursor to write code 10x faster. You need tests that generate 10x faster. Testim was built for a pre-LLM world."
