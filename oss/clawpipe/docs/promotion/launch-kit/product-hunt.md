# Product Hunt — launch packet

## Tagline (≤ 60 chars)

```
The only AI gateway that skips LLM calls entirely.
```

(50 chars. Direct echo of the landing-page hero, optimised for the PH card.)

Backup options if the primary feels long in the PH UI:

- `Skip the LLM. Pay zero tokens. Open SDK.` (40 chars)
- `Skip the LLM with 246 deterministic Booster rules.` (50 chars)
- *Taglines that cite the 57% / 400-prompt number have been removed — that figure is from an in-house synthetic benchmark. Re-add a measured tagline once the public benchmark at `github.com/finsavvyai/clawpipe-booster-benchmark` lands.*

## Description (≤ 260 chars)

```
ClawPipe is an SDK + Cloudflare gateway with a "Booster" stage that resolves
greetings, math, dates, JSON, conversions, and 246 other patterns locally —
no LLM call. Everything else flows through a self-learning router across 21
providers. MIT SDK, free tier 1K calls/day.
```

(258 chars. Adjust if PH counts differently than your editor — paste into the form to verify.)

## First-comment maker post

Three short paragraphs from the founder. Post within 60 seconds of the launch going live.

> Hey Hunters — Shahar here, builder of ClawPipe.
>
> I started this because I was watching teams burn $5K-$30K/month on OpenAI bills where, on inspection, a meaningful chunk of their traffic was prompts like "what's today's date" or "format this JSON" or "what's 2 + 2 in dollars" — full GPT-4 calls for things a regex could answer. So I built **Booster**: 246 deterministic rules that resolve those prompts locally in the SDK, sub-millisecond, zero tokens. The rest of the pipeline (compression, semantic cache, self-learning router across 21 providers) handles whatever Booster can't.
>
> What I learned building it: (a) the cost-savings story sells but the "skip the LLM" framing is what gets engineers to actually try it — "another LLM gateway" gets ignored, "a gateway that doesn't always call the LLM" gets a "wait, what?". (b) Honest benchmarks (with the dataset published, with the synthetic disclosure up top) convert better than polished marketing numbers. Our 57.3% cost reduction on a 400-prompt synthetic benchmark is a real result on a real (mock) workload — and we say "synthetic" out loud.
>
> Free tier is 1,000 calls/day, no card. SDK is MIT on GitHub (github.com/finsavvyai/clawpipe-sdk). I'll be in this thread all day — happy to answer the hard questions, especially "how is this not just Portkey/LiteLLM/OpenRouter" (short version: Booster is the part nobody else ships, and the router is a bandit not a config). Thanks for reading.

## Gallery copy — 5 image slots

Each slot needs both a caption (≤ 70 chars, displayed under the image on PH) and the AI generation prompt. Generation prompts go to `brand-assets.md`; captions live here.

### Image 1 — Hero (1270×760, primary card image)

**Caption:** `The only AI gateway with a "skip the LLM" stage.`

**Visual brief:** Bold dark hero. Centered headline, subhead, single CTA pill. Subtle pipeline ribbon underneath. ClawPipe wordmark top-left. Accent violet `#6e56cf` on key elements only.

### Image 2 — Pipeline diagram (1270×760)

**Caption:** `Six stages. One pass. The first one might be the last one.`

**Visual brief:** Six rounded cards left-to-right: Booster · Packer · Cache · Router · Gateway · Learner. An arrow exits from each card downward labeled "respond" — emphasizes that any stage can short-circuit. Annotation: "30% never reach the LLM (in our benchmark)."

### Image 3 — Benchmark numbers (1270×760)

**Caption:** `Synthetic 400-prompt benchmark. Methodology published. Public measured benchmark in progress.`

**Visual brief:** Three giant stat tiles: `57.3%` (cost reduction), `30%` (Booster hit rate), `35%` (cache hit rate). Below: small monospace footer "n=400 · 200 unique × 2 passes · synthetic dataset · benchmarks/results/summary.json". Honest disclosure must be visible on the image.

### Image 4 — Pricing (1270×760)

**Caption:** `Free 1K calls/day. Paid starts $79. MoR billing.`

**Visual brief:** Five-column tier strip: Free / Dev $79 / Growth $299 / Scale $799 / Enterprise. "Most popular" pill on Growth. Bottom-line note: "Billing via LemonSqueezy (Merchant of Record) — handles VAT, sales tax, chargebacks."

### Image 5 — SDK code example (1270×760)

**Caption:** `Drop-in OpenAI compat. One line to migrate.`

**Visual brief:** Code editor mockup, dark theme, JetBrains Mono. Show the OpenAI-compat shim:
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.CLAWPIPE_API_KEY,
  baseURL: "https://api.clawpipe.ai/v1",
});

// Same OpenAI calls. Now boosted, cached, routed.
const r = await client.chat.completions.create({...});
```
Caret/cursor visible. Subtle violet glow on `baseURL`.

## Hunter outreach DMs

Three templated messages. **Do not** include real names without the user verifying the hunter is active and on-topic for AI dev tools. Replace `[Hunter Name]` with someone whose recent hunts include LLM tooling, dev SaaS, or open-source infrastructure.

### How to find a relevant hunter

- Go to producthunt.com → filter products by "Developer Tools" → "AI" → sort by Top in the last 90 days.
- Find the **top 5 products in the AI/dev-tools category** in the last 30 days that look adjacent to ClawPipe (gateways, model routers, observability, agent frameworks).
- For each, click into the launch and look at the **Hunter** in the top-right.
- Cross-check the hunter's profile: how many products have they hunted in the last 60 days? (You want active.) Are they replying to comments on their hunts? (Engaged.) Have they hunted any AI dev infra recently? (On-topic.)
- Pick three with the strongest fit. DM via PH's built-in messaging or via their listed Twitter/LinkedIn.

### DM template 1 — short, value-led

> Hi [Hunter Name] — saw your hunt of [product they hunted recently], the framing on [specific thing in their post] was sharp.
>
> I'm shipping ClawPipe next Tuesday — it's an AI gateway with a "Booster" stage that resolves prompts like math/dates/JSON locally before any LLM call. Synthetic 400-prompt benchmark published with full methodology; public measured benchmark in progress. SDK is MIT.
>
> Would love your eyes on it before launch. Happy to give you a free Scale-tier account permanently as a thank-you whether you hunt it or not. No pressure either way — just thought it might be your kind of thing.

### DM template 2 — for hunters who care about technical depth

> Hi [Hunter Name] — I read your comment on [their recent comment on a related launch] about [specific point]. You'd probably have an opinion on what we're shipping.
>
> ClawPipe: AI gateway. The differentiator is a deterministic pre-LLM stage that catches ~30% of common prompts (greetings, math, JSON formatting, conversions, UUID generation, 246 patterns total) and answers them in microseconds without calling a provider. Open SDK on GitHub, full benchmark methodology published.
>
> Thinking about a Tuesday launch. If you're up for hunting it I'd be honoured; if not, I'd still love your honest read on whether the positioning lands. Coffee on me (Wise transfer or anything you prefer).

### DM template 3 — if the hunter is more of a "show me the data" type

> Hi [Hunter Name] — would you be open to hunting an AI dev infra launch?
>
> ClawPipe ships next week. The pitch is "the only AI gateway that skips LLM calls entirely" — there's a deterministic Booster stage in the SDK that resolves common prompts locally, no provider call. We have a published synthetic 400-prompt benchmark (dataset + methodology open) and a public measured benchmark in progress at github.com/finsavvyai/clawpipe-booster-benchmark.
>
> I can send you (a) early access to the dashboard with our internal numbers, (b) a custom benchmark on a workload of your choice, or (c) a draft of the launch deck for review. Whichever helps you decide. No expectation either way.

## Top 5 anticipated FAQ comments — with answers

### Q1. "How is this different from Portkey?"

> Portkey is broader (1,600+ models, mature dashboard, guardrails). ClawPipe is narrower but deeper on cost: we ship a deterministic Booster stage that resolves common prompts without an LLM call (Portkey doesn't), and our router is self-learning rather than config-driven (Portkey's is fallback-chain config). If you need 1,600 models or built-in PII guardrails today, pick Portkey. If you want to skip LLM calls and learn-by-traffic routing, pick us. We'll tell you honestly which fits.

### Q2. "What's the catch on the 57% number?"

> Two catches, both disclosed up front: (1) it's a synthetic 400-prompt benchmark, not measured production traffic — costs are computed against published per-token prices. (2) Your number depends entirely on your prompt mix. A workload that's 90% complex one-shot reasoning won't see 57%; a workload heavy in greetings/lookups/format requests might see more. Methodology + raw JSON: `benchmarks/results/summary.json` in the repo. Run it on your own dataset to know your real number.

### Q3. "Free tier limits — anything hidden?"

> 1,000 calls/day, all features (Booster, cache, router, all 21 providers), 1 project, no credit card. The 1K resets at UTC midnight. Bring your own provider keys or use ours. No upgrade prompts in the SDK, no rate-limit games, no "this feature is paid" gates inside the free tier — the only thing that's paid is more volume and more projects.

### Q4. "Self-hosted option?"

> SDK runs anywhere — it's MIT, no callbacks home, no licensing dance. The hosted **gateway** is currently closed (we operate it on Cloudflare Workers + D1). On the roadmap for self-host: a Docker image of the gateway you can deploy in your VPC, with an OSS license tier still being decided. If self-hosting the proxy is a hard requirement today, LiteLLM is genuinely good and we'll point you there honestly.

### Q5. "Privacy / does ClawPipe see my prompts?"

> Prompt **content** is never logged. Cache lookups use SHA-256 hashes; analytics records only token counts, latency, model selection, and cost. Provider keys are encrypted at rest in Cloudflare KV. If you want zero-trust on our infra: use the SDK with `gatewayUrl` set to your own provider's endpoint directly — you skip our gateway entirely and just keep the local pipeline (Booster/Packer/Cache/Router run client-side and never need our backend at all).

## Launch day timing

- **Day:** Tuesday or Wednesday. Both are PH's strongest weekdays. Avoid Monday (slow ramp) and Friday (weekend collapse).
- **Time:** PH's day rolls over at **midnight Pacific (00:00 PT)**. The strongest pattern: be live the moment the new day's leaderboard opens. If you launch at 00:01 PT, you have a full 23 hours of the leaderboard cycle to accumulate upvotes.
- **Don't** launch in the middle of a US-only major holiday week (Thanksgiving, July 4, Christmas/New Year). Retention engagement craters.
- **Don't** launch on the same day as a YC batch demo day or a major Apple/Google keynote. You'll get buried.
- **Conflict check:** look at the upcoming launches list on PH the day before; if a unicorn or famous founder is launching the same day, consider sliding by 24-48 hours.

## Post-launch follow-up

### Hour 1 (00:00–01:00 PT)
- Reply to every comment. Every. Single. One.
- Post the maker comment immediately at 00:00:30.
- Notify your inner circle (founders' Slack, family, coworkers) — not "please upvote" but "we're live."

### Hour 6 (06:00 PT, ~9am EST)
- The US east coast is now waking. Re-engage in comments.
- Tweet the launch with a screenshot of where you're ranking.
- Post in 3-5 relevant subreddits (r/LocalLLaMA, r/MachineLearning's "Project" thread, r/programming if topical) — link to the PH page, not the landing page.

### Hour 12 (12:00 PT, 3pm EST)
- LinkedIn post (separate from the Twitter angle — different audience, different framing).
- Email your existing waitlist / mailing list if you have one. Subject: "We launched on Product Hunt today — here's the story."
- DM 5-10 people who've supported your past launches with a personal note.

### Hour 24 (next day 00:00 PT)
- Final position is locked at 23:59 PT. Take a screenshot.
- Write the retro: rank achieved, comments received, which traffic source drove the most signups.
- Post a thank-you comment in your own thread tagging top supporters.
- Begin the Dev.to article that says "We launched on Product Hunt — here's what worked and what didn't."
- Schedule the next milestone: HN drop the following Tuesday so the two launches reinforce, not compete.
