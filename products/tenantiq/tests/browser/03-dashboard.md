# Dashboard, Data Sync & Onboarding Tests

> 23 tests | Priority: P0

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected

## Tests

### Data Sync (from main suite section 3)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Trigger sync | Go to /licenses, click "Sync from Microsoft 365" | Spinner shows, toast: "Synced X users, Y licenses, Z workspaces" | |
| 2 | Users populated | Go to / (Dashboard) | "Total Users" card shows non-zero count | |
| 3 | Licenses populated | Go to /licenses | Table shows real SKUs (SPB, EXCHANGESTANDARD, etc.) | |
| 4 | Workspaces populated | Go to /governance | Workspace table shows Teams/Groups | |
| 5 | Secure Score | Go to / (Dashboard) | Score ring shows percentage (not --) | |
| 6 | Sync error handling | (If no tokens) | Toast: "Please sign out and sign in again" | |

### Dashboard (from main suite section 4)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7 | Metric cards | Go to / | 4 cards: Secure Score, Users, License Cost, Open Alerts | |
| 8 | Score ring | Check Security Posture section | Animated ring matching secure score value | |
| 9 | Score label | Check posture text | "Good" (>=70), "Needs Attention" (40-69), or "At Risk" (<40) | |
| 10 | License waste realistic | Check License Cost card | Not $60M+ (free SKUs should be $0) | |
| 11 | Quick actions | Check Quick Actions panel | 4 clickable cards (Sync Now, Run CIS Scan, AI Analysis, Create Backup) | |
| 12 | Quick actions clickable | Click any quick action | Navigates to correct page or triggers action | |
| 13 | Export button | Click Export dropdown | Shows JSON + Copy Link options | |
| 14 | Sync Now | Click "Sync Now" quick action | Triggers data sync from Microsoft 365 | |
| 15 | Tenant name | Check subtitle | Shows "[TenantName] - Last sync [time]" without double dashes | |

### Onboarding Wizard (from main suite section 22)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 16 | Wizard shows | Sign in with a new account or tenant with no data | OnboardingWizard renders with 3-step indicator (Welcome, Sync, Ready) | |
| 17 | Step indicator | Check top of wizard | Three numbered circles with step labels, step 1 active (blue) | |
| 18 | Welcome step | Read welcome screen | Shows tenant name, description text, and "Continue" button | |
| 19 | Advance to sync | Click "Continue" on Welcome step | Step 2 active, Welcome step shows green checkmark, "Start Sync" button visible | |
| 20 | Start sync | Click "Start Sync" | Progress bar animates, status text updates (e.g., "Syncing users...") | |
| 21 | Sync error | (If sync fails) | Error message displayed with option to retry | |
| 22 | Results step | After sync completes | Step 3 active, shows dashboard metrics summary (users, licenses, score) | |
| 23 | Go to dashboard | Click "Go to Dashboard" on results step | Wizard closes, navigates to main dashboard | |
