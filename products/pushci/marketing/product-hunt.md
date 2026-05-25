# PushCI — Product Hunt Launch Kit

---

## Tagline

CI/CD that runs on your machine. Zero YAML. $0.

---

## Description (500 chars)

GitHub just started charging for self-hosted runners. PushCI runs on your own machine — free compute forever. One command detects your stack (33 languages, 40+ frameworks), generates zero YAML, and runs your pipeline in seconds. Works with GitHub, GitLab, and Bitbucket. AI diagnoses failures and suggests fixes. 831 tests passing. We dogfood it ourselves — PushCI's own CI runs on PushCI. No config. No cloud bill. No account required. npx pushci init.

---

## First Comment (Hunter Comment)

I want to be upfront about something: we ran PushCI against our own 47-package pnpm + Turborepo monorepo before shipping this, and it found six real bugs in our own tool.

Not edge cases. Actual bugs. Turbo stages being ignored. pnpm workspaces not detected. Static `npm install` running regardless of lockfile. Artifact directories like `.next` and `.turbo` being enumerated as projects. We fixed all six, wrote regression tests, and shipped the fixes in the same session.

That's the dogfood story. It's a good one because it's embarrassing in the right way.

The timing of this launch is deliberate. GitHub announced in 2026 that self-hosted runners — which were previously free — now cost $0.002/minute. The move that was supposed to be the cheap alternative just got a price tag. We built PushCI because $0.008/minute for hosted runners felt absurd. Now even the workaround costs money.

PushCI runs on your machine. Your CPU. Your RAM. The compute is yours. It was always yours. We just made the tooling to use it properly.

One command: `npx pushci init`. It detects your stack, writes a config, and runs your first pipeline. No account. No YAML. No cloud anything. If a build fails, `pushci diagnose` hands it to an AI — Groq, Anthropic, DeepSeek, OpenAI, Gemini, or a local llamafile — and gets you a root cause and a fix suggestion.

We're bootstrapped, v1.7.0, 831 tests passing. Happy to answer anything.

---

## Topics

- CI/CD
- Developer Tools
- Open Source
- Artificial Intelligence
- DevOps

---

## Gallery Image Captions

1. **`npx pushci init` on a 47-package monorepo** — detects pnpm workspaces, Turborepo stages, and 23 packages in under 2 seconds. No YAML written by hand.

2. **Pipeline output** — three stages, 9.1 seconds, no cloud queue, no runner cold start. The terminal is your CI server now.

3. **The pricing math** — GitHub Actions at $0.008/min vs. PushCI at $0.00/min. For a team running 200 builds/day at 4 minutes each, that's $19,200/year vs. $0. The line chart is not subtle.

4. **`pushci diagnose` in action** — build fails, AI analyzes the stack trace, returns a plain-English root cause and a one-line fix. Powered by whichever AI provider you have a key for.

5. **Multi-platform pipeline status** — same `pushci run` command posting build status to GitHub, GitLab, and Bitbucket simultaneously. One tool, three platforms, zero platform lock-in.
