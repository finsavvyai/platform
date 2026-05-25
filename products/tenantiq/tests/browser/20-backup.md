# Backup Health Tests

> 4 tests | Priority: P2

## Prerequisites
- Signed in as admin user
- At least one backup created

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Backup page | Navigate to /backups | Backup health section visible with status indicator | |
| 2 | Health status | Check health indicator | Shows healthy (green), warning (amber), or critical (red) status badge | |
| 3 | Last backup | Check last backup info | Displays last successful backup timestamp and duration since | |
| 4 | Drift alerts | Check drift section | Shows drift alerts if configuration changed since last backup; empty state if no drift | |
