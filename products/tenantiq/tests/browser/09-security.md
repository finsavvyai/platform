# Security Dashboard, Sign-in Logs, Behavior & Certificate Tests

> 26 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected with sign-in data

## Tests

### Security Dashboard (from main suite section 24)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /security/dashboard (no tenant connected) | "Connect your tenant" CTA linking to /settings | |
| 2 | Score + metrics | After tenant connected | Security Score ring + Risk Level, MFA Coverage, Active Alerts metric cards | |
| 3 | Security posture | Check posture section | MFA Enrollment (x/y), Conditional Access count, Admin Accounts count, Expiring Credentials count | |
| 4 | MFA progress | Check MFA cards | Progress bar with percentage, green color | |
| 5 | Compliance frameworks | Check compliance section | Framework cards with score, pass/fail/partial control counts, color-coded progress bars | |
| 6 | Active risks | Check risks section | Risk cards with severity badges (critical/high/medium/low), title, description, recommendation | |
| 7 | Severity colors | Check risk badges | Critical = red bg, High = amber bg, Medium = amber/20, Low = green/20 | |

### Sign-in Logs (from main suite section 26)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 8 | Summary cards | Go to /security/signin-logs | 5 metric cards: Total Sign-ins, Successful, Failed, Risky, Unique Users | |
| 9 | Status filter | Change status dropdown | Options: All statuses, Success, Failure, Interrupted | |
| 10 | Risk filter | Change risk level dropdown | Options: All risk levels, High, Medium, Low, None | |
| 11 | User search | Type a username in filter input | Suggestions dropdown appears, table filters by user | |
| 12 | Logs table | After data loads | SignInLogsTable with user, app, IP, location, status, risk columns | |
| 13 | Pagination | Click "Next" button | Page increments, new logs load; "Previous" goes back | |
| 14 | Export CSV | Click "Export CSV" button | Opens export download in new tab | |

### Behavior Analysis (from main suite section 27)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 15 | Empty state | Go to /behavior (no data) | "No users monitored" with connect prompt | |
| 16 | Summary cards | After data loads | 4 metric cards: Users Monitored, Anomalies (24h), Avg Risk Score, High Risk Users | |
| 17 | Risk filter | Change risk level dropdown | Options: All risk levels, Critical, High, Medium, Low | |
| 18 | Sort options | Change sort dropdown | Options: Sort by Risk Score, Sort by Anomaly Count | |
| 19 | User search | Type in search input | Table filters by user name or email | |
| 20 | User risk rows | Check user list | UserRiskRow components with name, email, risk score, anomaly details | |
| 21 | Export | Click Export > CSV or JSON | Downloads user-behavior data with risk scores and anomalies | |

### Certificate Reminders (from trial gating suite section 10)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 22 | Reminder bell visible | Go to /security, hover a certificate row | Bell icon appears on hover | |
| 23 | Reminder modal opens | Click bell icon on a certificate | Modal opens with "Set Expiry Reminder" title | |
| 24 | Channel selection | Check modal content | Email/SMS toggle buttons | |
| 25 | Days selector | Check dropdown | Options: 7, 14, 30, 60, 90 days before | |
| 26 | Save reminder | Fill notes, click Save Reminder | Modal closes (reminder saved to localStorage) | |
