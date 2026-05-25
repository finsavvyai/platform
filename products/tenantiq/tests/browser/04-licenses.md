# License Management Tests

> 7 tests | Priority: P0

## Prerequisites
- Signed in as admin user
- Data synced from Microsoft 365

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | SKU table | Go to /licenses | Real SKUs with Total/Assigned/Available columns | |
| 2 | Free SKUs no cost | Check WINDOWS_STORE, FLOW_FREE | Cost/Unit shows "--" (no pricing) | |
| 3 | Paid SKUs priced | Check SPB, EXCHANGESTANDARD | Shows $22, $4 respectively | |
| 4 | Utilization color | Check Utilization column | Green for >50%, red for <50% | |
| 5 | Waste analysis | Check Waste Analysis section | Shows only paid SKU waste | |
| 6 | Export CSV | Click Export > CSV | Downloads .csv file with real data | |
| 7 | Export JSON | Click Export > JSON | Downloads .json with metadata wrapper | |
