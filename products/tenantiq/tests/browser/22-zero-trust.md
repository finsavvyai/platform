# Zero Trust Assessment Tests

> 5 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Assessment page | Navigate to /security/zero-trust | Zero Trust assessment page loads with "Run Assessment" CTA | |
| 2 | Run assessment | Click "Run Assessment" | Spinner during evaluation, then results render | |
| 3 | Overall score | Check score section | PurviewScoreRing with percentage and maturity level label (Initial/Advanced/Optimal) | |
| 4 | Pillar cards | Check pillar section | 6 pillar cards: Identity, Devices, Network, Applications, Data, Infrastructure -- each with score and per-check pass/partial/fail badges | |
| 5 | Recommendations | Check recommendations section | Numbered recommendation list with pillar attribution for each item | |
