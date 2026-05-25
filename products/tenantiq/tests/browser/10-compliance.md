# Compliance Frameworks & SDLC AI Compliance Tests

> 16 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- CIS scan or security dashboard data available

## Tests

### Compliance Frameworks (from main suite section 25)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /security/compliance (no data) | "No compliance data yet" with "Go to Dashboard" link | |
| 2 | Framework cards | After data loads | Grid of framework cards, each with ScoreRing, name, pass/fail/partial counts | |
| 3 | Score colors | Check score rings | Green >=80%, amber >=50%, red <50% | |
| 4 | Expand framework | Click a framework card | Card gets ring highlight, controls table appears below with ID, Name, Status, Details columns | |
| 5 | Control status | Check control table status column | Pass (green), Fail (red), Partial (amber) badges | |
| 6 | Export JSON | Click Export > JSON | Downloads compliance-frameworks.json | |

### Compliance Frameworks Detail (from main suite section 35)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7 | Frameworks page | Navigate to /security/compliance | Page loads with compliance framework cards | |
| 8 | Framework cards | Check card grid | 3 framework cards (SOC 2, HIPAA, GDPR) each showing score ring and name | |
| 9 | Expand controls | Click a framework card | Card expands to reveal controls list with ID, name, and status columns | |
| 10 | Control evidence | Check control rows | Each control shows pass/fail/partial status badge and evidence summary | |
| 11 | Remediation guidance | Click a failing control | Remediation guidance text displayed with actionable steps | |
| 12 | Export compliance | Click Export button | Downloads compliance data (JSON or CSV) with framework scores and control details | |

### SDLC.cc AI Compliance (from main suite section 17)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 13 | Setup page | Go to /sdlc | PII class toggles + compliance framework toggles | |
| 14 | Select PII | Toggle SSN, Credit Card, Email | Selected items highlighted blue | |
| 15 | Enable | Click "Enable AI Compliance" | Toast: "SDLC.cc AI Compliance enabled" | |
| 16 | Dashboard | After enable | Score ring, requests, PII redacted, integration guide | |
