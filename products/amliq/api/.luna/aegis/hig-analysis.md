# AMLIQ Web App - Apple HIG Compliance Audit

**Scope**: Full web application dashboard
**Analysis Type**: compliance
**Generated**: 2026-03-30
**Agent**: Luna Apple HIG Designer

---

## Executive Summary

The AMLIQ dashboard already has a strong Apple HIG foundation with a well-defined design system (custom Tailwind tokens for SF typography, Apple semantic colors, spacing scale, and component classes). This audit identified and fixed 18 specific issues across typography hierarchy, color consistency, interactive states, and spacing.

## Issues Found and Fixed

### 1. Color System Violations (6 fixes)
- `text-red-500` replaced with `text-apple-red` in: ScreenEntity, Configuration, SanctionsLists, AuditTrail, Analytics
- `text-green-600` replaced with `text-apple-green` in: SanctionsLists
- All error messages now use `text-apple-red sf-caption` with `role="alert"` for accessibility

### 2. Typography Hierarchy (6 fixes)
- Card headers using `sf-body font-semibold` upgraded to `sf-headline` in: Configuration (2 cards), ListCard, ListMarketplaceCard, BatchJobs, ScreeningResults
- ScreeningResults subsection title downgraded from `sf-title` to `sf-headline text-xl` (appropriate for subsection)
- StatCard trend text changed from raw `text-sm` to `text-sf-caption`

### 3. Interactive Elements (4 fixes)
- Added `cursor-pointer` to: ScreeningResultRow expand button, ListMarketplaceCard enable button
- Added `cursor-pointer transition-colors` to: Sidebar close button, Toolbar menu button
- AlertFilters toggle buttons: replaced inline `style` with Tailwind classes (`bg-apple-blue` / `bg-white/10 hover:bg-white/15`)

### 4. Layout and Spacing (2 fixes)
- ComplianceMetrics grid gap upgraded from `gap-md` to `gap-lg` for consistency
- Configuration list dividers: bare `border-b` replaced with `border-b border-white/10`

### 5. Component Consistency (2 fixes)
- StatCard: removed inline `clsx` function, imported from `clsx` package
- NavGroup and Sidebar user info: removed `hidden sm:inline` / `hidden sm:block` since sidebar is always w-64

## Compliance Assessment

### Clarity: 9/10
- Typography hierarchy is well-defined with sf-title, sf-headline, sf-body, sf-caption
- System font stack (-apple-system, SF Pro) used throughout
- Good contrast ratios with Apple semantic colors on dark background

### Deference: 9/10
- Content-first approach with minimal chrome
- Backdrop blur vibrancy on sidebar and toolbar
- Cards use subtle borders (border-white/10) instead of heavy outlines

### Depth: 8/10
- Card elevation via backdrop-blur and subtle borders
- Good layering between sidebar, toolbar, and content
- Could benefit from more shadow depth on elevated elements

## Remaining Recommendations

1. Legal pages and billing pages still use raw Tailwind colors (text-neutral-*, green-900) -- these have separate design contexts
2. Marketing pages use their own color scheme which is acceptable for landing pages
3. Consider adding active/pressed states (scale-95 or opacity-80) to primary buttons
4. Consider skeleton loading states for chart components
