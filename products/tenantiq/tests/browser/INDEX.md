# TenantIQ Browser Test Suite

> Version 4.0 | Total: 397 tests | Last updated: 2026-03-27

## Test Files

| # | Area | File | Tests | Priority |
|---|------|------|-------|----------|
| 1 | Authentication & Session | [01-authentication.md](01-authentication.md) | 20 | P0 |
| 2 | Sidebar Navigation | [02-navigation.md](02-navigation.md) | 31 | P0 |
| 3 | Dashboard & Onboarding | [03-dashboard.md](03-dashboard.md) | 23 | P0 |
| 4 | License Management | [04-licenses.md](04-licenses.md) | 7 | P0 |
| 5 | CIS Benchmark | [05-cis-benchmark.md](05-cis-benchmark.md) | 8 | P1 |
| 6 | Config Snapshots | [06-config-snapshots.md](06-config-snapshots.md) | 7 | P1 |
| 7 | Workspace Governance | [07-governance.md](07-governance.md) | 11 | P1 |
| 8 | Copilot Readiness & Usage | [08-copilot.md](08-copilot.md) | 9 | P1 |
| 9 | Security, Sign-in Logs & Behavior | [09-security.md](09-security.md) | 26 | P1 |
| 10 | Compliance Frameworks | [10-compliance.md](10-compliance.md) | 16 | P1 |
| 11 | AI Engine & Streaming | [11-ai-engine.md](11-ai-engine.md) | 17 | P1 |
| 12 | Alerts & Analytics | [12-alerts.md](12-alerts.md) | 10 | P1 |
| 13 | Team Management | [13-team.md](13-team.md) | 7 | P1 |
| 14 | Workflows & Bulk Ops | [14-workflows.md](14-workflows.md) | 22 | P1 |
| 15 | MSP Benchmark & Profit | [15-msp.md](15-msp.md) | 9 | P2 |
| 16 | Settings & Notifications | [16-settings.md](16-settings.md) | 14 | P2 |
| 17 | Export Across Pages | [17-export.md](17-export.md) | 7 | P2 |
| 18 | Remediation | [18-remediation.md](18-remediation.md) | 9 | P1 |
| 19 | Reports & Report Builder | [19-reports.md](19-reports.md) | 13 | P1 |
| 20 | Backup Health | [20-backup.md](20-backup.md) | 4 | P2 |
| 21 | Purview DLP | [21-purview.md](21-purview.md) | 4 | P2 |
| 22 | Zero Trust Assessment | [22-zero-trust.md](22-zero-trust.md) | 5 | P1 |
| 23 | Phishing Analysis | [23-phishing.md](23-phishing.md) | 6 | P2 |
| 24 | OpenClaw Integration | [24-openclaw.md](24-openclaw.md) | 8 | P2 |
| 25 | Self-Service Portal | [25-portal.md](25-portal.md) | 4 | P2 |
| 26 | Migration | [26-migration.md](26-migration.md) | 4 | P2 |
| 27 | Event Triggers | [27-events.md](27-events.md) | 4 | P2 |
| 28 | Trial Data Gating | [28-trial-gating.md](28-trial-gating.md) | 37 | P0 |
| 29 | Skill Marketplace | [29-skill-marketplace.md](29-skill-marketplace.md) | 10 | P1 |
| 30 | Billing & Subscriptions | [30-billing.md](30-billing.md) | 13 | P0 |
| 31 | AI Guide Chatbot | [31-chatbot.md](31-chatbot.md) | 8 | P1 |
| 32 | Sign-In Page Design | [32-sign-in-page.md](32-sign-in-page.md) | 5 | P1 |
| 33 | Error Handling | [33-error-handling.md](33-error-handling.md) | 5 | P3 |
| 34 | No Mock Data | [34-no-mock-data.md](34-no-mock-data.md) | 10 | P0 |
| 35 | Landing Page | [35-landing-page.md](35-landing-page.md) | 4 | P2 |
| | **Total** | | **397** | |

## How to Test

1. Open https://app.tenantiq.app
2. Sign in with Microsoft OAuth
3. Work through each file in order
4. To simulate different plans: modify localStorage (see instructions in [28-trial-gating.md](28-trial-gating.md))

## Priority Guide

- **P0**: Revenue-critical (auth, trial gating, billing, dashboard, licenses, no mock data) -- 141 tests
- **P1**: Key features (security, compliance, AI, CIS, copilot, workflows, remediation, reports) -- 183 tests
- **P2**: Secondary features (portal, migration, events, MSP, export, phishing, landing) -- 68 tests
- **P3**: Edge cases (error handling) -- 5 tests

## Source Documents

This suite was consolidated from:
- `CLAUDE_BROWSER_TEST_SUITE.md` v3.1 (288 tests across 51 sections)
- `TRIAL_GATING_TEST_SUITE.md` v1.0 (72 tests across 12 sections)

Additional tests were added for sections not originally assigned (onboarding wizard, SDLC compliance, platform subscriptions, bulk operations, certificate reminders) bringing the total from 360 to 397.

## Test Accounts Needed

| Account Type | Plan | Purpose |
|-------------|------|---------|
| Trial (active) | trial | Test gating with visible trial badge |
| Trial (expired, grace period) | trial | Test grace period banner and countdown |
| Trial (fully expired) | trial | Test overlay blocking content |
| Starter | starter | Verify gating lifts for starter features |
| Professional | professional | Verify all controls/frameworks visible |
| Enterprise | enterprise | Verify everything unlocked |
