# Auth Pages Overrides

> Overrides MASTER.md for sign-in, sign-up, and auth flows.

---

## Style Override

**Style:** Accessible & Ethical (WCAG AAA)
**Pattern:** Minimal Auth with Trust Signals

### Color Adjustments

| Role | Override Hex | Reason |
|------|-------------|--------|
| Background | `#F8FAFC` | Calm, neutral |
| Card BG | `#FFFFFF` | Clean white form card |
| Primary Action | `#1E40AF` | Blue for "Sign In" / "Sign Up" |
| Link Color | `#1E40AF` | Consistent with primary |
| Error | `#DC2626` | Clear error feedback |
| Success | `#059669` | Verification success |

### Layout

- Centered card, max-width 420px
- Card: white, rounded-2xl, shadow-lg, p-8
- Logo centered above card
- Trust badges below card (SOC2, encryption note)
- Background: subtle radial gradient (same as landing)

### Form Rules

- All inputs: 48px height minimum (touch target)
- Labels: visible, above input, font-weight 500
- Focus: 3px ring, primary color
- Errors: inline below input, red-600, with icon
- Password: show/hide toggle
- Submit button: full-width, primary color, 48px height

### Typography

| Element | Override |
|---------|----------|
| Page title | Inter 24px, weight 600, "Sign in to SDLC.ai" |
| Input label | Inter 14px, weight 500 |
| Input text | Inter 16px (prevents mobile zoom) |
| Error text | Inter 13px, weight 400, red-600 |
| Help text | Inter 13px, weight 400, slate-500 |

### Auth Flow Specifics

**Sign In:**
- Email + Password fields
- "Forgot password?" link (right-aligned)
- "Sign In" primary button
- Divider: "or continue with"
- Social buttons: Google, GitHub (outlined)
- Footer: "Don't have an account? Sign up"

**Sign Up:**
- Full name + Email + Password + Confirm password
- Password strength indicator
- Terms checkbox with link
- "Create account" primary button
- Footer: "Already have an account? Sign in"

### Effects

- Focus ring: 3px solid rgba(30,64,175,0.3)
- Error shake: subtle horizontal shake (200ms)
- Loading state: spinner in button, button disabled
- Success: check icon + redirect

---

## Anti-Patterns for Auth

- No social proof / testimonials (distraction)
- No pricing info on auth pages
- No auto-focus on mobile (keyboard jump)
- No custom password rules display before user types
- No CAPTCHA on initial view (only after failed attempts)
