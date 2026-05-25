# Workspace Governance Tests

> 11 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected with Teams/Groups

## Tests

### Workspace Governance (from main suite section 8)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /governance | "Sync Workspaces" CTA | |
| 2 | Sync | Click "Sync Workspaces" | Toast: "Synced X workspaces" | |
| 3 | Workspace table | After sync | Teams (T badge) and Groups (G badge) with member counts | |
| 4 | Guest indicator | Check guest column | Amber color for workspaces with guests | |
| 5 | Filter by type | Select "Teams" | Only Teams shown | |
| 6 | Filter by risk | Select "No owner" | Only orphaned workspaces shown | |

### Storage Analytics (from main suite section 10)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7 | Empty state | Go to /governance/storage | "Scan Storage" CTA | |
| 8 | Scan | Click "Scan Storage" | Toast with site count | |
| 9 | Summary cards | After scan | Total GB, Used GB, Site count | |
| 10 | Site table | After scan | Sites sorted by usage, with GB and utilization bar | |
| 11 | Utilization color | Check bars | Red >80%, amber >50%, green <50% | |
