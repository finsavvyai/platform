# CIS Benchmark Tests

> 8 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /security/cis (first visit) | "Run CIS Scan" CTA with 5 section previews | |
| 2 | Run scan | Click "Run CIS Scan" | Spinner, then score ring + results | |
| 3 | Score ring | After scan | Shows compliance percentage with color | |
| 4 | Section cards | After scan | 5 cards: Identity, Application, Data, Email, Audit | |
| 5 | Control table | After scan | 17 controls with pass/fail/partial badges | |
| 6 | Expand control | Click any control row | Shows Expected + Remediation details | |
| 7 | Filter section | Select a section from dropdown | Table filters to that section only | |
| 8 | Cache persistence | Reload /security/cis | Previous scan results still visible | |
