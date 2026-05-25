# TenantIQ Data Retention Policy

Last updated: 2026-03-26

## Overview

TenantIQ retains customer data only as long as necessary to provide the service.
This document describes retention periods for each data category.

## Retention Schedule

| Data Category | Retention Period | Storage | Notes |
|---------------|-----------------|---------|-------|
| User accounts | Active account lifetime + 30 days | D1 | Deleted 30 days after account closure |
| Tenant configuration | Active account lifetime + 30 days | D1 | Removed with account |
| Users cache (Graph sync) | Refreshed hourly, purged with tenant | D1 | Incremental sync replaces stale data |
| Alerts | 90 days (resolved), indefinite (active) | D1 | Resolved alerts auto-purged after 90 days |
| Audit logs | 1 year | D1 | Required for compliance reporting |
| CIS scan results | 1 year | D1 | Historical trend data for compliance |
| Config snapshots | 90 days | D1 + R2 | Configurable per tenant |
| Executive reports | 90 days | R2 | PDF/CSV exports |
| Cloud backups | 30 days (default, configurable) | R2 | Tenant admin can adjust up to 365 days |
| Workflow execution logs | 90 days | D1 | Execution history and error logs |

## Token & Cache Retention

| Data | TTL | Storage |
|------|-----|---------|
| Graph API access tokens | 1 hour (Microsoft default) | KV |
| Graph API refresh tokens | Indefinite (Microsoft managed) | KV |
| User sessions (JWT) | 24 hours | KV |
| OAuth state parameters | 5 minutes | KV |
| Security score cache | 1 week | KV |
| CIS scan cache | 1 hour | KV |
| Drift detection cache | 24 hours | KV |

## Account Closure

When a user requests account deletion:

1. Account is marked as `inactive` immediately.
2. All active sessions are invalidated.
3. After 30 days, all data associated with the account is permanently deleted:
   - Organization record
   - All tenant records and cached data
   - All alerts, audit logs, and scan results
   - All R2 objects (reports, snapshots, backups)
   - All KV entries (tokens, cache, sessions)
4. Deletion is irreversible after the 30-day grace period.

## Data Export

Users can request a full data export at any time via **Settings > Data Export**.
Export includes all tenant data, audit logs, and configuration in JSON format.

## Compliance

- GDPR: right to erasure honored within 30 days.
- SOC 2: audit log retention meets 1-year requirement.
- Data residency: all data processed on Cloudflare's global edge network.

## Contact

For data retention questions: privacy@tenantiq.app
