# Pricing Page Overrides

> Overrides MASTER.md for the pricing section and `/checkout/` pages.

---

## Style Override

**Style:** Trust & Authority
**Pattern:** Pricing-Focused with Comparison

### Color Adjustments

| Role | Override Hex | Reason |
|------|-------------|--------|
| Highlighted Card Ring | `rgba(30,64,175,0.3)` | Draws eye to recommended plan |
| Recommended Badge BG | `rgba(30,64,175,0.1)` | Subtle highlight |
| Recommended Badge Text | `#1E40AF` | Brand primary |
| Check Icon | `#1E40AF` | Feature check marks |
| Price Text | `#0F172A` | High contrast for price |

### Layout

- 3-column grid (responsive: 1 on mobile, 3 on desktop)
- Middle card: elevated (-translate-y-2), ring highlight
- Feature comparison table below cards (optional)
- FAQ accordion below comparison
- Annual/Monthly toggle (future)

### Typography

| Element | Override |
|---------|----------|
| Plan name | Inter 24px, weight 600 |
| Price | Inter 40px, weight 700, tracking-tight |
| Price period | Inter 16px, weight 400, slate-500 |
| Plan description | Inter 15px, weight 400, slate-600 |
| Feature text | Inter 14px, weight 400, slate-700 |
| CTA button | Inter 16px, weight 600 |

### Pricing Card Structure

```
[Recommended badge] (if highlighted)
Plan Name
$Price /mo
Description line

-- Feature list --
[check] Feature 1
[check] Feature 2
...

[CTA Button - full width]
```

### Conversion Strategy

- Annual discount 20-30% (when implemented)
- Mid-tier "Most Popular" badge
- Enterprise: "Contact Sales" CTA
- Bottom note: "SOC2, GDPR, audit trails on every tier"
- FAQ addresses objections (data residency, compliance, migration)

### Effects

- Card hover: shadow increase, subtle lift
- Recommended card: persistent elevation
- CTA hover: darken + glow
- Toggle animation: slide (annual/monthly)

---

## Anti-Patterns for Pricing

- No hidden fees or asterisks
- No "starting at" ambiguity
- No feature list longer than 7 items per card
- No dark patterns (pre-selected annual, auto-checkout)
- No comparison with competitor names
