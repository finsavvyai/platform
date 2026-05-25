---
name: ll-compete
displayName: Luna Compete
description: Competitive intelligence — analyze any competitor's product, tech stack, pricing, features, and generate your advantage plan
version: 1.0.0
category: strategy
agent: luna-task-planner
parameters:
  - name: competitor
    type: string
    description: Competitor URL, name, or GitHub repo
    required: true
    prompt: true
mcp_servers:
  - fetch
  - playwright
  - puppeteer
  - zai-mcp-server
  - image-compare
  - git
  - sequential-thinking
  - memory
---

# /compete — Know Your Enemy, Build Your Advantage

Deep-dive analysis of any competitor. Scrape their product, reverse-engineer their stack, analyze their UX, map their features, and generate your differentiation strategy.

## Analysis Layers

```
/compete https://linear.app
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
 PRODUCT    TECH      BUSINESS
 ├ Features  ├ Stack    ├ Pricing tiers
 ├ UX/UI     ├ Perf     ├ Target market
 ├ Flows     ├ API      ├ Growth signals
 ├ Mobile    ├ SEO      ├ Team size
 └ A11y      └ Infra    └ Funding
    │         │         │
    └─────────┼─────────┘
              ▼
       DIFFERENTIATION PLAN
       ├── Features they're missing
       ├── UX improvements over them
       ├── Pricing advantage opportunities
       ├── Technical advantages you can build
       └── Go-to-market positioning
```

## Usage

```bash
/compete https://linear.app                       # Full analysis
/compete https://n8n.io                            # Workflow competitor
/compete https://github.com/langchain-ai/langchain # Open source competitor
/compete "Zapier, Make, n8n"                       # Multi-competitor comparison
```

## In Pipes

```bash
/pipe compete "competitor.com" >> idea "build a better version" >> plan >> go *10
/pipe compete "top 3 competitors" >> brand >> marketing >> launch
```
