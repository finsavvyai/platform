---
name: ll-imagine
displayName: Luna Imagine
description: AI image and visual generation — product screenshots, marketing assets, social cards, diagrams, 3D models, brand assets
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: what
    type: string
    description: What to generate — description, or preset like "hero", "social-card", "og-image", "3d-model", "icon-set"
    required: true
    prompt: true
  - name: provider
    type: string
    description: "Provider: auto (best for task), dalle, stable-diffusion, flux, midjourney, replicate"
    required: false
    default: auto
  - name: style
    type: string
    description: "Style: photorealistic, illustration, 3d, minimal, abstract, branded"
    required: false
    default: branded
mcp_servers:
  - stability-ai
  - piapi
  - replicate
  - fal-ai
  - tripo-3d
  - zai-mcp-server
  - memory
---

# /imagine — See It Before You Build It

Generate any visual asset your product needs — from hero images to 3D models to social cards. Uses the best AI model for each task.

## Presets

```bash
/imagine hero "AI agents working in harmony"              # Hero section background
/imagine social-card "LunaOS v2.0 Launch"                # OG image for social
/imagine og-image                                          # Auto from product metadata
/imagine icon-set "workflow, agent, deploy, monitor"      # App icon set (SVG)
/imagine 3d-model "futuristic dashboard terminal"          # 3D asset (Tripo/Meshy)
/imagine mockup "phone showing our app"                   # Device mockup
/imagine diagram "our microservices architecture"          # Visual architecture diagram
/imagine avatar "friendly AI assistant"                    # Brand mascot
/imagine pattern "geometric luna theme"                    # Background pattern
/imagine logo-variations                                   # Logo in different contexts
```

## Provider Auto-Selection

| Task | Best Provider | Why |
|------|--------------|-----|
| Photorealistic images | Flux (via fal.ai) | Best photorealism |
| Illustrations | Midjourney (via PiAPI) | Best artistic quality |
| Quick iterations | DALL-E | Fastest generation |
| Product mockups | Stable Diffusion | Best control with ControlNet |
| 3D models | Tripo AI | Best text-to-3D |
| Social cards | Flux + typography | Brand-consistent |

## In Pipes

```bash
/pipe imagine hero >> brand >> hig >> browser-test        # Generate then verify
/pipe imagine social-card >> publish twitter               # Social card → post
/pipe imagine 3d-model "product" >> present pitch          # 3D asset for pitch deck
/pipe ghost blog "topic" >> imagine hero >> publish medium  # Blog with hero image
/pipe brand >> imagine icon-set >> imagine avatar >> ship   # Full brand asset kit
```
