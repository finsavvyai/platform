---
name: ll-figma
displayName: Luna Figma → Code
description: Pull Figma designs and generate pixel-perfect responsive components with your stack, design tokens, and HIG compliance
version: 1.0.0
category: design
agent: luna-design-architect
parameters:
  - name: source
    type: string
    description: Figma URL, frame ID, or "sync" to pull all changed frames
    required: true
    prompt: true
  - name: framework
    type: string
    description: "Target: react (default), vue, svelte, react-native, swift-ui"
    required: false
    default: react
mcp_servers:
  - zai-mcp-server
  - image-compare
  - accessibility-scanner
  - playwright
  - fetch
---

# /figma — Design to Production Code

Pull any Figma frame and generate production-ready components. Not just markup — full responsive behavior, animations, accessibility, dark mode, and design tokens extracted.

## Pipeline

```
/figma https://figma.com/file/xxx/Frame-Name
              │
              ▼
      EXTRACT from Figma
      ├── Layout tree (auto-layout → flexbox/grid)
      ├── Design tokens (colors, fonts, spacing, radii)
      ├── Component variants (hover, active, disabled)
      ├── Responsive breakpoints (if defined)
      ├── Icons and assets (SVG export)
      └── Prototype interactions (click, hover, scroll)
              │
              ▼
      GENERATE code
      ├── React/Vue/Svelte components
      ├── Tailwind utility classes (or CSS modules)
      ├── TypeScript interfaces for props
      ├── Storybook stories for each variant
      ├── Responsive behavior (mobile → desktop)
      ├── Dark mode variant
      ├── Animation/transition CSS
      └── ARIA labels and keyboard navigation
              │
              ▼
      VERIFY
      ├── Render component in browser (playwright)
      ├── Screenshot at 4 viewports
      ├── Visual diff against Figma frame (image-compare)
      ├── Accessibility scan (a11y MCP)
      ├── Report: pixel accuracy score
      └── If accuracy < 95% → auto-fix → re-verify
```

## Usage

```bash
/figma https://figma.com/file/abc/design?node-id=123  # Single frame
/figma sync                                             # Pull all changed frames
/figma https://figma.com/file/abc --framework vue       # Generate Vue components
/figma https://figma.com/file/abc --framework react-native  # Mobile components
/figma https://figma.com/file/abc --framework swift-ui  # iOS native
```

## In Pipes

```bash
/pipe figma sync >> hig >> browser-test >> pr
/pipe figma https://... >> morph to "react-native" >> test >> launch staging
/pipe brand >> figma sync >> visual-diff >> assert "95% accuracy" >> ship
```
