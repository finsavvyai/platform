---
name: ll-launch
displayName: Luna Launch
description: Full product launch sequence — deploy, monitor, announce, track metrics, auto-rollback if issues
version: 1.0.0
category: deployment
agent: luna-deployment
parameters:
  - name: target
    type: string
    description: "Target: staging, production, preview"
    required: true
    prompt: true
  - name: strategy
    type: string
    description: "Strategy: instant, canary (5%→25%→100%), blue-green, rolling"
    required: false
    default: canary
mcp_servers:
  - cloudflare
  - git
  - playwright
  - zai-mcp-server
  - image-compare
  - accessibility-scanner
  - fetch
  - memory
---

# /launch — Ship with Confidence

Not just deploy. A full launch sequence with visual verification, progressive rollout, real-time monitoring, and automatic rollback.

## Launch Sequence

```
/launch production --strategy canary
         │
         ▼
┌─── PRE-FLIGHT ────────────────────────────────┐
│  git: verify clean branch, all tests pass      │
│  playwright: full browser test suite            │
│  accessibility-scanner: WCAG AA compliance      │
│  image-compare: screenshot baseline captured    │
│  fetch: verify all external dependencies up     │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── DEPLOY 5% CANARY ─────────────────────────┐
│  cloudflare: deploy to edge, route 5% traffic  │
│  wait 5 minutes                                │
│  fetch: hit health endpoints                   │
│  playwright: smoke test against canary URL      │
│  zai-mcp: analyze canary screenshots vs baseline│
│  CHECK: error rate < 0.1%? latency < p99?       │
│  ├── PASS → promote to 25%                      │
│  └── FAIL → auto-rollback, alert, report        │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── DEPLOY 25% ────────────────────────────────┐
│  cloudflare: route 25% traffic                  │
│  wait 10 minutes                               │
│  Same verification as 5% step                  │
│  CHECK: all signals green?                      │
│  ├── PASS → promote to 100%                     │
│  └── FAIL → auto-rollback to previous version   │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── FULL DEPLOY ───────────────────────────────┐
│  cloudflare: route 100% traffic                 │
│  playwright: full regression suite              │
│  image-compare: diff vs pre-deploy baseline     │
│  memory: store deployment record                │
│  git: tag release                               │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── POST-LAUNCH ───────────────────────────────┐
│  Generate deployment report                    │
│  Store screenshots as new baseline             │
│  Update changelog                              │
│  memory: persist launch metrics for next time   │
└───────────────────────────────────────────────┘
```

## Usage

```bash
/launch staging                                   # Instant deploy to staging
/launch production                                # Canary deploy to production
/launch production --strategy blue-green          # Blue-green swap
/launch production --strategy rolling             # Rolling update
/launch preview                                   # Deploy preview branch
```

## In Pipes

```bash
/pipe test >> rev >> sec >> launch production
/pipe go *5 >> (test ~~ browser-test ~~ a11y) >> launch staging >> approve "Ship to prod?" >> launch production
/pipe swarm "build feature" >> test >> launch staging >> visual-diff >> launch production
```
