---
name: ll-tokens
displayName: Luna Design Tokens
description: Multi-brand design token engine — Style Dictionary v4 source of truth that emits CSS vars, Tailwind config, Figma Variables, iOS/Android tokens, with light/dark/contrast variants.
version: 1.0.0
category: design
agent: luna-tokens
parameters:
  - name: action
    type: string
    description: "init | add-brand | sync-figma | export"
    required: false
    default: "init"
  - name: brand
    type: string
    description: Brand name (e.g., default, dark, halloween, enterprise)
    required: false
  - name: targets
    type: string
    description: "css | tw | figma | ios | android | all"
    required: false
    default: "all"
workflow:
  - scaffold_style_dictionary
  - generate_token_schema
  - emit_css_variables
  - generate_tailwind_preset
  - sync_figma_variables_api
  - emit_native_tokens
  - generate_storybook_token_grid
output:
  - tokens/
  - .luna/{current-project}/tokens-report.md
prerequisites: []
---

# Luna Tokens — Multi-Brand Design Token Engine

Stops the chaos of color hex codes scattered across components, Figma, and native. One source. Many targets. Light/dark/contrast variants per brand.

## Why a Token Engine

Without one:
- Colors drift between Figma and code
- Dark mode is hand-rolled per component
- Brand themes are forks of the codebase
- High-contrast accessibility variant doesn't exist
- Native (iOS/Android) re-implements everything

With this command: one `tokens/` directory drives every platform.

## Architecture

```
tokens/
├── source/                       # source of truth (W3C DTCG-style)
│   ├── core.json                 # primitives — color scales, spacing scale, type ramp
│   ├── alias.json                # semantic — bg, fg, accent, muted (no values)
│   ├── brand.default.json        # brand mapping primitives → semantic
│   ├── brand.dark.json
│   ├── brand.contrast.json
│   └── brand.{custom}.json       # any number
├── transforms/                   # custom Style Dictionary transforms
│   └── *.js
├── platforms/                    # output by target
│   ├── css/
│   │   ├── tokens.default.css
│   │   ├── tokens.dark.css
│   │   └── tokens.contrast.css
│   ├── tailwind/preset.cjs
│   ├── figma/variables.json
│   ├── ios/Tokens.swift
│   └── android/tokens.xml
├── style-dictionary.config.cjs
└── package.json (sub-package)
```

## Token Layers

**Core (primitives)** — no semantic meaning, never used in components directly:

```json
{
  "color": {
    "neutral": { "0": "#FFFFFF", "100": "#F4F4F5", "900": "#0A0A0A" },
    "blue":    { "500": "#0A84FF", "600": "#0078E0" }
  },
  "size": { "1": "4px", "2": "8px", "4": "16px" }
}
```

**Alias (semantic)** — what components reference:

```json
{
  "color": {
    "background":   { "value": "{color.neutral.0}" },
    "foreground":   { "value": "{color.neutral.900}" },
    "accent":       { "value": "{color.blue.500}" }
  }
}
```

**Brand** — overrides aliases per brand: `{ "color": { "accent": { "value": "{color.brand.coral.500}" } } }`

## Modes
`init` scaffold • `add-brand <name>` (dark/contrast/custom) • `sync-figma` push/pull Figma Variables • `export` emit all platforms.

## Targets

| Target | Output |
|--------|--------|
| `css` | `tokens.{brand}.css` with `--color-background:` etc. |
| `tw` | Tailwind preset config consuming CSS vars |
| `figma` | Variables JSON via REST API or Figma plugin |
| `ios` | `Tokens.swift` static let constants |
| `android` | `tokens.xml` resources |
| `all` | Everything |

## Tailwind Integration

Generated preset:

```js
// tokens/platforms/tailwind/preset.cjs
module.exports = {
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        accent:     'rgb(var(--color-accent) / <alpha-value>)',
      },
      spacing: { /* … */ },
      borderRadius: { /* … */ },
    },
  },
};
```

Use in `tailwind.config.js`:

```js
module.exports = { presets: [require('./tokens/platforms/tailwind/preset.cjs')] };
```

## Figma Sync

Two-way:
- **Push**: write `tokens/source/*.json` → Figma Variables via REST API. Requires Figma file ID + access token.
- **Pull**: fetch Figma Variables → diff against source → propose patch.

## Brand Switching at Runtime

```html
<html data-brand="dark"> ...
```

```css
@import './tokens/platforms/css/tokens.default.css';
@import './tokens/platforms/css/tokens.dark.css';
@import './tokens/platforms/css/tokens.contrast.css';
```

Each brand file scopes vars under `[data-brand="..."]`. Brand switches with single attribute change. Combinations (dark + contrast) supported via attribute composition.

## Usage

```
/ll-tokens                                  # init default brand
/ll-tokens --action add-brand dark
/ll-tokens --action add-brand contrast
/ll-tokens --action sync-figma              # push to Figma Variables
/ll-tokens --action export --targets all    # rebuild all platforms
```

## Output

- `tokens/` directory
- `.luna/{project}/tokens-report.md` — token count, platforms emitted, drift report (Figma vs source)

## Storybook
If detected, generates `tokens/__stories__/Tokens.stories.tsx` with swatches, spacing scale, and type ramp grid.

## Rules
Aliases ref `{core.X}` only • no hex in components (use `rgb(var(--color-…) / <alpha>)`) • contrast brand passes WCAG AAA • default passes AA • tokens are pure data • semver bump on any change.

## In Pipes

```bash
/pipe ll-tokens init >> ll-boutique --aesthetic editorial
/pipe ll-tokens add-brand dark >> ll-tokens sync-figma >> ship
/pipe ll-tokens export >> hig
```
