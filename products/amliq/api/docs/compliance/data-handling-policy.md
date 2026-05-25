# Data Handling and Classification Policy

**Version**: 1.0 | **Effective**: 2026-04-03 | **Owner**: DPO

## Purpose
Define how AMLIQ collects, processes, stores, and disposes of data.

## Data Types Processed
| Data Type | Classification | Retention | Encryption |
|-----------|---------------|-----------|------------|
| Entity names/DOBs | Restricted | Duration of subscription + 7 years | AES-256-GCM |
| Screening results | Restricted | 7 years (regulatory requirement) | AES-256-GCM |
| API keys | Restricted | Until revoked | Hashed (SHA-256) |
| Audit trail | Confidential | 7 years | Integrity hash chain |
| Usage metrics | Confidential | 2 years | N/A |
| System logs | Internal | 1 year | N/A |

## Data Processing
- All screening data processed in tenant-isolated contexts
- No cross-tenant data access permitted
- Batch processing uses isolated worker queues

## Data Disposal
- Deleted data purged from primary storage within 30 days
- Backups rotated on 90-day cycle
- Encryption keys destroyed on tenant offboarding

## Cross-Border Transfers
- Data residency configurable per tenant
- EU customer data processed in EU region by default
- Standard contractual clauses available for cross-border transfers

## Review
Reviewed annually and when data processing activities change.
