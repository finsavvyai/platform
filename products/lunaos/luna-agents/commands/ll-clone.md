---
name: ll-clone
displayName: Luna Clone
description: Analyze any app/website and generate a complete clone with your own design system and improvements
version: 1.0.0
category: creation
agent: luna-design-architect
parameters:
  - name: url
    type: string
    description: URL of the app to analyze and clone
    required: true
    prompt: true
  - name: improvements
    type: string
    description: What to improve over the original (optional)
    required: false
mcp_servers:
  - playwright
  - puppeteer
  - fetch
  - zai-mcp-server
  - image-extractor
  - accessibility-scanner
  - sequential-thinking
  - ruflo
---

# /clone �� Reverse Engineer Any App

Point at any live app. Luna screenshots every page, extracts the design system, maps the architecture, and generates a complete codebase with your improvements baked in.

## Pipeline

```
/clone https://linear.app --improvements "add AI triage, better mobile UX"
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
 CAPTURE         EXTRACT         ANALYZE
 playwright      zai-mcp         fetch
 screenshots     UI-to-code      API routes
 all pages       design tokens   data model
 all viewports   components      auth flow
    │               │               │
    └───────────────┼───────────────┘
                    ▼
              SYNTHESIZE
              • Design system (colors, fonts, spacing)
              • Component library (React/Vue/Svelte)
              • Page layouts (responsive)
              • API schema (OpenAPI)
              • Data model (Prisma/Drizzle)
              • Auth flow (NextAuth/Clerk)
              • Your improvements layered on top
                    │
                    ▼
              GENERATE
              • Full project scaffold
              • Every component implemented
              • Every page routed
              • API stubs with types
              • Tests for critical paths
              • CI/CD pipeline
              • Deployment config
```

## Usage

```bash
/clone https://notion.so                          # Full clone
/clone https://stripe.com/dashboard --improvements "simpler onboarding"
/clone https://vercel.com --improvements "add team chat, mobile app"
/clone ./competitor-screenshot.png                 # Clone from screenshot
```

## In Pipes

```bash
/pipe clone https://app.com >> hig >> brand >> go *10 >> browser-test >> ship
/pipe clone https://app.com >> improve "add AI features" >> test >> deploy
```
