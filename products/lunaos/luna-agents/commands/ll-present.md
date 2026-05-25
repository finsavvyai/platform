---
name: ll-present
displayName: Luna Present
description: Auto-generate presentations — PowerPoint, Google Slides, Figma decks, pitch decks, sprint reviews, feature showcases
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: topic
    type: string
    description: Presentation topic, or "sprint" / "pitch" / "feature" / "architecture" / "retro"
    required: true
    prompt: true
  - name: format
    type: string
    description: "Format: pptx (PowerPoint), slides (Google Slides), figma, pdf, html"
    required: false
    default: pptx
  - name: style
    type: string
    description: "Style: minimal, corporate, creative, dark, apple-keynote"
    required: false
    default: apple-keynote
mcp_servers:
  - powerpoint
  - google-slides
  - playwright
  - zai-mcp-server
  - stability-ai
  - git
  - memory
  - sequential-thinking
---

# /present — Presentations That Build Themselves

Generate complete presentations from your codebase, git history, or any topic. Apple Keynote-quality slides with real data, screenshots, diagrams, and AI-generated visuals.

## Preset Templates

### /present sprint
```
Auto-generates sprint review deck:
├── Slide 1: Sprint goals and theme
├── Slide 2-4: Features shipped (with screenshots)
├── Slide 5: Metrics (velocity, coverage, performance)
├── Slide 6: Demo highlights (GIFs from /record)
├── Slide 7: Bugs fixed and tech debt reduced
├── Slide 8: What's next
└── All data pulled from git + project state
```

### /present pitch
```
Investor pitch deck:
├── Slide 1: One-liner + logo
├── Slide 2: Problem
├── Slide 3: Solution (with product screenshots)
├── Slide 4: Market size (TAM/SAM/SOM)
├── Slide 5: Product demo (key screenshots)
├── Slide 6: Traction and metrics
├── Slide 7: Business model
├── Slide 8: Team
├── Slide 9: Ask
└── AI-generated visuals for each slide
```

### /present feature
```
Feature showcase deck:
├── Slide 1: Feature name and value prop
├── Slide 2: Before vs After (screenshots)
├── Slide 3: How it works (architecture diagram)
├── Slide 4: Live demo (embedded GIF)
├── Slide 5: Technical details
├── Slide 6: Impact metrics
└── Slide 7: What's next
```

### /present architecture
```
Technical architecture deck:
├── Slide 1: System overview (mermaid → diagram)
├── Slide 2-4: Service deep-dives
├── Slide 5: Data flow
├── Slide 6: Infrastructure (Cloudflare/AWS/etc)
├── Slide 7: Security model
├── Slide 8: Scaling strategy
└── All diagrams auto-generated from code
```

## Usage

```bash
/present sprint                                            # Sprint review deck
/present pitch --style corporate                          # Investor pitch
/present "new auth system" --format figma                 # Feature deck in Figma
/present architecture --format html                       # Interactive architecture deck
/present retro --format slides                           # Sprint retro in Google Slides
/present "Q1 2026 results" --style minimal               # Quarterly review
```

## In Pipes

```bash
/pipe collab retro >> present retro >> share team
/pipe record "feature demo" >> present feature >> publish
/pipe compete "competitor.com" >> present "competitive analysis" >> share team
/pipe launch production >> present "release highlights" >> ghost social >> publish
```
