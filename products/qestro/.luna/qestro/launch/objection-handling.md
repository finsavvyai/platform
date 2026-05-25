# Qestro — Objection Handling Playbook

> For sales, support, Product Hunt replies, Reddit threads, and founder-DM inbound. Every response is grounded in a verifiable Qestro capability (cross-checked against `CLAUDE.md` Done / Recently Completed lists). Where a capability is planned but not shipped, it's flagged explicitly.

---

## How to use this

1. Steel-man the concern first — show you actually hear it.
2. Respond with the specific Qestro capability.
3. Close with a proof point (feature name, doc link, demo URL).

Do not stack superlatives. Do not claim features that don't exist. If an objection is correct and Qestro doesn't solve it, say so and offer the workaround.

---

## Table of objections

| # | Objection |
|---|---|
| 1 | "We already use Cypress." |
| 2 | "Self-healing will make silent changes we don't notice." |
| 3 | "AI-generated tests aren't trustworthy." |
| 4 | "Why not just use Playwright directly? It's free." |
| 5 | "Your free tier won't scale — we'll hit limits in a week." |
| 6 | "We don't want vendor lock-in." |
| 7 | "How is this different from Testim / Mabl / Autify?" |
| 8 | "We need enterprise SSO and SCIM — are you ready?" |
| 9 | "Can we run on-prem? We're regulated." |
| 10 | "What happens if Qestro shuts down?" |
| 11 | "$499/mo is expensive." |
| 12 | "We tried record-and-replay tools and they were flaky." |
| 13 | "Our QA team hand-maintains a 2,000-test suite. They won't adopt AI." |
| 14 | "We need API testing with auth flows, not just GET requests." |
| 15 | "You're too new / we don't trust unproven vendors." |

---

## 1. "We already use Cypress."

**Steel-man**: Cypress works. There's an existing suite, the team knows the tool, the CI is wired up. Changing tools has a cost and the benefit needs to justify it.

**Response**:

You probably shouldn't fully switch. Cypress is great for browser testing and the switching cost for an existing team is real. Qestro's not trying to win a head-to-head replacement fight on browser-only.

What Qestro gives you that Cypress doesn't, *alongside your existing Cypress suite*:

- **Mobile testing** (iOS + Android via Maestro) — Cypress doesn't do this.
- **API testing** (REST + GraphQL with auth chaining) — Cypress does this partially; Qestro treats it as first-class.
- **Natural-language test generation** — Cypress Studio is good; Qestro's LLM generation is a step beyond it and outputs Playwright instead of Cypress format.
- **Self-healing selectors** on every paid tier — Cypress has flake detection, not auto-healing.

The lowest-friction adoption is: keep Cypress for browser, add Qestro for mobile + API. Same team, one new dashboard.

**Proof points**: `backend/src/services/APIRunnerService.ts` (REST + GraphQL runner), `orchestrator/src/runners/` (Playwright + Maestro runners), `backend/src/services/SelfHealingEngine.ts` (self-heal engine). Docs: [qestro.app/docs/api-testing], [qestro.app/docs/mobile-testing].

---

## 2. "Self-healing will make silent changes we don't notice."

**Steel-man**: An automated test-fixer is dangerous because it can mask real regressions — the test "passes" because it got updated, not because the feature works.

**Response**:

Legitimate concern. This is the failure mode that kept me from shipping self-healing for three months.

How Qestro addresses it:

- **Default mode is propose-with-diff, not silent-auto-fix.** When a selector breaks, the healer proposes a fix in the dashboard with a visible diff: "This selector changed from `.submit` to `[data-testid='submit']`. Approve fix?" You click to accept. Nothing is modified without approval.
- **High-confidence auto-heal is opt-in per project.** You can flip it on for low-stakes tests (e.g., a smoke test on a marketing page) and off for critical-path tests (e.g., checkout flow).
- **Every heal is logged.** The audit log shows every proposed fix, who approved it, when, and what the original test was. You can diff the entire healing history for any test.
- **Self-heal never modifies assertion logic.** If the test said "assert total is $100" and the UI now shows $95, Qestro doesn't update the assertion. It fails loudly. Healing is scoped to selectors and timing, not correctness.

**Proof points**: `backend/src/services/SelfHealingEngine.ts` (healer implementation), `drizzle/schema.ts` (heal-history audit table). Docs: [qestro.app/docs/self-healing], [qestro.app/docs/self-healing/audit-log].

---

## 3. "AI-generated tests aren't trustworthy."

**Steel-man**: LLMs hallucinate. They write plausible-looking code that references the wrong selectors, misses edge cases, or asserts the wrong thing. Trusting AI to write tests that gate your deploys is risky.

**Response**:

Agreed — and Qestro treats AI generation as an assistant, not an oracle.

Three checks before a generated test enters your suite:

1. **Syntax + type validation.** Generated Playwright code is parsed and type-checked before it's saved. Broken code is rejected immediately, not saved and run later.
2. **Dry-run execution.** Before a generated test is marked "ready," Qestro runs it once against the target URL to confirm it actually executes end-to-end. If it fails, you see the failure in the generation UI and can iterate.
3. **Human review is always available.** The output is standard Playwright TypeScript — 10-second read time. You can accept, edit, or reject every generated test. Treat it like a Cursor-generated PR: review it like you would any code.

The AI is faster than a human at generating the *first draft*. It's not replacing your judgment. It's cutting the boilerplate out.

**Proof points**: `orchestrator/src/generators/test-generator.ts` (generation + validation pipeline), dry-run executor in `backend/src/services/PlaywrightRunnerService.ts`. Docs: [qestro.app/docs/test-generation].

---

## 4. "Why not just use Playwright directly? It's free."

**Steel-man**: Playwright is world-class, open source, and actively maintained by Microsoft. Every paid testing tool has to justify itself against a free, excellent framework.

**Response**:

Playwright is the best testing framework ever built and we build on top of it. If you're happy writing every test by hand, running your own grid, setting up your own dashboards, and writing your own selector-healing logic — vanilla Playwright is the right call. We use it ourselves for internal testing.

What you're paying $99 or $499/mo *for* when you pay Qestro:

- **Natural-language generation** — you don't write the boilerplate.
- **Managed grid** — CI runners, parallel execution, trace/screenshot storage.
- **Self-healing engine** — the failure-analysis pipeline that takes a broken test and proposes a fix.
- **Mobile + API coverage** — unified dashboard instead of Playwright + Maestro + custom API runner.
- **Analytics** — pass-rate trends, flaky-test detection, slowest-test analysis.
- **CI/CD integration** — one YAML snippet instead of a custom GitHub Action.

The math: if your team spends more than ~3 hours/month on test maintenance or CI plumbing, Starter at $99 pays for itself. If you have mobile + API coverage needs, Pro at $499 beats paying separately for mobile-specific tools plus API-specific tools plus browser infra.

**Proof points**: Cost comparison at [qestro.app/vs/playwright]. Output is pure Playwright TS — if you leave, your tests come with you.

---

## 5. "Your free tier won't scale — we'll hit limits in a week."

**Steel-man**: Free tiers are often bait — 5 projects and 100 runs/month sounds plausible, but a serious team will blow through it immediately and be forced to upgrade or leave.

**Response**:

The free tier is intentionally sized for solo developers and side projects, not production teams. Honest framing: if you have 5+ engineers running CI on every commit, you'll exit the free tier in days. That's by design.

What the free tier is for:

- Evaluating whether Qestro works for your stack before you commit money.
- Solo developers running light test loads on personal projects.
- A sandbox for exploring features before proposing Starter/Pro to your team.

What the free tier is *not*:

- A way to run production CI for a 10-engineer team at $0.

That said, the Starter tier at $99/mo (50 projects, 5K runs/month) covers most Series A teams. Pro at $499/mo (500 projects, 50K runs/month) handles Series B. If you're bigger, enterprise pricing is usage-based and negotiable.

If you want to evaluate without hitting the free-tier limit, reply and I'll extend your limits for 14 days so you can run a realistic load test.

**Proof points**: Pricing page at [qestro.app/pricing]. Usage limits enforced via `backend/src/middleware/rate-limit.ts`.

---

## 6. "We don't want vendor lock-in."

**Steel-man**: Testing tools that trap you in proprietary formats (Testim, Mabl, Reflect) mean you can't leave without abandoning years of test work. That's a bad trade.

**Response**:

Qestro's output is standard Playwright TypeScript. You can commit every test to your git repo today and run them with `npx playwright test` tomorrow, with or without Qestro.

Specifically:

- **No proprietary DSL.** Every browser test is `.spec.ts` Playwright code.
- **No dashboard lock-in for test logic.** The test IS the TypeScript file. What Qestro adds (managed runners, self-heal, analytics) is infrastructure on top.
- **Export mobile + API tests.** Maestro YAML and API test definitions can be exported to portable formats.
- **Export all results.** JUnit XML, HTML, Allure, JSON, CSV.

If Qestro shuts down tomorrow, you lose the dashboard, the self-healing, and the managed grid. You keep the tests, the test history exports, and the CI workflows.

This is a deliberate design choice. We'd rather compete on "the product is good enough you'll stay" than on "you can't leave."

**Proof points**: `orchestrator/src/reporters/` (export formats), Playwright code output visible in the editor pane. Docs: [qestro.app/docs/export].

---

## 7. "How is this different from Testim / Mabl / Autify?"

**Steel-man**: The AI-testing space is crowded. Record-and-replay incumbents have had self-healing for years. What's new about Qestro?

**Response**:

Three things differentiate Qestro from the incumbents:

1. **Code output vs. proprietary format.** Testim, Mabl, and Reflect store tests in their own JSON/DSL. You can't commit them, diff them, or run them without their platform. Qestro outputs standard Playwright TypeScript.
2. **Self-serve pricing vs. enterprise sales.** Testim and Mabl are contact-sales. Pricing starts at low 5-figures and the buying cycle takes 6–12 weeks. Qestro is free to $499/mo self-serve.
3. **Developer-first vs. QA-team-first.** The incumbents are built for QA directors, with UIs optimized for non-coders building tests visually. Qestro is built for developers who can read TypeScript and want tests that fit their PR review cycle.

The incumbents will win enterprise QA teams with 5+ dedicated QA engineers and $40K-$200K/yr budgets. Qestro wins developers, small teams, and AI-coding-era workflows where the developer is the QA.

**Proof points**: Feature matrix at `.luna/qestro/compete/feature-matrix.md`. Comparison pages at [qestro.app/vs/testim], [qestro.app/vs/mabl].

---

## 8. "We need enterprise SSO and SCIM — are you ready?"

**Steel-man**: A Series B+ company's security team requires SSO, SCIM, audit logs, and defined offboarding. "Coming soon" isn't good enough.

**Response**:

Honest status as of April 2026:

**Live today**:
- SAML 2.0 with XML parsing and signature validation
- OIDC / OAuth2 with authorization code + PKCE flow
- Supported providers: Azure AD, Okta, Auth0, Google Workspace, Keycloak, generic SAML/OIDC
- Multi-tenant provider registry
- Session management with federated logout
- Audit logs for auth events and admin actions

**Shipping in ~2 weeks** (April 2026):
- SCIM provisioning (auto-create/deprovision users)
- SSO group sync → team roles
- Session revocation webhooks
- MFA enforcement at provider level

**Not yet**:
- SOC 2 Type II — audit in progress, estimated certification Q3 2026
- FedRAMP / HIPAA — not on near-term roadmap

If your requirements list SCIM as a hard launch blocker, let's talk about a 2-week pilot that starts the moment SCIM ships. If SOC 2 is a hard requirement today, we're not ready for you yet — but I'll tell you that honestly rather than waste your procurement cycle.

**Proof points**: `backend/src/services/sso/` (SAMLProvider, OIDCProvider, SSOManager, ProviderRegistry — all live per CLAUDE.md Recently Completed). `backend/src/routes/sso.routes.ts` for endpoints.

---

## 9. "Can we run on-prem? We're regulated."

**Steel-man**: Regulated industries (finance, healthcare, defense) can't send test data — which often includes production-shaped data — to a third-party cloud.

**Response**:

On-prem is partially available today. The core architecture ships as Docker Compose (for dev) and Kubernetes manifests (for production), both checked into the repo at `docker-compose.yml` and `k8s/`. Most of the stack — frontend, backend, orchestrator, Playwright runners, Postgres, Redis — runs fully self-contained.

Caveats for true air-gapped on-prem:

- The default LLM integration (test generation, failure analysis) uses external providers (Anthropic, OpenAI, Groq, DeepSeek, Gemini via our multi-provider failover). For air-gapped deployment, you'd need to swap in a self-hosted LLM (Llama, Mistral, etc.) — we support this via the `LLM_PROVIDER_ENDPOINT` env var.
- Our managed SaaS has SLA + support bundled. On-prem deployment means you own the infra and get a best-effort support tier.

If you're regulated and need air-gapped + self-hosted LLM + custom SLA, that's an enterprise conversation. Pricing is usage-based and includes a dedicated deployment engineer for the first 90 days.

**Proof points**: `docker-compose.yml`, `k8s/`, `backend/src/services/ai/` multi-provider config. Docs: [qestro.app/docs/self-hosted] *[flag: confirm docs page exists before citing]*.

---

## 10. "What happens if Qestro shuts down?"

**Steel-man**: Startups fail. If I build my test suite in Qestro and the company goes away, I want to know I don't lose everything.

**Response**:

Your tests are standard Playwright TypeScript in your repo. If Qestro shuts down tomorrow:

- **You keep the tests.** They run with `npx playwright test` with zero Qestro involvement.
- **You keep the test history.** Export to JUnit, HTML, Allure, JSON, or CSV at any time.
- **You lose the managed runners.** You'd need to set up your own Playwright grid (GitHub Actions runners work fine for most teams).
- **You lose the self-healing.** The test suite reverts to normal Playwright behavior — it fails when selectors break, rather than auto-proposing fixes.
- **You lose the dashboard.** You'd read test results in your CI's native UI or set up Allure locally.

In the unlikely event of shutdown, we'd commit to 90 days of read-only access so you can export everything, and we'd open-source the self-healing engine as a final deliverable.

This isn't a "we'll never shut down" answer because nobody can honestly give you that answer. It's an "even if we do, you're not stranded" answer.

**Proof points**: Export endpoints in `backend/src/routes/`. Self-heal engine designed to be portable (planned open-source publication as `@qestro/self-healing`).

---

## 11. "$499/mo is expensive."

**Steel-man**: $499/mo is $6K/year. That's real budget. Especially compared to Cypress Team at $67/mo or Checkly Starter at $24/mo.

**Response**:

Fair — but Cypress Team is browser-only and Checkly Starter is monitoring-focused. Apples-to-apples comparison at $499:

- **Cypress Team ($67) + API testing tool ($50-100/mo Postman team) + Maestro managed runner (DIY, ~$200/mo infra) + engineer time to glue them together** ≈ $317-500/mo in tooling + significant engineer maintenance time.
- **Qestro Pro ($499)** covers all three surfaces, managed, with self-healing + visual regression + load testing + scheduled runs included.

The Pro tier is priced for teams of 5-20 engineers shipping weekly or faster. If your team is smaller or your testing needs are narrower, Starter at $99 is the right fit — it covers browser testing + CI + self-healing, which is where most teams start.

If $499 is blocking you and you're a 3-5 person team that would benefit from Pro features, reply and we'll work out a Starter-plus configuration.

**Proof points**: Competitive pricing comparison at `.luna/qestro/compete/feature-matrix.md`. Total-cost-of-ownership calculator at [qestro.app/tco] *[flag: confirm this page exists before citing]*.

---

## 12. "We tried record-and-replay tools and they were flaky."

**Steel-man**: Previous experience with record-and-replay tools (old Selenium IDE, old Testim) is that the tests are brittle, break constantly, and end up as a maintenance tax rather than a safety net.

**Response**:

Legitimate scar tissue. Early record-and-replay was genuinely bad — recording a UI interaction and replaying it against a moving target produced flaky tests because nothing understood the intent, only the mechanics.

Qestro isn't record-and-replay. Two distinct things:

1. **Qestro generates tests from intent, not from recording.** You describe the flow in English ("log in, create a project, assert dashboard shows name"). The LLM writes Playwright code that expresses the *intent* — which means the generated selectors are chosen to be stable (prefers `data-testid`, falls back to accessible labels, avoids brittle CSS chains).
2. **When the intent-expressed selector still breaks, self-healing recovers it semantically.** The healer isn't matching pixels or re-recording the click. It's analyzing the DOM delta and proposing a semantic equivalent.

The result: fewer initial flakes because selectors are chosen well, plus a recovery path when they do break.

If you want to validate this on your codebase, 14-day Pro trial with a real project and I'll personally look at any flakes you hit.

**Proof points**: Selector-stability heuristic in `orchestrator/src/generators/test-generator.ts`. Self-heal implementation in `backend/src/services/SelfHealingEngine.ts`.

---

## 13. "Our QA team hand-maintains a 2,000-test suite. They won't adopt AI."

**Steel-man**: A mature QA organization has invested years in a hand-crafted suite with specific conventions, patterns, and institutional knowledge. AI-generated tests disrupt that.

**Response**:

Don't replace the suite. Augment it.

Two realistic adoption paths for a QA team with an existing suite:

1. **Use Qestro for new tests only.** Leave the 2,000-test legacy suite untouched. Point Qestro at new features as they ship. The output is standard Playwright TS, so it lives in the same repo and runs in the same CI as the legacy tests. No team rewrite, no big-bang migration.

2. **Use Qestro to heal your flaky tests.** Run your existing suite inside Qestro and enable self-healing on the tests that are flakiest. The healer will propose selector fixes as tests break. Your QA team reviews and approves — no auto-changes. Effectively you're using Qestro as a flake-reduction layer without changing the authorship model.

Neither path requires your QA team to write English-generated tests. They can keep writing Playwright by hand. Qestro's value for them is the managed infra, the self-healing, and the unified mobile/API dashboard.

**Proof points**: Import-existing-suite docs at [qestro.app/docs/import] *[flag: confirm exists]*. Self-heal operates on any Playwright test regardless of origin.

---

## 14. "We need API testing with auth flows, not just GET requests."

**Steel-man**: Real API testing isn't curl-ing an endpoint. It's OAuth token refresh, session cookies, JWT rotation, multi-step workflows, and data dependencies between requests.

**Response**:

Qestro's API runner handles all of this:

- **Auth chaining.** POST to `/auth/login`, extract the JWT from the response, attach it as a Bearer token to every subsequent request in the test. Refresh-on-expiry flows work the same way.
- **Session / cookie handling.** Cookies set by one request are automatically sent on the next. Explicit cookie manipulation supported.
- **Multi-step workflows with data dependencies.** `POST /projects` → extract `project.id` from response → `GET /projects/:id` using the extracted ID. JSONPath extraction is built-in.
- **OAuth2 flows.** Authorization code, client credentials, refresh-token grants.
- **Response assertions.** Status codes, JSONPath value checks, schema validation (JSON Schema), header matching.
- **Both REST and GraphQL.** GraphQL queries are first-class — variable substitution, response extraction, nested query assertions.

**Proof points**: `backend/src/services/APIRunnerService.ts` (204 lines, covers assertions, chaining, auth). Docs: [qestro.app/docs/api-testing/auth], [qestro.app/docs/api-testing/graphql].

---

## 15. "You're too new / we don't trust unproven vendors."

**Steel-man**: Testing tooling is critical infrastructure. Betting on a new company means risking your test suite if they don't survive.

**Response**:

Fair concern, not dismissible. What I can tell you:

**Risk mitigations specific to Qestro**:
- **Output is portable.** Standard Playwright TypeScript in your repo. If we vanish, your tests don't.
- **Self-serve pricing, no annual lock-in.** Monthly billing on Starter and Pro. Cancel anytime, no penalty.
- **Public roadmap + public commit history.** GitHub activity is visible. 56/56 E2E tests passing as of April 2026. We ship code weekly, publicly.
- **Open-source adjacent work.** Planning to publish `@qestro/self-healing` as MIT npm package, so the critical IP has a public-facing artifact.
- **We're not asking for a 3-year commitment.** Start on the free tier. If Starter makes sense, add it. If we're still around in 12 months and you still love it, sure, annual prepay for a discount. Not before.

**Risks I can't mitigate**:
- We're pre-SOC 2. If your security team blocks pre-SOC 2 vendors, come back Q3 2026.
- We have fewer than 100 paying customers. If you need a case study from a company your size, we may or may not have one — I'll be honest about it.

Trust is earned, not asserted. If you want to test-drive without commitment, the free tier is genuinely free and lets you form your own read.

**Proof points**: GitHub repo at [github.com/qestro] *[flag: confirm repo URL]*. Changelog at [qestro.app/changelog]. Status page at [status.qestro.app] *[flag: confirm status page]*.
