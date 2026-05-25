# Export Across Pages Tests

> 7 tests | Priority: P2

## Prerequisites
- Signed in as admin user
- Data synced from Microsoft 365

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Dashboard JSON | / > Export > JSON | Downloads dashboard.json | |
| 2 | Licenses CSV | /licenses > Export > CSV | Downloads licenses.csv with SKU data | |
| 3 | Alerts JSON | /alerts > Export > JSON | Downloads alerts.json | |
| 4 | Security JSON | /security > Export > JSON | Downloads security.json | |
| 5 | CIS JSON | /security/cis > Export > JSON | Downloads CIS results | |
| 6 | Copy Link | Any page > Export > Copy Link | Toast: "Link copied to clipboard" | |
| 7 | Export dropdown closes | Click Export, then click elsewhere | Dropdown closes cleanly | |
