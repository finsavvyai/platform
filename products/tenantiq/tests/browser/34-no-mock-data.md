# No Mock Data Verification Tests

> 10 tests | Priority: P0

## Prerequisites
- Signed in as admin user
- Data synced from Microsoft 365
- DevTools Network tab open for API inspection

## Tests

| # | Check | How to verify | Status |
|---|-------|---------------|--------|
| 1 | No "Contoso" | Ctrl+F on Dashboard, MSP, Benchmark pages | |
| 2 | No "Fabrikam" | Ctrl+F on Dashboard, MSP pages | |
| 3 | No "Northwind" | Ctrl+F on Dashboard, MSP pages | |
| 4 | No "Adventure Works" | Ctrl+F on Dashboard, MSP pages | |
| 5 | No "globalremit.com" | Ctrl+F on Threats, Behavior pages | |
| 6 | No "t1", "t2" IDs | Open DevTools Network tab, check API responses | |
| 7 | Real email domain | All emails use real tenant domain | |
| 8 | Score not 72 | Dashboard secure score varies by actual data | |
| 9 | License costs vary | /licenses shows $0 for free SKUs, real prices for paid | |
| 10 | No "Acme Corporation" | Check /platform/subscriptions | |
