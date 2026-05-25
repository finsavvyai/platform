---
name: luna-ls-products
description: Scan a project and generate a complete HTML page for LemonSqueezy product creation — product descriptions, pricing tiers, features, and AI image prompts for hero, icon, social card, thumbnail, and variant cards — all click-to-copy
homepage: https://agents.lunaos.ai
---

# Luna LemonSqueezy Product Page Generator

Analyze the current project and **write a complete self-contained HTML file** with everything needed to create products in LemonSqueezy. Every text field and AI image prompt is click-to-copy.

## Step 1 — Analyze the Project

Read these files to understand the product:

- `package.json` — name, description, keywords
- `README.md` — features, value proposition, tagline
- `CLAUDE.md` — mission, target user, architecture
- Marketing/landing pages — hero text, feature lists, brand colors
- Existing pricing, billing config, or plan definitions
- Source structure — to assess capabilities and tier-worthy limits

Extract:
- Product name and one-line tagline
- Longer selling description (2-3 sentences)
- Target audience segments (solo dev, team, enterprise)
- Core features ranked by customer value
- Technical limits suitable for tier gating (API calls, seats, instances, storage, retention, support SLA)
- Brand accent color (default to violet #8b5cf6 if none found)

## Step 2 — Define Products and Tiers

Create 2-4 pricing tiers per product. For each tier define:

| Field | Content |
|-------|---------|
| Variant Name | `{Product} {Tier}` e.g. "MyApp Pro" |
| Price | Monthly USD integer e.g. `29` |
| Description | 2-3 sentences: what's included, limits, support |
| Features | 6-10 bullet points |

Pricing rules:
- 3 tiers is ideal, 2-4 acceptable
- ~3-4x price jump between tiers
- Middle tier marked "Most Popular"
- Each tier unlocks meaningful new capabilities

## Step 3 — Generate AI Image Prompts

Generate **6 image prompts** total — 4 at the product level and 1 per variant tier.

Every prompt follows this layout: **left third = visual icon/mark, right two-thirds = text with typography hierarchy** (headline, subtitle, detail row).

### Product-Level Prompts

**Hero Image (1270x760 — Product Hunt)**
```
Wide dark hero banner, 1270x760px. Black background (#0a0a0f).
Left third: [product icon/symbol relevant to what it does].
Soft diffused [accent color] glow behind.
Right two-thirds: large bold white sans-serif text "[Product Name]" as headline.
Below in smaller neutral gray: "[one-line tagline]".
Below that, 3 small icon-label pairs in a horizontal row in [accent] outline:
  [feature 1 icon] "[label]", [feature 2 icon] "[label]", [feature 3 icon] "[label]".
Bottom right: subtle pill button with [accent] border: "Start Free".
Calm, premium, welcoming. Apple-quality aesthetic. Clean typography hierarchy.
```

**App Icon (1024x1024)**
```
App icon, 1024x1024px square with rounded corners. Black background (#0a0a0f).
Upper half: [product icon/symbol] centered, with soft [accent color] ambient glow.
Lower half: bold white sans-serif text "[Product Name]" centered below,
  thin [accent] line separating icon from text.
Clean, balanced. Apple SF Symbol simplicity. Works at 32px favicon size.
```

**Open Graph / Social Card (1200x630)**
```
Social card, 1200x630px. Black background (#0a0a0f).
Left third: [product icon/symbol] with soft forward-facing light beam in [accent].
Light beam illuminates faint holographic outlines of [relevant UI elements] on right.
Right two-thirds: large bold white text "[Product Name]" as headline.
Below in neutral gray: "[tagline]".
Below that: "[feature] · [feature] · [feature] · [feature]" in [accent] text.
Faint grid at 3% opacity. Cinematic, premium typography.
```

**LemonSqueezy Thumbnail (800x400)**
```
Product card, 800x400px. Black background (#0a0a0f).
Left third: [product icon/symbol] with soft [accent] glow.
Right two-thirds: large white bold text "[Product Name]" as headline.
Below in neutral gray: "[tagline]".
Below that: "[feature] · [feature] · [feature] · [feature]" in [accent] text.
Clean, premium, Apple-inspired spacing.
```

### Variant/Tier Prompts (800x400 each)

```
SaaS subscription card, 800x400px. Black background (#0a0a0f).
Left third: [tier-appropriate icon variant — e.g. single symbol for personal,
  symbol with orbital ring for pro, 3 symbols in triangle for team].
Soft [accent] glow.
Right two-thirds: small [accent] label "[Tier]" at top [+ "Most Popular" badge if middle tier].
Large white bold text "$X/mo" as headline.
Below in neutral gray: "[primary limit] · [key differentiator]".
Below that, smaller dimmer gray: "[feature] · [feature] · [feature] · [feature]".
Clean typography hierarchy, Apple-inspired spacing. Premium, welcoming.
```

## Step 4 — Write the HTML File

Write a single self-contained HTML file. Default path: `scripts/ls-product-descriptions.html`.

### Structure

```
body > .container
  h1 "[Product Name] — LemonSqueezy Product Setup"
  p.subtitle "Click any field to copy..."
  .instructions (how-to-use numbered steps)
  .product
    .product-header (h2 name + badge)
    .variant "Product Setup"
      .field: Product Name (click-to-copy)
      .field: Product Description (click-to-copy)
      .ai-prompt: Hero Image prompt (click-to-copy)
      .ai-prompt: App Icon prompt (click-to-copy)
      .ai-prompt: Open Graph prompt (click-to-copy)
      .ai-prompt: LS Thumbnail prompt (click-to-copy)
    .variant (repeat per tier)
      .field: Variant Name (click-to-copy)
      .field: Price (click-to-copy) + "USD, Monthly" hint
      .field: Variant Description (click-to-copy)
      ul.features-list (checkmark items)
      .ai-prompt: Variant card prompt (click-to-copy)
  .product "Webhook Configuration" (separate card with blue border)
    .variant "LemonSqueezy Webhook"
      .field: Webhook URL (click-to-copy) — https://{api-domain}/billing/webhook
      .field: Signing Secret — instructions to generate + wrangler command
      .field: Events to subscribe (checkmark list):
        - subscription_created
        - subscription_updated
        - subscription_cancelled
        - subscription_expired
        - subscription_payment_failed
        - subscription_payment_success
    .variant "Cloudflare Secrets" (all click-to-copy wrangler commands)
      .field: wrangler secret put LEMONSQUEEZY_API_KEY
      .field: wrangler secret put LEMONSQUEEZY_STORE_ID
      .field: wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
      .field: wrangler secret put LEMONSQUEEZY_VARIANT_{TIER} (per tier)
      .field: DB migration command if applicable
      .field: Health check curl command
  script: copyThis()
```

### Styling

- `#0a0a0a` bg, `#e5e5e5` text, system font stack, 40px padding
- Max width 900px, centered
- `.product` cards: `#222` border, 12px radius, `#141414` header bg
- `.field-value`: `#111` bg, `#222` border, hover `#444`
- `.field-value.copied`: `#00E5C3` border + "Copied!" label
- `.ai-prompt`: `#0d1117` bg, `#1a2332` border, monospace font
- `.features-list li::before`: checkmark in `#2ECC7B`
- Prices in `#00E5C3` teal

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

## When to use

- User says "generate LemonSqueezy products", "ls products", "product page"
- User is setting up billing/monetization for a project
- User needs product descriptions, pricing tiers, or image prompts

## When NOT to use

- Integrating LemonSqueezy SDK into code
- Writing webhook handlers or API integration code
