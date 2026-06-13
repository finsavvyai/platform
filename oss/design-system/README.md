# FinsavvyAI Shared Design System (F8 UI Foundation)

> **This is the *intended* canonical shared design system for FinsavvyAI products — adoption is a roadmap goal, not the current state.**
>
> Per the consolidation plan (addendum §3): future UIs for PushCI, Qestro, LunaOS, OpenSyber, SDLC.cc, AMLIQ, TenantIQ, and any new FinsavvyAI product *should* consume components, tokens, and templates from this package set rather than building parallel design systems.
>
> **Reality check (June 2026 audit):** no product currently imports these packages. Several products (qestro, sdlc-cc, opensyber) ship their own divergent copies of the same package names (`@finsavvyai/ui`, `@finsavvyai/auth`), so this set is not yet canonical in practice. Treat the statement above as the target to migrate toward, not a description of today.
>
> Apple HIG compliance is a baseline requirement (see portfolio CLAUDE rules). Product-specific extensions are allowed; deviation from the underlying tokens (colors, typography scale, spacing grid) is not.
>
> See `MIGRATION_NOTES.md` for the post-migration state, the namespace-collision flag (`@finsavvyai/auth` exists in both `packages/auth` and `oss/design-system/auth`), and the LICENSE TODO.

---

## Legacy README content (from F8 migration)

The text below describes only 3 of the 12 packages actually present (`ui`, `ui-templates`, `ui-marketing`). The full inventory is in `MIGRATION_NOTES.md`. Treat this section as historical context, not as the canonical package list.

---

# F8 UI Foundation Library

Three TypeScript/React packages building a complete design system and component ecosystem.

## Packages

### 1. `@finsavvyai/ui` — Design System

Core design system with tokens and reusable components following Apple HIG.

**Components:**
- Button (variants: primary, secondary, outline, ghost; sizes: sm, md, lg)
- Input (text, email, password, number with error states)
- Card (variants: outlined, filled)
- Badge (variants: solid, outline; colors from tokens)
- Avatar (with image fallback and 3 sizes)
- Skeleton (animated loading placeholder)
- Modal (dialog with escape key and focus handling)
- Toast (toast provider with auto-dismiss)

**Tokens:**
- Colors (light/dark palettes, Apple HIG colors)
- Typography (6 heading levels, body, caption with SF Pro)
- Spacing (8pt grid system: 0-48px)

**Tests:** 92 tests, 100% passing, 90%+ coverage

### 2. `@finsavvyai/ui-templates` — Page Templates

Pre-built page layouts and components for common SaaS patterns.

**Components:**
- DashboardLayout (sidebar, header, responsive toggle)
- PricingPage (plan cards with recommended highlighting)
- SettingsPage (tab-based: profile, security, notifications)
- OnboardingWizard (multi-step with progress)
- BillingPortal (subscription + usage display)

**Tests:** 39 tests, 100% passing, 85%+ coverage

### 3. `@finsavvyai/ui-marketing` — Marketing Sections

Marketing landing page sections using Apple HIG patterns.

**Sections:**
- Hero (responsive headline, subheadline, CTA)
- Features (grid layout with icons)
- Testimonials (card-based testimonial grid)
- CTA (call-to-action section)
- Footer (links + copyright)
- LandingPage (combines all sections)

**Tests:** 24 tests, 100% passing, 85%+ coverage

## Requirements Met

✅ **All files ≤200 lines** (enforced via code structure)
✅ **95%+ test coverage** (ui package), 85%+ (templates, marketing)
✅ **SOLID patterns** (single responsibility, composition, immutability)
✅ **No secrets in code** (environment-based config only)
✅ **Apple HIG compliance** (colors, typography, spacing, interactions)
✅ **Actual working code** (all tests pass)

## Quick Start

```bash
cd packages/ui && npm install && npx vitest run
cd ../ui-templates && npm install && npx vitest run
cd ../ui-marketing && npm install && npx vitest run
```

All tests pass. Ready for integration into FinSavvy AI products.
