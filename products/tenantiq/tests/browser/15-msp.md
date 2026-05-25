# MSP Benchmark & Profit Dashboard Tests

> 9 tests | Priority: P2

## Prerequisites
- Signed in as MSP admin user
- Multiple tenants connected for cross-tenant comparison

## Tests

### MSP Benchmark (from main suite section 16)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Benchmark page | Go to /msp/benchmark | Cross-tenant comparison table | |
| 2 | Metrics | Check table columns | Users, Active %, License %, CIS Score, Alerts | |
| 3 | Sort | Change sort dropdown | Table reorders | |
| 4 | Export | Click Export > CSV | Downloads benchmark data | |

### MSP Profit Dashboard (from trial gating suite section 12)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 5 | Page loads | Navigate to /msp/profit | Header: "MSP Profit Dashboard" | |
| 6 | Metric cards | Check top row | 4 cards: Total Savings, TenantIQ Cost, Net Margin, Average ROI | |
| 7 | Tenant table | Check profit table | Tenants listed with savings, cost, margin, ROI columns | |
| 8 | ROI color coding | Check ROI column | Green for positive, amber for break-even, red for negative | |
| 9 | Export works | Click Export button | CSV/JSON export options available | |
