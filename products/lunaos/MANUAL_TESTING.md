# LunaOS — Full Manual Testing Guide

Complete QA checklist for all 6 LunaOS products across all platforms and browsers.
**Estimated time**: 2-3 hours for a full pass.

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Product 1: Marketing Site (lunaos.ai)](#2-marketing-site)
3. [Product 2: Docs Site (docs.lunaos.ai)](#3-docs-site)
4. [Product 3: Dashboard (agents.lunaos.ai)](#4-dashboard)
5. [Product 4: Studio IDE (studio.lunaos.ai)](#5-studio-ide)
6. [Product 5: Engine API (api.lunaos.ai)](#6-engine-api)
7. [Product 6: CLI (npm: luna-agents)](#7-cli)
8. [Cross-Browser Matrix](#8-cross-browser-matrix)
9. [Mobile Platform Testing](#9-mobile-platform-testing)
10. [Accessibility Audit](#10-accessibility-audit)
11. [Performance Baselines](#11-performance-baselines)
12. [Bug Report Template](#12-bug-report-template)

---

## 1. Environment Setup

### Required tools

```bash
# Browsers to install
# - Chrome (latest stable)
# - Firefox (latest stable)
# - Safari 17+ (macOS)
# - Edge (latest stable)

# Command-line tools
node --version      # ≥ 18
npm --version       # ≥ 8
curl --version
jq --version        # for API response inspection
```

### Test accounts to prepare

- [ ] **Primary test user**: `test+primary@example.com` / `TestPass123!`
- [ ] **Secondary test user**: `test+secondary@example.com` / `TestPass123!`
- [ ] **Admin test user**: `test+admin@example.com` / `AdminPass123!`
- [ ] **GitHub account** for OAuth testing (use a throwaway)

### Test device matrix

- [ ] **Desktop**: 1920×1080, 1440×900, 2560×1440
- [ ] **Tablet**: iPad (768×1024)
- [ ] **Mobile**: iPhone 15 (390×844), Android (360×800)

### Screen sizes for responsive testing

| Size | Width | Test Focus |
|------|-------|-----------|
| XS   | 375px | Mobile portrait — no horizontal scroll |
| SM   | 640px | Small tablet portrait |
| MD   | 768px | iPad portrait |
| LG   | 1024px | iPad landscape / small laptop |
| XL   | 1280px | Desktop |
| 2XL  | 1920px | Full HD monitor |

---

## 2. Marketing Site

**URL**: https://lunaos.ai
**Stack**: Static HTML/CSS/JS on Cloudflare Pages
**Primary goal**: Convert visitors to signups

### 2.1 Smoke Test (5 min)

- [ ] Site loads without errors (check DevTools console)
- [ ] No 404s on any internal resource (check Network tab)
- [ ] Hero copy renders: "Build full-stack apps with AI — backend included"
- [ ] Install command shows: `npm install -g luna-agents && luna-setup`
- [ ] Copy button in CLI bar works → clipboard contains the command
- [ ] "Start Building Free" button navigates to agents.lunaos.ai signup
- [ ] Footer links all resolve (docs, dashboard, studio)

### 2.2 Section-by-Section (15 min)

#### Hero section
- [ ] Headline is readable, not clipped
- [ ] Subtitle shows: "Database, APIs, auth, storage, and AI agents — all in one platform"
- [ ] CLI bar `npm install -g luna-agents && luna-setup` displayed
- [ ] "Copy" button changes to "Copied!" when clicked
- [ ] Primary CTA `Start Building Free` has hover state
- [ ] Secondary CTA `See It In Action` scrolls to `#demo`

#### Social proof bar
- [ ] Shows "Cloudflare Edge — sub-200ms globally"
- [ ] Shows "Open Source CLI"
- [ ] Shows "SOC 2 compliant infrastructure"
- [ ] **Red flag**: any claim about "X companies use us" when there are none

#### Use cases / Features
- [ ] All cards render with icons (SVG, not emoji)
- [ ] No broken images
- [ ] Card hover state works

#### Demo / terminal section
- [ ] Terminal output shows `$ npm install -g luna-agents && luna-setup` (correct package name)
- [ ] No references to `luna-agents-cli` (old wrong name)
- [ ] No references to `@luna-agents/cli` (old wrong scoped name)

#### Pricing section (if present)
- [ ] Free / Pro / Enterprise tiers displayed
- [ ] CTAs work (Free → signup, Pro → signup, Enterprise → Calendly)

#### Footer
- [ ] Email is `info@finsavvyai.com` (correct routing)
- [ ] GitHub link resolves: https://github.com/lunaos-ai
- [ ] npm link resolves: https://www.npmjs.com/package/luna-agents
- [ ] Privacy + Terms links work

### 2.3 Responsive (10 min)

Test at each breakpoint:

| Size | Check |
|------|-------|
| 375px | No horizontal scroll, hero text wraps, CLI bar wraps/scrolls |
| 768px | Nav collapses to hamburger, cards stack correctly |
| 1024px | 2-column layout where appropriate |
| 1920px | Max-width container, no content stretched awkwardly |

- [ ] No horizontal scroll on any size
- [ ] Text remains ≥14px on mobile
- [ ] Touch targets ≥44×44px
- [ ] Images don't overflow containers

### 2.4 Performance (5 min)

In Chrome DevTools → Lighthouse:
- [ ] Performance score ≥ 90
- [ ] Accessibility score ≥ 95
- [ ] Best Practices score ≥ 90
- [ ] SEO score ≥ 90
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1

---

## 3. Docs Site

**URL**: https://docs.lunaos.ai
**Stack**: VitePress, force-dark theme
**Primary goal**: Developer onboarding and reference

### 3.1 Smoke Test (5 min)

- [ ] Site loads, dark theme active (force-dark)
- [ ] Homepage renders with logo + nav
- [ ] Top nav: Guide, Agents, API Reference, Studio, What's New, Pricing, Dashboard
- [ ] Search (Ctrl+K / Cmd+K) opens search modal
- [ ] Search for "install" returns relevant results
- [ ] Clicking a search result navigates correctly

### 3.2 What's New page (NEW)

- [ ] Navigate to https://docs.lunaos.ai/whats-new
- [ ] Page loads with latest shipping info
- [ ] Swarm section with curl example renders
- [ ] Thompson sampling section renders
- [ ] Graph RAG section renders
- [ ] LLM provider table renders with all 6 providers
- [ ] Test count shows 179/179 (or newer)
- [ ] All internal links work

### 3.3 Getting Started flow

- [ ] `/getting-started/` loads
- [ ] Quickstart page has the correct install command: `npm install -g luna-agents`
- [ ] Configuration page documents env vars
- [ ] No links point to deprecated package names

### 3.4 API Reference

- [ ] `/api/` loads
- [ ] Authentication section documents Bearer token + API key
- [ ] Endpoint examples show real URLs (api.lunaos.ai)
- [ ] curl snippets are copy-pasteable and syntactically valid

### 3.5 Sidebar navigation

- [ ] All sidebar sections expand/collapse
- [ ] No 404 links in sidebar (use link checker if possible)
- [ ] Active page is highlighted correctly
- [ ] Sidebar remains sticky on scroll

### 3.6 Responsive

- [ ] Mobile: sidebar collapses to drawer
- [ ] Search works on mobile
- [ ] Code blocks horizontally scroll (don't overflow)

---

## 4. Dashboard

**URL**: https://agents.lunaos.ai
**Stack**: Next.js 15 static export on Cloudflare Pages
**Primary goal**: User admin of agents, keys, billing

### 4.1 Smoke Test (5 min)

- [ ] Landing page at `/` loads
- [ ] Logo and nav render
- [ ] "Sign up" and "Log in" buttons present
- [ ] No console errors on load
- [ ] No 404s on static assets

### 4.2 Signup flow (10 min)

Navigate to https://agents.lunaos.ai/auth/signup

- [ ] Form renders with: email, password, organization name
- [ ] Password strength indicator appears as you type
- [ ] Email validation rejects invalid formats
- [ ] Password field has show/hide toggle
- [ ] Submit button disabled until valid
- [ ] OAuth buttons present: Google, GitHub, Microsoft, LinkedIn
- [ ] Terms of Service + Privacy Policy links work
- [ ] Submit with valid data → success flow

**Expected**: Redirected to /onboarding or /dashboard with JWT in localStorage (`amliq_token` or similar)

### 4.3 Login flow (5 min)

Navigate to https://agents.lunaos.ai/auth/login

- [ ] Form renders
- [ ] "Forgot password?" link present and functional
- [ ] OAuth buttons render and work
- [ ] Invalid credentials show clear error message
- [ ] Valid credentials → dashboard

### 4.4 Dashboard pages (20 min)

After signing in, test each page:

#### `/dashboard` (Overview)
- [ ] Greeting displays user's name
- [ ] Stat cards show (total runs, success rate, active agents, usage)
- [ ] Recent activity feed renders
- [ ] Quick actions visible

#### `/dashboard/agents`
- [ ] List of 28 agents renders
- [ ] Free vs Pro tier badges visible
- [ ] Click an agent → detail page
- [ ] "Run agent" button present
- [ ] Fill context, submit → loading state → response streams in

#### `/dashboard/chains`
- [ ] List of saved chains (may be empty initially)
- [ ] "New chain" button → builder page
- [ ] Builder allows adding nodes

#### `/dashboard/api-keys`
- [ ] Existing keys list (masked, showing prefix only)
- [ ] "Create key" button works
- [ ] New key displayed once (copy it, never shown again)
- [ ] Revoke key button works
- [ ] Rate limit info visible

#### `/dashboard/billing`
- [ ] Current plan displayed
- [ ] Usage chart (current month)
- [ ] Upgrade CTA for free tier users
- [ ] LemonSqueezy checkout link works (don't complete purchase — just verify URL)

#### `/dashboard/kb` (Knowledge Base)
- [ ] File upload works (upload a test .md)
- [ ] Indexing status updates
- [ ] Search returns results after indexing

#### `/dashboard/repos`
- [ ] "Connect GitHub" button → OAuth flow
- [ ] Connected repos list
- [ ] Reindex button per repo

#### `/dashboard/analytics`
- [ ] Usage charts render (Recharts)
- [ ] Date range selector works
- [ ] Exports to CSV if button present

#### `/dashboard/settings`
- [ ] Profile edit works
- [ ] Password change works
- [ ] MFA setup link works

### 4.5 Logout flow

- [ ] Click logout → redirected to `/`
- [ ] Token cleared from localStorage
- [ ] Visiting `/dashboard` redirects to `/auth/login`

### 4.6 Responsive

- [ ] Mobile: sidebar collapses to drawer, hamburger visible
- [ ] Tables scroll horizontally on mobile
- [ ] Forms remain usable at 375px
- [ ] No content cut off

---

## 5. Studio IDE

**URL**: https://studio.lunaos.ai
**Stack**: Vite + React + ReactFlow v12
**Primary goal**: Visual workflow building

### 5.1 Smoke Test (5 min)

- [ ] Landing page loads
- [ ] "Try Demo" button works
- [ ] Hash routing works: `#demo` loads demo canvas, `#app` loads studio app
- [ ] Logo visible, no layout shifts on load

### 5.2 Demo canvas (`#demo`)

- [ ] Pre-loaded sample nodes render on canvas
- [ ] Can pan the canvas by dragging background
- [ ] Can zoom with scroll wheel
- [ ] Minimap visible in corner
- [ ] Node connections rendered with arrows
- [ ] Click a node → inspector sidebar opens
- [ ] Inspector shows node params

### 5.3 Full studio (`#app`)

- [ ] Sidebar lists node types: HTTP, Agent, Condition, Transform, etc.
- [ ] Drag a node type onto canvas → node appears
- [ ] Connect two nodes by dragging from output to input port
- [ ] Delete a node with keyboard (Delete key)
- [ ] Undo with Ctrl+Z / Cmd+Z
- [ ] "Save" button works (local or remote)
- [ ] "Export JSON" produces valid workflow JSON

### 5.4 Product Map (`#map`)

- [ ] Product map view loads
- [ ] Hierarchical cards render (Product > Workflow > Feature)
- [ ] "Add card" modal works
- [ ] Approval workflow buttons visible

### 5.5 Test run

- [ ] Build a simple flow: HTTP → Transform → Output
- [ ] Click "Test Run"
- [ ] Each node animates/highlights as it executes
- [ ] Output panel shows results
- [ ] Error state renders if a node fails

### 5.6 Responsive

- [ ] Canvas remains usable at 1024px
- [ ] Mobile: acceptable to show "Please use desktop" message (canvas is hard on mobile)

---

## 6. Engine API

**URL**: https://api.lunaos.ai
**Stack**: Hono on Cloudflare Workers
**Primary goal**: Programmatic access to agents

### 6.1 Public endpoints (no auth)

```bash
# Health check
curl https://api.lunaos.ai/health
# Expected: {"status":"healthy","version":"...","time":"..."}
```

- [ ] Returns 200
- [ ] Response is valid JSON
- [ ] Response time < 200ms

```bash
# Readiness check (DB ping)
curl https://api.lunaos.ai/ready
```

- [ ] Returns 200 when healthy, 503 when DB down

```bash
# Public agent list
curl https://api.lunaos.ai/agents/list
```

- [ ] Returns JSON array of agents
- [ ] Each agent has: slug, name, category, tier, hasSystemPrompt
- [ ] Total count ≥ 28

### 6.2 CORS

```bash
# Test CORS from browser
curl -H "Origin: https://lunaos.ai" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://api.lunaos.ai/agents/execute -v 2>&1 | grep -i "access-control"
```

- [ ] `Access-Control-Allow-Origin: https://lunaos.ai` present
- [ ] `Access-Control-Allow-Methods` includes POST
- [ ] Requests from `https://evil.com` are rejected

### 6.3 Auth endpoints

```bash
# Signup
curl -X POST https://api.lunaos.ai/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test+api@example.com","password":"TestPass123!","org_name":"Test Co"}'
```

- [ ] Returns 200 with JWT token on success
- [ ] Returns 400 on missing fields
- [ ] Returns 409 if email exists
- [ ] Password is hashed (never returned)

```bash
# Login
curl -X POST https://api.lunaos.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test+api@example.com","password":"TestPass123!"}'
```

- [ ] Returns 200 + JWT on success
- [ ] Returns 401 on bad password
- [ ] Returns 404 / 401 on unknown email

```bash
# Get current user (save token first)
TOKEN="<jwt from login>"
curl https://api.lunaos.ai/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] Returns user object with id, email, role
- [ ] 401 on missing or invalid token

### 6.4 Agent execution (authenticated)

```bash
# Run a single agent
curl -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "function add(a, b) { return a + b }",
    "useRag": false
  }'
```

- [ ] Returns SSE stream (text/event-stream)
- [ ] Streams `token` events
- [ ] Final `done` event with executionId, duration, tokens
- [ ] X-Context-Savings header present

### 6.5 Parallel swarm (NEW)

```bash
# Swarm: run 3 agents in parallel
curl -X POST https://api.lunaos.ai/agents/swarm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agents": ["code-review", "security-audit", "test-writer"],
    "context": "function login(pw) { return pw === \"admin\" }",
    "strategy": "consensus"
  }'
```

- [ ] Returns JSON (not SSE)
- [ ] Response has: strategy, winner, allResults, totalDurationMs, reason
- [ ] winner.output is non-empty
- [ ] allResults has 3 items
- [ ] reason describes why that winner was picked

Test all 3 strategies:
- [ ] `race` → fastest agent wins
- [ ] `consensus` → majority agreement
- [ ] `vote` → longest output wins

### 6.6 Rate limiting

```bash
# Hit rate limit
for i in {1..200}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://api.lunaos.ai/agents/execute \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"agent":"code-review","context":"x"}'
done | sort | uniq -c
```

- [ ] See 429 responses after ~100 requests/minute
- [ ] 429 response has `Retry-After` header
- [ ] Normal 200s resume after cooldown

### 6.7 API keys

```bash
# Create API key
curl -X POST https://api.lunaos.ai/apikeys/generate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"test-key","scopes":["read","execute"]}'
```

- [ ] Returns 200 with full key (one time only)
- [ ] Key starts with `sk_` or similar prefix

```bash
# List keys
curl https://api.lunaos.ai/apikeys \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] Returns array of keys with prefix only
- [ ] Full key never returned in list

```bash
# Use API key instead of JWT
API_KEY="<key from generate>"
curl https://api.lunaos.ai/agents/list \
  -H "X-API-Key: $API_KEY"
```

- [ ] API key auth works equivalently to JWT

### 6.8 Billing

```bash
# List plans (no auth)
curl https://api.lunaos.ai/billing/plans
```

- [ ] Returns Free, Pro ($29), Team ($79) with features
- [ ] LemonSqueezy checkout URLs in response

### 6.9 Error handling

- [ ] 400 responses include correlation ID
- [ ] 500 responses don't leak stack traces in production
- [ ] All error bodies are valid JSON `{error, correlation_id}`

### 6.10 Performance

- [ ] `/health` response < 50ms P95
- [ ] `/agents/list` response < 200ms P95
- [ ] `/agents/execute` TTFB < 500ms
- [ ] Cold start (first request after idle) < 2s

---

## 7. CLI

**Package**: `luna-agents` on npm
**Primary goal**: Claude Code plugin with 232 commands

### 7.1 Install

```bash
# Fresh install test
npm uninstall -g luna-agents 2>/dev/null
npm install -g luna-agents
```

- [ ] Install succeeds without errors
- [ ] Version matches latest (2.0.1+)
- [ ] `which luna-setup` shows the binary path

### 7.2 Setup

```bash
cd /tmp
mkdir test-project && cd test-project
luna-setup
```

- [ ] Prompts for config (API key, org, etc.)
- [ ] Creates `.luna/` directory
- [ ] Writes config file
- [ ] Idempotent (run twice, no errors)

### 7.3 Plugin detection in Claude Code

- [ ] Open Claude Code in a project
- [ ] Type `/luna-agents:` → autocomplete lists commands
- [ ] Command count ≥ 232
- [ ] `/luna-agents:cmds` shows full list

### 7.4 Core slash commands

Test each in Claude Code:

- [ ] `/luna-agents:plan "add a login page"` → generates task breakdown
- [ ] `/luna-agents:go` → implements next task
- [ ] `/luna-agents:test` → runs tests
- [ ] `/luna-agents:rev` → code review
- [ ] `/luna-agents:ship` → deploys
- [ ] `/luna-agents:cmds` → lists all commands
- [ ] `/luna-agents:help` → shows help

### 7.5 MCP servers

```bash
# Check MCP server directories installed
ls $(npm root -g)/luna-agents/mcp-servers/
```

- [ ] `luna-nexa-rag/` exists
- [ ] `luna-glm-vision/` exists
- [ ] `luna-vision-rag-client/` exists

### 7.6 Uninstall

```bash
npm uninstall -g luna-agents
```

- [ ] Removes binary cleanly
- [ ] `.luna/` in projects remains (user data)

---

## 8. Cross-Browser Matrix

Test all 5 web products (marketing, docs, dashboard, studio, API via curl) on each:

| Browser | Version | Marketing | Docs | Dashboard | Studio | API |
|---------|---------|-----------|------|-----------|--------|-----|
| **Chrome** | Latest | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Firefox** | Latest | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Safari** | 17+ | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Edge** | Latest | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Chrome Mobile** | Latest | [ ] | [ ] | [ ] | [ ] | N/A |
| **Safari iOS** | Latest | [ ] | [ ] | [ ] | [ ] | N/A |

### Common browser-specific issues to check

- [ ] **Safari**: CSS backdrop-filter works, date inputs render correctly
- [ ] **Firefox**: ReactFlow canvas pan/zoom smooth
- [ ] **Edge**: Fonts load without flash
- [ ] **iOS Safari**: 100vh doesn't cause layout jump
- [ ] **All**: Console has zero errors on fresh load

---

## 9. Mobile Platform Testing

### 9.1 iOS (iPhone 14+, iOS 17+)

- [ ] Marketing site loads in Safari, layout correct
- [ ] Tap targets ≥ 44px
- [ ] No horizontal scroll
- [ ] Pinch-to-zoom disabled on auth forms
- [ ] `input type="password"` doesn't trigger autofill incorrectly
- [ ] Dashboard drawer opens/closes smoothly
- [ ] Studio canvas shows "use desktop" or works in landscape

### 9.2 Android (Pixel 6+, Android 13+)

- [ ] Marketing site in Chrome, layout correct
- [ ] Material-style scrolling feels native
- [ ] Back button works correctly
- [ ] Pull-to-refresh doesn't break dashboard state

### 9.3 Tablet (iPad 10+, iPadOS 17+)

- [ ] Layouts use tablet breakpoints (not mobile)
- [ ] Studio canvas usable with touch
- [ ] Split-view compatible

---

## 10. Accessibility Audit

### 10.1 Keyboard navigation

For each product:

- [ ] Tab through all interactive elements
- [ ] Focus order matches visual order
- [ ] Focus indicators visible on all focusable elements
- [ ] Escape closes modals/dropdowns
- [ ] Enter submits forms
- [ ] Space toggles checkboxes

### 10.2 Screen reader (VoiceOver / NVDA)

- [ ] Page landmarks announced (main, nav, footer)
- [ ] Headings form a logical outline (h1 → h2 → h3)
- [ ] Form inputs have labels
- [ ] Buttons have accessible names
- [ ] Images have alt text (or role="presentation" if decorative)
- [ ] ARIA live regions announce dynamic updates

### 10.3 Color contrast

Use Chrome DevTools → Lighthouse → Accessibility, or WebAIM Contrast Checker:

- [ ] Body text ≥ 4.5:1 contrast
- [ ] Large text (18pt+) ≥ 3:1
- [ ] UI components (buttons, borders) ≥ 3:1
- [ ] Dark mode meets same ratios

### 10.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce)
```

- [ ] Test in System Preferences → Accessibility → Reduce Motion (macOS)
- [ ] Heavy animations disabled or simplified
- [ ] No parallax scrolling when reduced-motion is on

### 10.5 WCAG 2.1 AA checks

- [ ] No content flashes > 3x/sec (seizure risk)
- [ ] All functionality available via keyboard
- [ ] Error messages identify the field and fix
- [ ] Forms allow review before submission

---

## 11. Performance Baselines

### 11.1 Web Vitals (via Lighthouse)

Target scores for each product:

| Product | Perf | A11y | Best | SEO |
|---------|------|------|------|-----|
| Marketing | 95+ | 100 | 95+ | 100 |
| Docs | 95+ | 95+ | 95+ | 95+ |
| Dashboard | 85+ | 95+ | 90+ | 80+ |
| Studio | 80+ | 90+ | 90+ | 80+ |

### 11.2 Core Web Vitals

- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] FID (First Input Delay) < 100ms
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] INP (Interaction to Next Paint) < 200ms

### 11.3 API latencies

```bash
# Warm up
for i in {1..5}; do
  curl -o /dev/null -s -w "%{time_total}\n" https://api.lunaos.ai/health
done

# Measure P95
for i in {1..100}; do
  curl -o /dev/null -s -w "%{time_total}\n" https://api.lunaos.ai/agents/list
done | sort -n | tail -5
```

- [ ] /health P95 < 100ms
- [ ] /agents/list P95 < 300ms
- [ ] /agents/execute TTFB < 500ms (first token)

### 11.4 Bundle sizes

```bash
# Dashboard
curl -sI https://agents.lunaos.ai/_next/static/chunks/main.js | grep -i content-length

# Studio
curl -sI https://studio.lunaos.ai/assets/index.js | grep -i content-length
```

- [ ] Dashboard main JS < 200KB gzipped
- [ ] Studio main JS < 400KB gzipped
- [ ] Marketing total page weight < 500KB

---

## 12. Bug Report Template

When filing a bug, use this template:

```markdown
### Summary
[One-line description]

### Product
- [ ] Marketing (lunaos.ai)
- [ ] Docs (docs.lunaos.ai)
- [ ] Dashboard (agents.lunaos.ai)
- [ ] Studio (studio.lunaos.ai)
- [ ] API (api.lunaos.ai)
- [ ] CLI (luna-agents)

### Environment
- Browser: Chrome 122 / Firefox 123 / Safari 17 / Edge 122
- OS: macOS 14 / Windows 11 / Ubuntu 24 / iOS 17 / Android 14
- Device: Desktop 1920×1080 / iPhone 15 / iPad Air
- Viewport: 1920×1080

### Steps to reproduce
1.
2.
3.

### Expected behavior
[What should happen]

### Actual behavior
[What actually happened]

### Console errors
```
[Paste any errors from DevTools console]
```

### Network errors
[Paste any failed requests from Network tab]

### Screenshot
[Attach if applicable]

### Severity
- [ ] P0 — Blocking (users can't sign up/use the product)
- [ ] P1 — Critical (major feature broken)
- [ ] P2 — High (feature degraded)
- [ ] P3 — Medium (minor issue)
- [ ] P4 — Low (cosmetic)
```

---

## Appendix A: Quick Smoke Test (15 min)

If you only have 15 minutes, run these:

```bash
# 1. All domains respond
for url in lunaos.ai docs.lunaos.ai agents.lunaos.ai studio.lunaos.ai api.lunaos.ai; do
  echo -n "$url: "
  curl -o /dev/null -s -w "%{http_code}\n" https://$url
done
```

- [ ] All 5 return 200

- [ ] Marketing: hero install command correct
- [ ] Docs: /whats-new page loads
- [ ] Dashboard: signup form renders
- [ ] Studio: demo canvas loads
- [ ] API: /health returns JSON
- [ ] npm: `npm view luna-agents version` returns 2.0.1+

```bash
# 2. API end-to-end
curl https://api.lunaos.ai/health | jq .
curl https://api.lunaos.ai/agents/list | jq '.agents | length'
# Expect: ≥ 28
```

- [ ] Agent count ≥ 28

```bash
# 3. CLI install
npm view luna-agents
# Expect: version 2.0.1 or higher
```

---

## Appendix B: Testing Schedule Template

For regular QA cycles:

| Frequency | Tests |
|-----------|-------|
| **Every commit** (CI) | Unit tests (Vitest/Jest) |
| **Every PR** | Unit + integration + smoke |
| **Daily** | Full smoke test (appendix A) |
| **Weekly** | Full manual testing (this doc) |
| **Monthly** | Cross-browser matrix + mobile |
| **Quarterly** | Full accessibility audit + load testing |

---

## Appendix C: Production Monitoring

Even with perfect manual testing, monitor these in production:

- [ ] Sentry error rate < 0.1% of requests
- [ ] Cloudflare Analytics: no country blocked unexpectedly
- [ ] Worker CPU time P95 < 50ms
- [ ] D1 query time P95 < 20ms
- [ ] Vectorize query time P95 < 100ms
- [ ] Alert on any 500 response
- [ ] Alert on auth failures > 10/min (possible attack)

---

**Last updated**: 2026-04-10
**Maintained by**: LunaOS QA
**Total checks**: ~250+
