# Dev.to / Hashnode — three article drafts

Each article follows the same publish-and-syndicate plan:

1. **Publish first on `clawpipe.ai/blog`** with a clean canonical URL.
2. **Syndicate to Dev.to and Hashnode** with `canonical_url:` in front matter pointing back to `clawpipe.ai/blog/<slug>` so SEO juice consolidates on the owned domain.
3. **Optional Medium re-post** ~3 days later, also with `canonical_url` set. Medium's editor lets you set this in story settings.

Cover images: see `brand-assets.md` for the AI generation prompts. Each article specifies its own cover image slot.

---

## Article 1 — "We built an AI gateway that skips LLM calls — here's the architecture"

### Front matter

```yaml
---
title: "We built an AI gateway that skips LLM calls — here's the architecture"
published: false
description: "Most AI gateways always call the LLM. We added a deterministic Booster stage that resolves common prompts locally with zero tokens. Here's how it works, the rule shape, and the tradeoffs."
tags: ai, llm, architecture, typescript
cover_image: https://clawpipe.ai/blog/covers/booster-architecture.png
canonical_url: https://clawpipe.ai/blog/booster-architecture
---
```

### Body

There's a category of LLM request that doesn't actually need an LLM.

`What is 2 + 2?` `What's today's date?` `Convert 5 km to miles.` `Format this JSON.` `Generate a UUID.` `What's the SHA-256 of "hello"?` `What's hex for #6e56cf?`

Every one of those gets an answer from GPT-4 in production AI apps every single day. Each one costs real money. Each one adds 200-2000ms of latency. And the answer is always the same — because it's deterministic. It's a regex problem, not a reasoning problem.

We built ClawPipe partly because we got tired of paying for the regex problem.

#### The pipeline

ClawPipe is six stages:

```
Request → Booster → Packer → Cache → Router → Gateway → Learner
```

Booster runs first. If Booster matches, the request **never leaves the SDK**. No network hop. No tokens. No bill. Sub-millisecond response. The remaining five stages only run when Booster doesn't match.

Most "AI gateway" products (Portkey, OpenRouter, LiteLLM, Helicone) start at stage four — Router. They assume the LLM will be called; they just route to a cheaper one or cache the result. We assume the LLM might not need to be called at all.

#### The BoosterRule shape

Every Booster rule is a tiny strategy object. The actual TypeScript shape:

```typescript
export interface BoosterRule {
  name: string;
  test: (input: string) => boolean;
  resolve: (input: string) => string;
}
```

Two functions. `test` is a pure predicate — does this rule apply? `resolve` is the deterministic answer.

Here's the math rule, almost verbatim from `sdk/src/booster-rules/core.ts`:

```typescript
const mathPattern = /^(?:calculate|compute|what is|evaluate|solve)\s+(.+)/i;
const safeExprPattern = /^[\d\s+\-*/().,%^]+$/;

const mathRule: BoosterRule = {
  name: 'math',
  test: (input) => {
    const match = input.match(mathPattern);
    if (!match) return false;
    return safeExprPattern.test(match[1].trim());
  },
  resolve: (input) => {
    const match = input.match(mathPattern)!;
    const expr = match[1].trim().replace(/\^/g, '**');
    return String(safeEvalMath(expr));
  },
};
```

`What is 2 + 2` → `4`. Latency: 0.012ms. Tokens: 0. Cost: $0.

The date rule is even smaller:

```typescript
const dateRule: BoosterRule = {
  name: 'date',
  test: (input) => datePatterns.some((p) => p.test(input) && input.length < 60),
  resolve: () => new Date().toISOString(),
};
```

Unit conversion is a lookup table. UUID is a one-liner over `crypto.randomUUID()`. JSON formatting is `JSON.parse(...)` then `JSON.stringify(..., null, 2)`. None of these need a model.

We currently ship **246 rules** across modules: core, string, text, data, datetime, math, code, stats, encoding, finance, regex, format, color, dev, time, science, logic, iso, crypto, AWS, markup, geometry, physics, chemistry, music, and an M365 intent classifier for MSP tools.

#### The naive gateway shape

A "naive" gateway looks roughly like this:

```typescript
async function handleRequest(prompt: string, opts: Opts) {
  const cached = await cache.get(hash(prompt));
  if (cached) return cached;

  const provider = pickProvider(opts);
  const response = await provider.complete(prompt, opts);

  await cache.set(hash(prompt), response);
  return response;
}
```

It's fine. It works. It's also what every other gateway product looks like under the hood. The cache hit rate determines the savings.

A ClawPipe-shaped gateway adds one stage above the cache:

```typescript
async function handleRequest(prompt: string, opts: Opts) {
  const boosted = booster.tryResolve(prompt);  // <- new
  if (boosted) return { text: boosted, meta: { boosted: true } };

  const cached = await cache.get(hash(prompt));
  if (cached) return cached;

  const provider = pickProvider(opts);
  const response = await provider.complete(prompt, opts);

  await cache.set(hash(prompt), response);
  return response;
}
```

That's it. That's the entire wedge. One stage in front of the cache that can short-circuit on a regex match.

#### What this looks like in numbers

We ran a 400-prompt synthetic benchmark — 200 unique prompts, two passes (cold + warm), four categories (boostable, packable, simple, complex). Results from `benchmarks/results/summary.json`:

- **Booster hit rate:** 30.0% (120 of 400 prompts resolved without an LLM call)
- **Cache hit rate after pass 2:** 35.0% (140 of 400)
- **Average pipeline overhead:** 0.022ms total across all client-side stages
- **Cost reduction vs. direct provider calls:** 57.3%

Honest disclosure: this is a synthetic dataset on a mock gateway. The cost numbers are real arithmetic against published per-token prices, not measured production invoices. The 30/35/57 split on your traffic depends entirely on what your prompts look like.

But the *direction* of the result is robust. If 30% of your prompts can be answered by a regex, you should be answering 30% of your prompts with a regex.

#### Tradeoffs (where Booster goes wrong)

It's not free. There are three failure modes.

**Misfires.** A prompt like `"compute the eigenvalues of [[2,1],[1,2]]"` matches the math regex prefix but the input contains `[[`, which is not in `safeExprPattern`. We get a `false` from `test`, fall through to the LLM. Good — no harm done.

But: `"calculate 2 + 2 in production"` matches `safeExprPattern` against `2 + 2`, ignores the trailing words, and returns `4`. The user wanted commentary; we gave them an integer. We've seen this exactly once in beta and added a length constraint and a "trailing-text guard" to mitigate. The honest answer is that you can never make this 100% safe — Booster is an aggressive optimisation and a few prompts will be miscategorised. The mitigation is to keep the rules tight, ship a `--no-booster` flag (we do), and let users tag prompts that should never be boosted.

**Stale answers.** `What's the current date?` resolves to `new Date().toISOString()`. If the user actually wanted a friendly format, or a specific timezone, or "today" framed naturally — they get UTC ISO. Our docs flag this. The fix is rule diversity (we ship multiple date-shape rules), not turning Booster off.

**Maintenance load.** 246 rules is 246 things that can break. We test each one (there are dedicated unit tests in `sdk/src/booster.test.ts` and per-rule-pack test files). The CI gate is "every new rule needs a test." So far this has held; long-term it's a meaningful surface area.

#### How to actually use this

The ClawPipe SDK is MIT-licensed on npm:

```bash
npm install clawpipe-ai
```

Drop-in OpenAI-compat:

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.CLAWPIPE_API_KEY,
  baseURL: "https://api.clawpipe.ai/v1",
});
```

Same OpenAI calls, now with Booster + Cache + Router in front of every request. Free tier is 1K calls/day, no card. The full SDK source (rules, tests, everything) is at https://github.com/finsavvyai/clawpipe-sdk — fork it, audit it, build your own rules.

If you've ever stared at an OpenAI bill and thought "wait, half of these prompts are basically `2 + 2`" — yes, you're right, and yes, you can fix it. The fix is upstream of the LLM, not at it.

---

## Article 2 — "Comparing 21 LLM providers: which actually works in production"

### Front matter

```yaml
---
title: "Comparing 21 LLM providers: which actually works in production"
published: false
description: "We integrated 21 LLM providers into one gateway and benchmarked them. Not all are equal. Here's an honest cost/latency/quality ranking — including the ones that surprised us by being bad."
tags: llm, ai, benchmark, infrastructure
cover_image: https://clawpipe.ai/blog/covers/21-providers.png
canonical_url: https://clawpipe.ai/blog/21-providers-ranked
---
```

### Body

We ship `clawpipe-ai`, an SDK + gateway that talks to 21 LLM providers behind one OpenAI-compatible API. To do that we had to actually integrate, test, and run traffic against all 21. After several weeks of writing provider adapters and watching them in production, here's the ranking nobody wants to write.

This is going to make some vendors unhappy. Publishing it anyway. The numbers are from our own integration work — your mileage will vary; run your own benchmarks before betting your stack.

#### The 21

In integration order:

OpenAI · Anthropic · DeepSeek · Mistral · Groq · Google Gemini · Together AI · Fireworks · Cohere · AI21 · Azure OpenAI · AWS Bedrock · Google Vertex · Cerebras · Databricks · HuggingFace · OpenRouter · Perplexity · Replicate · Writer · xAI

Our gateway has a per-provider TypeScript adapter under `gateway/src/providers/`. Each one handles auth, request formatting, response parsing, and error normalization for that vendor's wire format.

#### Categories

Twenty-one providers don't all play the same game. We bucket them:

- **Tier-1 frontier model labs:** OpenAI, Anthropic, Google (Gemini + Vertex), xAI
- **Speed-first inference:** Groq, Cerebras, Fireworks, Together
- **OSS-model hosts:** HuggingFace, Replicate, Together (overlap)
- **Cloud-native enterprise:** Azure OpenAI, AWS Bedrock, Databricks, Vertex
- **Specialty:** DeepSeek (cheap-but-capable), Mistral (Europe-friendly), Cohere (RAG-shaped), AI21, Writer (enterprise-content), Perplexity (search-augmented), OpenRouter (meta-marketplace)

#### Latency: who's actually fast

Measured from our edge (Cloudflare Workers, mostly US-East) on standardized 200-token prompts to the smallest "fast" model each provider offers. Times are first-token latency. Lower is better.

| Provider | First-token latency | Notes |
|---|---|---|
| **Groq** | sub-100ms typical | LPUs are real — fastest production inference we've measured |
| **Cerebras** | sub-150ms typical | When it's working. See "Cerebras footnote" below |
| **DeepSeek** | 200-400ms | Surprisingly competitive |
| **OpenAI (gpt-4o-mini)** | 300-600ms | Reliable baseline |
| **Anthropic (claude-3-haiku)** | 300-700ms | Reliable, slightly slower than OpenAI |
| **Google Gemini 1.5 Flash** | 400-900ms | Variance is the issue, not the floor |
| **Mistral** | 500-900ms | Solid for European traffic |
| **Together / Fireworks** | 400-1200ms | Depends heavily on which OSS model |
| **AWS Bedrock** | 500-2000ms | SigV4 signing adds overhead; cold-start variance large |
| **Vertex AI** | 600-1500ms | RS256 JWT exchange + Google's auth tax |
| **Replicate** | 1000-30000ms | Cold-starts can be brutal; not for low-latency paths |
| **HuggingFace Inference** | variable, often slow | Great for prototyping; production needs dedicated endpoints |

> **Cerebras footnote:** when it works it's stunningly fast. We've seen non-trivial 5xx rates during peak hours. Worth retrying through OpenRouter or having a Groq fallback.

#### Cost: who's actually cheap

Per-million-token list prices for "small fast" tier (input + output averaged), as of integration time. These move; check current pricing before depending on this:

| Tier | Providers | Notes |
|---|---|---|
| **Cheapest** | DeepSeek, Groq Llama, OSS-via-Together | Sub-$0.50/Mtok common |
| **Cheap-with-quality** | Gemini Flash, Claude Haiku, gpt-4o-mini | $0.15-$1.50/Mtok |
| **Mid-tier** | Mistral, Cohere, AI21 | $1-$5/Mtok |
| **Frontier** | gpt-4o, claude-sonnet-4, gpt-4-turbo, gemini-1.5-pro | $3-$30/Mtok |
| **Expensive-frontier** | Claude Opus, gpt-4 (legacy) | $15-$60/Mtok |
| **Specialty markup** | Perplexity (bundles search), Writer (enterprise contract) | Varies by plan |
| **Marketplace markup** | OpenRouter takes ~5% on top of provider | Convenience tax |

The cheapest model that works for your task almost always beats the most capable model. This is the entire premise of routing.

#### Quality: who's actually good

This is the soft section. We don't run public quality benchmarks — too easy to game and too dependent on prompt shape. Subjective ranking on the kinds of tasks we see most (code, summarization, classification, structured-output extraction):

- **Frontier code:** Claude Sonnet 4 and GPT-4o are roughly tied; Claude tends to follow long instructions more precisely, GPT-4o tends to be slightly faster and chattier.
- **Cheap code:** DeepSeek Coder is the surprise winner under $1/Mtok. Significantly above Llama-3.1-70B for code tasks specifically.
- **Cheap general:** Claude Haiku and Gemini Flash trade blows. Haiku follows system prompts more reliably; Gemini has a longer context window.
- **Speed-critical:** Groq running Llama-3.1-70B is the best speed/quality tradeoff we've found for chat.
- **Long context:** Gemini 1.5 (1M tokens) is unmatched here. Anthropic 200K is plenty for most.
- **RAG:** Cohere's command-r-plus is purpose-built; it shows. If you're doing pure retrieval-augmented generation it's worth the integration.

#### Where each one struggles

Honest weaknesses:

- **OpenAI:** rate-limit pain at low tiers, opaque reasoning about safety refusals.
- **Anthropic:** can be over-cautious on benign requests; tool use was historically clunkier (better in Sonnet 4).
- **Gemini:** dashboard UX is rough; quota management is a maze.
- **Groq:** model selection is narrow (Llama family + a few others).
- **Cerebras:** uptime hasn't been at frontier-lab levels in our experience.
- **Bedrock:** SigV4 is annoying to integrate; per-region availability is uneven.
- **Vertex:** RS256 JWT auth + service account JSON is heavy; the Google Cloud "experience tax" is real.
- **Replicate:** cold-starts. Don't put it on a synchronous user-facing path.
- **HuggingFace:** the public Inference API has hot/cold variance that makes it unsuitable for production unless you pay for dedicated endpoints.
- **Writer:** enterprise-priced; small teams will bounce.
- **AI21:** quality-per-dollar isn't competitive against Claude Haiku in our testing.
- **OpenRouter:** the 5% margin is fine, but you're now debugging across two layers when something breaks.

#### What we actually use in production

Our own router defaults to a small set, weighted by observed task quality:

- **Default fast/cheap:** Anthropic Claude Haiku 3 (140 of 400 routes in our internal benchmark)
- **Default frontier:** Claude Sonnet 4 / GPT-4o based on task type
- **Speed-critical:** Groq Llama 3.1
- **Code-cheap:** DeepSeek Coder
- **Long-context:** Gemini 1.5 Pro

The "21 providers" headline is honest — we ship adapters for all of them, and you can use them all through the gateway. But the *useful* set is a handful. The other dozen are there because (a) someone in your org will need a specific one, (b) Bedrock/Vertex/Azure is the only acceptable answer for compliance reasons, and (c) optionality has value even when you don't exercise it.

#### How to test this on your own workload

Don't trust this article. Trust your own data.

```bash
npm install clawpipe-ai
```

```typescript
import { Gateway } from "clawpipe-ai";

const g = new Gateway({ apiKey: "cp_..." });

const providers = ["openai", "anthropic", "groq", "deepseek", "gemini"];
for (const p of providers) {
  const t = Date.now();
  const r = await g.complete("Your representative prompt here", { provider: p });
  console.log(p, Date.now() - t, "ms", r.tokens, "tokens");
}
```

Run that against the 5-7 providers most plausible for your workload, on 100 of your real prompts, and you'll know more than any benchmark article (including this one) can tell you.

---

## Article 3 — "We migrated billing from Stripe to LemonSqueezy in one day. Here's why."

### Front matter

```yaml
---
title: "We migrated billing from Stripe to LemonSqueezy in one day. Here's why."
published: false
description: "Israeli company. Stripe friction was eating into our launch timeline. We migrated to LemonSqueezy as Merchant of Record in 24 hours. Here's the API, the webhook idempotency pattern, and the D1 migration."
tags: stripe, billing, saas, israel
cover_image: https://clawpipe.ai/blog/covers/stripe-to-ls.png
canonical_url: https://clawpipe.ai/blog/stripe-to-lemonsqueezy
---
```

### Body

I'm going to skip the suspense. We're an Israeli SaaS, we built our billing on Stripe first, we hit the wall I'd been warned about, and we migrated to LemonSqueezy in a day. Here's the technical story.

#### The Israeli MoR problem

Stripe is the default. It's the default everywhere. And for a US-incorporated company with a US bank account, it works flawlessly.

For an Israeli company in 2026, the experience has gotten harder:

- Account approval takes weeks, sometimes months.
- Random KYC re-verification mid-quarter that holds payouts.
- VAT collection for EU buyers is your problem.
- US sales tax (post-Wayfair) is your problem.
- Chargebacks come back to you to dispute, in your name.
- Some categories of SaaS get account holds with no clear reason.

A **Merchant of Record** (MoR) flips that around. The MoR sells your product *as their own entity* and pays you out as a vendor. They handle EU VAT, US sales tax, chargebacks, the whole tax-and-compliance stack. Paddle and LemonSqueezy are the main MoRs in the SaaS dev space.

We picked LemonSqueezy because:

- The developer experience is closer to Stripe than Paddle's is.
- The webhook event model is sane.
- Per-variant pricing maps cleanly to the tier structure we already had.
- No upfront fees; revenue share is transparent.

#### The migration plan, in one day

Hour breakdown of the actual migration day:

- **Hours 0-1:** create LS store, define products + variants for each tier (Free / Dev $79 / Growth $299 / Scale $799 / Enterprise contact). Generate API key and webhook secret.
- **Hours 1-3:** write `lemonsqueezy-client.ts` — thin wrapper around the LS REST API. Just the methods we need: `createCheckout`, `getSubscription`, `cancelSubscription`, `getCustomerPortal`.
- **Hours 3-5:** write `lemonsqueezy-webhook.ts` — HMAC verification + idempotency. This is the part most people get wrong; section below.
- **Hours 5-7:** write `tier-sync.ts` — the bridge between LS subscription state and our internal `projects.tier` column. Variant ID → tier name mapping.
- **Hours 7-9:** D1 migration. Add `billing_events` table for webhook idempotency.
- **Hours 9-12:** wire up the new checkout route, swap the pricing page CTAs, run end-to-end on the LS test store.
- **Hours 12+:** flip a feature flag, monitor first real subscriptions, sleep.

#### HMAC verification (the part that matters)

LS signs every webhook with HMAC-SHA256 over the raw body. The signature comes in `X-Signature` as a hex string. The verification has to be:

1. Constant-time (prevents timing attacks).
2. Done on the **raw** body, before any JSON parsing.
3. Tolerant of the `sha256=` prefix some libraries add.

Real code from `gateway/src/billing/lemonsqueezy-webhook.ts`:

```typescript
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('sha256=') ? hex.slice(7) : hex;
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) return new Uint8Array(0);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function verifyLSSignature(
  body: string, signature: string, secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const sigBytes = hexToBytes(signature);
  if (sigBytes.length === 0) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(body) as BufferSource,
  );
}
```

`crypto.subtle.verify` is the constant-time compare — don't roll your own with `===` or you'll regret it. We're on Cloudflare Workers, so `crypto.subtle` is the WebCrypto standard everywhere.

#### Idempotency: the part everyone gets wrong

Every payment provider retries webhooks. Stripe retries up to 3 days; LS retries on a similar schedule. If you process the same `subscription_created` event twice, you'll either double-charge a customer's tier upgrade or, worse, demote them on the second pass because some intermediate event made the second processing look stale.

The pattern: a `billing_events` table with a UNIQUE constraint on the provider's event ID:

```sql
CREATE TABLE billing_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ls_event_id TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

The handler tries to insert before doing any tier-sync work. If the insert fails on the UNIQUE violation, we know we've seen this event ID before and we drop the second copy. Code:

```typescript
async function recordEvent(
  env: Env, lsEventId: string, projectId: string,
  eventType: string, payload: string,
): Promise<boolean> {
  try {
    await env.DB.prepare(
      `INSERT INTO billing_events (id, project_id, event_type, ls_event_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), projectId, eventType, lsEventId, payload,
      Math.floor(Date.now() / 1000),
    ).run();
    return true;  // we inserted -> first time seeing this event
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg)) return false;  // duplicate -> drop
    throw err;
  }
}
```

If `recordEvent` returns `false`, the handler returns `200 OK` without doing anything. LS sees a success response, stops retrying, and we don't double-process. The whole pattern is ~20 lines and saves you from the worst-case incident.

#### The tier sync

LS sends `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`. We translate variant IDs back to tier names via a build-time map:

```typescript
function buildVariantMap(env: Env): Record<string, Tier> {
  return {
    [env.LS_VARIANT_DEV]: 'dev',
    [env.LS_VARIANT_GROWTH]: 'growth',
    [env.LS_VARIANT_SCALE]: 'scale',
  };
}
```

Then we update the project row:

```typescript
await env.DB.prepare(
  `UPDATE projects SET tier = ?, ls_subscription_id = ?, ls_status = ?, updated_at = ?
   WHERE id = ?`,
).bind(tier, subscriptionId, status, Math.floor(Date.now()/1000), projectId).run();
```

That's it. Webhook arrives, we verify the HMAC, we deduplicate against `billing_events`, we look up the variant, we update the tier, we return 200. The customer's API key gets the new rate limit on the next request.

#### What we'd do differently

A few honest takeaways now that we've shipped:

- **Run the test store in parallel for a week before flipping.** We didn't, and we found one variant ID off-by-one mistake in real money. Recoverable, but a wasted afternoon refunding.
- **Subscribe to *every* event type, log the ones you don't handle.** LS adds events; you want to see them in your logs before you find out you should have been processing them.
- **Write a `tier-sync.test.ts` that loads a real webhook payload from a fixture and asserts the resulting D1 state.** We did and it's caught two regressions. File: `gateway/src/billing/tier-sync.test.ts`.
- **Don't expose the raw LS customer portal URL.** Wrap it in your own `/billing` route that re-signs the link on demand, so customers always land in the right place.

#### Should you do the same?

If you're a US-incorporated company with a US bank account, Stripe is still the right answer. The MoR overhead isn't worth it.

If you're outside the US — especially Israel, India, Brazil, or smaller European jurisdictions where Stripe support is uneven — the MoR pattern saves you weeks of compliance work and several percentage points of monthly drag. LS specifically (vs. Paddle) is a fine pick for SaaS that look like a developer tool.

The migration itself is one day if you've never done it, half a day if you've done it before. The real cost is changing the mental model from "I am the merchant" to "I am a vendor selling through the merchant." Once that clicks, it's actually less work, not more.

The full billing module (HMAC verification, webhook handler, tier sync, idempotency table) lives at https://github.com/finsavvyai/clawpipe-sdk in `gateway/src/billing/`. MIT-licensed. Steal whatever helps.

---

## Cross-publication notes

- **Publish order:** clawpipe.ai/blog → 24h later Dev.to + Hashnode (both with `canonical_url` set) → 72h later Medium.
- **Article spacing:** Article 1 day 4, Article 2 day 8, Article 3 day 14 (per the launch-kit calendar).
- **Promotion cadence per article:** original Twitter thread on launch day, LinkedIn long-form on day 2, drop link in 2 relevant subreddits on day 3 (only if topical to the sub).
- **Engagement rule:** reply to every comment on Dev.to and Hashnode within 24 hours for the first week post-publish. The platform algorithms reward author-replied threads with extra distribution.
