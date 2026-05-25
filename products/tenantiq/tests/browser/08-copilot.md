# Copilot Readiness & Usage Tests

> 9 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected

## Tests

### Copilot Readiness (from main suite section 9)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /security/copilot | 4 dimension previews + "Run Assessment" CTA | |
| 2 | Run assessment | Click "Run Assessment" | Spinner, then score ring + 4 dimension cards | |
| 3 | Dimensions | After assessment | Data Governance, Permissions, Oversharing, Identity scores | |
| 4 | Check details | In dimension cards | Per-check results: Pass/Fail/Warn with detail text | |
| 5 | Recommendations | After assessment | Numbered recommendation list | |

### Copilot Usage (from main suite section 11)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6 | Empty state | Go to /security/copilot-usage | "Scan Usage" CTA | |
| 7 | Scan | Click "Scan Usage" | Adoption ring + metric cards | |
| 8 | License info | After scan | Shows Copilot SKUs with seat counts (or "0 licensed") | |
| 9 | App breakdown | After scan (if available) | Usage bars for Word, Excel, PowerPoint, Teams, Outlook | |
