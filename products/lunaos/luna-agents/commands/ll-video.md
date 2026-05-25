---
name: ll-video
displayName: Luna Video
description: AI video generation — product trailers, explainer videos, social clips, avatar presentations from text or screenshots
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: type
    type: string
    description: "Type: trailer (product trailer), explainer (how it works), social (short clip), avatar (AI presenter), ad (promotional)"
    required: true
    prompt: true
  - name: topic
    type: string
    description: What the video should be about
    required: false
  - name: duration
    type: string
    description: "Duration: 15s, 30s, 60s, 3min, 5min"
    required: false
    default: 60s
mcp_servers:
  - runway
  - heygen
  - piapi
  - fal-ai
  - elevenlabs
  - suno
  - playwright
  - zai-mcp-server
  - stability-ai
  - memory
---

# /video — Professional Videos from Your Terminal

Generate production-quality videos — product trailers, explainer videos, social clips, and AI avatar presentations. No video editing skills needed.

## Video Types

### /video trailer
```
Cinematic product trailer:
├── Opening hook (dramatic text + music)
├── Problem statement (animated text)
├── Product reveal (screenshots with motion)
├── Feature highlights (zoom into key UI)
├── Social proof (user count, metrics)
├── CTA (logo + tagline)
├── Cinematic soundtrack (Suno)
└── Duration: 30-60 seconds
```

### /video explainer
```
How-it-works explainer:
├── Intro: "What if you could..."
├── Step 1-3: Animated walkthrough
├── Each step: screenshot + narration + zoom
├── Benefits summary
├── CTA
├── AI narration (ElevenLabs)
├── Background music (lo-fi or corporate)
└── Duration: 1-3 minutes
```

### /video avatar
```
AI presenter video (HeyGen):
├── Choose avatar or clone your face
├── Script auto-generated from feature
├── Avatar walks through your product
├── Screen recordings embedded
├── Professional editing and pacing
└── Duration: 1-5 minutes
```

### /video social
```
Short-form social clip:
├── Vertical format (9:16 for TikTok/Reels/Shorts)
├── Hook in first 3 seconds
├── Quick feature showcase
├── Text overlays + captions
├── Trending music style
├── CTA + link
└── Duration: 15-30 seconds
```

## Usage

```bash
/video trailer "LunaOS — Ship AI agents in minutes"
/video explainer "how our workflow engine works"
/video avatar "product walkthrough for investors"
/video social "we just launched dark mode" --duration 15s
/video ad "Try LunaOS free — deploy AI agents in 60 seconds"
```

## In Pipes

```bash
/pipe launch production >> video trailer >> publish youtube >> publish twitter
/pipe record "feature demo" >> video social >> publish all
/pipe present pitch >> video avatar "investor pitch" >> share investors
/pipe sing "product jingle" >> video trailer >> imagine thumbnail >> publish
```
