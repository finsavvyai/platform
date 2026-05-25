---
name: ll-heygen
displayName: Luna HeyGen Transform
description: Transform any webapp into HeyGen-style professional dark UI — design tokens, components, layouts, flows, and AI avatar video generation
version: 2.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: url
    type: string
    description: Target webapp URL or local path to transform
    required: true
    prompt: true
  - name: mode
    type: string
    description: "Mode: transform (apply design system), video (generate demo video), full (both)"
    required: false
    default: full
  - name: avatar
    type: string
    description: "HeyGen avatar ID for video (or 'default')"
    required: false
    default: default
mcp_servers:
  - playwright
  - zai-mcp-server
prerequisites: []
---

# Luna HeyGen Transform

Transform any webapp into the HeyGen-style professional dark UI design system, then generate an AI avatar product video. Uses the exact design tokens, components, and patterns from the HeyGen/Pushci transformation guide.

## What This Command Does

### Transform Mode
Analyzes the target webapp and generates a complete redesign using the HeyGen dark UI pattern:

1. **Audit** — Screenshots the current webapp, identifies all pages and components
2. **Map** — Maps existing elements to the HeyGen design system equivalents
3. **Generate** — Produces a transformation guide specific to that webapp:
   - CSS variables (design tokens) mapped to the app's brand color
   - Component-by-component transformation specs
   - Page layout restructuring (sidebar + content pattern)
   - Navigation redesign
   - Typography scale application
   - Motion/transition specs
4. **Apply** — Generates the actual CSS/component code to transform the app
5. **Output** — Full transformation guide as an interactive HTML page (like the reference)

### Video Mode
Captures the transformed (or existing) webapp and produces a HeyGen AI avatar video.

### Full Mode (default)
Does both: transform the design, then record the demo video.

## Design System Applied

### Core Design Tokens
```css
:root {
  /* Backgrounds (3-level depth) */
  --bg-root:    #0d0d0d;   /* body */
  --bg-surface: #141414;   /* sidebar, cards */
  --bg-raised:  #1a1a1a;   /* inputs, hover */
  --bg-hover:   #222222;   /* active state */

  /* Borders */
  --border:     #2a2a2a;   /* subtle divider */
  --border-em:  #333333;   /* emphasized */

  /* Text */
  --text-1:     #f0f0f0;   /* headings */
  --text-2:     #a0a0a0;   /* body */
  --text-3:     #666666;   /* meta */

  /* Brand Accent (adapted per app) */
  --accent:     #7c5cfc;
  --accent-dark:#6b4ef0;
  --accent-glow:rgba(124,92,252,0.15);

  /* Semantic */
  --success: #22c55e;
  --info:    #3b82f6;
  --warning: #f97316;
  --danger:  #ef4444;

  /* Radius Scale */
  --r-sm: 6px;  --r-md: 10px;  --r-lg: 14px;  --r-xl: 20px;

  /* Layout */
  --sidebar-w: 220px;
  --content-p: 28px 32px;

  /* Transitions */
  --t-fast:   all 0.15s ease;
  --t-spring: all 0.2s cubic-bezier(0.34, 1.3, 0.7, 1);

  /* Typography */
  --font-ui:  'SF Pro Display', system-ui, sans-serif;
  --font-mono:'SF Mono', 'Fira Code', monospace;
}
```

### Layout Pattern
- **App shell**: 2-column flex (fixed sidebar + scrollable main)
- **Sidebar**: 220px wide, `--bg-surface`, border-right
- **Content**: max-width 1100px, padding 28px 32px
- **Cards**: `--bg-surface`, 1px border, radius 14px, padding 18px
- **Grids**: auto-fill minmax(200px, 1fr), 14px gap

### Typography Scale
| Role | Size | Weight | Color |
|------|------|--------|-------|
| Page title | 22px | 600 | --text-1 |
| Section heading | 18px | 600 | --text-1 |
| Card title | 14px | 600 | --text-1 |
| Body / nav | 13.5px | 400 | --text-2 |
| Label | 12px | 600 | contextual |
| Caption | 11px | 400 | --text-3 |
| Divider label | 10px | 600 | uppercase tracking .1em |

### Component Patterns
- **Buttons**: Primary (accent bg), Secondary (raised bg + border), Ghost (transparent + border)
- **Inputs**: raised bg, border-em, 9px 12px padding, focus = accent border + glow
- **Cards**: surface bg, border, r-lg, hover = border-em + translateY(-1px)
- **Pills/Tabs**: border bottom 2px, active = accent color + border
- **Badges**: tinted bg (15% opacity) + semantic color text
- **Nav items**: 8px padding, r-sm radius, icon 16px + 10px gap

### Motion
- Hover: translateY(-1px) on cards, scale(0.97) on button press
- Focus: 3px box-shadow with accent-glow
- Page transitions: fade 0.2s or slide 0.3s
- Spring easing: cubic-bezier(0.34, 1.3, 0.7, 1) for interactive elements

## Usage

```bash
# Transform + video
/heygen https://myapp.com

# Just apply the design system
/heygen https://myapp.com transform

# Just generate video
/heygen https://myapp.com video

# Transform a local project
/heygen http://localhost:3000 transform

# With specific accent color (adapt the purple to your brand)
/heygen https://myapp.com --accent "#3b82f6"
```

## Output

```
.luna/{project}/heygen/
  transformation-guide.html   # Interactive guide (like the reference)
  design-tokens.css           # Ready-to-paste CSS variables
  components.css              # Component styles
  layout.css                  # App shell + grid styles
  page-specs/                 # Per-page transformation specs
    home.md
    dashboard.md
    settings.md
    ...
  screenshots/                # Before/after captures
    before/
    after/
  video/                      # HeyGen video assets
    video.mp4
    voice/
    flow.json
  checklist.md                # Transformation progress checklist
```

## How It Adapts Per App

The agent doesn't blindly copy HeyGen's UI. It:

1. **Detects the app's primary color** and maps it to `--accent`
2. **Identifies the navigation pattern** and restructures to sidebar layout
3. **Maps existing components** to the design system equivalents
4. **Preserves content and functionality** — only changes visual presentation
5. **Generates the transformation guide** as an interactive HTML page matching the reference format, but with the target app's specific pages, flows, and components

## Reference
The full design specification is at: `html/heygen-pushci-guide.html`

## In Pipes

```bash
# Transform then audit
/pipe heygen https://myapp.com transform >> site-audit https://myapp.com

# Full product launch
/pipe heygen https://myapp.com full >> browser-test https://myapp.com >> ship

# Transform, test, fix loop
/pipe heygen https://myapp.com transform >> browser-test >> fix >> heal
```
