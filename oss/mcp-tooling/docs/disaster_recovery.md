# Disaster Recovery Runbook

## Overview
This document outlines the procedures for backing up and restoring the MCPOverflow database.

## Automated Backups
Automated backups are configured in `docker-compose.yml` via the `backup` service.
- **Schedule**: Every day at 2:00 AM UTC (can be changed via `BACKUP_SCHEDULE` env var).
- **Location**:
  - Locally: `postgres_backups` volume (mounted to `/backups` inside container).
  - S3: `s3://mcpoverflow-backups` (if AWS credentials are provided).
- **Retention**: 30 days (configured in `scripts/backup.sh`).

## Manual Backup
To trigger a backup manually:

```bash
# Run backup script inside the container
docker-compose exec backup /scripts/backup.sh
```

Or from your host machine (requires `pg_dump` and DB credentials):
```bash
./scripts/backup.sh
```

## Restoration Procedure

### 1. From Local Backup
If you have a local `.sql.gz` backup file:

```bash
# Restore specific file
./scripts/restore.sh path/to/mcpoverflow_20240101_000000.sql.gz

# Restore latest local backup (found in default backup dir)
./scripts/restore.sh --latest
```

### 2. From S3 Backup
To restore the latest backup from S3 (requires `aws` CLI configured):

```bash
./scripts/restore.sh --s3
```

### 3. Emergency Restore (Docker)
If the host machine does not have `psql` installed, you can restore using the postgres container:

1. Copy backup file to container:
   ```bash
   docker cp backup.sql.gz mcpoverflow_postgres:/tmp/backup.sql.gz
   ```

2. Execute restore:
   ```bash
   docker exec -it mcpoverflow_postgres bash -c "gunzip -c /tmp/backup.sql.gz | psql -U postgres -d mcpoverflow"
   ```

## Point-in-Time Recovery (PITR)
*Current implementation supports dump-based snapshots only.*
For true PITR, WAL archiving must be enabled on the Postgres server. This is currently **NOT** enabled in the development docker-compose setup.
Production environments using managed databases (RDS, Supabase, CloudSQL) should rely on the provider's PITR capabilities.

## Verification
To verify backup integrity:
```bash
gunzip -t path/to/backup.sql.gz
```
