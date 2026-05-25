# I got tired of paying GitHub $340/month to run npm test

Last quarter our GitHub Actions bill hit $340. I pulled it up, looked at the line items, and felt something I can only describe as offended. Not surprised — we'd seen it creeping up for months — but genuinely, personally offended.

We were running `npm test`. On a monorepo. The tests take about 4 minutes on a GitHub-hosted runner. My laptop runs the same suite in 26 seconds. We're paying $0.008 per minute to borrow someone else's computer to do something my computer does better and faster and for free.

That's the whole inciting incident. It's petty. But pettiness is often where the useful software comes from.

---

## What I tried first: self-hosted runners

The obvious move. GitHub lets you attach your own machine as a runner, and historically it was free. You register a runner, it picks up jobs, your compute, $0.

This worked fine for about eight months. Then GitHub announced in 2026 that self-hosted runners now cost $0.002/minute. The escape hatch got a price tag.

To be clear: $0.002/min is cheaper than $0.008/min. But the move from $0 to anything is a different kind of change. It's not a pricing adjustment. It's a category change. "Free because it's your machine" is a fundamentally different value proposition than "cheaper because it's your machine." The first one is a principle. The second one is just a discount.

I wanted the principle back.

---

## Building PushCI: the zero-config approach

The core problem with self-hosted runners is that you still need the YAML. The 50-line `ci.yml` that describes how to check out your code, set up your Node version, install dependencies, run your tests. You're doing all that configuration work for what is, at its core, a `npm test` command.

The idea behind PushCI is: what if the tool figured it out?

You run `npx pushci init`. It scans your repo. It looks for `package.json`, `go.mod`, `Cargo.toml`, `pom.xml`, `requirements.txt`, `pyproject.toml` — 33 languages worth of detection. It finds your test runner, your build tool, your lockfile. It generates a `pushci.yml` that describes exactly what should run and in what order.

No YAML you had to write. No documentation to consult. No "oh, you forgot to add the `actions/setup-node` step" three hours into the setup.

The detection isn't magic — it's pattern matching on file presence and content. But it covers enough ground that for most repos, the generated config is correct on the first try.

---

## The dogfood story: 47 packages, 6 bugs

Before shipping v1.7.0 we ran PushCI against our own monorepo. 47 packages, pnpm workspaces, Turborepo. A real project with real complexity.

It found six bugs in PushCI itself.

Here's the actual terminal output from that session:

```bash
$ npx pushci init

Scanning workspace...
  Found: pnpm-workspace.yaml
  Found: turbo.json
  Detected: 47 packages across 6 workspace directories

Detected: Node.js / pnpm / Turborepo
  Build tool: pnpm (lockfile: pnpm-lock.yaml)
  Monorepo: yes (workspace consolidation enabled)
  Turbo stages: build, test, lint, type-check

Generated: pushci.yml
```

Then we ran it:

```bash
$ pushci run

Stage: install
  pnpm install --frozen-lockfile    ✓  8.2s

Stage: build
  turbo run build                   ✓  19.4s

Stage: test
  turbo run test                    ✓  14.1s

Stage: lint
  turbo run lint                    ✓  6.3s

Pipeline passed in 48.0s
```

That's the happy path. Before we got there, we hit six failures:

**Bug 1:** pnpm workspaces not detected. It was running `npm install` per-package instead of `pnpm install` at the root.

**Bug 2:** Static `npm install` regardless of lockfile type. If you have `pnpm-lock.yaml`, you should be running `pnpm install`. We weren't.

**Bug 3:** `turbo.json` ignored. Turbo stages weren't being generated — just a flat `npm run build` / `npm run test`.

**Bug 4:** Artifact directories being enumerated as projects. `.next/`, `.turbo/`, `.cache/` directories were being treated as packages.

**Bug 5:** Redundant root install step after workspace detection fixed.

**Bug 6:** `pushci run --help` silently running the actual pipeline instead of printing help text.

All six fixed. Regression tests written for each. This is the version that shipped.

The dogfood story matters because it demonstrates a specific kind of quality signal: does the tool work on non-trivial real-world inputs, specifically the most complex input we could find (our own monorepo). It's a higher bar than passing your unit test suite, and a more honest one.

---

## How the AI piece works

When a build fails, `pushci diagnose` runs. It collects the failure output, the stack trace, and some context about your detected stack, then hands it to an AI.

Not a specific AI. Your AI.

We support six providers: Groq (Llama 3.3 70B on LPUs — fastest, ~500 tokens/sec), Anthropic (Claude Haiku), DeepSeek (cheapest per token), OpenAI (GPT-4o-mini), Google Gemini, and local llamafile if you want fully offline operation.

The selection order:

1. `PUSHCI_AI_PROVIDER=<name>` env var (explicit override)
2. `GROQ_API_KEY` — fastest for CI latency
3. `ANTHROPIC_API_KEY` — best tool-use quality
4. `DEEPSEEK_API_KEY` — cheapest
5. `OPENAI_API_KEY` — broad fallback
6. `GEMINI_API_KEY` — free tier

The AI returns plain-English output: what failed, why it probably failed, and what to try. It works well for the failure modes that appear in stack traces — dependency conflicts, missing env vars, path problems, version mismatches. It works less well for logic bugs where the test output just says "expected X, got Y" and you need domain knowledge to understand why.

We're honest about this. `pushci diagnose` is a triage tool, not a debugger.

---

## What it actually costs

**Free:** unlimited local runs, GitHub/GitLab/Bitbucket status posting, AI diagnose with your own API keys.

**Pro ($9/month):** unlimited AI proxy calls, team dashboard, run history, webhook triggers, email alerts.

**Team ($29/month):** everything in Pro, plus SSO, audit logs, managed cloud runner fallback for when your machine is offline.

The compute is always free. It's your machine. We're not going to put a meter on your CPU cycles.

The paid tiers are for the features that require our infrastructure — the dashboard, the webhook relay, the managed runner. If you only ever run locally and post status to GitHub, the free tier covers you forever.

---

## Try it

If you want to see whether this works for your stack:

```bash
npx pushci init
pushci run
```

That's the complete installation and first-run experience. No account. No config file to write. No cloud setup.

If it detects wrong, `pushci init --force` drops you into interactive mode where you can override anything. If a build fails, `pushci diagnose` gives you an AI read on what happened.

v1.7.0. 831 tests passing. 33 languages, 40+ frameworks. Bootstrapped.

pushci.dev
