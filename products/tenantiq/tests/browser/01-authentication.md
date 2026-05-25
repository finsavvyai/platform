# Authentication & Session Tests

> 20 tests | Priority: P0

## Prerequisites
- Access to https://app.tenantiq.app
- Microsoft OAuth admin account
- Trial, grace period, and expired trial accounts for full coverage

## Tests

### Auth & Session (from main suite section 1)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Sign in | Click "Sign in with Microsoft" | Redirects to Microsoft login, returns to dashboard | |
| 2 | Session persists | Reload the page | User remains signed in, sidebar shows name | |
| 3 | Tenant loaded | Check sidebar | Shows tenant name (e.g., "Global Remit") | |
| 4 | Trial badge (active) | Check sidebar user name badge | Shows green "Trial" badge if trial active, amber "Xd left" during grace period, or blue "Free" after grace expires | |
| 5 | Trial status | Check sidebar trial section | Active: green "Trial ends [date]". Grace period: amber "X days of access left" with "Upgrade" link. Expired: blue "Ready to upgrade?" with "View plans" link | |
| 6 | User avatar | Check sidebar user section | Shows first letter of name in blue circle | |
| 7 | Sign out | Click "Sign Out" at bottom of sidebar | Redirects to sign-in screen, clears session | |
| 8 | Re-sign in | Sign in again | All data restored, same tenant selected | |
| 9 | Grace period banner | Check top banner (if trial expired <7 days) | Amber banner: "X days left -- Your trial ended, but we've extended your access". Dismissible. "View plans" button | |
| 10 | Grace period overlay | Navigate any page (if trial expired >7 days) | Soft overlay: "We loved having you on the trial" with benefits cards and "Choose a plan" CTA. Settings page still accessible | |

### Auth Callback (from main suite section 31)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 11 | Successful callback | Navigate to /auth/callback?token=...&user=... | Shows spinner "Signing you in...", then redirects to / | |
| 12 | Error display | Navigate to /auth/callback?error=some_error | Shows "Sign-in Failed" with error details | |
| 13 | Permission error | Callback with AADSTS permission error | Shows "Permission Issue" help box with Azure Portal instructions | |
| 14 | Token error | Callback with expired token error | Shows "Session Expired" help box with "Try Again" button | |

### Trial & Grace Period UX (from main suite section 51)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 15 | Active trial sidebar | Check sidebar (active trial) | Green trial section showing "Trial ends [date]" | |
| 16 | Grace period sidebar | Check sidebar (expired trial, <7 days) | Amber "X days of access left" with "Upgrade to keep access" link | |
| 17 | Grace period banner | Check top of page (expired trial, <7 days) | Amber banner with countdown, "View plans" button, dismissible X | |
| 18 | Banner dismissible | Click X on grace period banner | Banner disappears for this session | |
| 19 | Expired overlay | Navigate to any page (expired >7 days) | Soft overlay with heart icon, "We loved having you on the trial", 3 benefit cards, "Choose a plan" button | |
| 20 | Settings accessible | Navigate to /settings (expired >7 days) | Settings page loads WITHOUT overlay -- user can access billing to upgrade | |
