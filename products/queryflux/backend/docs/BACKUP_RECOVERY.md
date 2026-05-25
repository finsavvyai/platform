# PostgreSQL Backup and Recovery Procedures

This document outlines the comprehensive backup and recovery procedures for QueryFlux PostgreSQL database deployment.

## Table of Contents

1. [Backup Strategy Overview](#backup-strategy-overview)
2. [Types of Backups](#types-of-backups)
3. [Automated Backup Procedures](#automated-backup-procedures)
4. [Manual Backup Procedures](#manual-backup-procedures)
5. [Recovery Procedures](#recovery-procedures)
6. [Disaster Recovery Plan](#disaster-recovery-plan)
7. [Backup Storage and Retention](#backup-storage-and-retention)
8. [Monitoring and Alerting](#monitoring-and-alerting)
9. [Testing and Validation](#testing-and-validation)
10. [Troubleshooting](#troubleshooting)

## Backup Strategy Overview

QueryFlux implements a multi-layered backup strategy to ensure data safety and business continuity:

### Backup Types
- **Full Backups**: Complete database dumps taken daily
- **Incremental Backups**: WAL (Write-Ahead Log) archiving for point-in-time recovery
- **Logical Backups**: Schema and data exports for portability
- **Physical Backups**: File-system level backups for fast recovery

### Backup Frequency
- **Full Backups**: Daily at 2:00 AM UTC
- **WAL Archiving**: Continuous
- **Schema Backups**: Weekly
- **Configuration Backups**: On change

### Retention Policy
- **Daily Backups**: 30 days
- **Weekly Backups**: 12 weeks
- **Monthly Backups**: 12 months
- **WAL Files**: Until next full backup

## Types of Backups

### 1. Full Physical Backups

**Description**: Complete binary copy of the database cluster
**Use Case**: Fast full recovery, major disasters
**Command**:
```bash
# Using pg_basebackup
pg_basebackup -h localhost -D /backup/full/db_$(date +%Y%m%d) -U postgres -v -P -W

# Using BARMAN (if configured)
barman backup queryflux_prod
```

### 2. WAL (Write-Ahead Log) Backups

**Description**: Transaction log backups for point-in-time recovery
**Use Case**: Recover to specific point in time
**Configuration**:
```postgresql
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
max_wal_senders = 3
wal_keep_segments = 32
```

### 3. Logical Backups

**Description**: SQL dumps of database contents
**Use Case**: Schema migration, data portability
**Command**:
```bash
# Full logical backup
pg_dump -h localhost -U postgres -d queryflux_prod -f /backup/logical/db_$(date +%Y%m%d).sql

# Custom format backup (compressed)
pg_dump -h localhost -U postgres -d queryflux_prod -Fc -f /backup/logical/db_$(date +%Y%m%d).dump

# Schema-only backup
pg_dump -h localhost -U postgres -d queryflux_prod -s -f /backup/logical/schema_$(date +%Y%m%d).sql
```

## Automated Backup Procedures

### Backup Script Implementation

Create `/usr/local/bin/postgres_backup.sh`:

```bash
#!/bin/bash

# PostgreSQL Backup Script for QueryFlux
# Usage: ./postgres_backup.sh [full|incremental|logical]

set -euo pipefail

# Configuration
BACKUP_DIR="/backup/postgres"
LOG_DIR="/var/log/postgres_backup"
DB_NAME="queryflux_prod"
DB_USER="postgres"
DB_HOST="localhost"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create directories
mkdir -p "$BACKUP_DIR/full"
mkdir -p "$BACKUP_DIR/wal"
mkdir -p "$BACKUP_DIR/logical"
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/backup_$DATE.log"
}

# Backup type
BACKUP_TYPE="${1:-full}"

log "Starting PostgreSQL backup: $BACKUP_TYPE"

case "$BACKUP_TYPE" in
    "full")
        # Full physical backup
        log "Starting full physical backup"
        
        BACKUP_PATH="$BACKUP_DIR/full/db_$DATE"
        
        pg_basebackup \
            -h "$DB_HOST" \
            -D "$BACKUP_PATH" \
            -U "$DB_USER" \
            -v \
            -P \
            -W \
            2>&1 | tee -a "$LOG_DIR/backup_$DATE.log"
        
        if [ $? -eq 0 ]; then
            log "Full backup completed successfully"
            
            # Create backup info file
            echo "Backup Type: Full Physical" > "$BACKUP_PATH/backup_info.txt"
            echo "Timestamp: $(date)" >> "$BACKUP_PATH/backup_info.txt"
            echo "Database: $DB_NAME" >> "$BACKUP_PATH/backup_info.txt"
            echo "Hostname: $(hostname)" >> "$BACKUP_PATH/backup_info.txt"
            
            # Compress backup
            tar -czf "$BACKUP_PATH.tar.gz" -C "$(dirname "$BACKUP_PATH")" "$(basename "$BACKUP_PATH")"
            rm -rf "$BACKUP_PATH"
            
            log "Backup compressed: $BACKUP_PATH.tar.gz"
        else
            log "ERROR: Full backup failed"
            exit 1
        fi
        ;;
        
    "logical")
        # Logical backup
        log "Starting logical backup"
        
        BACKUP_FILE="$BACKUP_DIR/logical/db_$DATE.dump"
        
        pg_dump \
            -h "$DB_HOST" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -Fc \
            -f "$BACKUP_FILE" \
            2>&1 | tee -a "$LOG_DIR/backup_$DATE.log"
        
        if [ $? -eq 0 ]; then
            log "Logical backup completed successfully: $BACKUP_FILE"
        else
            log "ERROR: Logical backup failed"
            exit 1
        fi
        ;;
        
    *)
        log "ERROR: Invalid backup type: $BACKUP_TYPE"
        echo "Usage: $0 [full|logical]"
        exit 1
        ;;
esac

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days"

find "$BACKUP_DIR/full" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/logical" -name "*.dump" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/wal" -name "*" -mtime +7 -delete

find "$LOG_DIR" -name "backup_*.log" -mtime +30 -delete

log "Backup process completed"
```

### Cron Job Configuration

Add to `/etc/cron.d/postgres_backup`:

```cron
# PostgreSQL Backup Schedule
# Full backup daily at 2:00 AM UTC
0 2 * * * postgres /usr/local/bin/postgres_backup.sh full

# Logical backup daily at 3:00 AM UTC
0 3 * * * postgres /usr/local/bin/postgres_backup.sh logical

# Backup verification daily at 4:00 AM UTC
0 4 * * * postgres /usr/local/bin/verify_backups.sh
```

## Manual Backup Procedures

### Emergency Full Backup

```bash
# Create emergency backup directory
mkdir -p /backup/emergency/$(date +%Y%m%d_%H%M%S)
cd /backup/emergency/$(date +%Y%m%d_%H%M%S)

# Stop application (recommended)
systemctl stop queryflux-backend

# Take full backup
pg_basebackup -h localhost -D ./backup -U postgres -v -P -W

# Create schema backup
pg_dump -h localhost -U postgres -d queryflux_prod -s -f schema.sql

# Create configuration backup
cp -r /etc/postgresql/* ./
cp -r /var/lib/postgresql/data/pg_hba.conf ./

# Restart application
systemctl start queryflux-backend

echo "Emergency backup completed in $(pwd)"
```

### Schema Backup Before Major Changes

```bash
# Backup schema
pg_dump -h localhost -U postgres -d queryflux_prod -s > schema_before_v2.1.sql

# Backup specific tables
pg_dump -h localhost -U postgres -d queryflux_prod -t users -t connections -t queries > tables_backup.sql

# Backup roles and permissions
pg_dumpall -h localhost -U postgres --roles-only > roles.sql
```

## Recovery Procedures

### 1. Point-in-Time Recovery (PITR)

**Scenario**: Recover database to specific time due to data corruption or accidental deletion.

**Steps**:

1. **Stop PostgreSQL Service**
```bash
systemctl stop postgresql
```

2. **Backup Current Data Directory**
```bash
mv /var/lib/postgresql/data /var/lib/postgresql/data.bak.$(date +%Y%m%d_%H%M%S)
```

3. **Restore from Latest Full Backup**
```bash
# Extract full backup
tar -xzf /backup/postgres/full/db_20241201.tar.gz -C /var/lib/postgresql/
mv /var/lib/postgresql/db_20241201 /var/lib/postgresql/data
```

4. **Configure Recovery**
```bash
# Create recovery signal file
touch /var/lib/postgresql/data/recovery.signal

# Create postgresql.auto.conf for recovery
cat > /var/lib/postgresql/data/postgresql.auto.conf << EOF
# Recovery Configuration
restore_command = 'cp /backup/postgres/wal/%f %p'
recovery_target_time = '2024-12-01 14:30:00 UTC'
EOF
```

5. **Start PostgreSQL**
```bash
systemctl start postgresql
```

6. **Monitor Recovery Progress**
```bash
tail -f /var/log/postgresql/postgresql-*.log
```

### 2. Full Database Restore

**Scenario**: Complete database restoration from full backup.

**Steps**:

1. **Stop Services**
```bash
systemctl stop postgresql
systemctl stop queryflux-backend
```

2. **Restore Full Backup**
```bash
# Clean data directory
rm -rf /var/lib/postgresql/data/*
mkdir -p /var/lib/postgresql/data

# Restore from backup
pg_basebackup -h localhost -D /var/lib/postgresql/data -U postgres -v -P -W
```

3. **Restore WAL Files (if available)**
```bash
# Copy recent WAL files
cp /backup/postgres/wal/* /var/lib/postgresql/data/pg_wal/
```

4. **Start Services**
```bash
systemctl start postgresql
systemctl start queryflux-backend
```

### 3. Logical Restore

**Scenario**: Restore data to different database or server.

**Steps**:

1. **Create Target Database**
```bash
createdb -h localhost -U postgres queryflux_restore
```

2. **Restore from Dump**
```bash
# From custom format dump
pg_restore -h localhost -U postgres -d queryflux_restore /backup/postgres/logical/db_20241201.dump

# From SQL dump
psql -h localhost -U postgres -d queryflux_restore < /backup/postgres/logical/db_20241201.sql
```

3. **Verify Data Integrity**
```bash
# Check row counts
psql -h localhost -U postgres -d queryflux_restore -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserted,
    n_tup_upd as updated,
    n_tup_del as deleted,
    n_live_tup as live,
    n_dead_tup as dead
FROM pg_stat_user_tables;
"
```

## Disaster Recovery Plan

### Scenario 1: Complete Server Failure

**Recovery Steps**:

1. **Provision New Server**
   - Install PostgreSQL (same version)
   - Configure network and storage
   - Install QueryFlux application

2. **Restore from Latest Backup**
   - Copy backup files from off-site storage
   - Restore full database backup
   - Apply WAL files for point-in-time recovery

3. **Verify Application**
   - Test database connectivity
   - Verify application functionality
   - Update DNS/load balancer

4. **Post-Recovery Tasks**
   - Run full backup of recovered system
   - Update monitoring configuration
   - Document recovery process

### Scenario 2: Data Corruption

**Recovery Steps**:

1. **Identify Corruption Time**
   - Review application logs
   - Check database logs
   - Identify affected tables/rows

2. **Point-in-Time Recovery**
   - Restore to time before corruption
   - Export affected data
   - Restore current state
   - Re-import clean data

3. **Validation**
   - Verify data integrity
   - Run application tests
   - Monitor for issues

## Backup Storage and Retention

### Local Storage

```bash
# Directory structure
/backup/postgres/
├── full/           # Full physical backups
├── wal/            # WAL archive files
├── logical/        # Logical backups
└── config/         # Configuration backups
```

### Off-Site Storage

**AWS S3 Configuration**:
```bash
# Sync backups to S3
aws s3 sync /backup/postgres/ s3://queryflux-backups/postgres/ --delete

# Lifecycle policy for S3
aws s3api put-bucket-lifecycle-configuration \
    --bucket queryflux-backups \
    --lifecycle-configuration file://lifecycle.json
```

**S3 Lifecycle Policy** (`lifecycle.json`):
```json
{
    "Rules": [
        {
            "ID": "PostgreSQLBackupLifecycle",
            "Status": "Enabled",
            "Transitions": [
                {
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 365,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ]
        }
    ]
}
```

## Monitoring and Alerting

### Backup Monitoring Script

Create `/usr/local/bin/monitor_backups.sh`:

```bash
#!/bin/bash

# Monitor backup health and send alerts

BACKUP_DIR="/backup/postgres"
LOG_DIR="/var/log/postgres_backup"
ALERT_EMAIL="admin@queryflux.com"
DATE=$(date +%Y%m%d)

# Check if today's backup exists
check_backup() {
    local backup_type=$1
    local pattern=$2
    
    if ! find "$BACKUP_DIR/$backup_type" -name "$pattern" -mtime 0 | head -1; then
        echo "ALERT: $backup_type backup not found for today!" | \
        mail -s "QueryFlux Backup Alert" "$ALERT_EMAIL"
        return 1
    fi
    
    return 0
}

# Check backup sizes
check_backup_size() {
    local backup_file=$1
    local min_size_mb=$2
    
    if [ -f "$backup_file" ]; then
        local size_mb=$(du -m "$backup_file" | cut -f1)
        if [ "$size_mb" -lt "$min_size_mb" ]; then
            echo "ALERT: Backup $backup_file is too small (${size_mb}MB < ${min_size_mb}MB)" | \
            mail -s "QueryFlux Backup Size Alert" "$ALERT_EMAIL"
        fi
    fi
}

# Check backup integrity
check_backup_integrity() {
    local backup_file=$1
    
    if [[ "$backup_file" == *.dump ]]; then
        if ! pg_restore --list "$backup_file" > /dev/null 2>&1; then
            echo "ALERT: Backup $backup_file appears to be corrupted" | \
            mail -s "QueryFlux Backup Corruption Alert" "$ALERT_EMAIL"
        fi
    fi
}

# Perform checks
check_backup "full" "db_${DATE}*.tar.gz"
check_backup "logical" "db_${DATE}*.dump"

# Check sizes
LATEST_FULL=$(find "$BACKUP_DIR/full" -name "db_*.tar.gz" -mtime 0 | head -1)
check_backup_size "$LATEST_FULL" 100  # Minimum 100MB

# Check integrity
LATEST_LOGICAL=$(find "$BACKUP_DIR/logical" -name "db_*.dump" -mtime 0 | head -1)
check_backup_integrity "$LATEST_LOGICAL"
```

### Prometheus Metrics

Add to PostgreSQL configuration for backup monitoring:

```sql
-- Create backup tracking table
CREATE TABLE backup_stats (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL,
    backup_path TEXT NOT NULL,
    backup_size BIGINT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT
);

-- Create backup monitoring view
CREATE VIEW backup_monitoring AS
SELECT 
    backup_type,
    DATE(start_time) as backup_date,
    COUNT(*) as backup_count,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration_seconds,
    SUM(backup_size) as total_size_bytes,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_backups,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups
FROM backup_stats
WHERE start_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY backup_type, DATE(start_time);
```

## Testing and Validation

### Monthly Backup Testing Procedure

1. **Test Restore Process**
```bash
#!/bin/bash
# Test backup restore monthly

TEST_DATE=$(date +%Y%m%d)
TEST_DB="queryflux_test_${TEST_DATE}"

# Create test database
createdb -U postgres "$TEST_DB"

# Restore latest logical backup
LATEST_BACKUP=$(find /backup/postgres/logical -name "*.dump" -mtime -7 | head -1)
pg_restore -U postgres -d "$TEST_DB" "$LATEST_BACKUP"

# Run validation queries
psql -U postgres -d "$TEST_DB" -c "
SELECT 
    (SELECT COUNT(*) FROM users) as user_count,
    (SELECT COUNT(*) FROM connections) as connection_count,
    (SELECT COUNT(*) FROM queries) as query_count;
"

# Clean up test database
dropdb -U postgres "$TEST_DB"
```

2. **Automated Validation**
```bash
# Add to crontab
0 5 1 * * postgres /usr/local/bin/test_backup_restore.sh
```

## Troubleshooting

### Common Backup Issues

#### 1. Insufficient Disk Space
**Symptoms**: Backup fails with "No space left on device"
**Solution**:
```bash
# Check disk usage
df -h

# Clean old backups
find /backup -name "*.tar.gz" -mtime +7 -delete
find /backup -name "*.dump" -mtime +7 -delete

# Move backups to external storage
aws s3 mv /backup/postgres/ s3://queryflux-backups/postgres/ --recursive
```

#### 2. WAL Archiving Issues
**Symptoms**: WAL files not being archived
**Solution**:
```bash
# Check archive command
test -f /backup/wal/test && rm /backup/wal/test

# Check permissions
ls -la /backup/wal/

# Verify archive command in postgresql.conf
grep archive_command /etc/postgresql/*/main/postgresql.conf
```

#### 3. Backup Corruption
**Symptoms**: Restore fails with corruption errors
**Solution**:
```bash
# Verify backup integrity
pg_restore --list backup.dump

# Test restore on test system
pg_restore -U postgres -d test_db backup.dump

# If corrupted, use previous backup
find /backup -name "*.dump" -mtime -2
```

### Recovery Issues

#### 1. Timeline Divergence
**Symptoms**: Recovery fails with timeline mismatch
**Solution**:
```bash
# Check available timelines
ls /backup/postgres/wal/* | grep -E '\.[0-9A-F]{8}$'

# Choose correct timeline
echo "recovery_target_timeline = 'latest'" >> /var/lib/postgresql/data/postgresql.auto.conf
```

#### 2. Missing WAL Files
**Symptoms**: Recovery stops due to missing WAL segments
**Solution**:
```bash
# Check WAL archive
ls -la /backup/postgres/wal/

# If WAL files are missing, restore to last available point
# Update recovery_target_time to an earlier time
```

### Performance Issues

#### 1. Slow Backups
**Symptoms**: Backup taking longer than expected
**Solution**:
```bash
# Check database activity during backup
SELECT * FROM pg_stat_activity WHERE state = 'active';

# Use parallel backup
pg_basebackup -h localhost -D ./backup -U postgres -v -P -W -j 4

# Consider using compression
pg_dump -h localhost -U postgres -d queryflux_prod -Fc -Z9 -f backup.dump
```

#### 2. High I/O During Backups
**Symptoms**: Performance degradation during backups
**Solution**:
```bash
# Monitor I/O
iotop -o

# Schedule backups during low-usage periods
# Update cron job timing

# Use throttling
ionice -c2 -n7 nice -n19 pg_basebackup ...
```

## Contact and Support

- **Database Administrator**: dba@queryflux.com
- **Infrastructure Team**: infra@queryflux.com
- **Emergency Contact**: +1-555-0123

For immediate assistance during a disaster recovery scenario, page the on-call database administrator using the emergency contact number.

---

**Document Version**: 1.0
**Last Updated**: December 1, 2024
**Next Review**: March 1, 2025
**Approved By**: Database Team Lead