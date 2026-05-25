# PostgreSQL Backup and Recovery Procedures

This document outlines the backup and recovery procedures for the QueryFlux PostgreSQL primary database.

## Overview

The PostgreSQL database serves as the primary metadata storage for QueryFlux, containing:
- User accounts and authentication data
- Database connection configurations (encrypted)
- Query history and saved queries
- Team and project configurations
- Monitoring and alerting data
- System settings and preferences

## Backup Strategy

### 1. Automated Backups

#### Daily Full Backups
- **Schedule**: 2:00 AM UTC daily
- **Retention**: 30 days
- **Method**: pg_dump with custom format
- **Compression**: Enabled (gzip)
- **Storage**: Encrypted cloud storage (AWS S3/Azure Blob/GCS)

#### Hourly Incremental Backups
- **Schedule**: Every hour
- **Retention**: 7 days
- **Method**: WAL archiving
- **Storage**: Same as full backups

#### Continuous Archiving
- **Method**: Write-Ahead Log (WAL) shipping
- **Retention**: 7 days
- **Real-time**: Yes

### 2. Manual Backups

#### On-Demand Full Backup
```bash
# Create full backup
pg_dump -h localhost -U queryflux -d queryflux_db \
  --format=custom \
  --compress=9 \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup
pg_restore --list backup_YYYYMMDD_HHMMSS.dump
```

#### Schema-Only Backup
```bash
pg_dump -h localhost -U queryflux -d queryflux_db \
  --schema-only \
  --file=schema_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Data-Only Backup
```bash
pg_dump -h localhost -U queryflux -d queryflux_db \
  --data-only \
  --exclude-table=audit_logs \
  --file=data_backup_$(date +%Y%m%d_%H%M%S).sql
```

## Backup Configuration

### PostgreSQL Configuration (`postgresql.conf`)

```ini
# WAL Configuration
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
archive_mode = on
archive_command = 'cp %p /wal_archive/%f'
archive_timeout = 1800

# Checkpoint Configuration
checkpoint_completion_target = 0.9
wal_buffers = 16MB
checkpoint_timeout = 10min

# Logging Configuration
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
```

### pg_hba.conf for Replication

```
# Allow replication connections from localhost
local   replication     queryflux                                md5
host    replication     queryflux        127.0.0.1/32           md5
host    replication     queryflux        ::1/128                 md5
```

## Recovery Procedures

### 1. Point-in-Time Recovery (PITR)

#### Prerequisites
- Base backup file
- Required WAL files
- PostgreSQL binaries
- Recovery target time

#### Recovery Steps

1. **Stop PostgreSQL Service**
```bash
sudo systemctl stop postgresql
```

2. **Clear Data Directory**
```bash
sudo rm -rf /var/lib/postgresql/14/main/*
```

3. **Restore Base Backup**
```bash
pg_restore -h localhost -U queryflux -d queryflux_db \
  --clean --if-exists \
  /backups/full_backup_YYYYMMDD_HHMMSS.dump
```

4. **Configure Recovery**
Create `recovery.conf`:
```ini
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = '2024-01-15 14:30:00'
standby_mode = off
```

5. **Start PostgreSQL**
```bash
sudo systemctl start postgresql
```

6. **Verify Recovery**
```bash
# Check database status
psql -h localhost -U queryflux -d queryflux_db -c "SELECT version();"

# Verify data integrity
psql -h localhost -U queryflux -d queryflux_db -c "SELECT COUNT(*) FROM users;"
```

### 2. Full Database Restoration

#### Complete Restore
```bash
# Drop existing database
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS queryflux_db;"

# Create new database
psql -h localhost -U postgres -c "CREATE DATABASE queryflux_db OWNER queryflux;"

# Restore from backup
pg_restore -h localhost -U queryflux -d queryflux_db \
  --clean --if-exists --verbose \
  /backups/full_backup_YYYYMMDD_HHMMSS.dump
```

#### Selective Restore
```bash
# Restore specific tables
pg_restore -h localhost -U queryflux -d queryflux_db \
  --table=users \
  --table=connections \
  --table=queries \
  /backups/full_backup_YYYYMMDD_HHMMSS.dump

# Restore specific schemas
pg_restore -h localhost -U queryflux -d queryflux_db \
  --schema=public \
  --schema=monitoring \
  /backups/full_backup_YYYYMMDD_HHMMSS.dump
```

### 3. Disaster Recovery

#### Hot Standby Setup

1. **Configure Master Server**
```ini
# postgresql.conf on master
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 32
archive_mode = on
archive_command = 'rsync -a %p replica_server:/wal_archive/%f'
```

2. **Configure Standby Server**
```bash
# Create base backup on standby
pg_basebackup -h master_server -D /var/lib/postgresql/14/main \
  -U replication -v -P -W

# Configure recovery.conf on standby
standby_mode = on
primary_conninfo = 'host=master_server port=5432 user=replication'
trigger_file = '/tmp/postgresql.trigger'
```

3. **Promote Standby to Master**
```bash
# Create trigger file to promote
sudo touch /tmp/postgresql.trigger

# Or use pg_ctl
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/14/main
```

## Backup Scripts

### Automated Backup Script (`backup.sh`)

```bash
#!/bin/bash

# Configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="queryflux"
DB_NAME="queryflux_db"
BACKUP_DIR="/backups/postgresql"
RETENTION_DAYS=30
S3_BUCKET="queryflux-backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/queryflux_backup_$TIMESTAMP.dump"

# Create backup
echo "Starting backup at $(date)"
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  --format=custom \
  --compress=9 \
  --verbose \
  --file=$BACKUP_FILE

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup completed successfully"
    
    # Upload to S3
    aws s3 cp $BACKUP_FILE s3://$S3_BUCKET/postgresql/
    
    # Remove old backups
    find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
    
    echo "Backup uploaded and old files cleaned up"
else
    echo "Backup failed"
    exit 1
fi
```

### Recovery Script (`recover.sh`)

```bash
#!/bin/bash

# Configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="queryflux"
DB_NAME="queryflux_db"
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop PostgreSQL
echo "Stopping PostgreSQL..."
sudo systemctl stop postgresql

# Clear data directory
echo "Clearing data directory..."
sudo rm -rf /var/lib/postgresql/14/main/*

# Restore backup
echo "Restoring backup..."
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  --clean --if-exists --verbose \
  $BACKUP_FILE

# Start PostgreSQL
echo "Starting PostgreSQL..."
sudo systemctl start postgresql

# Verify recovery
echo "Verifying recovery..."
sleep 10
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();"

echo "Recovery completed"
```

## Monitoring and Maintenance

### Backup Verification

```sql
-- Create backup verification table
CREATE TABLE backup_verification (
    id SERIAL PRIMARY KEY,
    backup_date TIMESTAMP DEFAULT NOW(),
    backup_file VARCHAR(255),
    verification_date TIMESTAMP,
    status VARCHAR(50),
    error_message TEXT
);

-- Verify backup integrity
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples
FROM pg_stat_user_tables;
```

### Backup Performance Monitoring

```sql
-- Monitor backup performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE query LIKE 'pg_dump%'
ORDER BY total_time DESC;
```

### Recovery Time Objectives (RTO)

| Scenario | Target RTO | Actual RTO | Notes |
|----------|------------|------------|-------|
| Full Restore | 2 hours | 1.5 hours | From S3 backup |
| PITR | 4 hours | 3.5 hours | Including WAL restore |
| Failover | 15 minutes | 10 minutes | Hot standby promotion |

### Recovery Point Objectives (RPO)

| Data Type | Target RPO | Actual RPO | Notes |
|-----------|------------|------------|-------|
| User Data | 1 hour | 15 minutes | Hourly backups |
| Configuration | 15 minutes | 5 minutes | WAL archiving |
| Queries | 1 hour | 15 minutes | Hourly backups |

## Security Considerations

### Backup Encryption
- Use AES-256 encryption for backup files
- Encrypt storage with customer-managed keys
- Rotate encryption keys quarterly

### Access Control
- Restrict backup access to DBA team only
- Use IAM roles for cloud storage access
- Implement multi-factor authentication

### Data Protection
- Encrypt sensitive connection data at rest
- Mask PII in non-production restores
- Implement data retention policies

## Testing and Validation

### Monthly Backup Tests
1. Restore latest backup to test environment
2. Verify data integrity with checksums
3. Test application connectivity
4. Document any issues found

### Quarterly Disaster Recovery Drills
1. Simulate complete database failure
2. Execute full recovery procedure
3. Measure recovery time
4. Update procedures based on findings

### Annual Recovery Audits
1. Review backup retention policies
2. Validate encryption certificates
3. Test access controls
4. Update documentation

## Troubleshooting

### Common Issues

#### Backup Fails Due to Connections
```bash
# Terminate existing connections
psql -h localhost -U postgres -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'queryflux_db' AND pid <> pg_backend_pid();"
```

#### Restore Fails with Permission Errors
```bash
# Fix ownership issues
sudo chown -R postgres:postgres /var/lib/postgresql/14/main/
sudo chmod 700 /var/lib/postgresql/14/main/
```

#### WAL Files Missing
```bash
# Identify missing WAL files
pg_controldata /var/lib/postgresql/14/main | grep "Latest checkpoint location"

# Find missing WAL in archive
ls -la /wal_archive/ | grep <missing_wal_file>
```

## Contact Information

- **Primary DBA**: dba-team@queryflux.com
- **On-call Engineer**: oncall@queryflux.com
- **Emergency Contact**: emergency@queryflux.com

## Related Documents

- [Database Configuration Guide](database_config.md)
- [Security Policies](security.md)
- [Incident Response Plan](incident_response.md)
- [Monitoring and Alerting](monitoring.md)