# Qestro Differentiation Plan

> **Date**: 2026-04-17. Synthesized from 9-competitor analysis.
> 5 differentiators, each with: (a) claim, (b) evidence, (c) competitors beaten vs not, (d) marketing copy.

---

## 1. "The copilot for AI vibe coding"

**Claim (one-liner)**: Qestro is the testing layer built for developers who ship with Cursor, Claude Code, and Copilot. None of the incumbents were designed for that workflow.

**Evidence it's real**:
- Positioning is embedded in CLAUDE.md and mission statement.
- Recent shipped features align: MCP server integration, multi-LLM failover (Anthropic/Groq/DeepSeek/Gemini), AI chat, JWT-hardened API surface the vibe coder can call.
- Test generation from plain English is the default authoring flow.
- Output is Playwright code the developer can own and git-commit.

**Beats**: Testim, Autify, Mabl, Reflect, QA Wolf (all designed for QA engineers, not dev-first).
**Ties**: Cypress, Playwright, Checkly (dev-first, but not AI-first).
**Loses**: None — this is our cleanest positioning wedge.

**Marketing copy**:
- Landing: "Developers ship fast with AI. Qestro makes sure nothing breaks."
- Product Hunt: "The copilot for testing AI vibe coding. Your dev agent writes code, our agent writes the tests that catch when it breaks."
- Cold email: "If your team uses Cursor, Claude Code, or Copilot, your test suite is now the bottleneck. Qestro fixes that."

---

## 2. Three platforms, one tool (Browser + Mobile + API)

**Claim**: Most competitors do one or two of browser/mobile/API well. Qestro unifies all three under one dashboard, one billing line, one auth.

**Evidence**:
- Real Playwright runner (browser), Maestro runner (mobile), APIRunner service (REST+GraphQL) — all shipped per CLAUDE.md.
- Unified test storage, unified results, unified self-healing across runners.

**Beats**: Cypress (browser only), Playwright (browser only), Testim (web + Salesforce), Checkly (web + API, no mobile), Reflect (mobile is add-on).
**Ties**: Autify, Mabl, QA Wolf (all three platforms covered).
**Loses to**: QA Wolf on exotic surfaces (phone calls, iBeacon, barcode).

**Marketing copy**:
- Landing: "Browser, mobile, and API tests in one tool. Written once in English, run everywhere."
- Comparison page: "Still using Cypress for browser and Postman for API? Qestro does both, plus mobile."
- Cold email: "You're probably paying for Cypress, Postman, and maybe Maestro separately. Consolidate."

---

## 3. Self-healing by default, not by add-on

**Claim**: When your UI changes and a selector rots, Qestro fixes the test automatically. Every other tool either alerts you, charges extra, or locks the feature into an enterprise tier.

**Evidence**:
- Dedicated SelfHealingEngine with selector, timing, assertion, and API healers (shipped per CLAUDE.md).
- Self-healing available on all paid tiers, not gated to Enterprise.

**Beats**: Cypress (flake detection ≠ self-healing), Playwright (none), Checkly (alerts only), Reflect (partial).
**Ties**: Testim (original pioneer), Autify, Mabl, QA Wolf.
**Loses**: None — at parity or better with the self-healing incumbents, and ahead of the dev-first tools.

**Marketing copy**:
- Landing: "Tests that fix themselves. When your UI changes, your tests don't break."
- Pricing page: "Self-healing included on every tier. No enterprise gatekeeping."
- Sales deck: "Cypress tells you a selector rotted. We change it for you."

---

## 4. Transparent, dev-friendly pricing

**Claim**: Qestro is self-serve from $0 to $499/mo. No "contact sales" until you truly need enterprise. The SMB/Series A engineer can adopt without procurement.

**Evidence**:
- Free tier: 5 projects, 100 runs/mo.
- Starter $99/mo, Pro $499/mo — published.
- Competitors Testim, QA Wolf, Mabl are contact-sales-only.

**Beats**: Testim, QA Wolf, Mabl (all contact-sales).
**Ties**: Cypress, Autify, Checkly, Reflect (public pricing).
**Loses to**: Cypress Team ($67/mo), Checkly Starter ($24/mo) — but they're narrower in scope.

**Marketing copy**:
- Pricing page: "From zero to ready in 30 seconds. No demo required."
- Hero: "Start free. Upgrade when you need more. Never talk to a sales rep."
- Sales: "We have enterprise, but you don't need it yet."

---

## 5. Your tests, your code, your repo (no lock-in)

**Claim**: Qestro generates real Playwright code that you can own, edit, and commit to your own git repo. Leave Qestro anytime and keep every test you built.

**Evidence**:
- Output is standard Playwright TS code.
- No proprietary test DSL.
- Human-readable display IDs (TC-0001) make tests easy to reference in PRs.

**Beats**: Testim (proprietary JSON), Mabl (proprietary), Reflect (proprietary), Autify (mixed), QA Wolf (owned by them).
**Ties**: Playwright (obviously), Cypress (their own format but open).
**Loses**: None.

**Marketing copy**:
- Landing: "Tests written in Playwright. Committable to your repo. Yours forever."
- Sales deck: "No lock-in. Leave us and keep your test suite. We're confident you won't want to."
- Developer-relations: "Open standard output. Your tests run in any Playwright CI, with or without us."

---

## Anti-claims (what we should NOT claim)

| Don't claim | Why |
|---|---|
| "Best browser testing framework" | Cypress + Playwright own that narrative. We build on top of Playwright. |
| "Enterprise-grade" | Not until SOC 2 + 10+ enterprise logos ship. Today we're SMB-to-mid-market. |
| "QA team replacement" | QA Wolf owns this. We're a tool, not a service. |
| "Zero maintenance" | Self-healing reduces maintenance; it doesn't eliminate it. Don't over-promise. |
| "Cheapest tool" | Checkly Starter is $24. We're the cheapest at our feature scope, not absolutely. |

## The 30-second narrative (sales-ready)

> "Qestro is the testing copilot for teams shipping with AI coding tools. Paste a URL, describe what you want tested in plain English, and get production-ready Playwright tests across browser, mobile, and API. When your UI changes, the tests fix themselves. Starts free, $99/mo for SMB, $499/mo for Pro. No lock-in — you own the Playwright code. Built on Cloudflare's edge. Unlike Cypress, we cover mobile and API. Unlike Testim or Mabl, we're self-serve and the output is code you own."
