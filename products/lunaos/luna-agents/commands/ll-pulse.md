---
name: ll-pulse
displayName: Luna Pulse
description: Real-time health pulse across your entire stack — code, infra, users, revenue, team velocity — in one view
version: 1.0.0
category: monitoring
agent: luna-monitoring-observability
parameters:
  - name: scope
    type: string
    description: "Scope: all, code, infra, users, revenue, team"
    required: false
    default: all
mcp_servers:
  - git
  - cloudflare
  - fetch
  - memory
  - sequential-thinking
---

# /pulse — Your Product's Vital Signs

One command to see everything that matters. Combines signals from code, infrastructure, users, and revenue into a single health score.

## Dashboard

```
/pulse
         │
         ▼
┌──────────────────────────────────────────────────────┐
│                    LUNA PULSE                          │
│                   Score: 87/100                        │
├──────────────────────────────────────────────────────┤
│                                                       │
│  CODE HEALTH ████████░░ 82%                           │
│  ├── Test coverage: 91%                               │
│  ├── Open PRs: 3 (oldest: 2 days)                    │
│  ├── CI status: all green                             │
│  ├── Security: 0 critical, 1 medium                  │
│  └── Tech debt: 4 TODOs in release branch             │
│                                                       │
│  INFRA HEALTH ██████████ 95%                          │
│  ├── API latency p99: 142ms                           │
│  ├── Error rate: 0.02%                                │
│  ├── Edge cache hit: 94%                              │
│  ├── DB connections: 12/100                           │
│  └── Uptime (30d): 99.98%                            │
│                                                       │
│  USER HEALTH ████████░░ 80%                           │
│  ├── DAU: 1,247 (+12% WoW)                           │
│  ├── Signup→Active: 34%                               │
│  ├── NPS: 42                                          │
│  ├── Support tickets: 8 open (avg 4h response)       │
│  └── Feature adoption: auth 89%, billing 67%          │
│                                                       │
│  REVENUE HEALTH █████████░ 92%                        │
│  ├── MRR: $12,400 (+8% MoM)                          │
│  ├── Churn: 2.1% (target <3%)                        │
│  ├── ARPU: $28.50                                     │
│  ├── Trial→Paid: 18%                                  │
│  └── Failed payments: 2 (recovering)                  │
│                                                       │
│  TEAM VELOCITY █████████░ 88%                         │
│  ├── PRs merged this week: 14                         │
│  ├── Avg review time: 3.2 hours                      │
│  ├── Sprint completion: 85%                           │
│  ├── Blockers: 1                                      │
│  └── Deploy frequency: 4/week                         │
│                                                       │
│  ALERTS                                               │
│  ⚠ Medium vuln in express@4.18.2 — fix available     │
│  ⚠ PR #47 open 3 days without review                 │
│  ✓ All critical paths have 100% test coverage         │
│                                                       │
└──────────────────────────────────────────────────────┘
```

## Usage

```bash
/pulse                    # Full dashboard
/pulse code               # Code health only
/pulse infra              # Infrastructure only
/pulse revenue            # Revenue metrics only
/pulse team               # Team velocity only
```

## In Pipes

```bash
/pipe pulse >> if $pulse.score < 80 >> fix >> pulse   # Auto-heal if unhealthy
/pipe launch production >> pulse >> assert $pulse.infra > 90
/pipe pulse >> report >> notify team                   # Daily standup pulse
```
