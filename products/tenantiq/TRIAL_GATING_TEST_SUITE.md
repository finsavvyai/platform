# TenantIQ — Trial Gating & Monetization Test Suite

**Version:** 1.0 | **Total Tests:** 72 | **URL:** https://app.tenantiq.app

---

## How to Test

1. Sign in with a **trial account** (plan = 'trial' or 'free')
2. Work through each section in order
3. Mark each test PASS/FAIL/SKIP
4. To test paid plans, temporarily change `$auth.user.plan` in localStorage or use a paid account

---

## Section 1: Trial Badge & Grace Period (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1.1 | Trial badge visible | Check sidebar next to user name | Amber badge showing "Xd left" or green "Trial" | |
| 1.2 | Grace period banner | Check top of page (if trial expired) | Amber banner: "X days left" with "View plans" button, dismissible | |
| 1.3 | Banner dismissible | Click X on grace period banner | Banner disappears for this session | |
| 1.4 | Banner returns on refresh | Reload page after dismissing | Banner reappears (session-only dismiss) | |
| 1.5 | Expired overlay | Navigate any page (if grace period over) | Soft overlay: "We loved having you on the trial" with benefits and "Choose a plan" CTA | |
| 1.6 | Settings accessible when expired | Navigate to /settings (if grace expired) | Settings page loads WITHOUT overlay — billing accessible | |
| 1.7 | Billing section visible | Navigate to /settings, scroll to billing | Plans section with Starter $49, Professional $99, Enterprise Custom | |
| 1.8 | Plan cards clickable | Click "Get Started" on any plan | Button is present and clickable (may link to payment flow) | |

---

## Section 2: CIS Benchmark Gating (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 2.1 | Score ring visible | Go to /security/cis with trial account | Score ring shows compliance percentage (always visible — this is the hook) | |
| 2.2 | Section cards visible | Check dimension cards | All 5 section cards (Identity, Application, Data, Email, Audit) with scores visible | |
| 2.3 | First 3 controls visible | Scroll to controls table | First 3 controls fully visible with pass/fail/partial badges and details | |
| 2.4 | Remaining controls blurred | Scroll past 3rd control | Remaining controls hidden behind blur overlay | |
| 2.5 | Gate message correct | Check blur overlay text | Shows "X more CIS Controls available" with lock icon | |
| 2.6 | Upgrade button present | Check blur overlay | "Upgrade to Professional" button linking to /settings?tab=billing | |
| 2.7 | Click upgrade navigates | Click "Upgrade to Professional" | Navigates to /settings page with billing section scrolled into view | |
| 2.8 | Paid user sees all | Switch to professional plan account | All 17+ controls visible, no blur overlay | |

---

## Section 3: Alerts Gating (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 3.1 | Alert count visible | Go to /alerts with trial account | "X active alerts" header with count visible (hook) | |
| 3.2 | Filters visible | Check status/severity dropdowns | Filter dropdowns functional (can filter what's visible) | |
| 3.3 | First 2 alerts visible | Check alert list | First 2 alerts fully visible with severity badges, titles, details | |
| 3.4 | Remaining alerts blurred | Check after 2nd alert | Remaining alerts behind blur overlay | |
| 3.5 | Gate message correct | Check blur overlay | "X more Alerts available" with lock icon | |
| 3.6 | Upgrade CTA present | Check overlay button | "Upgrade to Starter" button | |
| 3.7 | Paid user sees all | Switch to starter+ plan | All alerts visible, no blur | |

---

## Section 4: License Gating (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 4.1 | Total waste visible | Go to /licenses with trial account | Total license spend and waste $ amount visible in metric cards (this is the hook!) | |
| 4.2 | Utilization metrics visible | Check metric cards | All top-level metric cards (spend, waste, utilization %) visible | |
| 4.3 | First 3 SKUs visible | Check license table | First 3 SKUs fully visible with pricing, assigned/available counts | |
| 4.4 | Remaining SKUs blurred | Check after 3rd SKU | Remaining SKUs behind blur overlay | |
| 4.5 | Gate message correct | Check blur overlay | "X more Licenses available" with lock icon | |
| 4.6 | Waste analysis gated | Check waste analysis section | Waste breakdown may be gated for detailed per-SKU view | |
| 4.7 | Export works for visible | Click Export > CSV | Exports only the 3 visible SKUs (not gated data) | |
| 4.8 | Paid user sees all | Switch to starter+ plan | All SKUs visible, full export | |

---

## Section 5: Compliance Framework Gating (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 5.1 | One framework visible | Go to /security/compliance with trial account | 1 framework card visible (first of SOC2/HIPAA/GDPR) | |
| 5.2 | Other frameworks gated | Check remaining framework cards | Other 2 frameworks blurred or show "Upgrade" overlay | |
| 5.3 | Visible framework expandable | Click the visible framework | Controls table expands with pass/fail/partial badges | |
| 5.4 | Gate message present | Check gated frameworks | "Upgrade to Professional for all compliance frameworks" | |
| 5.5 | Professional sees all 3 | Switch to professional plan | All 3 frameworks visible and expandable | |
| 5.6 | Starter sees 1 | Switch to starter plan | Same as trial — 1 framework visible | |

---

## Section 6: Skill Marketplace Pricing (10 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6.1 | Skills page loads | Go to /skills | Grid of skill cards with categories | |
| 6.2 | Free skills marked | Check Security Monitoring, Dashboard | Price shows "Included" or "$0", no "Add to Plan" needed | |
| 6.3 | Paid skill pricing | Check CIS Benchmark skill card | Shows "$15/mo/tenant" price | |
| 6.4 | Plan tier badge | Check paid skill cards | Badge showing "Professional+" or "Enterprise" | |
| 6.5 | Add to Plan button | Check paid skill card | "Add to Plan" button visible (not just "Activate") | |
| 6.6 | Deactivate button | Check active skill card | "Deactivate" button visible next to "Open" | |
| 6.7 | Foundation not deactivatable | Check free skill (price=0) | No "Deactivate" button on free/foundation skills | |
| 6.8 | Deactivate works | Click Deactivate on an active skill | Toast: skill deactivated, card updates to inactive state | |
| 6.9 | Pricing categories correct | Check skill prices match spec | Security Monitoring $0, CIS $15, License Opt $10, AI Autopilot $25, Backup $20 | |
| 6.10 | Skill opens correctly | Click "Open" on an active skill | Navigates to the correct feature page | |

---

## Section 7: Billing & Plans (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7.1 | Plans section visible | Go to /settings, find billing section | 3 plan cards: Starter $49, Professional $99, Enterprise Custom | |
| 7.2 | Recommended badge | Check Professional plan card | "Recommended" badge on Professional plan | |
| 7.3 | Feature lists accurate | Check each plan's feature list | Features match: Starter (9 tenants, monitoring), Professional (25 tenants, AI, compliance), Enterprise (unlimited, SSO/SAML, white-label) | |
| 7.4 | CTA buttons present | Check each plan card | "Get Started" on Starter/Professional, "Contact Sales" on Enterprise | |
| 7.5 | Auto-scroll from banner | Click "View plans" on trial banner | Settings page opens and scrolls to billing section | |
| 7.6 | Current plan indicated | Check plan cards (if on a plan) | Current plan highlighted or shows "Current Plan" label | |
| 7.7 | Trial text accurate | Check subtitle text | Shows trial end date or "Your trial has ended" message | |

---

## Section 8: Tenant Permissions Display (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 8.1 | Permissions button visible | Go to /settings, find tenant card | "Permissions" button on each tenant card | |
| 8.2 | Permissions expand | Click "Permissions" button | Expandable section shows Graph API permissions grid | |
| 8.3 | Permission categories shown | Check expanded permissions | Shows: Users R/W, Groups R/W, Policies R/W, Security Read, Audit Read, Mail Send, Directory Read | |
| 8.4 | MS docs reference | Check permissions section footer | "Manage in Azure Portal > App Registrations" text | |
| 8.5 | Collapse works | Click "Permissions" again | Section collapses | |

---

## Section 9: AI Guide Chatbot (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 9.1 | Chat bubble visible | Check bottom-right corner on any page | Floating circular chat button (56px) | |
| 9.2 | Opens on click | Click the chat bubble | Panel opens (380x500px) with "TenantIQ Guide" header | |
| 9.3 | Free badge shown | Check chat panel header | "Free" badge visible | |
| 9.4 | Basic question works | Type "What is TenantIQ?" and send | Bot responds with product description | |
| 9.5 | Navigation question | Type "Show me security" | Response includes link to /security page | |
| 9.6 | Feature question | Type "How do I run a scan?" | Response explains CIS scan process with navigation | |
| 9.7 | Unknown question fallback | Type a complex/random question | Response: "For advanced AI analysis, use the AI Agent page" with upgrade link | |
| 9.8 | Close button works | Click X on chat panel | Panel closes, bubble remains | |

---

## Section 10: Certificate Reminders (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 10.1 | Reminder bell visible | Go to /security, hover a certificate row | Bell icon appears on hover | |
| 10.2 | Reminder modal opens | Click bell icon on a certificate | Modal opens with "Set Expiry Reminder" title | |
| 10.3 | Channel selection | Check modal content | Email/SMS toggle buttons | |
| 10.4 | Days selector | Check dropdown | Options: 7, 14, 30, 60, 90 days before | |
| 10.5 | Save reminder | Fill notes, click Save Reminder | Modal closes (reminder saved to localStorage) | |

---

## Section 11: Sign-In Page Design (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 11.1 | Dark theme | Sign out, view sign-in page | Dark background (#060b0f) with green grid overlay | |
| 11.2 | Left panel content | Check left side | TenantIQ logo, "M365 security, fully in control." headline, stats (100+, 5, 13+), compliance badges | |
| 11.3 | Right panel card | Check right side | Glassmorphism sign-in card with Microsoft button | |
| 11.4 | Status bar | Check below sign-in card | Green pulsing dot: "Security scan running across tenants" | |
| 11.5 | Responsive layout | Resize to mobile width | Stacks vertically, card below headline | |

---

## Section 12: MSP Profit Dashboard (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 12.1 | Page loads | Navigate to /msp/profit | Header: "MSP Profit Dashboard" | |
| 12.2 | Metric cards | Check top row | 4 cards: Total Savings, TenantIQ Cost, Net Margin, Average ROI | |
| 12.3 | Tenant table | Check profit table | Tenants listed with savings, cost, margin, ROI columns | |
| 12.4 | ROI color coding | Check ROI column | Green for positive, amber for break-even, red for negative | |
| 12.5 | Export works | Click Export button | CSV/JSON export options available | |

---

## Summary Table

| # | Section | Tests | Priority |
|---|---------|-------|----------|
| 1 | Trial Badge & Grace Period | 8 | P0 |
| 2 | CIS Benchmark Gating | 8 | P0 |
| 3 | Alerts Gating | 7 | P0 |
| 4 | License Gating | 8 | P0 |
| 5 | Compliance Framework Gating | 6 | P1 |
| 6 | Skill Marketplace Pricing | 10 | P1 |
| 7 | Billing & Plans | 7 | P0 |
| 8 | Tenant Permissions | 5 | P2 |
| 9 | AI Guide Chatbot | 8 | P1 |
| 10 | Certificate Reminders | 5 | P2 |
| 11 | Sign-In Page Design | 5 | P1 |
| 12 | MSP Profit Dashboard | 5 | P2 |
| **Total** | | **72** | |

---

## Test Priority Guide

**P0 (Must pass before launch):** Sections 1, 2, 3, 4, 7 — trial gating and billing are revenue-critical

**P1 (Should pass):** Sections 5, 6, 9, 11 — compliance gating, skill pricing, chatbot, sign-in design

**P2 (Nice to have):** Sections 8, 10, 12 — permissions display, reminders, profit dashboard

---

## Test Accounts Needed

| Account Type | Plan | Purpose |
|-------------|------|---------|
| Trial (active) | trial | Test gating with visible trial badge |
| Trial (expired, grace period) | trial | Test grace period banner and countdown |
| Trial (fully expired) | trial | Test overlay blocking content |
| Starter | starter | Verify gating lifts for starter features |
| Professional | professional | Verify all controls/frameworks visible |
| Enterprise | enterprise | Verify everything unlocked |

To simulate different plans without multiple accounts, modify `localStorage`:
```javascript
// In browser console:
const user = JSON.parse(localStorage.getItem('tenantiq_user'));
user.plan = 'professional'; // change plan
localStorage.setItem('tenantiq_user', JSON.stringify(user));
location.reload();
```
