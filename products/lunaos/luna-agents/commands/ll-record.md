---
name: ll-record
displayName: Luna Record
description: Auto-generate demo videos of your features — screen recording, AI narration, background music, editing, and publishing
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: feature
    type: string
    description: Feature to demo, or "tour" for full product walkthrough
    required: true
    prompt: true
  - name: style
    type: string
    description: "Style: demo (product demo), tutorial (step-by-step), changelog (what's new), pitch (investor), social (short clip)"
    required: false
    default: demo
  - name: voice
    type: string
    description: "Voice: ai (ElevenLabs), clone (your voice clone), none (music only)"
    required: false
    default: ai
mcp_servers:
  - playwright
  - puppeteer
  - elevenlabs
  - suno
  - runway
  - heygen
  - zai-mcp-server
  - git
  - memory
---

# /record — Auto-Generated Demo Videos

Luna navigates your app, records every interaction, adds AI narration, background music, transitions — and outputs a polished demo video. No screen recording software needed.

## How It Works

```
/record "new billing dashboard" --style demo
              │
              ▼
   SCRIPT (auto-generated from code)
   ├── Analyze the feature (read components, routes)
   ├── Write narration script (key talking points)
   ├── Plan navigation flow (which pages, which clicks)
   └── Determine highlight moments
              │
              ▼
   CAPTURE (playwright)
   ├── Navigate to each screen
   ├── Perform interactions (click, type, scroll)
   ├── Screenshot each state at 1440px
   ├── Record timing between actions
   └── Capture before/after states
              │
              ▼
   PRODUCE (parallel)
   ├── ElevenLabs: generate narration audio
   ├── Suno: generate background music (--style soundtrack)
   ├── HeyGen: AI avatar presenter (optional)
   ├── Runway: scene transitions and effects
   └── zai-mcp: analyze screenshots for captions
              │
              ▼
   ASSEMBLE
   ├── Sync screenshots with narration timing
   ├── Add zoom effects on key interactions
   ├── Add captions/subtitles
   ├── Add intro/outro with branding
   ├── Mix narration + background music
   └── Export multiple formats
              │
              ▼
   OUTPUT
   ├── demo-full.mp4 (1080p full demo)
   ├── demo-60s.mp4 (social media cut)
   ├── demo-30s.mp4 (ad cut)
   ├── demo-gif.gif (for README/PR)
   ├── thumbnail.png
   ├── script.md (narration transcript)
   └── captions.srt (subtitle file)
```

## Usage

```bash
/record "billing dashboard" --style demo                  # Product demo
/record "auth flow" --style tutorial                      # Step-by-step tutorial
/record tour                                               # Full product walkthrough
/record "v2.0 features" --style changelog                 # What's new video
/record "AI workflow engine" --style pitch                 # Investor pitch video
/record "new dark mode" --style social                    # 60-second social clip
```

## Avatar Mode (HeyGen)

```bash
/record "product overview" --voice avatar                  # AI avatar presents your product
```

Generates a video with an AI presenter (HeyGen) walking through your app with your script.

## In Pipes

```bash
/pipe go *5 >> record "what I just built" >> publish youtube
/pipe launch production >> record "release highlights" >> ghost social >> publish
/pipe record tour >> sing "product jingle" >> combine >> publish
/pipe record "new feature" --style social >> publish twitter >> publish linkedin
```
