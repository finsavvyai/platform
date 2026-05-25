# PushCI — Product Vision

**Mission**: Make CI/CD invisible. Push code. Everything happens.

## The Problem

CI/CD is broken for 90% of developers:
- **GitHub Actions**: 50+ lines of YAML to run `go test`
- **Costs spiral**: $200-2000/mo for moderate teams
- **Platform lock-in**: Config doesn't port between GitHub/GitLab
- **Junior devs excluded**: CI/CD is expected but never taught
- **Reliability declining**: GitHub Actions had major outages in 2025

## The Insight

Your code already knows what to test. `go.mod` means Go.
`package.json` means Node. `pom.xml` means Maven. Why are
developers writing YAML to tell CI what their repo already says?

## The Product

PushCI is the first AI-native CI/CD platform.

```
npx pushci init    # AI scans your repo
git push           # tests run automatically
```

No YAML. No config. No cloud compute bills.

## How It Works

```
1. Developer installs: npx pushci init
   → AI scans repo (go.mod, package.json, Cargo.toml...)
   → Detects stack, framework, build tool
   → Generates pipeline, installs git hooks

2. Developer pushes code: git push
   → Pre-push hook runs tests locally (free)
   → Webhook notifies PushCI API
   → Status posted on PR (pending → pass/fail)

3. On merge to main:
   → Deploy to configured target (AWS/GCP/CF/etc.)
   → Slack/Discord notification
   → Badge updates on README
```

## Architecture Vision

```
┌──────────────────────────────────────────────┐
│                   PushCI                      │
├──────────┬───────────┬───────────┬───────────┤
│  CLI     │  API      │  Dashboard│  Runner   │
│  (Go)    │  (CF      │  (React)  │  Agent    │
│          │  Workers) │           │  (Go)     │
├──────────┴───────────┴───────────┴───────────┤
│              Platform Layer                   │
│     GitHub    GitLab    Bitbucket    Gitea    │
├──────────────────────────────────────────────┤
│              Intelligence Layer               │
│  Stack Detect → Change Analysis → Caching    │
│  Error AI → Flaky Detection → Auto-fix       │
├──────────────────────────────────────────────┤
│              Deploy Layer (16 targets)         │
│  Cloudflare  AWS  GCP  Azure  Vercel  K8s    │
└──────────────────────────────────────────────┘
```

## Key Differentiators

1. **Zero Config** — No other tool auto-detects and just works
2. **Free Compute** — Runs on your machine, not cloud
3. **Multi-Platform** — One tool for GitHub+GitLab+Bitbucket
4. **AI-Native** — Error explanation, auto-fix, smart caching
5. **95% Margins** — No compute costs = SaaS dream economics
