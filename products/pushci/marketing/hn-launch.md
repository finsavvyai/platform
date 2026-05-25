# Show HN: PushCI – CI/CD that runs on your machine, zero YAML, $0 compute

---

## Post Body

GitHub announced earlier this year that self-hosted runners — the thing developers adopted specifically to avoid paying $0.008/minute for hosted runners — now cost $0.002/minute. The escape hatch has a price tag. I want to talk about what we built in response, and be honest about where it stands.

**The problem**

We were running a mid-size monorepo on GitHub Actions. Nothing exotic — pnpm, Turborepo, a handful of Node services. The monthly bill was $340. I pulled up the cost breakdown one afternoon and stared at it for too long. We were paying Microsoft to temporarily borrow a computer in Virginia to check if our semicolons were correct. On a machine we own. In an office we pay rent for. I ran `npm test` locally. It took 4 seconds. The same test suite took 4 minutes on Actions.

That's not a performance problem. That's a category error.

**What PushCI does**

`npx pushci init` — that's the whole onboarding. It scans your repo, detects your stack (Go, Node, Python, Rust, Java, Ruby, 33 languages total, 40+ frameworks), generates a `pushci.yml`, and runs your first pipeline. On your machine. Using your CPU.

There is no YAML to write. There is no account to create. There is no runner to provision. The config it generates is a description of what you were already doing — it just makes it reproducible and hookable into your git workflow.

The pipeline runs as a pre-push hook. You push, your tests run, the push goes through or it doesn't. Same semantics as CI, zero cloud involved. Status posts back to GitHub, GitLab, or Bitbucket via their APIs.

**The dogfood story**

Before shipping v1.7.0 we ran PushCI against our own monorepo — 47 packages, pnpm workspaces, Turborepo. It found six bugs in PushCI itself:

1. pnpm workspaces not detected at all — it was running installs per-package
2. Static `npm install` regardless of lockfile type — should have been `pnpm install`
3. `turbo.json` was being ignored — Turbo stages not generated
4. Artifact directories (`.next`, `.turbo`, `.cache`) being enumerated as projects
5. Redundant root install step after workspace consolidation fixed
6. `pushci run --help` silently running the actual pipeline instead of printing help

All six fixed. Regression tests written. This is the version you're looking at now.

The point isn't that we had bugs — every tool has bugs. The point is that dogfooding against a real complex monorepo surfaces a different class of problem than unit tests do, and we did it before shipping rather than after.

**The AI piece**

When a build fails, `pushci diagnose` sends the failure to an AI provider. We support six: Groq (Llama 3.3 70B, fastest — ~500 tok/sec on LPUs), Anthropic (Claude Haiku), DeepSeek, OpenAI, Gemini, and local llamafile for fully offline operation. Priority is determined by which keys you have set. You can force a specific provider with `PUSHCI_AI_PROVIDER=groq` or whatever.

The AI returns a plain-English root cause and a suggested fix. It's not magic — it's pattern-matching on stack traces plus some context about your stack. It works well for common failure modes (dependency version conflicts, missing env vars, path issues) and less well for business logic errors where the stack trace doesn't tell you much. We're honest about this in the docs.

**What it costs**

Free tier: unlimited local runs, GitHub/GitLab/Bitbucket status posting, AI diagnose up to 100 calls/month (uses your own API keys, so the limit is really just our proxy calls).

Pro ($9/month): unlimited AI calls, team dashboard, run history, webhook triggers.

Team ($29/month): everything in Pro plus SSO, audit logs, managed runners if you want cloud fallback.

The compute is always free because it's always yours.

**What we're not sure about**

We don't know how this scales to very large teams where the "runs on your machine" model breaks down — if you have 50 developers all pushing simultaneously, the local model still works per-developer, but you lose centralized visibility. The dashboard and webhook runner address this for the Pro/Team tier but we don't have many large-team users yet.

We also haven't solved the "my laptop is closed" problem elegantly. If you push from a laptop that's sleeping, the pre-push hook runs on the laptop before the push, so that's fine — but triggered builds from PR comments or scheduled runs need a runner that's actually on. We have a Hetzner VPS runner option for this but it's not as polished as it should be.

**What I'd like to know**

What's the failure mode you've hit with local CI that made you go back to hosted? What's missing from this model that would make it actually work for your team? Where did we get the threat model wrong?

Happy to answer questions. Source is private (commercial product) but the architecture is straightforward Go — happy to describe any part of it in detail.

pushci.dev
