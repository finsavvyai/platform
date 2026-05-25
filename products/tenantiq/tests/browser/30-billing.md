# Billing, Plans & Platform Subscriptions Tests

> 13 tests | Priority: P0

## Prerequisites
- Signed in as admin user
- Access to /settings billing section

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Plans section visible | Go to /settings, find billing section | 3 plan cards: Starter $49, Professional $99, Enterprise Custom | |
| 2 | Recommended badge | Check Professional plan card | "Recommended" badge on Professional plan | |
| 3 | Feature lists accurate | Check each plan's feature list | Features match: Starter (9 tenants, monitoring), Professional (25 tenants, AI, compliance), Enterprise (unlimited, SSO/SAML, white-label) | |
| 4 | CTA buttons present | Check each plan card | "Get Started" on Starter/Professional, "Contact Sales" on Enterprise | |
| 5 | Auto-scroll from banner | Click "View plans" on trial banner | Settings page opens and scrolls to billing section | |
| 6 | Current plan indicated | Check plan cards (if on a plan) | Current plan highlighted or shows "Current Plan" label | |
| 7 | Trial text accurate | Check subtitle text | Shows trial end date or "Your trial has ended" message | |

### Platform Subscriptions (from main suite section 30)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 8 | Stats grid | Go to /platform/subscriptions | 6 stat cards: Active, Trials, Past Due, Total MRR, ARPA, Churn | |
| 9 | Status filter | Click status filter buttons | Filter by: All Status, Active, Trial, Past Due | |
| 10 | Tier filter | Click tier filter buttons | Filter by: All Tiers, Starter, Professional, Enterprise | |
| 11 | Subscription cards | Check subscription list | Cards with org name, tier badge, status badge, price, usage bars (Users, Scans) | |
| 12 | Usage indicators | Check usage bars | Green <70%, amber 70-90%, red >90% | |
| 13 | Empty state | Filter to show no results | "No subscriptions found" with "Clear Filters" button | |
