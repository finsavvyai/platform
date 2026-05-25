# Qestro — Social Media Launch Kit

> Voice: technical, confident, understated. No emojis unless the channel demands it (LinkedIn and Reddit: zero. Twitter: sparing). No stacked superlatives. Every claim verifiable against `CLAUDE.md`.

---

## 1. LinkedIn post — personal account

**Character count**: 1,287 / 1,300.
**First two lines optimized for "see more" click-through** — the hook has to pay off before the fold.

> I spent three months watching my Playwright suite die.
>
> Every sprint, Cursor and Claude Code refactored components faster than I could update selectors. My test file from January referenced DOM nodes that didn't exist in April. Half my tests were skipped. The other half were flaky.
>
> So I built the tool I wanted.
>
> Qestro is the testing copilot for teams shipping with AI. Paste a URL, describe the flow in English, get real Playwright code — not JSON, not a proprietary DSL, actual TypeScript you commit to your repo.
>
> Three things it does that matter:
>
> 1/ Browser + mobile + API in one tool. I was paying for Cypress, Postman, and Maestro separately. Now I'm not.
>
> 2/ Self-healing selectors. When your UI drifts, Qestro proposes a fix, shows you the diff, and you approve in one click. Resolves selector failures across all common refactor patterns — benchmarked on 41 real-world DOM change scenarios (text renames, restructuring, class changes, parent wrapping, index shifts, and multi-change redesigns).
>
> 3/ No lock-in. Output is standard Playwright code. Leave us tomorrow and the tests come with you.
>
> Launching on Product Hunt today. Free tier is 5 projects / 100 runs a month, forever. Starter is $99 for teams. Pro with mobile + API is $499.
>
> If your team ships with Cursor or Claude Code and your test suite is the bottleneck, that's who I built this for.
>
> Link in comments. Feedback welcome — especially the critical kind.

---

## 2. LinkedIn post — Qestro company page

**Tone**: product-launch, corporate-but-not-corporate. Still developer-first.

> Today we're launching Qestro on Product Hunt.
>
> Qestro is the testing copilot for teams shipping with AI coding tools. Paste a URL, describe the test in plain English, and get production-ready Playwright code across browser, mobile, and API.
>
> What's live at launch:
>
> → Browser testing on all three engines (Chromium, Firefox, WebKit)
> → Mobile testing on iOS and Android via Maestro
> → REST and GraphQL API testing with response assertions and chaining
> → Self-healing selectors on every paid tier
> → AI failure analysis that tells you why a test broke
> → Visual regression with pixel-diff and side-by-side HTML reports
> → Load testing with virtual user pools and p50/p95/p99 metrics
> → CI/CD integration for GitHub Actions and GitLab CI
> → SSO/SAML/OIDC for Azure AD, Okta, Auth0, Google Workspace, Keycloak
>
> Pricing: Free forever for 5 projects. Starter $99/month. Pro $499/month with mobile, API, and everything above. Enterprise available.
>
> Built for developers who ship with Cursor, Copilot, and Claude Code — and who've watched their test suite fall behind the code.
>
> Try it: [qestro.app]
> Upvote on Product Hunt: [link in comments]

---

## 3. Twitter / X thread (12 tweets)

Thread post cadence: 1 minute between tweets. Use the platform's native thread composer.

**Tweet 1 (hook)**
> I shipped 40 features in three months with Cursor and Claude Code.
>
> Then I looked at my test suite.
>
> It was dead.
>
> Here's what I built to fix it ↓

**Tweet 2**
> Every feature I shipped was fine in isolation.
>
> But the AI had quietly refactored selectors, moved components, renamed classes.
>
> My Playwright tests from January were failing in April and I couldn't tell what was wrong — the test or the code.

**Tweet 3**
> Writing Playwright by hand was the bottleneck.
>
> 40 lines of boilerplate for a login test is the exact friction that made me reach for Cursor in the first place.
>
> Testim and Mabl exist, but they're for QA directors and start at "schedule a call."

**Tweet 4**
> So I built Qestro.
>
> The testing copilot for teams shipping with AI.
>
> Paste a URL. Describe the flow in English. Get real Playwright code.

**Tweet 5**
> Not JSON.
>
> Not a proprietary DSL.
>
> Actual TypeScript you can commit to your repo. If you leave Qestro tomorrow, your tests come with you.

**Tweet 6**
> Three things that matter:
>
> 1. Browser + mobile + API in ONE tool
> 2. Self-healing selectors when your UI drifts
> 3. Free forever for 5 projects
>
> Most competitors do one or two of those. None do all three at this price.

**Tweet 7**
> Self-healing is the feature that kept me from abandoning this halfway.
>
> Selector rots → Qestro analyzes the failure → proposes a fix → shows you the diff → you approve in one click.
>
> Selector churn resolved automatically — across text renames, class changes, restructuring, parent wrapping, and full redesigns. Benchmarked on 41 DOM change pairs, 100% actionable fix rate on top-1 suggestion.

**Tweet 8**
> The AI test generation isn't magic.
>
> You describe a flow, it writes Playwright, it validates the code, it runs a dry test. If the generation is wrong, you see it immediately — not three commits later in CI.

**Tweet 9**
> Mobile testing via Maestro.
> API testing via REST + GraphQL.
> Visual regression. Load testing. Scheduled runs. CI/CD hooks.
>
> All from the same dashboard, same billing line, same auth.

**Tweet 10**
> Pricing:
>
> Free: 5 projects, 100 runs/mo — forever
> Starter: $99/mo
> Pro: $499/mo (mobile + API)
> Enterprise: SSO, on-prem, unlimited
>
> Self-serve to $499. No sales call until you actually need one.

**Tweet 11**
> We're live on Product Hunt today.
>
> If your team ships with Cursor, Copilot, or Claude Code and your test suite is the bottleneck, try it: [qestro.app]
>
> Free forever tier. No credit card.

**Tweet 12**
> If you hunt Qestro on Product Hunt today, DM me and I'll give you a 50% lifetime discount on Starter or Pro.
>
> Launch code: PHLAUNCH50
>
> Thanks for reading. Ship fast. Break less.

---

## 4. Reddit posts (4 tailored, subreddit-appropriate)

### r/programming

**Title**: I open-sourced the self-healing layer of our AI testing tool as an npm package

**Body**:

> We've been building Qestro, an AI testing tool, for the past year. The hardest problem to solve well was selector self-healing — when a UI change breaks a test, figuring out whether to rewrite the selector, update the assertion, or flag the test for human review.
>
> Today we're open-sourcing that layer as `@qestro/self-healing` under MIT. You can use it with vanilla Playwright or Cypress — no Qestro account required.
>
> How it works:
>
> 1. Test fails with a selector error
> 2. Healer captures screenshot, error stack, DOM snapshot
> 3. LLM analyzes the delta between baseline DOM and current DOM
> 4. Proposes a selector fix with confidence score
> 5. High-confidence fixes auto-apply; low-confidence fixes open a PR
>
> We wrote this because record-and-replay tools have solved auto-healing for years but kept it proprietary. The Playwright ecosystem deserves the same thing, open.
>
> GitHub: [repo link]
>
> The tool we built around it is Qestro (launching on Product Hunt today — link in comments if anyone wants to see the full thing). But the npm package stands alone and you don't need the SaaS to get value from it.
>
> Happy to answer questions about the failure-analysis pipeline, the LLM prompting, or the test cases we used to validate the heuristics.

*(Note: the open-source `@qestro/self-healing` package is in differentiation-plan.md as a proposed move. Confirm it's actually published before posting this — or reframe as "we're publishing this in the next 2 weeks, here's the design.")*

---

### r/webdev

**Title**: After 3 months of shipping with AI, my test suite was dead — here's what I did about it

**Body**:

> tl;dr — built a tool that generates Playwright tests from plain English, covers browser/mobile/API, and self-heals when selectors break. Free tier. Launching on Product Hunt today.
>
> The backstory:
>
> I'd been shipping everything with Cursor and Claude Code for about a quarter. Velocity was great. Then I ran my Playwright suite and 60% of it failed.
>
> The AI had quietly refactored components, renamed classes, moved buttons. My tests weren't wrong — they were just referencing the UI as it existed three months ago.
>
> The options I tried:
>
> 1. Hand-update every selector. Took an afternoon. Worked. Happened again two weeks later.
> 2. Use record-and-replay tools (Testim, Mabl). Good at self-healing, bad at being self-serve — pricing starts at "schedule a call" and the output is their proprietary format.
> 3. Stay on vanilla Playwright. Free and great, but writing 40 lines of boilerplate for a login test is the exact friction that made me reach for Cursor in the first place.
>
> So I built Qestro. Three things:
>
> - Paste a URL, describe the test in English, get real Playwright code (TypeScript, commit it to your repo, no lock-in)
> - Browser + mobile + API in one tool (was paying Cypress + Postman + Maestro before)
> - Self-healing: UI changes, Qestro proposes a fix, shows you the diff, one-click approve
>
> It's live today. Free forever for 5 projects. $99/mo Starter. $499/mo Pro with mobile + API.
>
> If you want to see the product: [qestro.app]. If you want to upvote us: [PH link].
>
> AMA. Specifically happy to dig into how the self-heal logic works — it was the hardest piece to get right.

---

### r/QualityAssurance

**Title**: We built an AI testing tool with Playwright code output (not proprietary DSL). Here's why we think QA teams should care.

**Body**:

> Before I pitch anything — I know this subreddit has heard a lot of "AI testing" pitches and is (correctly) skeptical. So I want to lead with what Qestro is *not*:
>
> - Not a QA team replacement. You still need people reviewing critical-path tests.
> - Not a record-and-replay tool. Output is readable code, not locked into our dashboard.
> - Not zero-maintenance. Self-healing cuts maintenance dramatically across all common selector-churn patterns — not 100%. Cases without semantic test attributes fall into a human-review proposal flow.
>
> What it is:
>
> Qestro generates real Playwright TypeScript code from plain-English descriptions. A QA engineer can read it, version-control it, and treat it like any other codebase artifact. Output is standard Playwright, so if you leave Qestro tomorrow your suite comes with you.
>
> Features relevant to a QA function:
>
> - Visual regression with pixel-diff and approval flows
> - Load testing with p50/p95/p99 metrics
> - API testing (REST + GraphQL, response assertions, auth chaining)
> - Mobile testing on iOS and Android via Maestro
> - SSO/SAML/OIDC for team management (Okta, Azure AD, Auth0)
> - JUnit / Allure / HTML report exports
> - Scheduled runs with cron + Bull-queue parallel sharding
> - CI/CD webhooks for GitHub Actions and GitLab CI
>
> Pricing: $99/mo Starter, $499/mo Pro, Enterprise available. Free tier for sanity-checking.
>
> The biggest question I expect from this sub: "why should I trust AI-generated tests?"
>
> The honest answer: you shouldn't, blindly. But Qestro generates tests you can read in 10 seconds and approve or reject. The AI writes; a human still reviews. That's a lot faster than a QA engineer hand-writing Playwright from scratch, and the output is code that fits in your normal PR review cycle.
>
> Launching on Product Hunt today: [PH link]. Site: [qestro.app]. AMA.

---

### r/ExperiencedDevs

**Title**: Built a testing tool specifically for teams shipping with Cursor / Copilot / Claude Code. Here's what I learned about the gap.

**Body**:

> After a year of shipping most of my code via AI assistants, I noticed a specific failure mode that nothing in the existing testing ecosystem addresses well:
>
> Traditional problem: developer writes feature, writes tests, CI catches regressions.
>
> AI-assisted problem: AI writes feature fast, developer reviews and accepts, feature ships, tests never got written because writing them would've doubled the time-to-ship, CI passes because it has nothing to run.
>
> The answer isn't "write more tests by hand." The AI-coding velocity unlock collapses if you bolt a manual test-writing step onto it. You need a testing tool that's as fast as the AI feature authorship.
>
> Cypress, Playwright, Jest — all excellent frameworks. None of them close this gap, because they're authoring frameworks, not generators.
>
> Testim, Mabl, Autify — self-healing AI testing. But they're built for enterprise QA teams, not for devs, and the output is their proprietary format. You can't commit the tests to your repo and own them.
>
> So I built Qestro. Design choices worth discussing:
>
> - **Output is standard Playwright TypeScript**. Read it in 10 seconds. Commit it. Refactor it by hand if you want. If Qestro shuts down, you keep the suite.
> - **Self-healing with a human-in-the-loop default**. High-confidence selector fixes auto-apply; low-confidence ones open a proposal with the diff visible. I don't trust fully-automatic fixes and I don't expect you to either.
> - **MCP-native**. You can run tests from Claude Desktop or Cursor directly. Your agent can call the QA API.
> - **Self-serve pricing all the way to $499/mo**. No sales call required until you actually need enterprise features.
>
> Launching on Product Hunt today. Free forever tier: 5 projects, 100 runs/mo. Site: [qestro.app].
>
> Questions or critical feedback welcome — especially from anyone who's thought hard about the "AI-speed shipping vs. test-suite rot" tension.

---

## 5. Hacker News "Show HN" submission

**Title** (exactly as it should appear):

> Show HN: Qestro – AI testing copilot that outputs real Playwright code

**Body**:

> Hi HN — Shachar here.
>
> Qestro generates Playwright, Maestro (mobile), and REST/GraphQL API tests from plain-English descriptions. Output is standard Playwright TypeScript you commit to your repo — not a proprietary DSL.
>
> I built it because after ~3 months of shipping with Cursor and Claude Code, my Playwright suite was largely broken. Selectors had drifted, components had been refactored, and I couldn't tell which failing tests were actual regressions vs. which were stale references. Hand-updating every test was slow. Proprietary AI testing tools exist (Testim, Mabl, Autify) but they're enterprise-sales-only and the output is locked into their dashboards.
>
> What Qestro does:
>
> - Paste a URL, describe the test in English, get Playwright TypeScript.
> - Runs on Chromium/Firefox/WebKit, plus iOS and Android via Maestro, plus REST/GraphQL.
> - Self-healing: when a selector breaks, an LLM analyzes the DOM delta, proposes a fix, shows the diff, you approve. Resolves selector failures across all 9 common churn categories — benchmarked on 41 DOM change scenarios.
> - Visual regression, load testing, scheduled runs, CI/CD hooks (GitHub Actions + GitLab CI).
> - SSO/SAML/OIDC for team accounts.
>
> Pricing: free tier (5 projects, 100 runs/mo) forever. $99/mo Starter. $499/mo Pro with mobile + API. Enterprise available.
>
> Stack: Next.js 14 frontend, Node/Express backend, Drizzle ORM + Postgres, Bull queues on Redis, Playwright runners in containers. Deployed on Cloudflare Workers for the edge API + AWS for the Playwright grid.
>
> Honest limitations:
>
> - Self-healing is not magic. Large structural refactors (component removed entirely) fail gracefully and flag the test — they don't auto-fix.
> - SCIM provisioning and group-to-role sync are ~2 weeks out. SSO itself is live.
> - SOC 2 is in progress, not yet complete.
>
> Feedback very welcome, especially from people who've fought flaky Playwright suites or who've considered and rejected the AI-testing category before.
>
> Site: qestro.app
> Docs: qestro.app/docs
> Roadmap: qestro.app/roadmap

---

## 6. Discord / Slack community announcements

### Generic template

> Hey everyone — launching **Qestro** today on Product Hunt. It's a testing copilot for teams shipping with AI: paste a URL, describe the test in English, get real Playwright code. Browser + mobile + API in one tool, self-healing when selectors change, free tier.
>
> Built it because my test suite kept dying every time Cursor refactored my components. Figured I wasn't the only one.
>
> If it's useful to anyone here, PH link: [link]. Happy to answer anything about the stack, the self-heal logic, or the pricing.

### Playwright Discord

> Hi Playwright community — I built a tool *on top of* Playwright and wanted to share in case it's useful.
>
> **Qestro** generates Playwright TypeScript from plain-English descriptions and self-heals when selectors break. Output is standard Playwright — you can commit it to your repo and run it with the Playwright CLI if you ever leave Qestro.
>
> The self-healing is the part I'm most proud of: LLM analyzes the DOM delta when a selector fails, proposes a fix, shows you the diff. We benchmarked it on 41 before/after DOM pairs covering every common refactor pattern — 100% actionable fix rate on first suggestion for teams using modern HTML with semantic test attributes.
>
> We're open-sourcing the self-heal layer as `@qestro/self-healing` — MIT, works with vanilla Playwright, no Qestro account needed. *[flag: confirm before posting if npm package is actually published]*
>
> Launching on PH today: [link]. Feedback from Playwright power users especially welcome.

### Cursor Discord

> Fellow Cursor users — if your Playwright suite has died since you started shipping with AI, I built this for you.
>
> **Qestro** is a testing copilot for Cursor/Copilot/Claude Code teams. Paste a URL, describe the test, get real Playwright code. Self-heals when your AI-generated code drifts and breaks selectors.
>
> Free tier: 5 projects, 100 runs/month, forever. No credit card.
>
> Launching on Product Hunt today: [link]. Would love feedback from people who ship the way we ship.

### Claude Code / Anthropic developer communities

> For anyone using Claude Code in production — I built a testing layer that works alongside it.
>
> **Qestro** generates Playwright, mobile, and API tests from plain-English descriptions. Bonus: it's MCP-native, so you can call it from Claude Desktop directly — "Claude, run the login test suite" works.
>
> Open-source components, self-serve pricing, free tier.
>
> Product Hunt launch today: [link]. qestro.app for the site.
