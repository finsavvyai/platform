---
name: ll-site-audit
displayName: Luna Site Audit
description: Brutal full-stack website audit — product clarity, UX, security, conversion, trust, accessibility, performance, and marketability
version: 1.0.0
category: analysis
agent: luna-task-executor
parameters:
  - name: url
    type: string
    description: Website URL to audit (e.g., https://myapp.com)
    required: true
    prompt: true
  - name: product
    type: string
    description: Product name
    required: false
    prompt: true
  - name: type
    type: string
    description: "Product type: saas, marketplace, fintech, ai-tool, e-commerce, landing-page, app"
    required: false
    default: saas
  - name: audience
    type: string
    description: Target audience (e.g., developers, enterprise, consumers)
    required: false
    prompt: true
  - name: goal
    type: string
    description: "Main conversion goal: signup, purchase, booking, demo, install, contact"
    required: false
    default: signup
  - name: competitors
    type: string
    description: Known competitors (comma-separated)
    required: false
mcp_servers:
  - playwright
  - zai-mcp-server
prerequisites: []
---

# Luna Site Audit — Brutal Full-Stack Website Audit

Performs a comprehensive, no-BS audit of any website from 10 personas across 14+ categories. Captures screenshots, tests flows, and generates a prioritized fix list.

## What This Command Does

Acts as a brutal senior product auditor, QA lead, conversion strategist, UX expert, security reviewer, growth marketer, and technical reviewer — all at once.

Evaluates whether the site is:
1. Fully functional
2. Trustworthy
3. Secure
4. High-converting
5. Fast
6. Accessible
7. Easy to use
8. Marketable
9. Scalable
10. Launch-ready

## Usage

```bash
# Full audit
/site-audit https://myapp.com

# With context
/site-audit https://myapp.com --product "MyApp" --type saas --audience "developers" --goal signup --competitors "Vercel,Supabase"

# Quick audit (skip screenshots)
/site-audit https://myapp.com --quick
```

## Personas Tested

The audit evaluates from 10 distinct perspectives:

1. **First-time visitor** — low patience, wants immediate clarity
2. **High-intent buyer** — wants pricing, proof, ROI, security
3. **Skeptical enterprise buyer** — compliance, docs, legitimacy
4. **Non-technical user** — confused by jargon, needs simplicity
5. **Technical evaluator** — architecture, docs, developer experience
6. **Mobile user** — one-handed, small screen, slow attention
7. **Returning user** — wants frictionless continuation
8. **Accessibility-dependent user** — keyboard nav, screen reader, contrast
9. **Security-conscious user** — phishing signals, auth design, trust
10. **Impatient comparison shopper** — judges within seconds

## Flows Tested

### Core Flows
- Homepage → CTA → signup → dashboard
- Pricing comprehension and checkout
- Login, forgot password, email verification
- Contact/sales/demo request
- Settings, profile, logout
- Error states, empty states, 404s

### Marketing Flows
- Landing from Google, social, Product Hunt
- Plan comparison and upgrade path
- Trust evidence discovery
- Competitor differentiation understanding

### Technical Trust Flows
- Documentation quality and discoverability
- API/developer onboarding experience
- Legal pages, privacy policy, terms
- Security posture, cookie consent
- Company identity verification

### Edge Cases
- Invalid inputs, weak passwords, duplicate signups
- Broken links, expired tokens, empty results
- Back button, session expiry, mobile menu
- Slow loading, missing images, placeholder content

## Categories Reviewed

1. Product clarity
2. Messaging and positioning
3. Marketing and conversion
4. UX and usability
5. UI quality and visual polish
6. Navigation and information architecture
7. Mobile responsiveness
8. Functional QA
9. Security and trust
10. Accessibility (WCAG)
11. Performance and technical quality
12. SEO and discoverability
13. Onboarding / signup / auth
14. Pricing / sales flow
15. Logged-in / dashboard experience
16. Trust / legitimacy / compliance
17. Competitive weakness analysis
18. Marketability readiness

## Output

```
.luna/{project}/site-audit/
  report.md                    # Full audit report
  executive-summary.md         # Scores and top issues
  fix-checklist.md             # Prioritized fix table
  screenshots/                 # Annotated screenshots per page
    01-homepage-desktop.png
    02-homepage-mobile.png
    03-pricing.png
    04-signup.png
    05-login.png
    06-dashboard.png
    ...
  persona-reviews.md           # Per-persona breakdown
  flow-reviews.md              # Per-flow breakdown
  copy-fixes.md                # Rewritten headlines and CTAs
  security-flags.md            # Trust and security red flags
  accessibility-issues.md      # WCAG violations
  cro-opportunities.md         # Conversion rate optimization
  roadmap.md                   # Phased action plan
```

## Output Scores

The audit produces scores on:
- Trust level: /10
- Conversion readiness: /10
- UX maturity: /10
- Security/trust maturity: /10
- Design polish: /10

## How It Works

### Phase 1: Capture
- Opens the site in Playwright at desktop (1440px) and mobile (375px)
- Navigates every discoverable page and flow
- Screenshots each page with annotations
- Tests all links, buttons, forms
- Captures load times and visual issues

### Phase 2: Analyze
- Sends screenshots to vision AI for UI/UX analysis
- Tests forms with valid and invalid inputs
- Checks auth flows end-to-end
- Evaluates from each persona's perspective
- Compares against competitor patterns

### Phase 3: Report
- Generates the full audit report with severity ratings
- Creates the prioritized fix checklist
- Writes copy improvements for weak headlines
- Produces the phased roadmap

## Scoring Criteria

**Critical** — Blocks launch. Breaks trust. Loses customers.
**High** — Significant damage to conversion or credibility.
**Medium** — Noticeable weakness. Hurts perception.
**Low** — Polish issue. Won't block but should fix.

## Important Rules

- Be harsh but accurate
- Be specific, not generic ("improve UX" → "add loading state to signup button")
- Don't praise unless deserved
- Prioritize by business damage
- Flag fake polish and shallow marketing
- Compare against top-tier modern SaaS standards
- Flag anything incomplete, suspicious, generic, or low-trust

## In Pipes

```bash
# Audit then fix
/pipe site-audit https://myapp.com >> fix

# Audit, record demo, then ship fixes
/pipe site-audit https://myapp.com >> flow-record https://myapp.com >> fix >> ship

# Audit competitor then compare
/pipe site-audit https://competitor.com >> compete https://competitor.com

# Full launch prep: audit, fix, test, deploy
/pipe site-audit https://staging.myapp.com >> fix >> browser-test https://staging.myapp.com >> ship
```
