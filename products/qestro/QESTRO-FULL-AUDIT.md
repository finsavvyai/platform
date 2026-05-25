# QESTRO — BRUTAL PRODUCT AUDIT

**Auditor:** Senior Product/QA/Security Reviewer
**Date:** April 7, 2026
**Product:** Qestro — AI-Powered QA Platform
**URL:** http://localhost:3000
**Type:** SaaS / Testing Automation
**Target Audience:** QA Engineers, Developers, DevOps Teams
**Conversion Goal:** Signup → Dashboard → Test Creation
**Competitors:** Cypress, Playwright, Detox, Maestro, CloudQA, TestRigor

---

## EXECUTIVE SUMMARY

**Overall Verdict: NOT LAUNCH-READY. This is a demo dressed as a product.**

The frontend is polished and well-animated. The backend is a mock server returning hardcoded data. Authentication doesn't validate tokens. There is no real database connection. Every feature that appears functional is faking it. The landing page claims "500+ teams trust us" with fabricated testimonials. An OpenAI API key is exposed in plaintext in the repository. There is no privacy policy, no terms of service, no security page, and no real customer data anywhere in the system.

If you sent paid traffic here today, users would sign up, see a beautiful dashboard full of fake data, try to create a test, get mock results, and leave — never to return. Enterprise buyers would run a basic due diligence check, find no company identity, no legal pages, and no real functionality, and immediately disqualify.

| Metric | Score |
|--------|-------|
| Launch-ready | **No** |
| Trust level | **2/10** |
| Conversion readiness | **3/10** |
| UX maturity | **6/10** |
| Security/trust maturity | **1/10** |
| Design polish | **7/10** |

---

## TOP CRITICAL ISSUES (Ordered by Business Damage)

### 1. ENTIRE BACKEND IS MOCK DATA
- **Severity:** CRITICAL
- **Area:** QA / Trust / Product
- **What's wrong:** The running backend (`index.minimal.ts`) returns 100% hardcoded data. Login returns a fake user. Test generation returns template strings. Recording returns mock sessions. There is no database connection despite PostgreSQL being configured.
- **Why it matters:** Users interact with a Potemkin village. Nothing they do persists. Nothing is real. This is fraud-adjacent if you charge money.
- **Fix:** Switch to `index.production.ts` which connects to the real database and has real route handlers.
- **Impact:** Without this, there is no product. Just a frontend demo.

### 2. JWT AUTHENTICATION IS NOT VALIDATED
- **Severity:** CRITICAL
- **Area:** Security
- **What's wrong:** The `/api/auth/me` endpoint accepts ANY string after "Bearer " as valid authentication. No JWT signature verification. No expiration check. No user lookup. Returns the same hardcoded mock user for every request.
- **Why it matters:** Any person or bot can access every "protected" endpoint by sending `Authorization: Bearer literally-anything`.
- **Fix:** Use the real auth middleware at `backend/src/middleware/auth.ts` which has proper `jwt.verify()`.
- **Impact:** Complete security theater. Zero protection for user data.

### 3. OPENAI API KEY EXPOSED IN REPOSITORY
- **Severity:** CRITICAL
- **Area:** Security
- **What's wrong:** Full OpenAI API key (`sk-proj-FvmJ3...`) is hardcoded in `frontend/.env.development` and committed to git.
- **Why it matters:** Anyone with repository access can use your OpenAI credits. Bots scan public repos for exactly this pattern.
- **Fix:** Immediately revoke the key in OpenAI dashboard. Move to server-side environment variables. Never commit secrets to frontend env files.
- **Impact:** Financial loss, API abuse, potential account suspension.

### 4. FAKE SOCIAL PROOF AND TESTIMONIALS
- **Severity:** HIGH
- **Area:** Trust / Marketing
- **What's wrong:** Landing page claims "Trusted by 500+ teams" with zero evidence. Testimonials from "Acme Corp", "TechStart", "Enterprise Inc" are obviously fabricated placeholder names with gradient avatar circles instead of real photos.
- **Why it matters:** Savvy buyers recognize fake social proof immediately. It destroys trust faster than having no testimonials at all. "Acme Corp" is literally the placeholder name from cartoons.
- **Fix:** Remove all fake testimonials. Remove "500+ teams" claim. Either get real quotes or show nothing.
- **Impact:** Trust-killing. Any enterprise buyer disqualifies you instantly.

### 5. NO PRIVACY POLICY OR TERMS OF SERVICE
- **Severity:** HIGH
- **Area:** Legal / Compliance
- **What's wrong:** The signup page links to `/terms` and `/privacy` but these pages don't exist. Users agree to terms that don't exist.
- **Why it matters:** GDPR violation. FTC enforcement risk. Enterprise buyers require legal pages. App store rejection. Any compliance review fails immediately.
- **Fix:** Create real Privacy Policy and Terms of Service pages. Link them from signup, footer, and settings.
- **Impact:** Legal liability. Enterprise deal-breaker. App review rejection.

### 6. SSO/OAUTH CALLBACK IS A PLACEHOLDER
- **Severity:** HIGH
- **Area:** QA / Auth
- **What's wrong:** The SSO callback page (`SSOCallbackPage.tsx`) only renders `<div>SSO Callback Placeholder</div>`. OAuth redirects from GitHub/Azure AD land on a blank page.
- **Why it matters:** Anyone who clicks "Sign in with GitHub" or "Sign in with Azure AD" hits a dead end.
- **Fix:** Implement the callback handler: parse authorization code, exchange for tokens, create/link user account, redirect to dashboard.
- **Impact:** Broken auth flow. Enterprise SSO is unusable.

### 7. DEMO CREDENTIALS DISPLAYED ON LOGIN PAGE
- **Severity:** HIGH
- **Area:** Security / Trust
- **What's wrong:** The login page shows "Demo account: test@questro.io / testpassword123" in plaintext to every visitor.
- **Why it matters:** Signals the product is a demo, not production software. Undermines the entire login UX. Shows weak password as acceptable.
- **Fix:** Remove demo credentials from the UI entirely. Gate demo access behind an environment variable or separate demo portal.
- **Impact:** Trust destruction. No serious buyer would engage.

### 8. NO 404 PAGE
- **Severity:** MEDIUM
- **Area:** UX / QA
- **What's wrong:** Invalid URLs redirect silently to the dashboard. Users never know they hit a broken link.
- **Fix:** Create a proper 404 page with navigation back to dashboard/home.

### 9. 20+ ROUTES SHOW "RELEASE GATE" PAGE
- **Severity:** MEDIUM
- **Area:** Product / UX
- **What's wrong:** Clicking navigation items like AI Test Gen, API Studio, Security, Compliance, Agents, etc. shows a gate page saying "This page will return after it has a working backend contract." Over half the sidebar navigation leads to locked pages.
- **Why it matters:** Users see a product that promises 20 features but delivers 5. Expectation mismatch kills retention.
- **Fix:** Either hide unreleased features from navigation entirely, or show "Coming Soon" badges inline rather than full-page gates.

### 10. NO REAL TEST EXECUTION
- **Severity:** HIGH
- **Area:** Product / Core Value
- **What's wrong:** The Recording Studio shows hardcoded mock sessions. Test execution returns template code. The "AI Test Generation" returns a static Playwright template string after a fake 1-second delay.
- **Why it matters:** This is the core product promise. "Write tests once, run everywhere." But nothing actually runs.
- **Fix:** Connect to the real Playwright runner service. Wire the AI test generation to the actual LLM endpoint.
- **Impact:** Core value proposition is a lie without this.

---

## FULL DETAILED AUDIT BY CATEGORY

### 1. PRODUCT CLARITY

**What works:**
- Headline "Write Tests Once. Run Everywhere." is clear and compelling.
- Four feature cards on landing page explain the value proposition.
- Navigation sidebar clearly labels features.

**What's broken:**
- The product claims AI-powered test generation but delivers mock templates.
- "Self-Healing Assertions" are described but never demonstrated.
- "Cross-Platform" testing is claimed but mobile testing doesn't exist.
- Landing page says "MCP-Native" but there's no explanation of what MCP means to non-technical visitors.

**What's confusing:**
- The disconnect between what the landing page promises and what the dashboard delivers is jarring.
- Is this a testing platform or a test management tool? The UI mixes both concepts.

### 2. MESSAGING AND POSITIONING

**What's weak:**
- "AI-Powered QA Platform" is generic. Every testing tool claims AI now.
- No clear differentiator articulated against Cypress, Playwright, or TestRigor.
- "Vibe Test Pilot" naming is unclear — what is "vibe testing"?
- Enterprise messaging ("Enterprise Inc" testimonial) is laughable.

**What hurts trust:**
- Using "500+ teams" without evidence.
- Fake testimonials with cartoon-level company names.
- No case studies, no logos, no numbers, no proof.

### 3. MARKETING AND CONVERSION

**What works:**
- CTA buttons are prominent above the fold.
- Pricing page exists with 4 tiers.
- Free tier is clearly labeled.

**What's broken:**
- No actual checkout flow — pricing buttons do nothing.
- No comparison with competitors on the pricing page.
- Feature comparison table shows checkmarks for ALL features across ALL plans (no differentiation).
- No ROI calculator, no demo video, no live demo.
- Zero social proof that's verifiable.

### 4. UX AND USABILITY

**What works:**
- Navigation is intuitive with clear sidebar.
- Pages load with smooth animations.
- Error boundaries catch crashes gracefully.
- Loading states exist (PageLoader).
- Empty states guide users to create content.

**What's broken:**
- Pages silently fall back to mock data when API fails — users can't tell what's real.
- Onboarding shows mock test generation and fake "test passed" results.
- Settings page has Jira integration that connects but can't actually sync.

### 5. UI QUALITY AND VISUAL POLISH

**What works:**
- Design is genuinely good. Dark theme with gradient accents.
- Consistent component library (Button, Card, Badge, Input).
- Framer Motion animations are smooth and professional.
- Typography hierarchy is clear.
- Glass morphism effects are well-executed.

**What's amateur:**
- Some components use light-mode colors (`text-gray-900`, `bg-gray-100`) despite the dark theme.
- Duplicate LoginPage files (two different implementations).
- "Use client" directives from Next.js leaked into Vite components (cosmetic but sloppy).

### 6. MOBILE RESPONSIVENESS

**What works:**
- Hamburger menu on mobile.
- Responsive grid layouts.
- Touch-friendly buttons.

**What's untested:**
- Form usability on small screens.
- Dashboard charts on mobile.
- Recording Studio viewport controls on actual mobile.

### 7. FUNCTIONAL QA

**Broken:**
- SSO callback page is a blank placeholder.
- OAuth buttons (GitHub, Azure AD) lead to dead ends.
- Password reset sends email but there's no reset token page.
- Recording Studio is entirely mock data.
- Test execution returns template code.
- AI test generation is a hardcoded string template.
- Billing buttons don't connect to Stripe.

**Missing states:**
- No 404 page.
- No network error recovery UX.
- No "backend unavailable" indicator.
- No session expiry handling.

### 8. SECURITY AND TRUST

**Critical:**
- OpenAI API key committed to repository in plaintext.
- JWT tokens are not validated (any Bearer string accepted).
- Token generation is predictable: `mock-jwt-access-{timestamp}`.
- No rate limiting on auth endpoints.
- No CSRF protection.
- No input sanitization visible.

**Missing:**
- No security.txt.
- No responsible disclosure policy.
- No SOC2/compliance information.
- No GDPR consent mechanism.
- No cookie consent banner.
- No data encryption claims.

### 9. ACCESSIBILITY

**Missing or weak:**
- No visible focus states on most interactive elements.
- Color contrast in dark theme likely fails WCAG AA in subtle text areas.
- No aria-labels on icon-only buttons.
- No skip navigation link.
- Form error messages don't use aria-live regions.
- Charts (Recharts) likely not screen-reader accessible.

### 10. SEO AND DISCOVERABILITY

**Missing:**
- No meta descriptions per page (SPA limitation).
- No structured data.
- No sitemap.
- No canonical URLs.
- No landing pages for specific use cases.
- Title is generic: "Qestro - AI-Powered QA Platform" on every page.

### 11. PERFORMANCE

**Risks:**
- 44+ lazy-loaded pages — good for code splitting.
- Framer Motion animations are CPU-intensive on low-end devices.
- Recharts loaded for dashboard — heavy dependency.
- No visible image optimization.

### 12. TRUST AND LEGITIMACY

**What's missing:**
- No company name, address, or registration.
- No founder/team page.
- No "About" page.
- No blog.
- No changelog.
- No status page.
- No documentation site.
- No support email or contact form.
- No phone number.
- Testimonials are fabricated.
- Social proof claims are unverified.

---

## PERSONA-BY-PERSONA REVIEW

### 1. First-time Visitor
- **First 5 seconds:** "Clean design, AI testing tool... looks modern."
- **What stops them:** Fake testimonials, no proof, no demo video.
- **Would they convert?** Maybe to free tier out of curiosity. Would abandon after discovering mock data.

### 2. High-intent Buyer
- **First 5 seconds:** "Where's the proof? Where's the demo?"
- **What kills trust:** "Acme Corp" testimonials, no case studies, no ROI data.
- **Would they convert?** No. Not enough evidence to justify even free signup.

### 3. Skeptical Enterprise Buyer
- **First 5 seconds:** "Who is behind this?"
- **What stops them:** No company identity, no legal pages, no security claims, no SOC2, no SSO that works.
- **Would they convert?** Absolutely not. Immediate disqualification.

### 4. Non-technical User
- **What confuses them:** "MCP-Native", "Playwright", "Maestro", "Self-Healing Assertions" — all jargon.
- **Would they convert?** No. Can't understand the product.

### 5. Technical Evaluator
- **What they notice:** Demo credentials on login page. Mock data in dashboard. Template AI responses. No docs.
- **Would they convert?** No. Would identify it as a prototype immediately.

### 6. Mobile User
- **Experience:** Usable but untested. Charts may overflow. Forms may be cramped.

### 7. Returning User
- **Experience:** Session persists via localStorage. But since all data is mock, there's nothing real to return to.

### 8. Accessibility-dependent User
- **Experience:** Likely blocked by missing focus states, missing aria-labels, and contrast issues.

### 9. Security-conscious User
- **What they see:** Demo credentials on login page. No HTTPS enforcement. No security page. Would not trust this with test data.

### 10. Comparison Shopper
- **vs Cypress:** Cypress has docs, community, real functionality. Qestro has animations.
- **vs Playwright:** Playwright is a mature framework. Qestro promises to wrap it but delivers mock data.
- **Verdict:** Would choose any competitor over this in current state.

---

## FLOW-BY-FLOW BREAKDOWN

### Login Flow
- **Entry:** `/login`
- **Friction:** Demo credentials undermine trust. No "forgot password" recovery works end-to-end.
- **Error handling:** Shows error messages. Password reset sends email but no reset page exists.
- **Verdict:** Works for mock login. Not production-ready.

### Signup Flow
- **Entry:** `/register` or `/signup`
- **Friction:** Terms link leads to 404. Company field purpose unclear. Role selection unnecessary for onboarding.
- **Good:** Password validation is thorough. Confirmation field exists.
- **Verdict:** Form works but terms/privacy are missing.

### Dashboard Flow
- **Entry:** `/` (after login)
- **Friction:** Shows mock stats that look real. Users can't tell what's fake.
- **Drop-off:** User tries to do something real, discovers nothing persists.

### Test Creation Flow
- **Entry:** Recording Studio or Stories page
- **Friction:** Recording Studio shows hardcoded sessions. Test generation returns template code.
- **Verdict:** Core product flow is non-functional.

### Pricing/Billing Flow
- **Entry:** `/pricing` or `/billing`
- **Friction:** No checkout. No Stripe integration. Buttons do nothing.
- **Verdict:** Can't monetize.

---

## SECURITY / TRUST RED FLAGS

**Confirmed visible issues:**
1. OpenAI API key in `.env.development` in plaintext
2. Demo credentials displayed on login page
3. JWT tokens not validated (any Bearer string accepted)
4. Token generation uses predictable timestamp-based strings
5. No rate limiting on auth endpoints
6. No privacy policy or terms of service pages

**Likely risks based on patterns:**
7. No CSRF protection
8. No input sanitization/XSS prevention visible
9. CORS allows all localhost origins on any port
10. No secure session management (localStorage only)

**Missing trust/security signals:**
11. No security.txt
12. No responsible disclosure policy
13. No SOC2/compliance information
14. No GDPR consent mechanism
15. No cookie consent banner
16. No company identity or contact information

---

## CONVERSION RATE OPTIMIZATION OPPORTUNITIES

1. **Replace fake testimonials with real ones or remove** — immediate trust boost
2. **Add a demo video** — reduces bounce by 30-50% for SaaS
3. **Add pricing comparison table** — currently all plans show same features
4. **Add live interactive demo** — let visitors try without signup
5. **Remove demo credentials from login** — stops looking like a prototype
6. **Add "About Us" / team page** — builds company credibility
7. **Add documentation site** — proves product depth
8. **Gate signup behind email verification** — improves lead quality

---

## QUICK WINS (High Impact, Low Effort)

1. Remove fake testimonials and "500+ teams" claim
2. Remove demo credentials from login page
3. Delete OpenAI API key from `.env.development`, revoke it
4. Hide unreleased features from sidebar navigation
5. Create stub Privacy Policy and Terms of Service pages
6. Add a 404 page
7. Fix SSO callback to show "Coming Soon" instead of blank div

---

## STRATEGIC IMPROVEMENTS (Bigger Effort, High Impact)

1. Switch backend to `index.production.ts` with real database
2. Implement real JWT validation
3. Wire test generation to actual LLM endpoint
4. Connect Recording Studio to real Playwright service
5. Implement Stripe checkout for pricing tiers
6. Build documentation site
7. Create real case studies from beta users
8. Add SOC2/security posture page
9. Implement SSO callback properly
10. Add comprehensive accessibility improvements

---

## FINAL PRIORITY ROADMAP

### Phase 1: Critical Fixes Before ANY Traffic
- [ ] Revoke and remove exposed OpenAI API key
- [ ] Switch to production backend with real database
- [ ] Implement real JWT validation
- [ ] Remove fake testimonials and unverified claims
- [ ] Remove demo credentials from login page
- [ ] Create Privacy Policy and Terms of Service
- [ ] Fix SSO callback page
- [ ] Add 404 page
- [ ] Hide unreleased features from navigation

### Phase 2: Conversion and Trust Upgrades
- [ ] Add real customer testimonials or remove section
- [ ] Add demo video on landing page
- [ ] Implement actual test generation with LLM
- [ ] Connect Recording Studio to real backend
- [ ] Build documentation site
- [ ] Add company About page with team
- [ ] Differentiate pricing tiers properly
- [ ] Add contact form or support email

### Phase 3: Polish and Scale Readiness
- [ ] Implement Stripe checkout
- [ ] Add SSO (GitHub, Azure AD, Okta) properly
- [ ] Build accessibility compliance
- [ ] Add SEO meta tags and structured data
- [ ] Create competitor comparison pages
- [ ] Add case studies and ROI calculator
- [ ] Implement rate limiting and security headers
- [ ] Add monitoring and error tracking (Sentry)
- [ ] SOC2 preparation

---

## CONSOLIDATED FIX CHECKLIST

| # | Issue | Severity | Category | Page/Flow | Recommended Fix | Priority |
|---|-------|----------|----------|-----------|-----------------|----------|
| 1 | Entire backend is mock data | Critical | Product | All | Switch to index.production.ts with real DB | P0 |
| 2 | JWT not validated | Critical | Security | Auth | Use real auth middleware with jwt.verify() | P0 |
| 3 | OpenAI API key exposed | Critical | Security | Repo | Revoke key, move to server-side env | P0 |
| 4 | Fake testimonials | High | Trust | Landing | Remove or replace with real quotes | P0 |
| 5 | "500+ teams" claim false | High | Trust | Landing | Remove unverified claim | P0 |
| 6 | No privacy policy | High | Legal | Signup | Create real privacy policy page | P0 |
| 7 | No terms of service | High | Legal | Signup | Create real terms page | P0 |
| 8 | SSO callback is placeholder | High | QA | Auth | Implement OAuth callback handler | P0 |
| 9 | Demo credentials on login | High | Trust | Login | Remove from UI, gate behind env var | P0 |
| 10 | No real test execution | High | Product | Dashboard | Connect to Playwright runner service | P1 |
| 11 | AI generation returns template | High | Product | Stories | Wire to actual LLM endpoint | P1 |
| 12 | Recording Studio is mock | High | Product | Recording | Connect to real recording backend | P1 |
| 13 | No 404 page | Medium | UX | All | Create 404 page with nav | P1 |
| 14 | 20+ nav items lead to gate page | Medium | UX | Sidebar | Hide unreleased features | P1 |
| 15 | No billing integration | Medium | Revenue | Billing | Implement Stripe checkout | P1 |
| 16 | Password validation inconsistent | Medium | Security | Auth | Enforce same rules login/signup | P1 |
| 17 | No company identity | Medium | Trust | All | Add About page, team, contact | P1 |
| 18 | No documentation | Medium | Trust | All | Build docs site | P2 |
| 19 | No rate limiting | Medium | Security | Auth | Add rate limiter to auth endpoints | P2 |
| 20 | No CSRF protection | Medium | Security | Forms | Add CSRF tokens | P2 |
| 21 | No cookie consent | Medium | Legal | All | Add GDPR consent banner | P2 |
| 22 | No accessibility audit | Medium | A11y | All | Focus states, aria-labels, contrast | P2 |
| 23 | No SEO meta tags | Low | SEO | All | Add per-page meta descriptions | P2 |
| 24 | No error tracking | Low | Ops | All | Add Sentry or similar | P2 |
| 25 | Mock data shown without indicator | Medium | UX | Dashboard | Show clear offline/demo mode badge | P1 |
| 26 | Duplicate LoginPage files | Low | Code | Auth | Remove unused duplicate | P2 |
| 27 | Token refresh not implemented | Medium | Auth | Session | Implement refresh token rotation | P1 |
| 28 | No password reset page | Medium | Auth | Forgot PW | Build reset token handler page | P1 |
| 29 | Pricing tiers not differentiated | Medium | Revenue | Pricing | Different features per tier | P1 |
| 30 | No demo video | Medium | Marketing | Landing | Record and embed product demo | P1 |

---

## FINAL BRUTAL VERDICT

**What makes this site look weak:** It's a frontend demo pretending to be a product. Beautiful animations wrapping empty functionality. Fake testimonials from companies that don't exist. A backend that returns the same hardcoded JSON regardless of input.

**What makes it hard to trust:** No company identity. No legal pages. No real customers. Demo credentials displayed on the login page like a hackathon project. An exposed API key in the repository.

**What would stop a buyer:** Clicking anything beyond the surface and discovering nothing persists, nothing executes, and nothing is real. The "AI-powered" test generation is a string template with variable interpolation.

**What absolutely must be fixed before serious launch:**
1. A real backend with a real database
2. Real authentication that actually validates tokens
3. At least ONE feature that genuinely works end-to-end (record a test, run it, see real results)
4. Remove all fake social proof
5. Create legal pages
6. Hide unfinished features
7. Revoke the exposed API key

**Would I personally approve this for launch?**

**No.** This is a high-quality prototype, not a product. The frontend engineering is genuinely good — the design system, animations, and component architecture are professional-grade. But a product needs to work. Right now, this is a movie set: impressive from the front, empty behind the facade.

Ship ONE real feature end-to-end before spending a dollar on marketing. A single flow that works — record a test, run it, see the result — would be worth more than all 20 gated feature pages combined.
