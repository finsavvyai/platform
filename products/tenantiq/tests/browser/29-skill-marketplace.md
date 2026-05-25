# Skill Marketplace Pricing & Deactivation Tests

> 10 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Skills page accessible

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Skills page loads | Go to /skills | Grid of skill cards with categories | |
| 2 | Free skills marked | Check Security Monitoring, Dashboard | Price shows "Included" or "$0", no "Add to Plan" needed | |
| 3 | Paid skill pricing | Check CIS Benchmark skill card | Shows "$15/mo/tenant" price | |
| 4 | Plan tier badge | Check paid skill cards | Badge showing "Professional+" or "Enterprise" | |
| 5 | Add to Plan button | Check paid skill card | "Add to Plan" button visible (not just "Activate") | |
| 6 | Deactivate button | Check active skill card | "Deactivate" button visible next to "Open" | |
| 7 | Foundation not deactivatable | Check free skill (price=0) | No "Deactivate" button on free/foundation skills | |
| 8 | Deactivate works | Click Deactivate on an active skill | Toast: skill deactivated, card updates to inactive state | |
| 9 | Pricing categories correct | Check skill prices match spec | Security Monitoring $0, CIS $15, License Opt $10, AI Autopilot $25, Backup $20 | |
| 10 | Skill opens correctly | Click "Open" on an active skill | Navigates to the correct feature page | |
