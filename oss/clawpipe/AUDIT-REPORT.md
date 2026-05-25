# ClawPipe Audit Report

**Date:** April 22, 2026
**Scope:** Full audit of the ClawPipe product (clawpipe.ai, SDK `clawpipe-ai@3.6.0`, gateway at `api.clawpipe.ai`)
**Auditor:** Automated audit via Cowork + rerunnable test suite under `tests/audit/`
**Comparators:** OpenRouter, Portkey, Helicone, LangSmith, LiteLLM

---

## 1. Executive Summary

ClawPipe is a genuinely differentiated AI gateway. The pipeline architecture (Booster → Packer → Cache → Router → Gateway → Learner) is unique in the market: the only other vendor that bundles caching, routing, and observability into one SKU is Portkey, and no competitor ships a deterministic "Booster" stage that can skip LLM calls entirely. The SDK is well-tested (647 unit tests passing), the gateway supports 20+ providers including hard ones (Bedrock SigV4, Vertex RS256 JWT), and the landing page is conversion-optimised with a working ROI calculator.

However, the audit found **six classes of marketing/code drift** that undercut credibility with the exact enterprise buyers the product targets. None are catastrophic in isolation; together they suggest that release hygiene has not kept pace with feature velocity. All are fixable in under a day of focused work.

The competitive risk is narrower than the drift would suggest. OpenRouter owns hobbyists on price. Portkey owns enterprise on breadth (1,600+ models). Helicone owns observability-first teams. ClawPipe's wedge — **pre-LLM cost avoidance via Booster + semantic cache + self-learning routing** — is real but is not yet the first thing a visitor to clawpipe.ai learns. The homepage leads with "Control cost, routing, and reliability" which is a commodity positioning indistinguishable from Portkey's homepage.

**Top three recommendations, in priority order:**

1. **Fix the drift.** Version, pricing, and GitHub URLs must be identical across the landing page, SDK, and repo. The audit suite now enforces this in CI.
2. **Reframe the hero.** Lead with Booster ("the only gateway that skips LLM calls") — it's the defensible story. "Cost and routing" is a crowded category.
3. **Ship public benchmarks.** The `benchmarks/` directory exists in the repo but is not linked from the landing page, and the homepage's "See benchmarks" link 404s against a repo (`finsavvyai/clawpipe`) that does not exist publicly. Portkey and Helicone both publish benchmarks; ClawPipe has the numbers and isn't showing them.

---

## 2. Methodology

The audit was designed to be **rerunnable**, not a one-off. A four-tier test suite lives in `tests/audit/` and can be invoked on any developer machine or in CI:

```
tests/audit/
├── static/index.mjs          # 15 repo-local checks — no network
├── unit/run-vitest.mjs       # wraps sdk/ and gateway/ vitest suites
├── live/landing.mjs          # 10 probes against clawpipe.ai
├── live/api.mjs              # 8 probes against api.clawpipe.ai
├── lib/{tap,fetchSafe}.mjs   # zero-dep harness
└── run-all.mjs               # orchestrator + JSON rollup
```

Live tiers respect an `AUDIT_SKIP_LIVE=1` escape hatch for hermetic CI. The API tier exposes `CLAWPIPE_API_KEY` and `CLAWPIPE_PROJECT_ID` for authenticated probes (picks the cheapest Groq model to keep per-run cost under $0.01).

All findings below are backed by at least one assertion in that suite. The suite is the contract — if a finding ever becomes false, the corresponding test will turn green on its own.

---

## 3. Promises vs. Reality

### 3.1 What actually works

| Claim | Evidence | Status |
|---|---|---|
| "Booster skips LLM calls entirely" | `sdk/src/booster.ts` + 22 dedicated unit tests; deterministic rules for greetings, arithmetic, canonical redirects | **Works** |
| "Semantic caching" | `sdk/src/cache.ts` + `gateway/src/cache.ts`; hash-based local + KV tier | **Works** |
| "20+ providers" | 22 provider files under `gateway/src/providers/` including Bedrock (SigV4) and Vertex (RS256 JWT) | **Works** |
| "Self-learning routing" | `gateway/src/learner.ts` updates `route_weights` D1 table; router reads weighted scores | **Works** |
| "647 tests passing" | `cd sdk && npm test` — confirmed 647/647 locally | **Works** |
| OpenAI-compat shim | `sdk/src/openai-compat.ts` — drop-in `new OpenAI({ baseURL })` works | **Works** |
| MCP server | `mcp-server/` ships at v3.2.0 on npm | **Works** |

### 3.2 Where the pitch is ahead of the product

| Claim (source) | Reality | Severity |
|---|---|---|
| Landing-page JSON-LD `"softwareVersion": "3.0.0"` | SDK `package.json` is `3.6.0` — six minor versions of drift | **High** (SEO rich-snippet lies about current version) |
| Pricing card "Free — 500 calls/day" | Hero copy, final CTA, and JSON-LD all say 1,000 calls/day | **High** (one of these is what customers will be billed against) |
| JSON-LD `Offer` lists Pro $49 / Team $149 | Visible pricing grid is Dev $79 / Growth $299 / Scale $799 / Enterprise $2,500 | **High** (rich snippets misrepresent every price) |
| Homepage "Star on GitHub" button → `github.com/finsavvyai/clawpipe` | Repo 404s (source is private; no public mirror yet) | **Medium** (broken CTA) |
| Homepage "See benchmarks" link | Points at the same dead GitHub URL | **Medium** (broken CTA — and `benchmarks/` does exist in the private repo) |
| "demo.mp4" present in `landing-page/` | Never referenced in `index.html` — dead asset | **Low** (4.7 MB uploaded, 0 impressions) |
| `CLAUDE.md` in repo: "21 files, 212 tests, v3.0.0" | Actual: 82 files, 647 tests, v3.6.0 | **Low** (internal doc staleness) |
| CI-enforced "≤200 lines per source file" | Six files over the limit: `sdk/src/index.ts=201`, `sdk/src/packer-advanced.ts=201`, `gateway/src/analytics.ts=201`, plus three test files at 218/243/278 | **Low** (rule is aspirational, not enforced; either fix the code or fix the rule) |
| README lists 6 providers | 16 additional provider files shipped: ai21, azure-openai, bedrock, cerebras, cohere, databricks, fireworks, gemini, huggingface, openrouter, perplexity, replicate, together, vertex, writer, xai | **Low** (undersells breadth — this is a *good* drift to fix) |

Every row above is caught by a specific assertion in `tests/audit/static/index.mjs`. Fix the underlying code, and the test goes green.

### 3.3 Not tested (out of scope for this audit)

- End-to-end cost savings claim (30–50% reduction). Would require a captive production workload to measure honestly.
- "1.5K concurrent requests" load test from the release checklist — no load-testing harness shipped in the repo; the claim is unverified.
- Security audit ("8 issues fixed") — the remediations exist in git history but there's no published report linking finding → fix.

---

## 4. Competitive Gap Analysis

### 4.1 Positioning map

| Vendor | Model | Core wedge | Pricing anchor |
|---|---|---|---|
| **ClawPipe** | SDK + hosted gateway | Pre-LLM cost avoidance (Booster) + pipeline | $0 / $79 / $299 / $799 / $2,500 |
| **OpenRouter** | Proxy only | Model marketplace, pay-as-you-go credits | 5% margin on provider costs |
| **Portkey** | Proxy + SDK | Enterprise observability + guardrails + 1,600 models | $49 / $249 / custom |
| **Helicone** | Proxy only | Logs-first observability, simple to adopt | $20/seat, free < 10k logs |
| **LangSmith** | SaaS observability | Tracing for LangChain-first teams | $39/seat |
| **LiteLLM** | Self-hosted proxy | OSS, 100+ providers, bring-your-own-infra | Free (OSS) + $50/mo hosted |

### 4.2 Where ClawPipe leads

- **Booster stage is unique.** No other gateway ships a deterministic pre-LLM layer that can respond without a provider call. For repetitive workloads (greetings, canonical redirects, trivial arithmetic, common lookups) this is a real zero-cost path. The marketing does not emphasise this enough.
- **Self-learning router.** Portkey and LiteLLM offer *configured* fallback chains; ClawPipe's router updates `route_weights` based on observed outcomes. That's closer to a bandit than a config file.
- **SDK + gateway bundled.** Helicone and LangSmith are proxies — you integrate by changing a base URL and then still need to pick a routing library. ClawPipe's SDK does local-side work (Booster, Packer, local cache) before any network hop, so part of the savings never leave the client.
- **Multi-language SDKs shipped.** Repo contains node, go, php, java, dotnet, elixir SDKs. Portkey ships Node + Python. Helicone ships Node + Python. This is a quiet differentiator for polyglot teams.

### 4.3 Where ClawPipe trails

- **Model breadth.** 22 providers is strong but Portkey's "1,600 models" headline is hard to beat on paper. ClawPipe needs to either match volume or reframe the axis (quality-curated vs. everything-including-dead-models).
- **Guardrails.** Portkey and Helicone both ship PII redaction, prompt-injection detection, and output moderation as turnkey features. ClawPipe's `gateway/src/` has no visible guardrails module. For regulated buyers (healthcare, fintech) this is table stakes.
- **Observability UX.** Helicone's dashboard is the category benchmark. ClawPipe's dashboard exists but the `dashboard/` React app is less mature and the audit could not verify a live production dashboard without credentials.
- **Open-source story.** LiteLLM is Apache-2.0 and self-hostable; OpenRouter's marketplace model is transparent. ClawPipe's repo is private. For the buyer who wants "I can always fork it," ClawPipe currently has no answer.
- **Community signals.** No public GitHub → no stars, no issues, no contributor graph. The "Star on GitHub" CTA on the homepage therefore not only 404s, it can't currently be honest.
- **Free-tier generosity.** Helicone: 10K logs/mo free. OpenRouter: no account floor. ClawPipe: 1,000 calls/day (= 30K/mo, actually competitive — but the pricing card claims 500, which makes it look stingier than it is).

### 4.4 Feature matrix (condensed)

| Feature | ClawPipe | OpenRouter | Portkey | Helicone | LiteLLM |
|---|---|---|---|---|---|
| Multi-provider routing | ✓ | ✓ | ✓ | partial | ✓ |
| Semantic cache | ✓ | — | ✓ | — | ✓ |
| Pre-LLM skip ("Booster") | **✓ unique** | — | — | — | — |
| Self-learning router | **✓** | — | config only | — | config only |
| PII / guardrails | — | — | ✓ | ✓ | — |
| Observability dashboard | partial | basic | ✓ | **best-in-class** | — |
| OpenAI-compat shim | ✓ | ✓ | ✓ | ✓ | ✓ |
| Open-source gateway | — | — | partial | partial | **✓** |
| Model count claim | 22 | ~300 | 1,600 | 100+ | 100+ |
| SDKs shipped | **6 languages** | 2 | 2 | 2 | 1 (Python) |
| Pricing floor (paid) | $79/mo | 5% margin | $49/mo | $20/seat | $50/mo hosted |

---

## 5. Landing-Page UX & Marketing Effectiveness

### 5.1 What the page does well

The landing page is clearly professionally produced. It has: a clear hero, a working ROI calculator (users input tokens/month and see estimated savings), a logo strip covering all six README-promised providers, a pricing grid with "Most Popular" anchoring on Growth ($299), JSON-LD structured data for SEO, a CTA funnel that ends in "Start free — 1,000 calls/day" (consistent with the free tier intent), and sensible security headers deployed via Cloudflare Pages `_headers`.

Conversion architecture is sound. The page doesn't over-promise in copy and the ROI calculator is a good "show the math" move for a cost-focused product.

### 5.2 Friction and broken experiences

- **"Star on GitHub"** — the most prominent social-proof CTA on the page — leads to a 404.
- **"See benchmarks"** — same destination, same 404.
- **Pricing-card free tier** displays 500 calls/day; the rest of the page says 1,000. A visitor who reads both will distrust everything else on the page.
- **Hero headline** ("Control cost, routing, and reliability") is generic. Swapping "cost" for "LLM calls you never have to make" would immediately differentiate from every proxy vendor.
- **No demo video visible.** `demo.mp4` ships in the `landing-page/` directory but is never embedded. Video on a developer landing page lifts conversion materially and this one is one `<video>` tag away from existing.
- **JSON-LD Offer prices are stale.** This is an SEO / rich-snippet issue — Google will surface $49/$149 in search results even though the real grid starts at $79. Buyers who click through and see different prices will bounce.

### 5.3 What the marketing copy could say (but doesn't)

The homepage never mentions that the SDK runs parts of the pipeline *client-side*. That's the strongest rebuttal to "why not just use OpenRouter" — savings start before the first network hop. Similarly, the self-learning router is buried. Both of these are the reasons to choose ClawPipe over any proxy; they should be the second and third paragraphs on the page.

---

## 6. Test & Quality Posture

### 6.1 Unit-test coverage (as observed)

- **SDK:** 647 tests across 21 files — 100% pass locally (`cd sdk && npm test`). Covers booster rules, packer compression, cache eviction, router scoring, retry/circuit-breaker, OpenAI-compat shim. This is strong coverage for a codebase this size.
- **Gateway:** 58 tests including provider-specific tests for Bedrock (SigV4 signature), Vertex (JWT signing), OpenRouter passthrough. All pass on a fresh `npm install`.
- **Integration (e2e/):** Suite exists but requires a deployed gateway and valid API keys; not runnable in a hermetic CI.

### 6.2 Static CI rules

The portfolio-wide rule is ≤200 lines per source file. Six files exceed the limit by 1–78 lines. None are egregious; `packer-advanced.test.ts` at 278 lines is the worst offender. Either split (preferred — keeps the rule meaningful) or add an explicit exemption list with a one-line justification each.

### 6.3 Security

- `.gitignore` correctly lists `.env`, `.wrangler/`, `node_modules/`.
- Secrets regex scan (`sk-…`, `ghp_…`, `glpat-…`) found zero hits in `sdk/src`, `gateway/src`, `landing-page/`.
- Provider keys are documented as encrypted-at-rest in KV; D1 stores hashed API keys. Not verified live (would require DB access).

### 6.4 Live-tier findings (pending)

The `tests/audit/live/` tier was designed but could not be executed from the audit sandbox (egress to `clawpipe.ai` / `api.clawpipe.ai` is proxy-blocked). Run on a developer machine:

```bash
cd tests/audit
node run-all.mjs
# or: CLAWPIPE_API_KEY=... CLAWPIPE_PROJECT_ID=... node run-all.mjs
```

Expected behaviour documented in `tests/audit/README.md`. The probes target: health endpoint latency (<500ms budget), CORS preflight, unauth requests return 401/403 (never 5xx), authed prompt returns `meta` cost block, rate-limit headers exposed, TLS/HSTS on the landing page, presence of robots.txt / sitemap.xml / llms.txt, legal pages resolvable.

---

## 7. Prioritised Fix List

**Ship within a day (credibility bugs, not code bugs):**

1. Bump JSON-LD `softwareVersion` to `3.6.0` in `landing-page/index.html` — ideally script this at build time from `sdk/package.json`.
2. Replace the pricing-card "500 calls/day" with "1,000 calls/day" to match the hero and JSON-LD.
3. Update JSON-LD `Offer` array to reflect actual tiers (Dev $79, Growth $299, Scale $799, Enterprise contact).
4. Fix or remove the "Star on GitHub" and "See benchmarks" CTAs. If the public repo isn't ready, link to `docs.clawpipe.ai/benchmarks` instead.
5. Embed `demo.mp4` in the hero or right below it.
6. Refresh `CLAUDE.md` with current counts (82 files, 647 tests, v3.6.0).

**Ship within the week (positioning):**

7. Rewrite the hero around Booster's zero-LLM-call path. "Control cost" is commodity; "Skip the LLM entirely" is yours.
8. Publish a public-facing benchmarks page with a cost-per-1K-calls chart vs. raw OpenAI/Anthropic, and vs. Portkey/OpenRouter where you can measure it fairly.
9. Update README to mention every shipped provider (there are 22, not 6).
10. Publish a minimal public repo — even a docs-only mirror — so the GitHub CTAs can link somewhere real.

**Ship within the quarter (competitive):**

11. Ship a guardrails module (PII redaction + basic prompt-injection detection). Parity with Portkey/Helicone on this is mandatory for regulated buyers.
12. Harden the dashboard to the point where a Helicone user would feel at home.
13. Decide open-source strategy: either open-source the gateway (matching LiteLLM) or publicly commit to "closed but audited" with a SOC2-style report.

---

## 8. Rerunning this audit

```bash
# static + units (works offline, no live-site access needed):
cd tests/audit && node static/index.mjs
cd tests/audit && node unit/run-vitest.mjs

# full run including live probes:
cd tests/audit && node run-all.mjs

# skip live tier in hermetic CI:
AUDIT_SKIP_LIVE=1 node tests/audit/run-all.mjs

# authenticated API probe:
CLAWPIPE_API_KEY=... CLAWPIPE_PROJECT_ID=... node tests/audit/live/api.mjs
```

Rollup JSON lands at `tests/audit/audit-report.json`. Per-tier JSON lands under `tests/audit/reports/`. The suite uses zero third-party dependencies — it runs anywhere Node 20+ and the existing vitest suites run.

---

## Errata — commit message corrections

Tracked here because git history is immutable; the underlying code is correct.

- **`72ee86b` "feat(billing): LS-only migration …"** — body says "24 new tests"; the actual count from the breakdown is **34** (10 webhook + 14 tier-sync + 7 checkout + 3 portal). Code and breakdown are correct; only the summary number is off. Verified via `grep -cE "^\s*(test|it)\(" gateway/src/billing/*.test.ts`.

---

*End of report.*
