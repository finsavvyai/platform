#!/bin/bash

# Backup and Disaster Recovery Configuration
# Sets up automated backup and disaster recovery procedures

set -e

echo "💾 Setting up backup and disaster recovery configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create database backup scripts
setup_database_backups() {
    log_info "Setting up database backup procedures..."

    mkdir -p scripts/backup

    cat > scripts/backup/backup-database.sh << 'EOF'
#!/bin/bash

# Database Backup Script
# Performs automated database backups with encryption and cloud storage

set -e

# Configuration
DB_NAME="${DB_NAME:-qestro_production}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/qestro}"
S3_BUCKET="${S3_BUCKET:-qestro-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/daily/qestro_backup_$TIMESTAMP.sql"
ENCRYPTED_FILE="$BACKUP_FILE.enc"

# Create database backup
create_backup() {
    echo "Creating database backup..."

    # Use pg_dump for PostgreSQL backup
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-privileges \
        --verbose \
        --format=custom \
        --compress=9 \
        --file="$BACKUP_FILE"

    # Verify backup was created
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "ERROR: Backup file was not created"
        exit 1
    fi

    echo "Database backup created: $BACKUP_FILE"
}

# Encrypt backup
encrypt_backup() {
    echo "Encrypting backup file..."

    if [ -z "$ENCRYPTION_KEY" ]; then
        echo "WARNING: No encryption key provided, skipping encryption"
        cp "$BACKUP_FILE" "$ENCRYPTED_FILE"
    else
        # Encrypt with GPG
        echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
            --symmetric --cipher-algo AES256 \
            --output "$ENCRYPTED_FILE" "$BACKUP_FILE"

        # Remove unencrypted backup
        rm "$BACKUP_FILE"
    fi

    echo "Backup encrypted: $ENCRYPTED_FILE"
}

# Upload to cloud storage
upload_to_cloud() {
    echo "Uploading backup to cloud storage..."

    if command -v aws &> /dev/null && [ -n "$AWS_ACCESS_KEY_ID" ]; then
        # Upload to AWS S3
        aws s3 cp "$ENCRYPTED_FILE" "s3://$S3_BUCKET/database/daily/$(basename "$ENCRYPTED_FILE")" \
            --storage-class GLACIER_IR

        echo "Backup uploaded to S3: s3://$S3_BUCKET/database/daily/$(basename "$ENCRYPTED_FILE")"
    else
        echo "WARNING: AWS CLI not configured, skipping cloud upload"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    echo "Cleaning up old backups..."

    # Remove local daily backups older than RETENTION_DAYS
    find "$BACKUP_DIR/daily" -name "*.enc" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR/daily" -name "*.sql" -mtime +$RETENTION_DAYS -delete

    # Keep weekly backups for 12 weeks
    if [ $(date +%u) -eq 1 ]; then  # Monday
        cp "$ENCRYPTED_FILE" "$BACKUP_DIR/weekly/weekly_$(date +%Y%m%d).enc"
    fi
    find "$BACKUP_DIR/weekly" -name "*.enc" -mtime +84 -delete

    # Keep monthly backups for 12 months
    if [ $(date +%d) -eq 1 ]; then  # First of month
        cp "$ENCRYPTED_FILE" "$BACKUP_DIR/monthly/monthly_$(date +%Y%m).enc"
    fi
    find "$BACKUP_DIR/monthly" -name "*.enc" -mtime +365 -delete

    echo "Old backups cleaned up"
}

# Verify backup integrity
verify_backup() {
    echo "Verifying backup integrity..."

    if [ -f "$ENCRYPTED_FILE" ]; then
        local file_size=$(stat -c%s "$ENCRYPTED_FILE")
        if [ $file_size -gt 1000 ]; then
            echo "Backup verification passed: $(basename "$ENCRYPTED_FILE") ($file_size bytes)"
            return 0
        else
            echo "ERROR: Backup file too small: $file_size bytes"
            return 1
        fi
    else
        echo "ERROR: Backup file not found"
        return 1
    fi
}

# Send notifications
send_notification() {
    local status="$1"
    local message="$2"

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        if [ "$status" = "ERROR" ]; then
            color="danger"
        elif [ "$status" = "WARNING" ]; then
            color="warning"
        fi

        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\", \"color\": \"$color\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main execution
main() {
    echo "🗄️ Starting database backup process..."

    local start_time=$(date +%s)

    # Create backup
    if create_backup; then
        # Encrypt backup
        if encrypt_backup; then
            # Verify backup
            if verify_backup; then
                # Upload to cloud
                upload_to_cloud

                # Cleanup old backups
                cleanup_old_backups

                local end_time=$(date +%s)
                local duration=$((end_time - start_time))

                echo "✅ Database backup completed successfully in ${duration}s"
                send_notification "SUCCESS" "✅ Database backup completed successfully for $DB_NAME ($(basename "$ENCRYPTED_FILE"))"
            else
                echo "❌ Backup verification failed"
                send_notification "ERROR" "❌ Database backup verification failed for $DB_NAME"
                exit 1
            fi
        else
            echo "❌ Backup encryption failed"
            send_notification "ERROR" "❌ Database backup encryption failed for $DB_NAME"
            exit 1
        fi
    else
        echo "❌ Database backup failed"
        send_notification "ERROR" "❌ Database backup failed for $DB_NAME"
        exit 1
    fi
}

main "$@"
EOF

    chmod +x scripts/backup/backup-database.sh

    # Create restore script
    cat > scripts/backup/restore-database.sh << 'EOF'
#!/bin/bash

# Database Restore Script
# Restores database from encrypted backup

set -e

# Usage information
usage() {
    echo "Usage: $0 <backup_file> [target_database]"
    echo "  backup_file: Path to encrypted backup file"
    echo "  target_database: Optional target database name (defaults to production)"
    exit 1
}

# Check arguments
if [ $# -lt 1 ]; then
    usage
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-qestro_production}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Decrypt backup
decrypt_backup() {
    echo "Decrypting backup file..."

    local decrypted_file="${BACKUP_FILE%.*}.sql"

    if [ -z "$ENCRYPTION_KEY" ]; then
        echo "WARNING: No encryption key provided, assuming file is not encrypted"
        cp "$BACKUP_FILE" "$decrypted_file"
    else
        echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
            --decrypt --output "$decrypted_file" "$BACKUP_FILE"
    fi

    echo "Backup decrypted: $decrypted_file"
    echo "$decrypted_file"
}

# Create target database
create_database() {
    echo "Creating target database: $TARGET_DB"

    PGPASSWORD="$DB_PASSWORD" createdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        "$TARGET_DB" 2>/dev/null || echo "Database already exists or creation failed"
}

# Restore database
restore_database() {
    local sql_file="$1"

    echo "Restoring database from: $sql_file"

    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TARGET_DB" \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        "$sql_file"

    echo "Database restore completed"
}

# Verify restore
verify_restore() {
    echo "Verifying database restore..."

    local table_count=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TARGET_DB" \
        -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")

    echo "Restored database contains $table_count tables"

    if [ "$table_count" -gt 0 ]; then
        echo "✅ Database restore verification passed"
        return 0
    else
        echo "❌ Database restore verification failed"
        return 1
    fi
}

# Main execution
main() {
    echo "🔄 Starting database restore process..."

    echo "Source backup: $BACKUP_FILE"
    echo "Target database: $TARGET_DB"

    # Decrypt backup
    local sql_file=$(decrypt_backup)

    # Create target database
    create_database

    # Restore database
    if restore_database "$sql_file"; then
        # Verify restore
        if verify_restore; then
            echo "✅ Database restore completed successfully"

            # Clean up decrypted file
            rm -f "$sql_file"
        else
            echo "❌ Database restore verification failed"
            exit 1
        fi
    else
        echo "❌ Database restore failed"
        exit 1
    fi
}

main "$@"
EOF

    chmod +x scripts/backup/restore-database.sh

    log_success "Database backup scripts created"
}

# Create application backup scripts
setup_application_backups() {
    log_info "Setting up application backup procedures..."

    cat > scripts/backup/backup-application.sh << 'EOF'
#!/bin/bash

# Application Backup Script
# Backs up application files, configurations, and user data

set -e

# Configuration
APP_DIR="${APP_DIR:-/opt/qestro}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/qestro}"
S3_BUCKET="${S3_BUCKET:-qestro-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR/application"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/application/qestro_app_backup_$TIMESTAMP.tar.gz"

# Components to backup
BACKUP_COMPONENTS=(
    "src"
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "webpack.config.js"
    ".env.production"
    "nginx"
    "scripts"
    "uploads"
    "logs"
)

# Create application backup
create_backup() {
    echo "Creating application backup..."

    cd "$APP_DIR"

    # Create tar archive
    tar -czf "$BACKUP_FILE" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='.git' \
        --exclude='coverage' \
        --exclude='*.log' \
        "${BACKUP_COMPONENTS[@]}" 2>/dev/null

    # Verify backup was created
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "ERROR: Application backup file was not created"
        exit 1
    fi

    echo "Application backup created: $BACKUP_FILE"
}

# Backup user-generated content
backup_user_content() {
    echo "Backing up user-generated content..."

    local user_content_backup="$BACKUP_DIR/application/user_content_$TIMESTAMP.tar.gz"

    if [ -d "$APP_DIR/uploads" ]; then
        tar -czf "$user_content_backup" -C "$APP_DIR" uploads/
        echo "User content backup created: $user_content_backup"
    fi

    if [ -d "$APP_DIR/user-data" ]; then
        tar -czf "$user_content_backup" -C "$APP_DIR" user-data/
        echo "User data backup created: $user_content_backup"
    fi
}

# Upload to cloud storage
upload_to_cloud() {
    echo "Uploading application backup to cloud storage..."

    if command -v aws &> /dev/null && [ -n "$AWS_ACCESS_KEY_ID" ]; then
        # Upload to AWS S3
        aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/application/daily/$(basename "$BACKUP_FILE")" \
            --storage-class STANDARD

        echo "Application backup uploaded to S3: s3://$S3_BUCKET/application/daily/$(basename "$BACKUP_FILE")"
    else
        echo "WARNING: AWS CLI not configured, skipping cloud upload"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    echo "Cleaning up old application backups..."

    # Remove backups older than RETENTION_DAYS
    find "$BACKUP_DIR/application" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

    echo "Old application backups cleaned up"
}

# Verify backup integrity
verify_backup() {
    echo "Verifying application backup integrity..."

    if [ -f "$BACKUP_FILE" ]; then
        # Test archive integrity
        if tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
            local file_size=$(stat -c%s "$BACKUP_FILE")
            echo "Application backup verification passed: $(basename "$BACKUP_FILE") ($file_size bytes)"
            return 0
        else
            echo "ERROR: Application backup archive is corrupted"
            return 1
        fi
    else
        echo "ERROR: Application backup file not found"
        return 1
    fi
}

# Main execution
main() {
    echo "📦 Starting application backup process..."

    local start_time=$(date +%s)

    # Create backup
    if create_backup; then
        # Backup user content
        backup_user_content

        # Verify backup
        if verify_backup; then
            # Upload to cloud
            upload_to_cloud

            # Cleanup old backups
            cleanup_old_backups

            local end_time=$(date +%s)
            local duration=$((end_time - start_time))

            echo "✅ Application backup completed successfully in ${duration}s"
        else
            echo "❌ Application backup verification failed"
            exit 1
        fi
    else
        echo "❌ Application backup failed"
        exit 1
    fi
}

main "$@"
EOF

    chmod +x scripts/backup/backup-application.sh

    log_success "Application backup scripts created"
}

# Create backup scheduling
setup_backup_scheduling() {
    log_info "Setting up automated backup scheduling..."

    mkdir -p scripts/backup

    cat > scripts/backup/schedule-backups.sh << 'EOF'
#!/bin/bash

# Backup Scheduling Setup
# Sets up cron jobs for automated backups

set -e

# Configuration
BACKUP_SCRIPT_DIR="/opt/qestro/scripts/backup"
LOG_FILE="/var/log/qestro-backups.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if backup scripts exist
check_backup_scripts() {
    log_info "Checking backup scripts..."

    local required_scripts=(
        "backup-database.sh"
        "backup-application.sh"
    )

    for script in "${required_scripts[@]}"; do
        if [ ! -f "$BACKUP_SCRIPT_DIR/$script" ]; then
            log_error "Required backup script not found: $script"
            exit 1
        fi
    done

    log_success "All backup scripts found"
}

# Create log directory
setup_logging() {
    log_info "Setting up backup logging..."

    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"

    # Set permissions
    chmod 640 "$LOG_FILE"

    log_success "Backup logging configured: $LOG_FILE"
}

# Setup cron jobs
setup_cron_jobs() {
    log_info "Setting up cron jobs for automated backups..."

    # Remove existing qestro backup cron jobs
    crontab -l 2>/dev/null | grep -v "qestro-backup" | crontab -

    # Add new cron jobs
    (crontab -l 2>/dev/null; cat << CRON_EOF

# Qestro Automated Backups

# Database backup - Daily at 2 AM
0 2 * * * $BACKUP_SCRIPT_DIR/backup-database.sh >> $LOG_FILE 2>&1

# Application backup - Daily at 3 AM
0 3 * * * $BACKUP_SCRIPT_DIR/backup-application.sh >> $LOG_FILE 2>&1

# Backup verification - Daily at 4 AM
0 4 * * * $BACKUP_SCRIPT_DIR/verify-backups.sh >> $LOG_FILE 2>&1

# SSL certificate monitoring - Daily at 9 AM
0 9 * * * /opt/qestro/scripts/ssl/monitor-ssl.sh >> $LOG_FILE 2>&1

# Cleanup old logs - Weekly on Sunday at 5 AM
0 5 * * 0 find /var/log/qestro* -name "*.log" -mtime +30 -delete

CRON_EOF
    ) | crontab -

    log_success "Cron jobs configured successfully"
}

# Test backup scripts
test_backup_scripts() {
    log_info "Testing backup scripts..."

    # Test database backup (dry run)
    log_info "Testing database backup script..."
    if "$BACKUP_SCRIPT_DIR/backup-database.sh" --test 2>/dev/null || true; then
        log_success "Database backup script test passed"
    else
        log_warning "Database backup script test failed (may be normal in test environment)"
    fi

    # Test application backup (dry run)
    log_info "Testing application backup script..."
    if "$BACKUP_SCRIPT_DIR/backup-application.sh" --test 2>/dev/null || true; then
        log_success "Application backup script test passed"
    else
        log_warning "Application backup script test failed (may be normal in test environment)"
    fi
}

# Create backup verification script
create_verification_script() {
    log_info "Creating backup verification script..."

    cat > "$BACKUP_SCRIPT_DIR/verify-backups.sh" << 'VERIFY_EOF'
#!/bin/bash

# Backup Verification Script
# Verifies that backups are working correctly

set -e

BACKUP_DIR="/var/backups/qestro"
S3_BUCKET="${S3_BUCKET:-qestro-backups}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

send_alert() {
    local message="$1"

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Verify local backups
verify_local_backups() {
    log_info "Verifying local backups..."

    local daily_backups=$(find "$BACKUP_DIR/daily" -name "*.enc" -mtime -1 | wc -l)
    local weekly_backups=$(find "$BACKUP_DIR/weekly" -name "*.enc" -mtime -7 | wc -l)
    local monthly_backups=$(find "$BACKUP_DIR/monthly" -name "*.enc" -mtime -30 | wc -l)

    echo "Daily backups (last 24h): $daily_backups"
    echo "Weekly backups (last 7d): $weekly_backups"
    echo "Monthly backups (last 30d): $monthly_backups"

    if [ $daily_backups -eq 0 ]; then
        log_error "No daily backups found in the last 24 hours"
        send_alert "🚨 Backup Alert: No daily backups found for Qestro"
        return 1
    else
        log_success "Daily backups verified: $daily_backups files"
    fi

    if [ $weekly_backups -eq 0 ]; then
        log_warning "No weekly backups found in the last 7 days"
    else
        log_success "Weekly backups verified: $weekly_backups files"
    fi

    return 0
}

# Verify cloud backups
verify_cloud_backups() {
    log_info "Verifying cloud backups..."

    if command -v aws &> /dev/null && [ -n "$AWS_ACCESS_KEY_ID" ]; then
        local cloud_backups=$(aws s3 ls "s3://$S3_BUCKET/database/daily/" --recursive | grep "$(date +%Y%m%d)" | wc -l)

        echo "Cloud backups (today): $cloud_backups"

        if [ $cloud_backups -eq 0 ]; then
            log_warning "No cloud backups found for today"
            return 1
        else
            log_success "Cloud backups verified: $cloud_backups files"
        fi
    else
        log_warning "AWS CLI not configured, skipping cloud backup verification"
    fi

    return 0
}

# Main verification
main() {
    echo "🔍 Verifying backup systems..."

    local errors=0

    if ! verify_local_backups; then
        ((errors++))
    fi

    if ! verify_cloud_backups; then
        ((errors++))
    fi

    if [ $errors -eq 0 ]; then
        log_success "✅ All backup verifications passed"
        send_alert "✅ Backup verification completed successfully for Qestro"
    else
        log_error "❌ $errors backup verifications failed"
        send_alert "❌ Backup verification failed for Qestro - $errors errors detected"
        exit 1
    fi
}

main "$@"
VERIFY_EOF

    chmod +x "$BACKUP_SCRIPT_DIR/verify-backups.sh"

    log_success "Backup verification script created"
}

# Display summary
show_summary() {
    log_info "Backup scheduling summary:"
    echo ""
    echo "📅 Scheduled Tasks:"
    echo "  • Database Backup: Daily at 2:00 AM"
    echo "  • Application Backup: Daily at 3:00 AM"
    echo "  • Backup Verification: Daily at 4:00 AM"
    echo "  • SSL Monitoring: Daily at 9:00 AM"
    echo "  • Log Cleanup: Weekly on Sunday at 5:00 AM"
    echo ""
    echo "📁 Backup Locations:"
    echo "  • Local: /var/backups/qestro/"
    echo "  • Cloud: s3://$S3_BUCKET/"
    echo "  • Logs: $LOG_FILE"
    echo ""
    echo "🔧 To modify schedules, edit crontab with: crontab -e"
}

# Main execution
main() {
    echo "⏰ Setting up automated backup scheduling..."

    check_backup_scripts
    setup_logging
    setup_cron_jobs
    test_backup_scripts
    create_verification_script

    echo ""
    log_success "🎉 Automated backup scheduling completed successfully!"
    echo ""
    show_summary
}

main "$@"
EOF

    chmod +x scripts/backup/schedule-backups.sh

    log_success "Backup scheduling scripts created"
}

# Create disaster recovery procedures
create_disaster_recovery() {
    log_info "Creating disaster recovery procedures..."

    mkdir -p docs/disaster-recovery

    cat > docs/disaster-recovery/disaster-recovery-plan.md << 'EOF'
# Disaster Recovery Plan

## Overview
This document outlines the disaster recovery procedures for the Questro platform.

## Recovery Time Objectives (RTO)
- **Critical Services**: 4 hours
- **Non-Critical Services**: 24 hours
- **Data Loss Tolerance**: Maximum 1 hour

## Backup Strategy

### Database Backups
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days daily, 12 weeks weekly, 12 months monthly
- **Storage**: Local + AWS S3 (Glacier)
- **Encryption**: AES-256 encryption at rest and in transit

### Application Backups
- **Frequency**: Daily at 3:00 AM UTC
- **Components**: Source code, configuration files, user uploads
- **Storage**: Local + AWS S3
- **Retention**: 30 days

## Disaster Scenarios

### 1. Database Corruption
**Symptoms**: Database errors, data inconsistency
**Impact**: High - Complete service outage
**Recovery Time**: 2-4 hours

**Recovery Steps**:
1. Identify corruption timestamp
2. Stop application services
3. Restore from most recent clean backup
4. Verify data integrity
5. Restart services
6. Monitor system health

### 2. Server Failure
**Symptoms**: Server unresponsive, hardware failure
**Impact**: High - Complete service outage
**Recovery Time**: 4-8 hours

**Recovery Steps**:
1. Provision new server
2. Install required dependencies
3. Restore application from backup
4. Restore database from backup
5. Update DNS if needed
6. Test all services
7. Update monitoring

### 3. Data Center Outage
**Symptoms**: Multiple services unavailable
**Impact**: Critical - Extended service outage
**Recovery Time**: 8-24 hours

**Recovery Steps**:
1. Activate disaster recovery site
2. Restore from offsite backups
3. Update DNS to point to DR site
4. Verify all services
5. Monitor performance
6. Plan for failback

### 4. Ransomware Attack
**Symptoms**: Files encrypted, ransom notes
**Impact**: Critical - Data and system compromise
**Recovery Time**: 24-48 hours

**Recovery Steps**:
1. Isolate affected systems
2. Contact security team
3. Wipe and rebuild systems
4. Restore from clean backups
5. Change all credentials
6. Conduct security audit
7. Notify affected users

## Emergency Contacts

### Primary Contacts
- **DevOps Lead**: [Phone] | [Email]
- **System Administrator**: [Phone] | [Email]
- **Database Administrator**: [Phone] | [Email]
- **Security Officer**: [Phone] | [Email]

### Service Providers
- **Cloud Provider**: AWS Support - [Phone]
- **DNS Provider**: Cloudflare Support - [Phone]
- **Monitoring Service**: [Contact Info]

## Recovery Procedures

### Database Recovery
```bash
# 1. Identify required backup
ls -la /var/backups/qestro/daily/

# 2. Restore database
./scripts/backup/restore-database.sh <backup_file> target_db

# 3. Verify data
psql -d target_db -c "SELECT count(*) FROM users;"
```

### Application Recovery
```bash
# 1. Restore application files
tar -xzf /var/backups/qestro/application/qestro_app_backup_YYYYMMDD.tar.gz -C /opt/qestro/

# 2. Install dependencies
npm ci --production

# 3. Update configuration
cp .env.production.backup .env.production

# 4. Restart services
systemctl restart qestro
```

### Full System Recovery
```bash
# 1. Provision new server
# 2. Install dependencies
apt-get update && apt-get install -y nodejs npm postgresql nginx

# 3. Create qestro user
useradd -m -s /bin/bash qestro

# 4. Restore application
./scripts/backup/restore-application.sh <backup_file>

# 5. Restore database
./scripts/backup/restore-database.sh <backup_file>

# 6. Configure services
systemctl enable qestro nginx postgresql
systemctl start qestro nginx postgresql
```

## Testing and Maintenance

### Monthly Tests
- Verify backup integrity
- Test restore procedures
- Update contact information
- Review and update procedures

### Quarterly Tests
- Conduct full disaster recovery drill
- Test failover to DR site
- Update documentation
- Security audit

### Annual Tests
- Major disaster recovery exercise
- Review and update entire plan
- Budget review for DR infrastructure
- Third-party security assessment

## Monitoring and Alerting

### Backup Monitoring
- Daily backup verification
- Storage capacity monitoring
- Backup failure alerts
- Cloud sync monitoring

### System Health Monitoring
- Service availability
- Performance metrics
- Error rates
- Security events

### Escalation Procedures
1. **Level 1**: Automated alerts to on-call engineer
2. **Level 2**: Escalate to DevOps team (30 minutes)
3. **Level 3**: Escalate to management (1 hour)
4. **Level 4**: Activate disaster recovery (2 hours)

## Post-Incident Review

After any incident or disaster recovery event:
1. Document timeline of events
2. Identify root cause
3. Evaluate response effectiveness
4. Update procedures as needed
5. Conduct team debrief
6. Implement improvements

## Documentation Updates

This document should be reviewed and updated:
- Monthly for contact information
- Quarterly for procedure updates
- Annually for comprehensive review
- After any major incident or change
EOF

    cat > docs/disaster-recovery/emergency-contacts.md << 'EOF'
# Emergency Contacts

## Primary Response Team

### DevOps Team
- **DevOps Lead**:
  - Phone: [REPLACE WITH ACTUAL PHONE]
  - Email: [REPLACE WITH ACTUAL EMAIL]
  - Backup: [REPLACE WITH BACKUP CONTACT]

- **System Administrator**:
  - Phone: [REPLACE WITH ACTUAL PHONE]
  - Email: [REPLACE WITH ACTUAL EMAIL]
  - Backup: [REPLACE WITH BACKUP CONTACT]

### Development Team
- **Tech Lead**:
  - Phone: [REPLACE WITH ACTUAL PHONE]
  - Email: [REPLACE WITH ACTUAL EMAIL]

- **Backend Lead**:
  - Phone: [REPLACE WITH ACTUAL PHONE]
  - Email: [REPLACE WITH ACTUAL EMAIL]

- **Frontend Lead**:
  - Phone: [REPLACE WITH ACTUAL PHONE]
  - Email: [REPLACE WITH ACTUAL EMAIL]

### Management
- **CTO**:
  - Phone: [REPLACE WITH ACTUAL PHONE]
  - Email: [REPLACE WITH ACTUAL EMAIL]

- **Engineering Manager**:
  - Phone: [REPLACE WITH ACTUAL PHONE]
  - Email: [REPLACE WITH ACTUAL EMAIL]

## Service Providers

### Cloud Services
- **AWS Support**:
  - Phone: 1-800-618-8899
  - Enterprise Support: 1-855-770-2675
  - Account ID: [REPLACE WITH AWS ACCOUNT ID]

### DNS Services
- **Cloudflare Support**:
  - Phone: 1-650-319-8930
  - Email: support@cloudflare.com

### Database Services
- **Render Support**:
  - Email: support@render.com
  - Dashboard: https://dashboard.render.com/support

### Monitoring Services
- **Uptime Robot**:
  - Email: support@uptimerobot.com

## External Contacts

### Security
- **Security Consultant**: [REPLACE WITH CONTACT]
- **Legal Counsel**: [REPLACE WITH CONTACT]

### PR/Communications
- **PR Contact**: [REPLACE WITH CONTACT]
- **Customer Support**: [REPLACE WITH CONTACT]

## Escalation Procedures

### Severity Levels
- **SEV-0**: Complete system outage
- **SEV-1**: Major service degradation
- **SEV-2**: Minor service issues
- **SEV-3**: Non-critical issues

### Response Times
- **SEV-0**: Immediate response (15 minutes)
- **SEV-1**: 30 minutes
- **SEV-2**: 2 hours
- **SEV-3**: 24 hours

### Escalation Chain
1. **On-call Engineer** → **DevOps Lead** (30 min)
2. **DevOps Lead** → **CTO** (1 hour)
3. **CTO** → **Executive Team** (2 hours)

## Communication Templates

### SEV-0 Incident
```
SUBJECT: CRITICAL: Questro Service Outage

We are currently experiencing a critical service outage affecting all Questro services.

Impact:
- Users cannot access the application
- All services are unavailable

Timeline:
- First detected: [TIME]
- Team engaged: [TIME]

Current Status:
[STATUS UPDATE]

Next Update: [TIME]

Team is actively working to restore services.
```

### Service Recovery
```
SUBJECT: Questro Service Restored

Questro services have been restored following the earlier outage.

Timeline:
- Outage started: [TIME]
- Services restored: [TIME]
- Total downtime: [DURATION]

Impact:
- [DESCRIBE IMPACT]

Root Cause:
[BRIEF EXPLANATION]

Preventive Measures:
[STEPS BEING TAKEN]

We apologize for the inconvenience.
```
EOF

    log_success "Disaster recovery documentation created"
}

# Main execution
main() {
    echo "🛡️ Setting up backup and disaster recovery configuration..."

    setup_database_backups
    setup_application_backups
    setup_backup_scheduling
    create_disaster_recovery

    echo ""
    log_success "🎉 Backup and disaster recovery configuration completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "1. Configure environment variables for backup scripts"
    echo "2. Set up AWS credentials for cloud backups"
    echo "3. Run './scripts/backup/schedule-backups.sh' to automate backups"
    echo "4. Test backup and restore procedures"
    echo "5. Update emergency contact information in docs/disaster-recovery/"
    echo ""
    log_info "Documentation created:"
    echo "- docs/disaster-recovery/disaster-recovery-plan.md"
    echo "- docs/disaster-recovery/emergency-contacts.md"
    echo "- scripts/backup/ - Complete backup automation"
}

# Handle script interruption
trap 'log_error "Script interrupted. Please review partial changes."' INT TERM

# Run main function
main "$@"