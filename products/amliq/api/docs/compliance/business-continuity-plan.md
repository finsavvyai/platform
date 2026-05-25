# Business Continuity Plan

**Version**: 1.0 | **Effective**: 2026-04-03 | **Owner**: CTO

## Recovery Objectives
| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | 4 hours |
| RPO (Recovery Point Objective) | 1 hour |
| Uptime SLA | 99.9% (8.7h downtime/year) |

## Critical Systems
1. **Screening API** — primary revenue path
2. **PostgreSQL database** — all entity and screening data
3. **Background workers** — list sync, monitoring, media pipeline
4. **Authentication** — JWT/API key validation

## Backup Strategy
- PostgreSQL: continuous WAL archiving + daily base backup
- Encryption keys: separate secure storage with geographic redundancy
- Configuration: version-controlled in git
- Sanctions list snapshots: cached locally, refreshed on recovery

## Failover Procedures

### Database Failure
1. Promote read replica to primary (automated)
2. Update connection strings
3. Verify data integrity via latest WAL replay

### API Server Failure
1. Health check removes unhealthy instance from load balancer
2. Auto-scaling launches replacement instance
3. Verify screening accuracy with test suite

### Complete Region Failure
1. DNS failover to secondary region
2. Restore database from cross-region backup
3. Deploy API and workers
4. Verify all sanctions lists are current

## Testing
- Failover drill: quarterly
- Backup restoration test: monthly
- Full DR exercise: annually
