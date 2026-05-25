# Landing Page Overrides

> Overrides MASTER.md for the landing page (`pages/index.tsx`).

---

## Style Override

**Style:** Trust & Authority with Glass Morphism
**Pattern:** Enterprise Gateway Landing

### Color Adjustments

| Role | Override Hex | Reason |
|------|-------------|--------|
| Accent Gradient Start | `#1E40AF` | Brand gradient for hero |
| Accent Gradient End | `#0EA5E9` | Sky blue for approachability |
| CTA Background | `#059669` | High-contrast emerald for conversion |
| Glass Surface | `rgba(255,255,255,0.78)` | Elevated glass panels |
| Glass Border | `rgba(255,255,255,0.74)` | Subtle glass edge |

### Typography Adjustments

| Element | Override |
|---------|----------|
| Hero H1 | 48px mobile, 64px desktop, font-weight 700, tracking-tight |
| Hero subtitle | 18px mobile, 20px desktop, slate-600 |
| Section H2 | 30px mobile, 48px desktop, font-weight 600, tracking-tight |
| Badge text | 13px, font-weight 500 |

### Section Structure

1. **Hero** - Split layout: left copy + right illustration
   - Trust pill badge above headline
   - Gradient text for key phrase
   - 3 value prop pills with icons
   - Primary CTA + Secondary CTA + Tertiary link
   - Right: Glass panel with shield illustration + 3 metric cards
2. **Trust Bar** - Inline compliance badges (SOC2, HIPAA, GDPR, FINRA)
3. **Features** - 3x2 grid, glass cards with icon + title + bullet list
4. **OpenClaw Capabilities** - 2x2 grid with pill tags
5. **Pricing** - 3 columns, middle highlighted with "Recommended" badge
6. **Demo Form** - Centered card with validated form fields
7. **Footer** - Glass panel, 3-column grid

### Effects

- Hero gradient: radial blue/cyan glow on background
- Glass panels: `backdrop-filter: blur(18px)`
- Card hover: translateY(-3px) + shadow increase
- Button hover: translateY(-1px) + glow increase
- Section animations: fade-in + slide-up on viewport entry
- Badge pills: static, no animation (trust = stability)

### Specific Component Rules

**Header (Floating Nav)**
- Fixed, glass morphism, rounded-2xl
- Top padding: 16px from viewport edge
- Logo: gradient icon + "SDLC.ai" text
- Nav links: slate-700, hover slate-950
- CTA: "Start Free" button-primary style

**Hero Metrics**
- 3-column grid inside glass panel
- White/85 background per metric
- Value: text-xl font-semibold slate-900
- Label: text-xs slate-600

**Pricing Cards**
- Highlighted card: ring-2 ring-primary/30, -translate-y-2
- "Recommended" badge: primary/12 bg, primary text
- Check icons: primary color (#1E40AF)

---

## Anti-Patterns for Landing

- No auto-playing video (performance)
- No carousel/slider for features (cognitive load)
- No floating chat widget on landing
- No cookie banner that covers CTA
- No stock photography (use illustrations/SVGs)
