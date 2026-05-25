# PushCI — Technical Vision

## Architecture Evolution

### Today (v0.3): Single Binary
```
pushci CLI ──→ local execution ──→ status via API
```

### v0.5: Agent Mode
```
pushci agent ──→ receives webhooks
             ──→ runs checks locally
             ──→ posts status to GitHub/GitLab/BB
```

### v0.7: Distributed
```
API (CF Workers) ──→ dispatch to runner pool
                 ──→ runners claim jobs from queue
                 ──→ stream logs via WebSocket
                 ──→ store results in D1
```

### v1.0: Full Platform
```
┌─ CF Workers API ─────────────────────────┐
│  Webhooks │ Auth │ Runs │ Deploy │ Badge  │
├────────────────────────────────────────────┤
│  CF D1 (runs, projects, users, orgs)      │
│  CF KV (runner registry, job queue)        │
│  CF R2 (build artifacts, logs, cache)      │
│  CF Durable Objects (WebSocket, real-time) │
├────────────────────────────────────────────┤
│  Runner Fleet                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ self │ │ self │ │ mgd  │ │ mgd  │     │
│  │hosted│ │hosted│ │linux │ │macos │     │
│  └──────┘ └──────┘ └──────┘ └──────┘     │
└────────────────────────────────────────────┘
```

## Intelligence Engine (v0.8+)

### Change Impact Analysis
```
git diff → parse affected files
        → map to packages/modules
        → determine which checks to run
        → skip unchanged (cache hit)
```

Result: 10-second CI for small changes (vs 5-minute full run).

### AI Error Diagnosis
```
test failure output → LLM analysis
                   → identify root cause
                   → suggest fix
                   → optionally auto-PR
```

Uses: Claude API for analysis, local heuristics for common patterns.

### Flaky Test Detection
```
track test results per test name
→ if test flips pass/fail without code change
→ mark as flaky
→ auto-retry up to 3 times
→ report flaky rate in dashboard
```

## Data Model

### Core Entities
```
User → has many → Orgs → has many → Projects
Project → has many → Runs → has many → Checks
Project → has → Config (pushci.yml)
Project → has many → Secrets (encrypted)
Org → has many → Runners
```

### Storage Strategy
```
CF D1:    structured data (runs, projects, users)
CF KV:    ephemeral data (job queue, runner heartbeat)
CF R2:    blobs (logs, artifacts, cache)
CF DO:    real-time (WebSocket connections, live logs)
```

## Security Model

### Secrets
- AES-256-GCM encryption at rest
- Machine-bound key derivation (local)
- Per-org encryption keys (cloud)
- Never logged, never in plain text in transit

### Runner Trust
- Runners authenticate with signed tokens
- Job payloads encrypted in transit
- Runners never see other org's data
- Auto-expire runner tokens (24h)

### Webhook Verification
- GitHub: HMAC-SHA256
- GitLab: Secret token header
- Bitbucket: IP allowlist + signature

## Pricing Architecture

### Free Tier (generous, never crippled)
- Unlimited local runs (pushci run)
- 1 project with webhook agent
- Basic dashboard
- Community support

### Pro $9/mo
- Unlimited projects
- Full dashboard + history
- Slack/Discord/email notifications
- Badge generator
- Priority support
- 30-day log retention

### Team $29/mo per seat
- Everything in Pro
- Shared runners
- Team secrets
- SSO + RBAC
- Audit log
- 90-day log retention

### Enterprise $99/mo per seat
- Everything in Team
- Managed runners
- Matrix builds
- Approval gates
- Preview environments
- SOC2 compliance
- SLA (99.9%)
- Dedicated support
- 1-year log retention
