# CLAUDE.md — PushCI.dev

## What This Is

**PushCI.dev** = AI-native CI/CD platform.
"The operating system for developer pipelines,
powered by your own infrastructure + AI."

Domain: pushci.dev (purchased)
Repo: github.com/finsavvyai/pushci
Parent: github.com/finsavvyai/amliq (in runlocal/)

## Why It Exists

GitHub Actions: $0.008/min, 50-line YAML, platform lock-in.
PushCI: $0 (your machine), zero config, works everywhere.
CI/CD market: $8-14B, growing 15-20%/yr. No competitor
combines AI + zero config + multi-platform + free compute.

## Product Stats (v1.0.1)

- 21 Go packages, 465+ tests, 167 Go files
- 19 languages, 40+ frameworks, 21 deploy targets
- 14 CLI commands, 18+ API endpoints
- 11 dashboard pages, 5 landing pages
- 23 spec docs, 6 launch docs
- Security audited (8 issues fixed)
- All files ≤100 lines

## Architecture

```
Developer → npx pushci init → detects stack
         → git push → pre-push hook runs tests
         → webhook → PushCI API (CF Workers)
         → dispatches to runner (local or cloud)
         → posts status to GitHub/GitLab/Bitbucket
         → dashboard shows results
```

```
┌─ CF Workers API (Hono + D1 + KV) ──────────┐
│  Webhooks │ Auth │ Runs │ AI │ Billing       │
├─────────────────────────────────────────────┤
│  Runner Fleet (self-hosted or managed)       │
│  Local │ Hetzner VPS │ Fly.io │ Docker       │
├─────────────────────────────────────────────┤
│  Claude AI (Haiku) │ MCP Server │ NLP        │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| CLI | Go 1.22 (cmd/pushci/, 14 commands) |
| API | Cloudflare Workers + Hono + D1 + KV |
| Landing | React 18 + Vite + Tailwind |
| Dashboard | React 18 + Vite + Tailwind |
| AI | Claude Messages API (@anthropic-ai/sdk) |
| Billing | Stripe (checkout, portal, webhooks) |
| Secrets | AES-256-GCM, machine-bound keys |
| Auth | GitHub/GitLab OAuth + JWT |
| Hosting | Cloudflare Pages (free) |
| Distribution | npm, Homebrew, curl, Docker, go install |
| VS Code | Extension (status bar, sidebar, commands) |
