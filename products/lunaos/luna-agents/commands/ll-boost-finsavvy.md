---
name: ll-boost-finsavvy
displayName: Luna Boost FinsavvyAI Projects
description: Analyze and boost any FinsavvyAI portfolio project using shared libraries, Claw Gateway, and cross-project synergies
version: 1.0.0
category: infrastructure
agent: luna-task-executor
parameters:
  - name: path
    type: string
    description: "Project path"
    required: false
    default: "."
    prompt: true
  - name: action
    type: string
    description: "analyze (assess + plan), connect (register on gateway), sync (apply shared libs)"
    required: false
    default: analyze
prerequisites: []
---

# Luna Boost FinsavvyAI Projects

Analyze any project in the FinsavvyAI portfolio and generate a plan using shared private infrastructure, @finsavvyai libraries, and cross-project synergies.

## What This Knows About

### Shared Infrastructure (Deployed)
- **Claw Gateway** — shared AI proxy at claw-gateway.workers.dev (8 projects connected)
- **ReasoningBank** — KV prompt cache (30% token savings)
- **Agent Booster** — skip LLM for simple transforms (<1ms, $0)
- **Context Packing** — trim context (40-60% savings)
- **Smart Router** — self-learning model selection
- **Hybrid Search** — sparse+dense RRF fusion
- **Credit System** — gamification with achievements
- **Queen-Led Swarm** — multi-agent task decomposition (OpenSyber)
- **Self-Learning SDK** — client-side caching + outcome tracking

### @finsavvyai Shared Libraries (Master Ship Plan)
- **@finsavvyai/pay** — Stripe + LemonSqueezy unified payments
- **@finsavvyai/auth** — Clerk, Supabase, CF Access, JWT middleware
- **@finsavvyai/test-config** — Vitest/Playwright presets, 95%+ coverage
- **@finsavvyai/llm** — Multi-provider AI client with fallback chains
- **@finsavvyai/monitor** — Sentry + Prometheus + structured logging
- **@finsavvyai/cf-stack** — Cloudflare Workers toolkit (Hono + D1 + KV)
- **@finsavvyai/db** — Drizzle schema templates + migration helpers
- **@finsavvyai/ui** — Apple HIG design system components

### Portfolio Projects (44 total, 8 on gateway)
Connected: LunaOS, CodeRailFlow, Aegis, OpenSyber, Push-CI, PipeWarden, QueryFlux, Qestro

### Revenue Bundles (Master Ship Plan)
- **Security Suite** — OpenSyber + PipeWarden + Coderail.dev
- **DevX Platform** — QueryFlux + MCPOverflow + AutoBoot
- **FinTech Bundle** — FinTech Suite + PipeWarden
- **Israeli Market** — YallaBye + Moneh Hacham + Hashmal
- **AI Agents** — LunaOS + FinSavvyAI + A2A + Skill Seekers

### Shipping Waves
- Wave 1 (ship now): Luna-OS, FinSavvyAI, FinTech Suite, Skill Seekers, SubsForge, CoderailFlow, OpenSyber, AutoBoot
- Wave 2 (quick builds): PipeWarden, TenantIQ, Qestro, DevWrapped, UPM, ViralSplit, ScanGenie
- Wave 3-5: remaining 24 projects

## Analysis Steps

1. **Identify** — what is this project, what stack, what wave
2. **Check gateway** — is it registered on Claw? If not, register it
3. **Check shared libs** — which @finsavvyai packages does it need
4. **Check intelligence features** — which of the 9 features apply
5. **Check synergies** — which other projects does it complement
6. **Check bundle** — which revenue bundle does it belong to
7. **Generate plan** — prioritized steps with effort estimates

## Usage

```bash
# Analyze current project
/boost-finsavvy

# Register on gateway + apply shared libs
/boost-finsavvy . connect

# Sync shared library versions
/boost-finsavvy . sync
```

## Output

```
.luna/{project}/boost-finsavvy/
  status.md             # Gateway connection, shared lib usage
  plan.md               # Integration steps
  synergies.md          # Cross-project opportunities
  bundle.md             # Revenue bundle position
```

## In Pipes

```bash
# Full portfolio boost
/pipe boost-finsavvy /path/to/project >> connect-infra . >> boost-project .

# Prepare for shipping
/pipe boost-finsavvy . >> site-audit https://myapp.com >> fix >> ship
```
