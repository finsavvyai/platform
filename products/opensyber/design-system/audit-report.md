# Design-System Audit — `apps/web`

**Run date:** 2026-05-06
**Scope:** `apps/web/src/**/*.{ts,tsx,css}`
**Reference:** `design-system/opensyber-web/MASTER.md` + `docs/opensyber-brand.html`
**Method:** ripgrep against brand-violation patterns. All counts traceable to commands in this report.

---

## TL;DR

Brand foundation **is wired** (Tailwind v4 `@theme inline` in `globals.css` + `next/font` for Bebas Neue / Space Mono / DM Sans in `layout.tsx`). Foundation is good. **Migration to brand tokens is incomplete:**

| Area | Status |
|------|--------|
| Tokens defined in CSS | ✓ (with drift — see below) |
| Brand fonts loaded | ✓ |
| Components use brand tokens (`bg-signal`, `bg-info`, `bg-alert`) | partial |
| Components use generic blue/indigo/sky | **170 files, 281 occurrences — needs migration** |
| Files >200 LOC cap | 3 |
| Emoji-as-icon | 0 (clean) |

---

## 1. Token drift — `globals.css` vs `docs/opensyber-brand.html`

| Token | Brand HTML | `globals.css` | Drift |
|-------|-----------|---------------|-------|
| `--color-void` | `#080B0F` | `#060910` | -2,-1,-1 (slightly bluer/darker) |
| `--color-panel` | `#0D1117` | `#0A0F18` | -3,-2,+1 |
| `--color-surface` | `#141B24` | `#111827` | -3,-3,+3 |
| `--color-border` | `#1E2A38` | `#1C2940` | -2,-1,+8 |
| `--color-wire` | `#243344` | `#243344` | match |
| `--color-signal` | `#00E5C3` | `#00E5C3` | match |
| `--color-text-primary` | `#E8F0F8` | `#E8F0F8` | match |
| `--color-text-secondary` | `#7A96B2` | `#7A96B2` | match |
| `--color-text-muted` | `#3D5470` | `#3D5470` | match |

**Extras in code, not in brand HTML:**

- `--color-signal-hover: #00ffda`
- `--color-text-dim: #6B8AAD`
- `--color-alert-vivid: #FF4B4B` (vs `--color-alert: #FF4D4D` — 2-unit drift)
- `--color-warn-muted: #F5A623`

**Decision needed:** Pick one source of truth (code OR brand HTML) and propagate. Recommendation: keep code values (slightly bluer darks read better on OLED), update `docs/opensyber-brand.html` and brand memory to match.

---

## 2. Generic blue / indigo / sky violations (brand inconsistency)

**Pattern:** `bg-blue-{500,600}`, `text-blue-{300,400}`, `border-blue-500/30`, `bg-sky-*`, `bg-indigo-*`, `from-blue-500 to-indigo-600`.

**Replace with:** `bg-info` for informational, `bg-signal` for primary teal, `bg-alert` for severity, `bg-warn` for warnings, `bg-ok` for success.

**Counts:**

```
Files affected: 170
Total occurrences: 281
```

**Reproduce:**

```bash
grep -rEln "bg-blue-|text-blue-|border-blue-|bg-sky-|bg-indigo-|from-blue-|to-indigo-" \
  apps/web/src --include="*.tsx" --include="*.ts"
```

**Top offenders (by file):**

| File | Notes |
|------|-------|
| `app/marketplace/MarketplaceClient.tsx` | filter tabs use `bg-blue-600 text-white` — should be `bg-signal text-void` |
| `app/dashboard/toxic-combinations/SeverityBadge.tsx` | medium severity uses `bg-blue-500/20 text-blue-400` — should be `bg-info/20 text-info` |
| `app/dashboard/security-graph/GraphDetailPanel.tsx` | low severity in blue — same swap |
| `app/threats/ThreatEntryCard.tsx` | low severity in blue — same swap |
| `app/dashboard/AiChatWidget.tsx` | input focus border `focus:border-blue-500` — should be `focus:border-signal` |
| `app/marketplace/bundles/page.tsx` | gradient `from-blue-500 to-indigo-600` — replace with `from-signal to-info` |
| 14× `focus:border-blue-500` in form inputs | global pattern; should be `focus:border-signal` |
| `app/demo/{OverviewTab,EventsTab}.tsx` | mixes `bg-signal/10` (correct) with `border-blue-500/20` (wrong) — pick one |

**Suggested migration approach:**

1. One commit replacing every `bg-blue-{500,600}` → `bg-info`
2. One commit replacing every `text-blue-{300,400}` → `text-info`
3. One commit replacing every `border-blue-500/*` → `border-signal/*` for focus / `border-info/*` for info contexts
4. Visual regression test with Playwright before merge

---

## 3. Files exceeding 200-line cap (CLAUDE.md rule)

| File | Lines | Action |
|------|-------|--------|
| `apps/web/src/app/globals.css` | 292 | Split into `globals.tokens.css`, `globals.effects.css`, `globals.layout.css` |
| `apps/web/src/app/marketplace/page.tsx` | 209 | Extract `MarketplaceFilters` and `BundleHighlight` sub-components |
| `apps/web/src/components/dashboard/security/AddSecretForm.test.tsx` | 201 | Extract fixtures into `AddSecretForm.fixtures.ts` |

---

## 4. Hardcoded hex colors in components

**Pattern:** any `#[0-9a-fA-F]{6}` in a `.tsx` file (excluding `globals.css`).

**Count:** 148 occurrences. Some are legitimate (chart series colors, MITRE technique IDs), but many are inline replacements for what should be tokens.

**Sample audit (manual review needed):**

```bash
grep -rEn "#[0-9a-fA-F]{6}" apps/web/src --include="*.tsx" | grep -v "globals.css"
```

---

## 5. Missing `cursor-pointer` on `onClick` handlers

**Heuristic count:** 266 `onClick=` instances on non-`<button>` elements. Not all are violations (some may be on form rows, intercepting bubbles, or already styled), but worth a manual sweep.

**Proper fix path:** prefer `<button>` over clickable `<div>` whenever semantically valid — that gets keyboard handling, focus, and cursor for free.

---

## 6. Emoji-as-icon — clean

```bash
grep -rEn "[🚀🎯⚡✨🔥💡🎨🛡📊📈📉🔒🔓🤖✅❌⚠️💬📝📦🌟⭐]" apps/web/src \
  --include="*.tsx" --include="*.ts"
```

**Result:** 0 matches. No emoji icons in the codebase.

---

## 7. Brand fonts wiring — verified ✓

`apps/web/src/app/layout.tsx` lines 2–22:

```ts
import { DM_Sans, Space_Mono, Bebas_Neue } from 'next/font/google';

const dmSans = DM_Sans({ variable: '--font-body', ... });
const spaceMono = Space_Mono({ variable: '--font-mono', ... });
const bebasNeue = Bebas_Neue({ variable: '--font-display', ... });
```

All three brand fonts loaded, mapped to CSS variables, available globally.

---

## 8. Other observations

- `app/HeroSection.tsx`, `app/HomeFeatures.tsx` etc. live at the **root** of `app/` rather than under a route folder. This violates Next.js convention (`page.tsx` files should be in route folders) and makes route-vs-component intent ambiguous. Move these into a colocated folder like `app/(marketing)/_components/`.
- `apps/web` has 217 `.ts(x)` files in `src/` — small enough that a full token-migration sweep is one focused day of work, not a major refactor.

---

## Prioritized punch-list

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Replace `bg-blue-*` / `text-blue-*` with `bg-info` / `text-info` (170 files) | 1 day | High — visual brand consistency |
| 2 | Reconcile token drift (decide canonical values, update brand HTML or globals.css) | 1 hour | High — single source of truth |
| 3 | Split `globals.css` (292 → ≤200 LOC) | 30 min | Medium — CLAUDE.md cap |
| 4 | Trim `marketplace/page.tsx` and `AddSecretForm.test.tsx` to ≤200 | 30 min | Medium — cap |
| 5 | Add `text-dim` and `signal-hover` to MASTER (or remove from CSS) | 15 min | Low — spec hygiene |
| 6 | Move `app/Hero*.tsx` files into `(marketing)/_components/` | 30 min | Medium — Next.js convention |
| 7 | Manual cursor-pointer / clickable-div audit | 2 hours | Medium — a11y |

---

## Reproducibility

Every count in this report was generated by ripgrep / wc / find. To re-run:

```bash
# Counts at top of report
grep -rEln "bg-blue-|text-blue-|border-blue-|bg-sky-|bg-indigo-|from-blue-|to-indigo-" \
  apps/web/src --include="*.tsx" --include="*.ts" | wc -l
grep -rEn "bg-blue-|text-blue-|border-blue-|bg-sky-|bg-indigo-|from-blue-|to-indigo-" \
  apps/web/src --include="*.tsx" --include="*.ts" | wc -l

# Files >200 lines
find apps/web/src \( -name "*.tsx" -o -name "*.ts" \) -not -path "*/node_modules/*" \
  | xargs wc -l | awk '$1 > 200 && $2 != "total" {print $1, $2}' | sort -rn

# Token drift comparison
grep -E "color-(void|panel|surface|border|wire|signal|text)" \
  apps/web/src/app/globals.css
```
