# Config Snapshots Tests

> 7 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /backups/config | "Capture Snapshot" CTA with category previews | |
| 2 | Capture | Click "Capture Snapshot" | Spinner, toast with category + object count | |
| 3 | Snapshot card | After capture | Card shows label, category count, object count, timestamp | |
| 4 | View snapshot | Click snapshot card | Shows category list (CA policies, auth methods, etc.) | |
| 5 | Second capture | Click "Capture Snapshot" again | Second card appears in list | |
| 6 | Compare | Click "Compare" on first, then click second | Diff viewer shows changes or "No differences" | |
| 7 | Diff colors | In diff viewer | Green for added, red for removed, amber for changed | |
