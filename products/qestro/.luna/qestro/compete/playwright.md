# Playwright (playwright.dev)

> **Category**: Open-source framework (Microsoft), no managed SaaS
> **Threat level to Qestro**: **MEDIUM** — not a direct SaaS competitor, but the de-facto runtime Qestro uses. Microsoft could launch a SaaS at any time.

## 1. One-sentence positioning
"Fast and reliable end-to-end testing for modern web apps" — an open-source browser automation framework from Microsoft.

## 2. Core product capabilities
- Browser automation on Chromium, Firefox, WebKit (Linux, macOS, Windows)
- Auto-waiting and web-first assertions
- Language support: TypeScript/Node.js, Python, .NET, Java
- Test isolation with fresh browser contexts
- Parallel execution + sharding
- Playwright Trace Viewer + VS Code extension
- Test generator (codegen) from browser recording
- MCP server integration for AI tools
- Accessibility snapshots for AI agents
- **No cloud/SaaS offering** — framework only

## 3. What they do BETTER than Qestro
- **Backed by Microsoft**: 86.8k GitHub stars, TypeScript (90.7% of codebase), production-grade runtime.
- **Raw runtime quality**: auto-wait, trace viewer, codegen, isolation — these are exceptional engineering and we inherit them for free.
- **Cross-language**: 4 language bindings. Qestro is JS/TS-first.
- **Zero cost**: free forever. Qestro has to justify a price tag against "just use Playwright."

## 4. What Qestro does BETTER than them
- **Playwright is a library, Qestro is a product.** Playwright requires engineers to set up CI, write fixtures, manage selectors, build a dashboard, capture video, wire up Jira, and maintain the suite. Qestro delivers all of that out of the box.
- **Test generation from English** — Playwright's codegen records clicks into code; Qestro accepts "test that a user can sign up, verify email, and create a project" as input and generates the full test with assertions.
- **Self-healing** — Playwright has no self-healing; when selectors rot, your CI is red. Qestro's SelfHealingEngine auto-fixes.
- **Mobile + API** — Playwright is browser-only. Qestro orchestrates Maestro for mobile and an APIRunner for REST/GraphQL.
- **Managed infra** — no Docker, no CI tuning, no headless Chrome flags. Just run.

## 5. Tech stack signals
- TypeScript (90.7%), Node.js runtime
- Microsoft-maintained: github.com/microsoft/playwright
- Latest release: v1.59.1, 2026-04-01

## 6. Pricing tiers
- **Free**, MIT licensed. No paid offering.

## 7. Target customer
Engineers and QA teams who want direct framework control. Strong in engineering-heavy orgs, infrastructure-capable teams, and anyone with dedicated test automation staff.

## 8. Recent signals
- Released v1.59.1 on 2026-04-01 — actively developed.
- 86.8k stars, 603 open issues — very healthy project.
- Microsoft has not announced a SaaS, but **competitive risk**: if Microsoft launches Playwright Cloud or bundles testing into Azure DevOps, the ground shifts fast.
- MCP server integration shipped — Microsoft is embracing AI agents as first-class testing consumers.

## 9. Qestro's winning angle vs Playwright

**Playwright isn't a competitor — it's a building block.** Qestro is *built on* Playwright. This is actually a strong narrative:

"We don't compete with Playwright. We sit on top of it and give your team the platform layer: test generation from English, self-healing selectors, mobile + API coverage, CI integrations, analytics, and a dashboard. You could build all of this yourself on top of the Playwright framework — or you could be shipping product by Monday."

**Key wedge plays vs "just use Playwright"**:
1. "How much does your Playwright setup cost in engineering time? Hint: more than $99/mo."
2. "When your selector rots at 2am, who fixes it? Us, via self-healing. Or you, at 2am."
3. "Playwright is browser-only. Qestro adds mobile + API on the same stack."
4. "Playwright codegen records clicks. Qestro writes tests from English — no clicking required."

**Risk monitor**: Watch for "Playwright Cloud" or any Azure DevOps testing SaaS announcement. If Microsoft moves, Qestro's wedge against Playwright-direct-users shrinks.
