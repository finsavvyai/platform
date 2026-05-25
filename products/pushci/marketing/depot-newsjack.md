# Depot raised $10M to make GitHub Actions faster. We made it free.

> Dev.to article + HN comment + 3 tweets
> Published: April 2026

---

## Dev.to Article

**Title:** Depot raised $10M to make GitHub Actions faster. We made it free.

**Tags:** devops, cicd, github, opensource

---

Depot just closed a $10M Series A. They went GA on March 24th. The pitch: faster GitHub Actions at $0.0001/second, built for AI coding agents, powered by their own orchestration layer called Switchyard.

Genuinely — good for them. They identified a real problem, built serious infrastructure around it, and got funded. The problem is real. GitHub Actions runners are slow, cold starts are brutal, and $0.008/minute adds up fast when your monorepo takes 12 minutes to build.

But I want to talk about something.

### The optimization they chose

Depot's answer to "CI is slow and expensive" is: faster, cheaper cloud compute.

That's a sensible answer. If you're bottlenecked on runner speed and you're already committed to the GitHub Actions control plane, Depot is probably the right move. Their runners are arm64-native, their cache layer is legitimately fast, and $0.0001/second is a real improvement over GitHub's $0.008/minute (which is $0.000133/second — so Depot is roughly 25% cheaper and noticeably faster).

But here's the thing I keep coming back to: that's still not zero.

### Speed optimization is a local maximum

Here's the math problem that Depot's funding round surfaces:

- GitHub Actions: ~$0.000133/second
- Depot: $0.0001/second
- Your laptop: $0.0000/second

The gap between GitHub Actions and Depot is real. The gap between Depot and local execution is infinite — you cannot get cheaper than free.

Now, the obvious objection: "But my laptop is slow. Cloud runners have 4 cores and fast SSDs." Fair. But your M2 MacBook Pro has 10 cores and 32GB of RAM and it's sitting there idle while you wait for a GitHub Actions queue. The machine that already runs your IDE and your Docker containers and your local dev server can run your tests too.

The other objection: "What about CI for teams? Not everyone can run local CI." Also fair. PushCI supports self-hosted runners — Hetzner VPS, Fly.io, any machine with SSH access. A $6/month Hetzner instance runs most pipelines for less than a rounding error on a Depot bill.

### The AI agent angle

Depot's positioning explicitly targets AI coding agents: "built for AI agents that trigger CI runs." This is real and forward-looking. Agent-driven development means 10x more pipeline triggers per developer per day.

Here's where I think local execution wins on this front:

When an AI agent triggers 500 pipeline runs in a day, you pay Depot for 500 pipeline runs. When an AI agent triggers 500 pipeline runs against PushCI running locally, you pay $0 for 500 pipeline runs.

There's also a latency argument. Depot eliminates cold starts via warm runner pools — that's the thing Switchyard is doing. Impressive engineering. But a pipeline that runs on your local machine has zero queue time, zero network hop, zero runner provisioning. The absolute floor on latency is local execution.

For AI agent workflows where the agent is watching test output and deciding what to do next, shaving 30 seconds off a 3-minute pipeline meaningfully tightens the feedback loop. Eliminating the network round-trip tightens it more.

### An honest comparison

| | GitHub Actions | Depot | PushCI |
|---|---|---|---|
| Cost per minute | $0.008 | ~$0.006 | $0 |
| Cold start | 30-60s | ~5s (warm pool) | 0s |
| YAML required | Yes | Yes | No |
| Control plane | GitHub | GitHub + Depot | Your machine |
| Runs offline | No | No | Yes |
| Self-hosted option | Yes ($0.002/min fee pending) | No | Yes (free) |
| AI provider | N/A | N/A | Anthropic, Groq, DeepSeek, OpenAI, Gemini |
| Setup time | Hours (YAML) | Minutes (same YAML) | Seconds (npx pushci init) |

The table isn't meant to be a hit piece. Depot is genuinely better than GitHub Actions for teams that want to stay on the GitHub control plane. But it's worth being clear about what the tradeoffs are.

### What PushCI does differently

```bash
npx pushci init
```

That's it. PushCI detects your stack — 33 languages, 40+ frameworks — and generates a pipeline. No YAML. No account. No credit card.

```bash
pushci run
```

Runs on your machine. Or your team's self-hosted runner. Zero per-minute cost regardless of how many times your AI agent triggers it.

PushCI dogfoods itself: the entire PushCI CI pipeline runs using `pushci run`. The landing page deploys via `pushci deploy cloudflare-pages`. We haven't paid for CI compute since we launched.

### The honest conclusion

If you're a team that's deeply integrated with GitHub Actions and you need faster runners today, Depot is worth evaluating. Their Series A is well-deserved.

If you're starting a new project, or you're tired of paying for something your local machine can do for free, try PushCI.

The two tools solve different problems. Depot solves "GitHub Actions is slow." PushCI solves "why are we paying someone else's computer to run our tests."

```bash
npx pushci init
```

[pushci.dev](https://pushci.dev)

---

## HN Comment

*(For when Depot's Show HN post surfaces)*

---

Congratulations on the raise and the GA launch. The Switchyard architecture is genuinely interesting — warm runner pools solving cold start latency is the right problem to attack if you're staying on the GitHub control plane.

One thing I'd push back on gently: the framing of "built for AI agents" is going to run into a unit economics problem. Agent-driven development means pipeline triggers going from 20/day to 200/day per developer. At $0.0001/second and a 3-minute average pipeline, that's $3.60/developer/day — not catastrophic, but it compounds fast as agent usage scales.

The alternative framing is local execution. When an agent triggers 200 pipeline runs against a locally-running CI system, the marginal cost is zero. The latency floor is also lower — no queue, no runner provisioning, no network hop.

We built PushCI ([pushci.dev](https://pushci.dev)) on exactly this bet: that the right answer to "CI is expensive and slow" isn't "cheaper and faster cloud compute" — it's "run on the machine you already own." Stack detection via `npx pushci init`, no YAML, self-hosted runner support for team scenarios.

Not saying Depot is wrong — for teams committed to the GitHub Actions ecosystem, what you've built is clearly better than the alternative. But I think there's a genuine architectural divergence here worth naming: cloud-optimized vs locally-executable. Both will have a market.

What's the roadmap for local runner support? That seems like the natural next step if the AI agent angle plays out the way I think it will.

---

## 3 Tweets (Curb Voice)

---

**Tweet 1 — React to the $10M raise**

Depot raised $10M to make GitHub Actions faster.

I respect it. GitHub Actions runners ARE slow.

But I'm sitting here looking at my laptop — which has 10 cores and costs me $0 per minute — and I'm trying to figure out what problem we're solving exactly.

pushci.dev

---

**Tweet 2 — The math**

$0.008/min. GitHub Actions.
$0.006/min. Depot. (Nice!)
$0.000/min. Your own machine.

Look, Depot is genuinely 25% cheaper than GitHub. That's real money.

I'm just saying there's another option that's 100% cheaper than Depot and it's been sitting on your desk this whole time.

pushci.dev

---

**Tweet 3 — The AI agent angle**

Depot's pitch: "built for AI coding agents."

So your AI agent is going to trigger 500 pipeline runs a day. At $0.0001/second and a 3-minute pipeline, that's $9/agent/day.

Or. Hear me out. The agent runs the pipeline locally. $0. No queue. No cold start.

I'm not saying Depot is wrong. I'm saying there's math here.

pushci.dev
