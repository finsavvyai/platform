# Show HN — submission packet

## Title

```
Show HN: ClawPipe – The only AI gateway that skips LLM calls
```

(64 chars — within HN's 80-char limit, follows convention.)

## URL to submit

```
https://clawpipe.ai
```

(Submit the landing page, not the SDK repo. The repo gets linked from the body.)

## Body text

ClawPipe is an SDK + Cloudflare Worker gateway that sits between your app and ~21 LLM providers. The wedge is a stage we call **Booster** — 246 deterministic rules that resolve a prompt locally, in the SDK, before anything hits the network. If the prompt is something like `"what is 2 + 2"`, `"what's the current date"`, `"convert 5km to miles"`, `"format this JSON {...}"`, `"generate a uuid"`, or one of a few hundred other shapes, you get an answer in sub-millisecond time and pay zero tokens. No provider call ever happens.

Everything Booster doesn't catch flows through the rest of the pipeline: a context Packer (token compression), a hash + semantic Cache, a self-learning Router that updates per-model weights based on observed outcomes, and finally a multi-provider Gateway. The router is closer to a bandit than a config file — Portkey and LiteLLM let you write fallback chains; ClawPipe updates `route_weights` from real traffic.

I ran a 400-prompt benchmark (200 unique prompts × 2 passes, mix of "boostable", "packable", "simple", "complex" categories). On that workload: **57.3% cost reduction** vs. direct provider calls, **30% Booster hit rate**, **35% cache hit rate after pass 2**, average pipeline overhead **0.022ms**. Full disclosure: this is a synthetic dataset on a mock gateway — the cost numbers are real arithmetic against published per-token prices, not measured production savings. Methodology is in `benchmarks/results/summary.md` in the repo. The 30%/35%/57% triangle on your traffic depends entirely on what your prompts look like.

The SDK is MIT and on GitHub: https://github.com/finsavvyai/clawpipe-sdk — 647 unit tests passing, ships in TypeScript with adapters for Go, Python, PHP, Java, .NET, Elixir, Ruby, Rust, Swift. Drop-in OpenAI compatibility: `new OpenAI({ baseURL: 'https://api.clawpipe.ai/v1', apiKey: 'cp_...' })`. The hosted gateway has a free tier — 1,000 calls/day, no card required. Bring your own provider keys or use ours.

Honest known gaps (also in our public audit report): the gateway itself is not yet open-source (SDK is), no PII guardrails module yet (on the quarterly roadmap — Portkey/Helicone parity is the bar), and the dashboard is less mature than Helicone's. Happy to talk about any of it. I'll be in the thread all day.

## Comments-thread Q&A prep

Drafted replies to seed the first hour. Adapt tone to the actual question; don't paste verbatim if the asker's wording differs.

### Q1. "How is this different from Portkey / LiteLLM / OpenRouter?"

> Three honest distinctions:
>
> 1. **Booster.** Nobody else ships a deterministic pre-LLM stage. OpenRouter is a marketplace, Portkey is a config-driven proxy with guardrails, LiteLLM is an OSS proxy. None of them try to skip the LLM.
> 2. **Self-learning router.** Portkey/LiteLLM let you write fallback chains. Our router updates per-model weights from observed latency/cost/quality. Closer to a bandit than a config.
> 3. **SDK runs client-side.** Booster, Packer, and local cache execute in your process. Some savings never leave your machine. Pure proxies can't do this.
>
> Where they win: Portkey has 1,600+ models (we have ~21). LiteLLM is fully open-source (our gateway isn't yet). Helicone's dashboard is nicer than ours. Use the right tool for your problem.

### Q2. "Open-source the gateway too?"

> SDK is MIT, public, today: https://github.com/finsavvyai/clawpipe-sdk. Gateway is currently closed. We're working through the licensing and infra-cost story before flipping it — running a multi-provider proxy at scale has non-trivial KV/D1/egress bills and we want a sustainable model before we throw it open. If gateway open-source is a hard requirement for you, LiteLLM is genuinely good and I'll point you there.

### Q3. "What's your stack?"

> TypeScript end-to-end. Cloudflare Workers + D1 + KV for the gateway (SQLite-on-edge). Hono for routing. Vitest for tests. Cloudflare Pages for the landing page and dashboard. The SDK is plain TS, no framework, no runtime deps beyond what your provider needs. Whole thing deploys with `wrangler deploy`.

### Q4. "Is the 57% cost claim from real production?"

> No, and the post says so. It's a 400-prompt synthetic benchmark — 200 unique prompts × 2 passes, four categories (boostable / packable / simple / complex). Costs are computed against published per-token prices, not measured invoices. The numbers you'll see depend on your prompt mix: lots of greetings/math/format requests = high Booster hit, lots of unique long-context one-shots = mostly Router and Cache savings. Run the benchmark on your own dataset; the harness is in `benchmarks/`.

### Q5. "How do you handle PII / prompt injection?"

> Today, only partially. We have a Guard Registry with 15 plugins (input/output content checks) and a DLP pack with 12 PII detectors (SSN, CC, phone, email, IBAN, passport, api-key-leak, etc.) that you can enable per-project — they redact or block before the prompt leaves the SDK. We do **not** yet have a turnkey prompt-injection classifier or output moderation; that's a Q3 commitment. If you're regulated and need parity with Portkey/Helicone on this today, we're not the right pick yet — say so honestly in the thread.

### Q6. "Why MoR billing instead of Stripe?"

> We're an Israeli company. Stripe in Israel has gotten harder over the last two years — payout delays, increased KYC, occasional account holds. LemonSqueezy is a Merchant of Record: they handle EU VAT, US sales tax, chargebacks, and global payouts as one entity. We migrated in a day; the webhook handler is `gateway/src/billing/lemonsqueezy-webhook.ts` if you want to see the idempotency pattern. There's a longer write-up coming on Dev.to next week.

### Q7. "Latency overhead?"

> Pipeline stages clock in at sub-millisecond on the SDK side: Booster 0.012ms, Packer 0.005ms, Cache 0.0001ms, Router 0.004ms — all in-process. The only network hop is the Gateway call to your provider. If Booster catches the prompt, you skip that hop entirely and respond in microseconds. If Cache catches it, KV lookup adds ~1-5ms. The benchmark has the per-stage breakdown.

### Q8. "What happens when ClawPipe goes down?"

> Two answers. (a) The SDK has a `LocalProvider` that can fall back to llamafile / Ollama / LM Studio if you've configured one — your app keeps responding even if our gateway is unreachable. (b) For production, you should use the OpenAI-compat shim with `gatewayUrl` set to ClawPipe and a fallback `baseURL` set to the provider directly. Circuit breaker is built in. We're a single-region edge deploy at the moment, multi-region is on the roadmap.

### Q9. "Why not just use the OpenAI SDK directly?"

> If your traffic is uniform, single-provider, no caching, no compression, no routing — go for it. That's the right call. ClawPipe matters when (a) you have repetitive prompts that don't need the LLM (Booster wedge), (b) you want the cheapest viable model per task instead of always paying for GPT-4, (c) you want one SDK that works against 21 providers without a code change. If none of those apply, you don't need us.

### Q10. "Y Combinator?"

> No. Bootstrapped, Israeli founder, no outside funding yet.

## Optimal posting time

- **Best window:** US weekday, **Tuesday or Wednesday, 8:00–10:00 AM EST**.
- HN front page rank decays on a half-life of about 4 hours; posting at 8 AM EST lets you catch (a) the US East Coast morning, (b) the US West Coast morning, and (c) European afternoon all on the same trajectory.
- **Avoid Mondays** (people clearing weekend backlog, low engagement on new posts) and **Fridays** (front-page traffic dies into the weekend).
- **Avoid US holidays + holiday-adjacent days.** Check the US Federal calendar.
- **Do not** post at midnight UTC trying to "be first" — HN's algo penalises late-night submissions because the early upvote rate is low.

Recommended specific window for this launch: **Tuesday, the day after Product Hunt drops** (so PH momentum and HN momentum reinforce instead of competing for your attention).

## First-hour playbook

The first 60 minutes after posting determine whether you hit the front page. Plan accordingly.

- **Minute 0:** post. Immediately copy the HN URL. Do **not** upvote your own post (HN flags this).
- **Minute 0–5:** post the URL in your personal channels (Twitter/X, LinkedIn, Slack groups you're part of). Don't ask for upvotes — say "I just shipped this, would love HN-style critique." HN guidelines forbid vote-rigging; they're fine with notification.
- **Minute 5–60:** sit at the keyboard and reply to **every single comment**. No exceptions. Even hostile ones. Especially hostile ones.
  - When someone says "this is just OpenRouter with extra steps" — don't get defensive. Acknowledge what's true ("you're right that the proxy layer is similar"), then point at the actual difference ("Booster is the part that's not in OpenRouter, here's what it does").
  - When someone says "57% sounds like marketing fluff" — agree it would be if it weren't published. Link directly to the methodology file. Invite them to run the benchmark on their own dataset.
  - When someone catches a real bug or weak spot — say "yes, you're right, here's the issue link / here's the fix going out." Public visible humility is the single highest-converting behaviour on HN.
- **Minute 30:** post a top-level comment yourself with the benchmark methodology link, if it hasn't come up organically. Frame as "Since people are asking about the 57% number, here's the methodology and the raw JSON." Cite the disclosure that it's a synthetic dataset before anyone calls you on it.
- **Minute 60:** if you're trending (≥30 points, ≥15 comments), don't relax. The 60–180 minute window is where you win or lose front page. Keep replying.
- **Hour 2–4:** if you're falling off, do **not** edit the title or repost. HN penalises both. Take the L and do a retro on what didn't land.

Things to **not** do:
- Don't ever say "thanks for the upvote."
- Don't ever say "if you like it, please upvote."
- Don't argue with downvotes.
- Don't link out to a paywall, a video, or a signup-required asset in your top reply. Link to the public benchmark file.
- Don't claim the gateway is open-source. It isn't yet. The SDK is. Be precise.
