---
name: ll-collab
displayName: Luna Collab
description: Team collaboration workflows — standup generation, sprint retros, PR reviews, knowledge sharing, onboarding
version: 1.0.0
category: team
agent: luna-task-planner
parameters:
  - name: action
    type: string
    description: "Action: standup, retro, review-all, onboard, knowledge, handoff"
    required: true
    prompt: true
mcp_servers:
  - git
  - memory
  - fetch
  - sequential-thinking
---

# /collab — Team Intelligence

Automate team workflows that usually eat hours of meetings and coordination.

## Actions

### /collab standup
```
Auto-generates daily standup from git activity:
├── What was merged yesterday (per person)
├── What's in progress (open PRs, active branches)
├── Blockers detected (failing CI, stale PRs, dependency conflicts)
├── Deploy status (what's in staging, what's in prod)
└── Today's priorities (from sprint board)
```

### /collab retro
```
Auto-generates sprint retrospective:
���── Velocity: points completed vs planned
├── Quality: bugs shipped, hotfixes needed
├── Code health: coverage delta, tech debt change
├── Highlights: biggest features shipped
├── Incidents: outages, rollbacks, security issues
└── Patterns: what's improving, what's degrading
```

### /collab review-all
```
Review all open PRs in one shot:
├── For each open PR:
│   ├── Code review (security, quality, tests)
│   ├── Visual diff (screenshot comparison)
│   ├── Impact assessment (what it changes)
│   └── Recommendation (approve, request changes, needs discussion)
└─�� Priority-ranked summary
```

### /collab onboard
```
Generate onboarding guide for a new team member:
├── Architecture overview with diagrams
├── Setup instructions (tested and verified)
├���─ Key files and entry points explained
├── Common workflows and conventions
├── First PR suggestion (good-first-issue)
└── Team contacts and communication channels
```

### /collab handoff
```
Generate handoff document when leaving a project:
├── Current state of all features
├── Known issues and workarounds
├── Architecture decisions and reasoning
├── Deployment procedures
├── Monitoring and alerting setup
└── Contacts and tribal knowledge
```

## In Pipes

```bash
/pipe collab standup >> notify team
/pipe collab retro >> ghost blog "sprint retrospective"
/pipe collab review-all >> assert "all PRs approved" >> launch
```
