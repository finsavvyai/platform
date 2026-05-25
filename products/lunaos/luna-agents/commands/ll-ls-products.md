---
name: ll-ls-products
displayName: Luna LemonSqueezy Products
description: Scan project and generate an HTML page with LemonSqueezy product definitions — descriptions, pricing tiers, features, and AI image prompts for hero, icon, social card, thumbnail, and variant cards
version: 2.0.0
category: monetization
parameters:
  - name: output_path
    type: string
    description: Where to save the HTML file
    required: false
    prompt: false
workflow:
  - analyze_project
  - define_products_and_tiers
  - generate_image_prompts
  - write_html_file
output:
  - scripts/ls-product-descriptions.html (or custom path)
prerequisites: []
---

# Luna LemonSqueezy Product Page Generator

Scan the current project, define products with pricing tiers, generate AI image prompts, and **write a complete HTML file** where every field is click-to-copy — ready to paste into LemonSqueezy.

## Step 1 — Analyze the Project

Read these files in the current project:

- `package.json` — name, description
- `README.md` — features, tagline, value prop
- `CLAUDE.md` — mission, target user, architecture
- Marketing / landing pages — hero copy, feature lists, brand colors
- Any existing pricing, billing config, or plan definitions
- Source structure — to identify capabilities worth gating by tier

Extract:
- **Product name** and short tagline
- **Selling description** (2-3 sentences)
- **Target segments**: solo dev, pro user, team, enterprise
- **Feature list** ranked by customer value
- **Gating dimensions**: API calls, seats, instances, storage, retention, support SLA
- **Brand accent color** (default violet #8b5cf6 if not found)

## Step 2 — Define Products and Tiers

For each product, create 2-4 pricing tiers:

| Field | Content |
|-------|---------|
| Variant Name | `{Product} {Tier}` e.g. "MyApp Pro" |
| Price | Monthly USD integer e.g. `29` |
| Description | 2-3 sentences: what's included, limits, support |
| Features | 6-10 checkmark bullets |

Pricing rules:
- 3 tiers is ideal, 2-4 acceptable
- ~3-4x price jump between tiers
- Middle tier marked "Most Popular"
- Each tier unlocks meaningful new capabilities

## Step 3 — Generate AI Image Prompts

Generate **6 prompts total**: 4 product-level + 1 per variant tier.

Every prompt uses the same layout: **left third = visual icon/mark, right two-thirds = product name + value prop + feature details** with clear typography hierarchy.

### Product-Level Prompts (4)

**Hero (1270x760)**
Left third: product icon/symbol with accent glow.
Right two-thirds: "[Product Name]" headline in large white bold, tagline in gray below, 3 small icon-label feature pairs in accent color, "Start Free" pill CTA at bottom right. Black bg (#0a0a0f). Apple-quality.

**App Icon (1024x1024)**
Upper half: product icon/symbol centered with accent glow.
Lower half: "[Product Name]" in white bold, thin accent line separating icon from text.
Black bg, rounded corners. Works at 32px. SF Symbol simplicity.

**Open Graph (1200x630)**
Left third: product icon/symbol with light beam fanning right, illuminating faint holographic UI outlines.
Right two-thirds: "[Product Name]" headline, tagline in gray, feature labels in accent.
Grid at 3% opacity. Cinematic, premium.

**LS Thumbnail (800x400)**
Left third: product icon/symbol with accent glow.
Right two-thirds: "[Product Name]" headline, tagline, feature labels.
Clean, Apple-inspired spacing.

### Variant Tier Prompts (1 per tier, 800x400)

Left third: tier-scaled icon (single for personal, with orbital ring for pro, 3 in triangle for team/enterprise). Accent glow.
Right two-thirds: small accent label "[Tier]" (+ "Most Popular" badge if middle), large "$X/mo" headline in white bold, primary limit in gray, feature details in dimmer gray.

## Step 4 — Write the HTML File

Write a single self-contained HTML file to output path (default: `scripts/ls-product-descriptions.html`). Create dirs if needed.

### Structure

```
body > .container
  h1 "[Product] — LemonSqueezy Product Setup"
  p.subtitle with link to app.lemonsqueezy.com/products/new
  .instructions (how-to-use steps)
  .product
    .product-header (h2 name + badge)
    .variant "Product Setup"
      .field: Product Name (click-to-copy)
      .field: Product Description (click-to-copy)
      .ai-prompt-label + .ai-prompt: Hero Image (click-to-copy)
      .ai-prompt-label + .ai-prompt: App Icon (click-to-copy)
      .ai-prompt-label + .ai-prompt: Open Graph (click-to-copy)
      .ai-prompt-label + .ai-prompt: LS Thumbnail (click-to-copy)
    .variant (repeat per tier)
      .field: Variant Name (click-to-copy)
      .field: Price (click-to-copy) + "USD, Monthly" hint
      .field: Variant Description (click-to-copy)
      ul.features-list (checkmark items)
      .ai-prompt-label + .ai-prompt: Variant card (click-to-copy)
  script: copyThis()
```

### Styling

```css
body        — #0a0a0a bg, #e5e5e5 text, system font, 40px padding
.container  — max-width 900px, centered
.product    — #222 border, 12px radius
.product-header — #141414 bg, #222 border-bottom
.field-value    — #111 bg, #222 border, hover #444
.field-value.copied — #00E5C3 border + "Copied!" top-right label
.variant-price  — #00E5C3 teal
.ai-prompt      — #0d1117 bg, #1a2332 border, monospace font
.ai-prompt.copied — #00E5C3 border + "Copied!" label
.ai-prompt-label — uppercase, small, #666 text, above prompt
.features-list li::before — "✓ " in #2ECC7B
```

### JavaScript

```javascript
function copyThis(el) {
  navigator.clipboard.writeText(el.innerText).then(() => {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 1500);
  });
}
```

Every `.field-value` and `.ai-prompt` has `onclick="copyThis(this)"`.

## After Generation

Tell the user:
1. Open the HTML file in a browser
2. Go to [app.lemonsqueezy.com/products/new](https://app.lemonsqueezy.com/products/new)
3. Click any field to copy, paste into the LS form
4. Create product first with name + description, then add variant tiers
5. Use the AI image prompts to generate product images in any AI image tool
