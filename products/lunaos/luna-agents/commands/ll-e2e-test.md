---
name: ll-e2e-test
displayName: Luna E2E Test Generator
description: Scan project routes, UI pages, and endpoints to generate a comprehensive browser-based E2E test plan with personas, flows, and status checkboxes
version: 1.0.0
category: testing
parameters:
  - name: output_path
    type: string
    description: Where to save the test plan (default: scripts/e2e-test-plan.md)
    required: false
    prompt: false
workflow:
  - scan_project
  - build_personas
  - generate_test_flows
  - write_test_plan
output:
  - scripts/e2e-test-plan.md (or custom path)
prerequisites: []
---

# Luna E2E Test Plan Generator

Scan the current project's codebase — API routes, UI pages, marketing pages, docs — and generate a comprehensive E2E test plan document designed for manual browser testing with Claude Chrome MCP or any browser-based QA tool.

## Step 1 — Scan the Project

Automatically discover all testable surfaces:

### API Endpoints
- Read all route files in `src/routes/`, `app/api/`, `pages/api/`, or equivalent
- Extract HTTP method + path + auth requirement for each endpoint
- Group by module (auth, billing, agents, teams, etc.)

### UI Pages
- For Next.js: scan `app/**/page.tsx` recursively
- For Vite/React: scan `src/pages/` or router config
- For static sites: scan `*.html` files
- Extract the URL path for each page

### Forms & Interactive Elements
- Identify forms (signup, login, checkout, settings, create/edit/delete flows)
- Identify modals, dropdowns, toggles, and other interactive components
- Note which pages require authentication

### External Integrations
- OAuth flows (GitHub, Google, etc.)
- Payment flows (LemonSqueezy, Stripe)
- Webhook endpoints
- Third-party API calls

## Step 2 — Build Personas

Create 3-5 test personas based on the project's tier/role model:

### Default Personas (adapt to project)

**Persona 1: New Visitor (unauthenticated)**
- Browses marketing pages, pricing, docs
- Signs up for a new account
- Completes onboarding

**Persona 2: Free Tier User**
- Logs in with free account
- Uses core features within free limits
- Hits a paywall or upgrade prompt
- Views billing page

**Persona 3: Paid User (Pro/Team)**
- Logs in with paid account
- Uses premium features
- Manages subscription (upgrade, cancel)
- Uses advanced features (API keys, integrations)

**Persona 4: Admin / Team Owner**
- Creates team, invites members
- Manages roles and permissions
- Views audit logs, analytics
- Manages billing for team

**Persona 5: API Consumer**
- Authenticates via API key
- Calls API endpoints programmatically
- Tests rate limiting, error handling

Adjust personas based on what the project actually supports (check for teams, billing tiers, roles, API keys in the codebase).

## Step 3 — Generate Test Flows

For each persona, generate ordered test flows covering:

### Flow Structure
Each flow is a numbered sequence of steps with:
- **Action**: what to do (navigate, click, type, submit, verify)
- **URL**: the page or endpoint
- **Expected Result**: what should happen
- **Status Checkbox**: `- [ ]` for tracking

### Flow Categories

**Authentication Flows**
- Signup with valid/invalid data
- Login with valid/invalid credentials
- Password reset (if exists)
- OAuth login (if exists)
- Logout
- Session persistence (refresh page, check still logged in)

**Navigation Flows**
- Visit every page in the sitemap
- Verify no 404s, broken links, or console errors
- Check page titles, meta tags, OG images
- Test responsive layout (mobile, tablet, desktop)

**Core Feature Flows**
- For each main feature: create → read → update → delete
- Test with valid and invalid inputs
- Test empty states (no data yet)
- Test loading states and error states

**Billing Flows**
- View pricing page
- Initiate checkout (don't complete payment)
- View subscription status
- View usage/limits
- Test upgrade prompt when hitting a limit

**Integration Flows**
- Connect/disconnect external services
- Test webhook delivery (if applicable)
- Test API key generation and usage

**Error & Edge Case Flows**
- Submit empty forms
- Use invalid data formats
- Test rate limiting (rapid requests)
- Test unauthorized access (visit auth-required pages without login)
- Test direct URL access to deep pages

**Security Flows**
- Verify auth-required pages redirect to login
- Verify CORS headers on API
- Verify security headers (HSTS, X-Frame-Options, CSP)
- Test XSS vectors in input fields
- Test CSRF protection on forms

## Step 4 — Write the Test Plan

Output a single markdown file with this structure:

```markdown
# E2E Test Plan — {Project Name}

Generated: {date}
Total Tests: {count}
Personas: {count}

## How to Use

1. Open each URL in Chrome with Claude Chrome MCP or manually
2. Follow the steps in order for each persona
3. Mark each checkbox [x] when verified
4. Note any failures inline

---

## Persona 1: {Name} ({role/tier})

### Flow 1.1: {Flow Name}

- [ ] **Step 1**: Navigate to {url}
  - Expected: {what should appear}
- [ ] **Step 2**: Click "{button/link text}"
  - Expected: {result}
- [ ] **Step 3**: Fill in {field} with "{value}"
  - Expected: {validation feedback}
...

### Flow 1.2: {Flow Name}
...

---

## Persona 2: {Name}
...

---

## API Endpoint Tests

### Auth Endpoints
- [ ] `POST /auth/signup` — valid data → 200 + token
- [ ] `POST /auth/signup` — duplicate email → 409
- [ ] `POST /auth/login` — valid → 200 + token
- [ ] `POST /auth/login` — wrong password → 401
...

### {Module} Endpoints
- [ ] `{METHOD} {path}` — {scenario} → {expected status}
...

---

## Cross-Browser / Responsive Tests

- [ ] Marketing pages on mobile (375px)
- [ ] Dashboard on tablet (768px)
- [ ] Dashboard on desktop (1440px)
- [ ] Safari compatibility
- [ ] Firefox compatibility

---

## Security Checklist

- [ ] All API endpoints require auth (except public ones)
- [ ] HSTS header present
- [ ] X-Frame-Options: DENY
- [ ] CSP header present
- [ ] No sensitive data in URL params
- [ ] Cookies have Secure + HttpOnly flags
```

## After Generation

Tell the user:
1. The test plan is at `{output_path}`
2. Total test count and persona count
3. Suggest running with Claude Chrome MCP for automated browser testing
4. Suggest marking items [x] as they pass
