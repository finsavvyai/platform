# Trial Data Gating Tests

> 37 tests | Priority: P0

## Prerequisites
- Signed in with a trial account (plan = 'trial' or 'free')
- To simulate different plans, modify localStorage (see below)

### Plan Simulation
```javascript
// In browser console:
const user = JSON.parse(localStorage.getItem('tenantiq_user'));
user.plan = 'professional'; // change to: trial, starter, professional, enterprise
localStorage.setItem('tenantiq_user', JSON.stringify(user));
location.reload();
```

## Tests

### Trial Badge & Grace Period (from trial gating suite section 1)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Trial badge visible | Check sidebar next to user name | Amber badge showing "Xd left" or green "Trial" | |
| 2 | Grace period banner | Check top of page (if trial expired) | Amber banner: "X days left" with "View plans" button, dismissible | |
| 3 | Banner dismissible | Click X on grace period banner | Banner disappears for this session | |
| 4 | Banner returns on refresh | Reload page after dismissing | Banner reappears (session-only dismiss) | |
| 5 | Expired overlay | Navigate any page (if grace period over) | Soft overlay: "We loved having you on the trial" with benefits and "Choose a plan" CTA | |
| 6 | Settings accessible when expired | Navigate to /settings (if grace expired) | Settings page loads WITHOUT overlay -- billing accessible | |
| 7 | Billing section visible | Navigate to /settings, scroll to billing | Plans section with Starter $49, Professional $99, Enterprise Custom | |
| 8 | Plan cards clickable | Click "Get Started" on any plan | Button is present and clickable (may link to payment flow) | |

### CIS Benchmark Gating (from trial gating suite section 2)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 9 | Score ring visible | Go to /security/cis with trial account | Score ring shows compliance percentage (always visible -- this is the hook) | |
| 10 | Section cards visible | Check dimension cards | All 5 section cards (Identity, Application, Data, Email, Audit) with scores visible | |
| 11 | First 3 controls visible | Scroll to controls table | First 3 controls fully visible with pass/fail/partial badges and details | |
| 12 | Remaining controls blurred | Scroll past 3rd control | Remaining controls hidden behind blur overlay | |
| 13 | Gate message correct | Check blur overlay text | Shows "X more CIS Controls available" with lock icon | |
| 14 | Upgrade button present | Check blur overlay | "Upgrade to Professional" button linking to /settings?tab=billing | |
| 15 | Click upgrade navigates | Click "Upgrade to Professional" | Navigates to /settings page with billing section scrolled into view | |
| 16 | Paid user sees all | Switch to professional plan account | All 17+ controls visible, no blur overlay | |

### Alerts Gating (from trial gating suite section 3)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 17 | Alert count visible | Go to /alerts with trial account | "X active alerts" header with count visible (hook) | |
| 18 | Filters visible | Check status/severity dropdowns | Filter dropdowns functional (can filter what's visible) | |
| 19 | First 2 alerts visible | Check alert list | First 2 alerts fully visible with severity badges, titles, details | |
| 20 | Remaining alerts blurred | Check after 2nd alert | Remaining alerts behind blur overlay | |
| 21 | Gate message correct | Check blur overlay | "X more Alerts available" with lock icon | |
| 22 | Upgrade CTA present | Check overlay button | "Upgrade to Starter" button | |
| 23 | Paid user sees all | Switch to starter+ plan | All alerts visible, no blur | |

### License Gating (from trial gating suite section 4)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 24 | Total waste visible | Go to /licenses with trial account | Total license spend and waste $ amount visible in metric cards (this is the hook!) | |
| 25 | Utilization metrics visible | Check metric cards | All top-level metric cards (spend, waste, utilization %) visible | |
| 26 | First 3 SKUs visible | Check license table | First 3 SKUs fully visible with pricing, assigned/available counts | |
| 27 | Remaining SKUs blurred | Check after 3rd SKU | Remaining SKUs behind blur overlay | |
| 28 | Gate message correct | Check blur overlay | "X more Licenses available" with lock icon | |
| 29 | Waste analysis gated | Check waste analysis section | Waste breakdown may be gated for detailed per-SKU view | |
| 30 | Export works for visible | Click Export > CSV | Exports only the 3 visible SKUs (not gated data) | |
| 31 | Paid user sees all | Switch to starter+ plan | All SKUs visible, full export | |

### Compliance Framework Gating (from trial gating suite section 5)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 32 | One framework visible | Go to /security/compliance with trial account | 1 framework card visible (first of SOC2/HIPAA/GDPR) | |
| 33 | Other frameworks gated | Check remaining framework cards | Other 2 frameworks blurred or show "Upgrade" overlay | |
| 34 | Visible framework expandable | Click the visible framework | Controls table expands with pass/fail/partial badges | |
| 35 | Gate message present | Check gated frameworks | "Upgrade to Professional for all compliance frameworks" | |
| 36 | Professional sees all 3 | Switch to professional plan | All 3 frameworks visible and expandable | |
| 37 | Starter sees 1 | Switch to starter plan | Same as trial -- 1 framework visible | |
