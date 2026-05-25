# Settings, Webhooks & Notifications Tests

> 14 tests | Priority: P2

## Prerequisites
- Signed in as admin user
- A Slack or Teams webhook URL for testing

## Tests

### Settings & Webhooks (from main suite section 18)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Settings page | Go to /settings | User info, tenant list, AI provider, webhook sections | |
| 2 | Webhook URL | Enter a Slack/Teams webhook URL | Auto-detects type (shows "Slack" or "Teams" badge) | |
| 3 | Save webhook | Click "Save" | Toast: "Webhook saved" | |
| 4 | Test webhook | Click "Test" | Toast: "Test notification sent" (if URL valid) | |
| 5 | Enable toggle | Toggle "Enabled" checkbox | Saves enabled state | |
| 6 | Theme toggle | Toggle dark/light mode | Theme changes | |

### Notification Preferences (from main suite section 50)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7 | Preferences page | Navigate to /settings, find notification preferences | Notification preferences section loads with category list | |
| 8 | Push toggles | Check push notification toggles | Per-category toggle switches (Security, Compliance, Licensing, System) | |
| 9 | Email preferences | Check email notification settings | Email notification toggles per category with frequency options (instant/daily digest) | |
| 10 | Quiet hours | Check quiet hours configuration | Start time, end time, and timezone selector for suppressing notifications | |

### Tenant Permissions (from trial gating suite section 8)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 11 | Permissions button visible | Go to /settings, find tenant card | "Permissions" button on each tenant card | |
| 12 | Permissions expand | Click "Permissions" button | Expandable section shows Graph API permissions grid | |
| 13 | Permission categories shown | Check expanded permissions | Shows: Users R/W, Groups R/W, Policies R/W, Security Read, Audit Read, Mail Send, Directory Read | |
| 14 | Collapse works | Click "Permissions" again | Section collapses | |
