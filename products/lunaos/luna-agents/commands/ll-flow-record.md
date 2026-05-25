---
name: ll-flow-record
displayName: Luna Flow Record
description: Record browser flows as demo videos — navigate any site, capture screenshots + video, generate AI narration
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: url
    type: string
    description: URL to record (e.g., https://lunaos.ai or http://localhost:3000)
    required: true
    prompt: true
  - name: flow
    type: string
    description: "Flow type: tour (full product), landing (marketing pages), auth (login/signup), dashboard, custom"
    required: false
    default: tour
  - name: output
    type: string
    description: "Output format: video (webm), screenshots (png), gif, all"
    required: false
    default: all
mcp_servers:
  - playwright
  - zai-mcp-server
prerequisites: []
---

# Luna Flow Record

Record any web app's user flows as professional demo videos with AI-generated narration.

## What This Command Does

1. **Analyze** — reads the target URL, detects pages and navigation
2. **Plan** — creates a flow of pages to visit with timing
3. **Record** — opens Playwright browser with video recording enabled
4. **Navigate** — visits each page, scrolls, waits for animations
5. **Screenshot** — captures every page state at 1280x720
6. **Narrate** — uses Claw Gateway AI to generate captions per step
7. **Output** — saves video (.webm), screenshots (.png), and narration (.srt)

## Usage

```bash
# Record a full product tour
/flow-record https://lunaos.ai tour

# Record just the landing page sections
/flow-record https://myapp.com landing

# Record auth flow
/flow-record https://myapp.com auth

# Record dashboard walkthrough
/flow-record http://localhost:3000 dashboard

# Screenshots only (no video)
/flow-record https://lunaos.ai tour screenshots
```

## How It Works

### Step 1: Detect Pages
The agent scans the target URL for navigation links, routes, and sections:
- Extracts all `<a href>` links from the page
- Identifies hash anchors for single-page sections
- Detects auth pages (login, signup, forgot-password)
- Finds dashboard/app routes if authenticated

### Step 2: Generate Flow Script
Creates a Playwright script that:
```javascript
const pages = [
  { url: 'https://site.com', wait: 2000, caption: 'Homepage' },
  { url: 'https://site.com/#features', wait: 1500, caption: 'Features' },
  { url: 'https://site.com/pricing', wait: 1500, caption: 'Pricing' },
  // ... detected pages
];
```

### Step 3: Record with Playwright
```javascript
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } },
});
// Navigate each page, wait for content, capture screenshots
```

### Step 4: AI Narration
For each screenshot, the agent calls the Claw Gateway:
```
System: You are a product demo narrator. Given a screenshot description,
write a 1-sentence caption for a demo video.

User: Page showing a pricing table with Free ($0), Pro ($29), Team ($79)

AI: "Choose the plan that fits — start free and upgrade as you grow."
```

### Step 5: Output
```
.luna/{project}/flow-record/
  video.webm          # Full recording (1280x720)
  screenshots/
    01-hero.png
    02-features.png
    03-pricing.png
    ...
  narration.srt       # Subtitle file with AI captions
  narration.json      # Structured narration data
  flow.json           # The flow definition (replayable)
```

## Predefined Flows

### `tour` — Full Product Tour
Visits: homepage → features → use cases → demo → pricing → login → dashboard → docs

### `landing` — Marketing Pages Only
Visits: homepage → features → pricing → about → contact → blog

### `auth` — Authentication Flow
Visits: signup → login → forgot password → OAuth buttons

### `dashboard` — App Walkthrough
Requires credentials in `.luna/rules.yaml`:
```yaml
flow_record:
  credentials:
    email: demo@example.com
    password: DemoPass123!
```

### `custom` — Define Your Own Flow
Create `.luna/{project}/flow-record/custom-flow.json`:
```json
[
  { "url": "/", "wait": 2000, "caption": "Welcome" },
  { "url": "/features", "wait": 1500, "scroll": "bottom" },
  { "url": "/pricing", "wait": 1500, "caption": "Pricing" }
]
```

## Integration with CodeRailFlow

If your project uses CodeRailFlow (flow.coderail.dev), existing flows can be recorded:

```bash
# Record a CodeRailFlow flow definition
/flow-record https://myapp.com --coderail-flow flow-id-123

# Use CodeRailFlow's element mapper for precise interactions
/flow-record https://myapp.com dashboard --use-elements
```

The agent will fetch the flow definition from CodeRailFlow's API and replay it with video recording enabled.

## In Pipes

```bash
# Build feature, then record demo
/pipe go >> flow-record http://localhost:3000 tour >> publish youtube

# Record before and after
/pipe flow-record https://staging.app.com tour >> deploy >> flow-record https://app.com tour

# Full launch: test, record, publish
/pipe browser-test http://localhost:3000 >> flow-record http://localhost:3000 tour >> ship
```

## Tips

- Use `tour` for Product Hunt / investor demos
- Use `landing` for marketing asset screenshots
- Use `auth` to verify OAuth buttons look right
- Videos are 1280x720 (standard HD) — good for embedding
- Screenshots work as social media cards (OG images)
