# Purview DLP Tests

> 4 tests | Priority: P2

## Prerequisites
- Signed in as admin user
- Microsoft Purview data available

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Purview page | Navigate to /security/purview | Purview compliance page loads with DLP and labels sections | |
| 2 | DLP policies | Check DLP section | Policies listed with name and enforcement status (Enforce/Test/Off) badges | |
| 3 | Sensitivity labels | Check labels section | Labels displayed with adoption percentage and usage metrics | |
| 4 | Compliance score | Check overall score | Purview compliance score displayed as percentage with color indicator | |
