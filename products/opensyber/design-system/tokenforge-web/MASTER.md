# TokenForge Web — Design System Master

> **LOGIC:** When building a specific page, first check `design-system/tokenforge-web/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, follow the rules below.

**Project:** TokenForge Web (`apps/tokenforge-web`)
**Category:** Auth/Identity SDK — developer console + marketing
**Brand:** Inherits OpenSyber Control Room with developer-tool emphasis
**Source of truth for tokens:** `docs/opensyber-brand.html`
**Status:** Migration spec — apply tokens during dashboard rebuild
**Generated:** 2026-05-06

---

## Vision

Auth0 / Stytch / Clerk killer for security-conscious developers. Device-bound sessions (ECDSA P-256 non-extractable keys). Console feel like Stripe + Linear: dark, fast, dense, copy-paste code samples everywhere.

---

## Color Tokens

Same dark palette as OpenSyber Web (single brand across portfolio). Reference `design-system/opensyber-web/MASTER.md` for the full tokens — do not redefine.

**Differentiators for TokenForge surface:**

- Lean harder on `--info` `#4D9EFF` for "Active session" indicators
- `--ok` `#2ECC7B` for "Device verified" badges
- Code blocks: `--surface` background `#141B24`, syntax tokens use signal/info/warn/ok

---

## Typography

Same triplet (Bebas Neue / Space Mono / DM Sans) **but** Space Mono usage is heavier here because this is a developer product:

- Code samples: Space Mono, syntax-highlighted
- API endpoints in headers: Space Mono
- Token strings in UI: Space Mono with copy-button affordance
- Headlines: Bebas Neue (only on marketing pages — internal console uses Space Mono headers)

---

## Page Pattern: Developer Console + Docs Hybrid

(Overrides skill output of "Minimal Single Column" — wrong for SDK product.)

### Layout — Console (post-login)

```
┌──────────────────────────────────────────────────┐
│ NAV (logo + project switcher + user menu)       │
├────────┬─────────────────────────────────────────┤
│        │ Tabs: Overview | Sessions | Devices |   │
│ SIDE   │       Webhooks | Keys | Logs            │
│ NAV    ├─────────────────────────────────────────┤
│ +      │  Page content                           │
│ ENV    │  - Quick install (code block)           │
│ SWITCH │  - Live metrics (4 tiles)               │
│        │  - Recent sessions table                │
└────────┴─────────────────────────────────────────┘
```

### Layout — Marketing (logged out)

Single-column hero + benefit grid + code-sample showcase + pricing + footer. Container `max-w-1100px`, `--void` background, page-grid behind hero only.

---

## Component Specs

### Code block (critical — primary UI element here)

```css
.code-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 16px 20px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  position: relative;
}
.code-block .copy-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  /* Space Mono, uppercase, on hover background var(--signal) */
}
.code-block .lang-tag {
  position: absolute;
  top: 0; left: 16px;
  transform: translateY(-50%);
  background: var(--void);
  padding: 0 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-secondary);
}
```

### Environment switcher (live/test)

- Two-state pill: TEST (warn yellow) | LIVE (signal teal)
- Persists across navigation via cookie
- Visible in nav at all times — TokenForge users must always know which env they're touching

### Token / API key display

```css
.token-display {
  font-family: var(--font-mono);
  background: var(--void);
  border: 1px solid var(--border);
  padding: 8px 12px;
  border-radius: 3px;
  letter-spacing: 0.02em;
}
/* Mask by default, reveal on click */
```

### SDK install tabs

Tabs across top: **JS / TS / Go / Python / Swift / Kotlin / RN**. Persist last selection in localStorage. Each tab shows a Space Mono code block with copy button.

### Session row (sessions table)

Each row: device-name + browser + IP + bound-key fingerprint (last 8 chars of SHA-256 in Space Mono) + status badge + age.

---

## Marketing-page Specifics

(For logged-out pages: `/`, `/pricing`, `/docs`)

- Hero: Bebas Neue 80px headline, DM Sans 18px subhead, single primary CTA "Get an API key"
- Code-sample showcase: tabs for languages, live-rendered Space Mono blocks
- Trust signals: SOC 2 Type II badge, customer logos in `--text-muted` (not full color)
- No carousels, no parallax — Linear-style fast static page

---

## Anti-Patterns

All OpenSyber-web anti-patterns apply, plus:

- "Vibrant & Block-based" style with random green CTAs (skill suggested this — wrong, breaks portfolio brand)
- Pill-rounded buttons (`border-radius: 9999px`) — TokenForge is technical, not consumer
- Animated gradient backgrounds (Stripe doesn't do them anymore for a reason)
- Marketing copy on console pages
- Generic JetBrains Mono everywhere (use Space Mono — brand consistency across portfolio)

---

## Pre-Delivery Checklist

Same as OpenSyber Web, plus:

- [ ] Environment indicator (TEST/LIVE) visible on every console page
- [ ] All API tokens displayed in Space Mono with copy button
- [ ] Code samples available in at least 3 languages on landing
- [ ] No real customer tokens / IDs in screenshots or copy
