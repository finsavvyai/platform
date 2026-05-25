# Apple HIG Compliance Audit — TenantIQ

> **Date**: 2026-05-04 (supersedes 2026-03-15 analysis)
> **Scope**: 5 UI surfaces shipped this session (frontend wave 1 + 2)
> **Method**: grepped against criteria, not from CLAUDE.md/marketing
> **Format**: per-component pass/issue list with severity

| Severity | Count |
|---|---|
| Critical (touch target < 44pt, contrast fail, no focus state) | **8** |
| High (motion missing, hardcoded color escapes design system) | **6** |
| Medium (typography off-scale, spacing off-grid) | **3** |
| Low (polish — radius, padding tweaks) | **2** |

---

## Components audited

| File | Lines | Status |
|---|---|---|
| `apps/web/src/lib/components/UpsellCard.svelte` | 95 | **Critical issues** |
| `apps/web/src/routes/security/inbox-rules/+page.svelte` | 200 | **Critical issues** |
| `apps/web/src/routes/settings/branding/+page.svelte` | 280 | **High issues** |
| `apps/web/src/lib/components/backup/SnapshotCard.svelte` | 105 | **Medium issues** (mostly Tailwind utilities, follows existing system) |
| `apps/web/src/lib/components/snapshots/DriftAlert.svelte` | 90 | **Medium issues** |

---

## Findings

### Critical — touch targets below 44pt

HIG: minimum 44×44pt for any interactive element. iOS reject criteria.

**8 violations across 3 components**:

1. `UpsellCard.svelte:btn-upgrade` — `padding: 0.5rem 0.875rem` ≈ 36px effective height. **Below 44pt**.
2. `UpsellCard.svelte:btn-dismiss` — same. **Below 44pt**.
3. `inbox-rules/+page.svelte:.btn-primary` — `padding: 0.5rem 1rem` ≈ 36px. **Below 44pt**.
4. `inbox-rules/+page.svelte:.sev-pill` filter buttons — `padding: 0.375rem 0.75rem` ≈ 30px. **Below 44pt**.
5. `inbox-rules/+page.svelte:.clear` — same. **Below 44pt**.
6. `branding/+page.svelte:.btn-sm` (verify, init, copy) — `padding: 0.375rem 0.75rem` ≈ 30px. **Below 44pt**.
7. `branding/+page.svelte:.btn-tiny` — `padding: 0.25rem 0.5rem` ≈ 26px. **Below 44pt**.
8. `DriftAlert.svelte:Revert/Acknowledge buttons` — `px-2 py-1` ≈ 28px. **Below 44pt**.

**Fix pattern**:
```css
.btn-primary, .btn-secondary, .btn-sm {
  min-height: 44px;
}
```

The existing buttons can stay visually compact via line-height; just enforce `min-height: 44px` so the touch target hits HIG. iPad/iPhone web users hit the spec.

### Critical — no `:focus-visible` on any new interactive element

HIG accessibility: focus indicator must be visible during keyboard navigation. WCAG 2.4.7. Affects all 5 components.

**Fix pattern**:
```css
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

Do this once in a global stylesheet rather than per-component.

### High — motion missing on most interactive elements

HIG motion: 200-300ms transitions on hover/active for "tactile" feel.

- `UpsellCard.svelte` has `transition: background 0.15s` — partial. btn-dismiss has no transition.
- `inbox-rules/+page.svelte` — **0 transitions**.
- `branding/+page.svelte` — **0 transitions** on new btn-sm, btn-tiny, copy.
- `SnapshotCard.svelte` — `transition-all duration-200` ✓ **passes**.
- `DriftAlert.svelte` — `transition-all duration-200` ✓ **passes**.

**Fix**: add `transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)` to button base classes globally.

### High — hardcoded hex colors escape the design system

The codebase uses CSS variables (`--color-primary`, `--color-text`, etc.) but new components hardcode:

**UpsellCard.svelte (12 hardcoded hex values)**:
- `#4f46e5`, `#4338ca`, `#818cf8`, `#6366f1` (indigo scale)
- `#1e1b4b`, `#3730a3`, `#c7d2fe`, `#e0e7ff` (text on indigo)
- `#eef2ff`, `#f5f3ff`, `#2e1065` (gradient backgrounds)

**inbox-rules/+page.svelte (5 hardcoded hex values)**:
- `#ef4444`, `#f97316`, `#f59e0b`, `#3b82f6` (severity palette)
- `#b91c1c` (external domain code)

These break the existing token system. Codebase already uses `--color-danger` / `--color-warning` etc. The escapees fight that.

**Fix pattern**:
```css
.upsell-card {
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--color-primary) 8%, transparent),
    color-mix(in srgb, var(--color-primary) 4%, transparent)
  );
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.btn-upgrade { background: var(--color-primary); }
```

### Medium — typography off the SF scale

HIG SF Pro scale: 11, 13, 15, 17, 20, 24, 28, 34, 48, 60pt.

Found in new components:
- `0.6875rem` = 11px ✓ on scale
- `0.75rem` = 12px ✗ (between 11 and 13)
- `0.8125rem` = 13px ✓ on scale
- `0.875rem` = 14px ✗ (between 13 and 15)
- `1.125rem` = 18px ✗ (between 17 and 20)
- `1.5rem` = 24px ✓ on scale

Several uses of 12px and 14px. Project Tailwind config sets `text-xs=12, text-sm=14` — that's a project-level deviation from SF, not per-component.

**Action**: align project Tailwind config to SF scale OR document the intentional deviation.

### Medium — spacing off the 4/8 base-unit grid

HIG: spacing on 4px (or 8px) base unit. Found:

- `inbox-rules/+page.svelte`: `0.375rem` (6px) — off-grid
- `UpsellCard.svelte`: `0.875rem` (14px) — off-grid
- `branding/+page.svelte`: `0.625rem` (10px) — off-grid

Round to nearest 4px multiple.

### Low — corner radius inconsistency

Buttons range 4-12px across components.

**Recommendation**: standardize on `--radius-button: 8px`, `--radius-card: 12px`.

### Low — UpsellCard color theme deviates from brand

Card uses indigo (`#4f46e5`) which doesn't match TenantIQ's primary blue (`#2563eb`). Brand consistency, not HIG fail.

---

## Per-component scorecard

| Component | Touch ≥44pt | Focus visible | Motion | Tokens | Typography | Total |
|---|---|---|---|---|---|---|
| UpsellCard | ✗ | ✗ | partial | ✗ | partial | **2/5** |
| inbox-rules page | ✗ | ✗ | ✗ | ✗ | partial | **0.5/5** |
| branding (custom-domain section) | ✗ | ✗ | ✗ | ✗ | partial | **0.5/5** |
| SnapshotCard | partial | ✗ | ✓ | ✓ | ✓ | **3.5/5** |
| DriftAlert | partial | ✗ | ✓ | ✓ | ✓ | **3.5/5** |

Components that extend the project's Tailwind utility classes (SnapshotCard, DriftAlert) score significantly higher. New ones written with raw `<style>` blocks hardcoded too much.

---

## Highest-leverage fixes

Three changes close ~80% of findings:

### Fix 1 — Global focus-visible + button base (5 min, single file)

Add to `apps/web/src/app.css`:
```css
button, a, [role="button"] {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

button:focus-visible,
a:focus-visible,
[role="button"]:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
  border-radius: var(--radius-button, 8px);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

Single block closes 8 critical touch-target findings + 5 critical focus findings + 6 high motion findings + `prefers-reduced-motion` support.

### Fix 2 — Replace hex literals with tokens in UpsellCard (10 min)

Use `color-mix(in srgb, var(--color-primary) 8%, transparent)` for tints. Map all indigo to `--color-primary`.

### Fix 3 — Severity color tokens in inbox-rules (5 min)

Replace `#ef4444 / #f97316 / #f59e0b / #3b82f6` with `var(--color-danger) / --color-warning-strong / --color-warning / --color-info`. Verify tokens exist; if not, add them.

---

## Out of scope (acknowledged, not fixing here)

- Project Tailwind text scale (12/14/16/18) deviates from SF (11/13/15/17/20). Project-level decision.
- Dark mode coverage gaps across some components. Separate audit.
- Dynamic Type up to 200% scaling. Needs viewport testing.
- VoiceOver labels on icon-only buttons. Accessibility audit.

---

## Recommendation

Land **Fix 1** (the global stylesheet block) as a single PR — touches one file, closes ~80% of HIG findings across the entire app. Fix 2 + Fix 3 are component-local cleanups.

The two components that score 3.5/5 (SnapshotCard, DriftAlert) demonstrate the right pattern: extend Tailwind utility classes that already map to design tokens. Avoid raw `<style>` blocks for new work.
