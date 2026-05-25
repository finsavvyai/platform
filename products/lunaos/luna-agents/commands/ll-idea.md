---
name: ll-idea
displayName: Luna Idea → Product
description: Transform a product idea into a full spec, architecture, design system, and implementation plan in one command
version: 1.0.0
category: creation
agent: luna-design-architect
parameters:
  - name: idea
    type: string
    description: Your product idea in plain English
    required: true
    prompt: true
  - name: platform
    type: string
    description: "Target: web, mobile, desktop, api, fullstack (default: fullstack)"
    required: false
    default: fullstack
mcp_servers:
  - fetch
  - sequential-thinking
  - memory
  - ruflo
---

# /idea — From Thought to Blueprint in 60 Seconds

Transform a single sentence into a complete product blueprint.

## What Happens

```
"I want a Slack bot that summarizes PRs daily"
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  1. RESEARCH (fetch + ruflo swarm)               │
│     • Search existing solutions                  │
│     • Identify gaps and differentiators          │
│     • Analyze target user personas               │
│     • Estimate market size                       │
├─────────────────────────────────────────────────┤
│  2. REQUIREMENTS (sequential-thinking)           │
│     • User stories with acceptance criteria      │
│     • Functional requirements                    │
│     • Non-functional requirements                │
│     • Edge cases and constraints                 │
├─────────────────────────────────────────────────┤
│  3. ARCHITECTURE                                 │
│     • System design (mermaid diagrams)           │
│     • Data model (entities, relationships)       │
│     • API design (endpoints, schemas)            │
│     • Infrastructure (Cloudflare/Vercel/AWS)     │
├─────────────────────────────────────────────────┤
│  4. DESIGN SYSTEM                                │
│     • Color palette, typography, spacing         │
│     • Component inventory                        │
│     • Page wireframes (text-based)               │
│     • Apple HIG compliance notes                 │
├─────────────────────────────────────────────────┤
│  5. IMPLEMENTATION PLAN                          │
│     • Sprint breakdown (2-week sprints)          │
│     • Task dependency graph                      │
│     • Tech stack recommendations                 │
│     • Estimated complexity per task              │
├─────────────────────────────────────────────────┤
│  6. SCAFFOLD                                     │
│     • Generate project structure                 │
│     • Create package.json / pyproject.toml       │
│     • Set up CI/CD templates                     │
│     • Initialize git repo                        │
└─────────────────────────────────────────────────┘
```

## Usage

```bash
/idea "AI-powered invoice scanner for freelancers"
/idea "Real-time multiplayer code editor" --platform web
/idea "Fitness tracker with Apple Watch sync" --platform mobile
/idea "CLI tool that converts Figma to React components" --platform desktop
```

## In Pipes

```bash
/pipe idea "my idea" >> plan >> go *10 >> test >> ship
/pipe idea "my idea" >> des >> hig >> brand >> go *5 >> browser-test >> ship
```

## Output

```
.luna/{project}/
  idea/
    research.md           # Market analysis, competitors, gaps
    requirements.md       # User stories, acceptance criteria
    architecture.md       # System design, data model, APIs
    design-system.md      # Colors, typography, components
    implementation-plan.md # Sprints, tasks, dependencies
```
