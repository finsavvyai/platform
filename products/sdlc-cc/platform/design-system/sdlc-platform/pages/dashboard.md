# Dashboard Page Overrides

> Overrides MASTER.md for the admin dashboard (`services/admin-ui/`).

---

## Style Override

**Style:** Data-Dense Dashboard + Swiss Minimalism
**Pattern:** Operational Analytics Dashboard

### Color Adjustments

| Role | Override Hex | Reason |
|------|-------------|--------|
| Background | `#F1F5F9` (slate-100) | Slightly darker for card contrast |
| Surface | `#FFFFFF` | Clean white cards |
| Sidebar BG | `#0F172A` (slate-900) | Dark sidebar for focus |
| Sidebar Text | `#CBD5E1` (slate-300) | Readable on dark |
| Sidebar Active | `#3B82F6` (blue-500) | Active nav highlight |
| Chart Primary | `#1E40AF` | Main data series |
| Chart Secondary | `#0EA5E9` | Secondary series |
| Chart Success | `#059669` | Positive metrics |
| Chart Danger | `#DC2626` | Alerts, failures |
| Chart Warning | `#F59E0B` | Warnings |

### Typography Adjustments

| Element | Override |
|---------|----------|
| Page Title | Inter 24px, weight 600 |
| Card Title | Inter 16px, weight 600 |
| KPI Value | Inter 32px, weight 700 |
| KPI Label | Inter 12px, weight 500, slate-500 |
| Table Header | Inter 12px, weight 600, uppercase, tracking-wide |
| Table Cell | Inter 14px, weight 400 |
| Code/Logs | Fira Code 13px, weight 400 |

### Layout

- **Sidebar:** 240px fixed, dark (slate-900)
- **Content:** fluid, max-w-none, p-6
- **Header:** sticky top-0, white, shadow-sm, h-16
- **Cards:** white, rounded-xl, border slate-200, p-6
- **Grid:** responsive 1-2-3-4 column grid for KPI cards

### Dashboard Sections

1. **Top Bar** - Page title + date range picker + refresh button
2. **KPI Row** - 4 cards: Total Requests, Redactions, Policies Active, Avg Latency
3. **Charts Row** - 2 charts: Request Volume (area) + Redaction by Category (bar)
4. **Recent Activity** - Table: timestamp, user, action, status
5. **Alerts Panel** - Right sidebar or bottom: active alerts

### Effects

- Hover tooltips on chart data points
- Row highlighting on table hover
- Skeleton loaders for async data (not spinners)
- Smooth filter/sort transitions (200ms)
- KPI counter animation on mount

### Specific Component Rules

**Sidebar Navigation**
- Icon + label per item
- Active: blue-500 bg-opacity-10, text-blue-400, left border
- Hover: bg-white/5 transition
- Sections: divider between nav groups

**KPI Cards**
- Icon top-right (muted)
- Value large, bold
- Label small, muted
- Trend indicator: green up / red down arrow + percentage

**Data Tables**
- Striped rows (slate-50 alternating)
- Sortable column headers
- Pagination: bottom-right
- Empty state: centered illustration + text

---

## Anti-Patterns for Dashboard

- No glass morphism (use solid white cards)
- No gradient backgrounds (flat slate-100)
- No decorative animations (data focus)
- No card hover lift (reserve for clickable cards only)
- No ornate styling (function over form)
