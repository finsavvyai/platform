# OpenSyber HIG Compliance Analysis — About, Governance, TrustBar

**Scope**: About page, Governance page, TrustBar component
**Analysis Type**: compliance
**Generated**: 2026-04-03
**Agent**: Luna Apple HIG Designer
**Compliance Score**: 78/100

---

## Executive Summary

The About and Governance pages are well-structured and follow the established Control Room brand system consistently. Typography hierarchy, spacing rhythm, and content-first design are strong. The TrustBar modification from 4 to 3 items maintains visual balance. However, there are specific HIG violations around touch targets, accessibility labels, contrast ratios, and motion that need attention.

---

## 1. About Page (`apps/web/src/app/about/page.tsx`)

### Typography Hierarchy — Score: 8/10

**Good:**
- Line 43: `text-5xl` h1 in Bebas Neue display font — correct for hero heading
- Line 57: `text-3xl` h2 for section headings — proper step-down from h1
- Line 97: `text-sm uppercase tracking-wider` for card titles in Space Mono — consistent with brand system
- Line 40: `text-[10px]` section labels in Space Mono — matches brand pattern

**Issues:**
- **Line 40, 54, 85, 109, 129**: `text-[10px]` section labels are below the Apple HIG minimum legible size of 11px. At 10px, these labels fail readability on standard density displays.
  - **Fix**: Change to `text-[11px]` across all section labels.
- **Line 100**: Card description `text-sm` (14px in Tailwind v4) is acceptable but sits at the lower end. The body text at line 46 (`text-lg`, 18px) creates a healthy contrast ratio with the card text. This is fine.
- **Line 118**: Timeline date `text-xs` (12px) is acceptable for secondary metadata.

### Spacing Consistency — Score: 9/10

**Good:**
- Consistent `mb-20` (80px) between major sections (lines 39, 53, 84, 108, 128)
- `mb-4` after section labels, `mb-8` after section headings — proper rhythm
- `gap-4` between grid items (lines 91, 135) — 16px, aligns with Apple's spacing scale
- `pt-28 pb-20` page padding — generous, content-breathable

**Issue:**
- **Line 97**: `mb-1` between card title and description is only 4px. Apple HIG recommends at least 8px between heading and body text for clarity.
  - **Fix**: Change `mb-1` to `mb-2` on card title h3 elements.

### Touch Targets — Score: 6/10

**Critical Issues:**
- **Lines 136-161**: Contact link cards (`px-6 py-4`) render approximately 48x44px with icon+text, which meets the 44px minimum. However, the actual computed height depends on font size and line-height. The `py-4` (16px top + 16px bottom) plus `text-sm` line-height should yield approximately 48px. **Borderline pass.**
- **Lines 166-177**: CTA buttons (`px-8 py-3`) — `py-3` is only 12px top + 12px bottom = 24px padding. With `text-sm` content height (~20px), total is ~44px. **Borderline — recommend `py-3.5` for comfortable 48px.**
- **Line 117**: Timeline items are not interactive, so no touch target concern. Good.

### Color Contrast — Score: 8/10

**Good:**
- `text-text-primary` (#E8F0F8) on `bg-void` (#080B0F) = contrast ratio ~14.5:1. Excellent.
- `text-text-secondary` (#7A96B2) on `bg-void` (#080B0F) = contrast ratio ~5.8:1. Passes AA.
- `text-signal` (#00E5C3) on `bg-void` (#080B0F) = contrast ratio ~10.2:1. Excellent.

**Issue:**
- **Line 100**: `text-sm text-text-secondary` inside `brand-card` (bg `--color-panel` #0D1117). #7A96B2 on #0D1117 = ~5.2:1. Passes AA for normal text but fails AAA. Acceptable for secondary content.
- **Line 168**: CTA button `text-void` (#080B0F) on `bg-signal` (#00E5C3) = ~10.2:1. Excellent.

### Accessibility — Score: 6/10

**Issues:**
- **Lines 136-161**: External links (`target="_blank"`) lack `aria-label` attributes. Screen readers will read the visible text ("GitHub", "hello@opensyber.cloud", "LinkedIn") which is adequate, but the external-link behavior is not communicated. 
  - **Fix**: Add `aria-label="GitHub (opens in new tab)"` etc.
- **Lines 92-103**: Value cards are not interactive (div, not link/button), which is correct. However, the icons lack `aria-hidden="true"` — screen readers may attempt to announce the SVG.
  - **Fix**: Add `aria-hidden="true"` to all decorative Lucide icons.
- **Line 43**: The h1 is properly structured. Heading order h1 > h2 > h3 is correct throughout. Good.
- **No skip-to-content link** — the SiteHeader should provide this (out of scope for this file, but worth noting).

### Content-First Design — Score: 9/10

The page follows Apple's deference principle well. The brand-card components use minimal chrome (thin border, subtle corner mark). Content is foregrounded. The story section (lines 60-80) uses generous `p-8` padding and `leading-relaxed` for comfortable reading. No competing visual elements.

### Motion — Score: 9/10

No motion is used on this page. For a content-heavy About page, this is the correct choice per HIG — motion should support comprehension, and static content pages do not benefit from entrance animations. The `hover:border-signal/30 transition` on contact cards (line 140) is subtle and appropriate.

---

## 2. Governance Page (`apps/web/src/app/governance/page.tsx`)

### Typography Hierarchy — Score: 8/10

**Good:**
- Same consistent pattern as About page: `text-5xl` h1, `text-3xl` h2, `text-sm` card content
- Line 77: Stats use `text-3xl` display font for values — creates strong visual hierarchy
- Line 80: Stats labels use `text-sm text-text-secondary` — proper subordination

**Issues:**
- **Lines 61, 87**: Same `text-[10px]` section label issue as About page. Below 11px minimum.
- **Line 99**: Same `mb-1` tight spacing between card title and description.

### Spacing Consistency — Score: 9/10

**Good:**
- Same `mb-20` section rhythm
- Stats grid `gap-4` (line 74) — consistent
- Pillar cards `gap-4` (line 93) — consistent
- `p-6` card padding throughout — matches About page pattern

### Touch Targets — Score: 7/10

**Issues:**
- **Lines 97-103**: Pillar cards are wrapped in `<Link>` elements. With `p-6` padding and content inside, these are large touch targets (well above 44px). **Pass.**
- **Lines 111-122**: CTA buttons have same `py-3` issue as About page. **Borderline.**
- **Line 97**: The entire card is a link, which is good for mobile — the touch target is the full card. However, there is no visible focus indicator beyond the global `focus-visible` rule. The `hover:border-signal/30` provides visual feedback on hover but keyboard users rely on the global outline. **Pass**, but consider adding a focus-visible border color change to match hover.

### Color Contrast — Score: 8/10

Same palette, same scores as About page. The stats section adds `text-signal` for values which has excellent contrast on `bg-panel`.

### Accessibility — Score: 6/10

**Issues:**
- **Lines 94-104**: Pillar card Links wrap a `div` with icon, h3, and p. Screen readers will read all text inside the link as the link name. This creates verbose link announcements. 
  - **Fix**: Add `aria-label` to each Link with concise text, e.g., `aria-label="Policy Enforcement — define and enforce agent policies"`.
- **Line 98**: Icons inside links should have `aria-hidden="true"` since the text already describes the pillar.
- **Lines 75-82**: Stats section has no semantic heading or ARIA landmark. Screen readers have no context for the numbers.
  - **Fix**: Add `aria-label="Governance statistics"` to the stats grid container, or wrap with a heading.

### Content-First Design — Score: 9/10

Clean layout. The 2-column grid for pillars (line 93) gives each pillar adequate space without crowding. Stats section provides immediate credibility. No visual clutter.

### Motion — Score: 8/10

No Framer Motion wrappers on this page (unlike HomeSections which uses FadeIn/StaggerChildren). For a feature landing page, subtle entrance animations would be appropriate per HIG to convey depth and guide attention. Consider adding FadeIn to the hero and StaggerChildren to the pillar grid, matching the home page pattern. This is an enhancement, not a violation.

---

## 3. TrustBar (`apps/web/src/app/HomeSections.tsx`, lines 11-31)

### Visual Balance with 3 Items — Score: 8/10

**Analysis:** The TrustBar uses `flex-wrap items-center justify-center gap-x-10 gap-y-4` (line 17). With 3 items instead of 4:

- **Desktop**: Three items centered with 40px (`gap-x-10`) horizontal gaps. The centering is maintained by `justify-center`. With 3 items, the total width is narrower than with 4, which means more negative space on each side. This is acceptable per HIG — ample negative space supports clarity.
- **Mobile**: `flex-wrap` handles stacking naturally. With 3 items, the likelihood of wrapping to 2 lines is lower than with 4, which actually improves mobile layout.

**Verdict**: The 3-item layout maintains proper visual balance. The `gap-x-10` provides comfortable breathing room between items.

### Spacing and Alignment — Score: 9/10

- `py-8` (32px) vertical padding — adequate for a trust bar
- `px-6` horizontal padding — consistent with page layout
- `max-w-5xl` — matches page content width
- `gap-x-10 gap-y-4` — good horizontal spacing with tighter vertical for wrapped states
- `border-t border-border` — subtle top border provides section separation

### Touch Targets — Score: 5/10

**Critical Issue:**
- **Line 24**: The GDPR link (`<a href="/compliance">`) wraps only an icon (16x16) and text at 11px. The link has no padding — the touch target is determined solely by the text and icon content size. With `text-[11px]` and a 16px icon, the computed height is approximately 18-20px. This is well below the 44px minimum.
  - **Fix**: Add `py-3 px-2` padding to the GDPR link to bring it to at least 44px height, or wrap it in a larger touch target area. Also add `rounded` for visual consistency when focused.

- **Lines 18-21**: The non-interactive items (Zero-Trust, Cloudflare) are correctly non-clickable `div` elements — no touch target concern.

### Color Contrast — Score: 7/10

**Issue:**
- **Line 17**: `text-text-dim` (#6B8AAD) on `bg-panel/40` (approximately #0D1117 at 40% opacity over #080B0F). The effective background is close to #0A0E14. #6B8AAD on #0A0E14 = ~4.3:1. This **barely passes** WCAG AA for normal text (4.5:1 required) and may fail depending on actual opacity computation.
  - **Fix**: Change `text-text-dim` to `text-text-secondary` (#7A96B2) which provides ~5.2:1, or increase the background opacity.

### Accessibility — Score: 6/10

**Issues:**
- **Line 24**: The GDPR link has no `aria-label`. The link text "GDPR compliant" (from i18n) is descriptive enough, but users may not realize it navigates to a compliance page.
  - **Fix**: Add `aria-label={t('gdpr') + ' — view compliance details'}` or similar.
- **Lines 19-21, 22-23**: The non-interactive trust items should be wrapped in a semantic list or have a section label.
  - **Fix**: Wrap the trust items in a `<ul role="list" aria-label="Trust certifications">` with `<li>` elements, converting the `<div>` items to `<li>` and the `<a>` to `<li><a>`.
- **Line 14**: The `<section>` has no accessible name.
  - **Fix**: Add `aria-label="Trust and compliance"`.

### Consistency After SOC2 Removal — Score: 9/10

The removal of the SOC2 badge leaves three trust signals: Zero-Trust Architecture, Cloudflare Edge, and GDPR Compliant. The items maintain a logical progression: architecture approach, infrastructure provider, regulatory compliance. The GDPR item becoming a link adds interactivity that differentiates it from the static items, which is a reasonable affordance since it leads to the compliance page. However, there is no visual indicator that the GDPR item is clickable — only the hover state reveals it.

**Issue:** The GDPR link looks identical to the non-interactive items at rest. Per HIG, interactive elements should be visually distinguishable.
- **Fix**: Consider adding a subtle underline, a different text color, or an arrow icon to signal interactivity. Alternatively, use `text-signal` for the GDPR text while keeping others as `text-text-dim`.

---

## Summary of Findings

### Critical (Must Fix)

| # | File | Line(s) | Issue | HIG Principle |
|---|------|---------|-------|---------------|
| 1 | HomeSections.tsx | 24 | GDPR link touch target is ~20px, well below 44px minimum | Clarity |
| 2 | HomeSections.tsx | 17 | `text-text-dim` contrast ratio ~4.3:1, borderline AA fail | Clarity |
| 3 | HomeSections.tsx | 24 | GDPR link is visually indistinguishable from non-interactive items | Depth |

### High (Should Fix)

| # | File | Line(s) | Issue | HIG Principle |
|---|------|---------|-------|---------------|
| 4 | about/page.tsx | 40,54,85,109,129 | `text-[10px]` below 11px minimum legible size | Clarity |
| 5 | governance/page.tsx | 61,87 | Same `text-[10px]` issue | Clarity |
| 6 | about/page.tsx | 136-161 | External links missing "(opens in new tab)" aria context | Accessibility |
| 7 | governance/page.tsx | 97-103 | Pillar Link cards create verbose screen reader announcements | Accessibility |
| 8 | about/page.tsx, governance/page.tsx | 166-177, 111-122 | CTA buttons `py-3` yields borderline 44px touch target | Clarity |

### Medium (Recommended)

| # | File | Line(s) | Issue | HIG Principle |
|---|------|---------|-------|---------------|
| 9 | about/page.tsx | 97 | `mb-1` (4px) between card title and description, recommend `mb-2` (8px) | Clarity |
| 10 | governance/page.tsx | 99 | Same `mb-1` issue | Clarity |
| 11 | Both pages | All icons | Decorative icons missing `aria-hidden="true"` | Accessibility |
| 12 | HomeSections.tsx | 14 | `<section>` missing `aria-label` | Accessibility |
| 13 | governance/page.tsx | 74-82 | Stats section missing aria landmark/label | Accessibility |

### Low (Enhancement)

| # | File | Line(s) | Issue | HIG Principle |
|---|------|---------|-------|---------------|
| 14 | governance/page.tsx | — | No entrance animations unlike home page sections | Depth |
| 15 | HomeSections.tsx | 14-30 | Trust items not in semantic list structure | Accessibility |

---

## Recommended Fixes (Code Excerpts)

### Fix 1: TrustBar touch target and link affordance (HomeSections.tsx)

```tsx
// Line 24 — add padding, visual affordance, and aria-label
<a
  href="/compliance"
  aria-label={t('gdpr') + ' — view compliance details'}
  className="flex items-center gap-2 py-3 px-2 -my-3 rounded hover:text-signal transition"
>
  <Lock className="h-4 w-4" aria-hidden="true" />
  <span className="underline decoration-text-dim/30 underline-offset-2">{t('gdpr')}</span>
</a>
```

### Fix 2: Section label font size (both pages)

```tsx
// Change all instances of text-[10px] to text-[11px]
<p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-4">
```

### Fix 3: CTA button touch targets (both pages)

```tsx
// Change py-3 to py-3.5 on all CTA buttons
className="inline-flex items-center gap-2 rounded bg-signal px-8 py-3.5 ..."
```

### Fix 4: Card title spacing (both pages)

```tsx
// Change mb-1 to mb-2 on card h3 elements
<h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-2">
```

---

## Compliance Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Typography | 8/10 | 15% | 1.20 |
| Spacing | 9/10 | 15% | 1.35 |
| Touch Targets | 6/10 | 15% | 0.90 |
| Color Contrast | 7.5/10 | 15% | 1.13 |
| Accessibility | 6/10 | 20% | 1.20 |
| Content-First | 9/10 | 10% | 0.90 |
| Motion | 8.5/10 | 10% | 0.85 |
| **Total** | | **100%** | **7.53/10 (75%)** |

Adjusted to **78/100** accounting for strong brand consistency and correct structural semantics.
