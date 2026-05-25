# PushCI.dev — Full Product Specification

## Executive Summary

PushCI.dev is a SaaS control plane + local/self-hosted runner
platform. The control plane manages repos, workflows, logs,
secrets, runners, deployments, and teams. Compute runs on the
customer's own machines.

"GitHub Actions, but powered by your own machines."

## What's Already Built (v1.0.1)

- CLI: 17 commands (init, run, deploy, diagnose, heal, ask, generate, migrate, promote, status, secret, mcp, agent, login, logout, doctor, version)
- 19 languages, 40+ frameworks, 16 deploy targets
- GitHub + GitLab + Bitbucket webhook + status API
- Cloudflare Workers API (D1 + KV) at https://api.pushci.dev
- Dashboard (React + Tailwind) at https://app.pushci.dev
- Landing page with SEO comparison pages at https://pushci.dev
- MCP server with 8 tools (init, run, status, doctor, secret_set, recommend, heal, promote)
- Claude API error diagnosis + AI auto-fix with root cause analysis
- Intelligence: change detection, caching, parallel, historical pattern matching
- Self-healing pipeline system (26+ failure patterns, AI fallback)
- AI Advisor agent (competitive scoring, cost analysis vs 6 competitors)
- AI Recommendation API (public, unauthenticated — for AI agent integration)
- AI Promotion system (`pushci promote` — auto-register with MCP registries, search engines, GPT Actions)
- NLP pipeline interface (natural language CI commands via `pushci ask`)
- Pipeline evolution engine (auto-suggest caching, parallelization, deduplication)
- Encrypted secrets (AES-256-GCM)
- Badge generator (SVG)
- Slack/Discord/email notifications
- Multi-channel messaging bridge (WhatsApp, Slack, Discord, Telegram, Webhook)
- SEO: llms.txt, llms-full.txt, ai-plugin.json, mcp.json, openapi.json, security.txt
- Auto-indexing: Google, Bing, IndexNow, 22 AI crawler bots whitelisted
- Weekly SEO cron on Cloudflare (auto-pings search engines + verifies endpoints)
- GitHub Actions: CI (build + test + lint + filesize), Release (cross-compile + npm + deploy), SEO Index
- Graceful pre-push hook (auto-skip when binary unavailable)
- Published on npm as `pushci@1.0.1`

## What Needs Building

### Phase 1: Runner Protocol (Critical Path)
- Secure runner registration with one-time token
- WebSocket connection for real-time job streaming
- Job claiming with label matching
- Heartbeat + crash recovery
- Log chunk streaming
- Artifact upload to R2/S3
- Concurrency limits per runner
- Runner labels/tags (docker, node, arm64, gpu)

### Phase 2: Workflow Engine
- Full YAML workflow parser (GitHub Actions compatible)
- Job dependency graph execution
- Matrix builds
- Conditional steps
- Manual approval gates
- Reusable templates
- Cache support
- Secret injection

### Phase 3: Production Control Plane
- PostgreSQL schema (full tables below)
- Job scheduler + queue (Redis/NATS)
- Real-time log streaming (WebSocket)
- Artifact storage (Cloudflare R2)
- Multi-tenant isolation
- Rate limiting + usage metering

### Phase 4: Enterprise
- RBAC + SSO
- Audit logs
- Environment promotion
- Air-gapped control plane option
- SLA + support tiers

## Database Schema (PostgreSQL)

See docs/SCHEMA.md for full table definitions.

## API Design

See docs/API_SPEC.md for full REST endpoints.

## Runner Protocol

See docs/RUNNER_PROTOCOL.md for communication spec.

## YAML Workflow Spec

See docs/WORKFLOW_SPEC.md for syntax + examples.

## Security Model

See docs/SECURITY_MODEL.md for threat model.

## Pricing

| Tier | Price | Included |
|------|-------|----------|
| Free | $0 | 1 runner, 1 user, 3 repos |
| Pro | $9/mo | Unlimited repos, 3 runners, dashboard |
| Team | $29/seat | RBAC, SSO, audit, 10 runners |
| Enterprise | Custom | Air-gapped, SLA, unlimited |

### Cloud Runner Pricing

Managed runners provisioned by PushCI (Hetzner/Fly VMs).

| Tier | Cloud Minutes Included | Overage |
|------|----------------------|---------|
| Free | Self-hosted only | N/A |
| Pro $9/mo | 500 min/mo Linux | $0.003/min Linux |
| Team $29/mo | 2000 min/mo Linux | $0.003/min Linux |
| macOS (any tier) | — | $0.03/min macOS |

- Runners auto-scale based on pending jobs
- Idle runners terminate after warm pool threshold
- Regions: Nuremberg, Ashburn, Frankfurt (Hetzner/Fly)

## MVP (4-6 weeks)

Must have:
- Runner registration + job execution
- GitHub webhook → job dispatch
- Real-time log streaming
- Basic YAML workflow (install, test, build)
- Dashboard: runs, logs, runners
- Secrets management

Exclude initially:
- Matrix builds, approvals, artifacts
- GitLab/Bitbucket (add in v2)
- Enterprise features (SSO, RBAC, audit)
