# Migration Tests

> 4 tests | Priority: P2

## Prerequisites
- Signed in as admin user
- At least two tenants connected

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Migration page | Navigate to /settings/migration | Migration planning interface loads | |
| 2 | Create plan | Select source tenant and target tenant, click "Create Plan" | Migration plan created showing items to migrate (users, groups, policies) | |
| 3 | Plan details | Check migration plan | Lists items with type, name, status, and estimated duration | |
| 4 | Execute migration | Click "Execute" and confirm | Status tracking shows per-item progress (pending/in-progress/completed/failed) | |
