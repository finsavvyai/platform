#!/bin/bash

# SDLC.ai Database Backup Script
# Creates encrypted, incremental backups with verification

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_DIR="$PROJECT_ROOT/logs"
CONFIG_FILE="$PROJECT_ROOT/config/backup.conf"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/backup-$DATE.log"

# Load configuration
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sdlc_platform}"
DB_USER="${DB_USER:-sdlc_admin}"
DB_PASSWORD="${DB_PASSWORD:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-sdlc-database-backups}"
S3_REGION="${S3_REGION:-us-west-1}"
KMS_KEY_ID="${KMS_KEY_ID:-}"
ENCRYPT_BACKUP="${ENCRYPT_BACKUP:-true}"
COMPRESS_BACKUP="${COMPRESS_BACKUP:-true}"
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
VERIFY_BACKUP="${VERIFY_BACKUP:-true}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL_RECIPIENTS="${EMAIL_RECIPIENTS:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2

    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        [[ "$status" == "failure" ]] && color="danger"
        [[ "$status" == "warning" ]] && color="warning"

        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Database Backup\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {
                            \"title\": \"Database\",
                            \"value\": \"$DB_NAME\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Timestamp\",
                            \"value\": \"$(date)\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Backup File\",
                            \"value\": \"${BACKUP_FILE:-N/A}\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Size\",
                            \"value\": \"${BACKUP_SIZE:-N/A}\",
                            \"short\": true
                        }
                    ]
                }]
            }" || log_warning "Failed to send Slack notification"
    fi

    # Email notification
    if [[ -n "$EMAIL_RECIPIENTS" ]]; then
        echo "$message" | mail -s "Database Backup $status" "$EMAIL_RECIPIENTS" || {
            log_warning "Failed to send email notification"
        }
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check required tools
    for tool in pg_dump pg_restore psql aws kubectl; do
        if ! command -v $tool &> /dev/null; then
            log_error "$tool is not installed"
            exit 1
        fi
    done

    # Check database connection
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
        log_error "Cannot connect to database"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi

    # Check S3 bucket access
    if ! aws s3 ls "s3://$S3_BUCKET" &>/dev/null; then
        log_error "Cannot access S3 bucket: $S3_BUCKET"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Create backup
create_backup() {
    log_info "Starting database backup..."

    BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$DATE.sql"
    FINAL_FILE="$BACKUP_FILE"

    # Custom pg_dump options for large database
    local dump_opts=(
        "-h" "$DB_HOST"
        "-p" "$DB_PORT"
        "-U" "$DB_USER"
        "-d" "$DB_NAME"
        "--verbose"
        "--no-owner"
        "--no-privileges"
        "--exclude-table-data=system_metrics"
        "--exclude-table-data=audit_logs"
        "--exclude-table-data=webhook_deliveries"
        "--jobs=$PARALLEL_JOBS"
        "--format=custom"
        "--file=$BACKUP_FILE"
    )

    # Execute backup
    log_info "Running pg_dump with options: ${dump_opts[*]}"

    if PGPASSWORD="$DB_PASSWORD" pg_dump "${dump_opts[@]}" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Database backup created: $BACKUP_FILE"
    else
        log_error "Database backup failed"
        send_notification "failure" "Database backup failed for $DB_NAME"
        exit 1
    fi

    # Compress backup if enabled
    if [[ "$COMPRESS_BACKUP" == "true" ]]; then
        log_info "Compressing backup..."
        gzip -f "$BACKUP_FILE"
        FINAL_FILE="${BACKUP_FILE}.gz"
        log_success "Backup compressed: $FINAL_FILE"
    fi

    # Encrypt backup if enabled
    if [[ "$ENCRYPT_BACKUP" == "true" ]]; then
        log_info "Encrypting backup..."

        if [[ -n "$KMS_KEY_ID" ]]; then
            # Use AWS KMS for encryption
            aws kms encrypt \
                --key-id "$KMS_KEY_ID" \
                --plaintext "fileb://$FINAL_FILE" \
                --output "fileb://${FINAL_FILE}.enc" \
                --region "$S3_REGION"

            rm -f "$FINAL_FILE"
            FINAL_FILE="${FINAL_FILE}.enc"
        else
            # Use GPG for encryption
            gpg --batch --yes --symmetric --cipher-algo AES256 \
                --output "${FINAL_FILE}.gpg" "$FINAL_FILE"

            rm -f "$FINAL_FILE"
            FINAL_FILE="${FINAL_FILE}.gpg"
        fi

        log_success "Backup encrypted: $FINAL_FILE"
    fi

    # Get backup size
    BACKUP_SIZE=$(du -h "$FINAL_FILE" | cut -f1)
    log_info "Backup size: $BACKUP_SIZE"

    # Create checksum
    log_info "Creating checksum..."
    sha256sum "$FINAL_FILE" > "${FINAL_FILE}.sha256"
    log_success "Checksum created: ${FINAL_FILE}.sha256"

    export BACKUP_FILE="$FINAL_FILE"
}

# Verify backup
verify_backup() {
    if [[ "$VERIFY_BACKUP" != "true" ]]; then
        log_info "Backup verification disabled"
        return 0
    fi

    log_info "Verifying backup integrity..."

    local test_db="${DB_NAME}_test_$(date +%s)"

    # Create test database
    PGPASSWORD="$DB_PASSWORD" createdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        "$test_db" || {
        log_error "Failed to create test database"
        return 1
    }

    # Restore to test database
    log_info "Restoring backup to test database..."

    local restore_opts=(
        "-h" "$DB_HOST"
        "-p" "$DB_PORT"
        "-U" "$DB_USER"
        "-d" "$test_db"
        "--verbose"
        "--jobs=$PARALLEL_JOBS"
        "--no-owner"
        "--no-privileges"
        "--disable-triggers"
    )

    # Decrypt if needed
    local restore_file="$BACKUP_FILE"
    if [[ "$BACKUP_FILE" == *.enc ]]; then
        aws kms decrypt \
            --ciphertext-blob "fileb://$BACKUP_FILE" \
            --output "fileb://${BACKUP_FILE}.dec" \
            --region "$S3_REGION"
        restore_file="${BACKUP_FILE}.dec"
    elif [[ "$BACKUP_FILE" == *.gpg ]]; then
        gpg --batch --yes --decrypt \
            --output "${BACKUP_FILE}.dec" "$BACKUP_FILE"
        restore_file="${BACKUP_FILE}.dec"
    fi

    # Decompress if needed
    if [[ "$restore_file" == *.gz ]]; then
        gunzip -c "$restore_file" > "${restore_file}.sql"
        restore_file="${restore_file}.sql"
    fi

    # Perform restore
    if PGPASSWORD="$DB_PASSWORD" pg_restore "${restore_opts[@]}" "$restore_file" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Backup restore verification passed"

        # Run basic checks
        log_info "Running verification queries..."

        local table_count=$(PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$test_db" \
            -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

        log_info "Tables restored: $table_count"

        # Check critical tables
        for table in tenants users documents; do
            local count=$(PGPASSWORD="$DB_PASSWORD" psql \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -U "$DB_USER" \
                -d "$test_db" \
                -tAc "SELECT COUNT(*) FROM $table;")
            log_info "$table records: $count"
        done

    else
        log_error "Backup restore verification failed"
        VERIFICATION_FAILED=true
    fi

    # Cleanup test database
    PGPASSWORD="$DB_PASSWORD" dropdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        "$test_db" || log_warning "Failed to drop test database"

    # Cleanup temporary files
    rm -f "${BACKUP_FILE}.dec" "${BACKUP_FILE}.sql"

    if [[ "${VERIFICATION_FAILED:-false}" == "true" ]]; then
        send_notification "failure" "Database backup verification failed for $DB_NAME"
        exit 1
    fi
}

# Upload to S3
upload_to_s3() {
    log_info "Uploading backup to S3..."

    local s3_key="backups/${DB_NAME}/$(date +%Y)/$(date +%m)/$(basename $BACKUP_FILE)"

    # Upload backup file
    if aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/$s3_key" \
        --storage-class STANDARD_IA \
        --metadata "backup-date=$(date -u +%Y-%m-%dT%H:%M:%SZ),database=$DB_NAME" \
        --region "$S3_REGION"; then
        log_success "Backup uploaded to S3: s3://$S3_BUCKET/$s3_key"
    else
        log_error "Failed to upload backup to S3"
        send_notification "failure" "Failed to upload backup to S3"
        exit 1
    fi

    # Upload checksum
    if aws s3 cp "${BACKUP_FILE}.sha256" "s3://$S3_BUCKET/${s3_key}.sha256" \
        --region "$S3_REGION"; then
        log_success "Checksum uploaded to S3"
    else
        log_warning "Failed to upload checksum to S3"
    fi

    # Create latest symlink
    if aws s3 cp "s3://$S3_BUCKET/$s3_key" "s3://$S3_BUCKET/backups/${DB_NAME}/latest.backup" \
        --region "$S3_REGION"; then
        log_success "Latest backup link updated"
    else
        log_warning "Failed to update latest backup link"
    fi

    # Set lifecycle policy
    aws s3api put-object-tagging \
        --bucket "$S3_BUCKET" \
        --key "$s3_key" \
        --tagging "BackupType=Daily&RetentionDays=$RETENTION_DAYS&Database=$DB_NAME" \
        --region "$S3_REGION" || log_warning "Failed to set object tags"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups..."

    # Local cleanup
    find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql*" -mtime +$RETENTION_DAYS -delete
    log_info "Local cleanup completed"

    # S3 cleanup
    log_info "Cleaning up S3 backups older than $RETENTION_DAYS days..."

    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)

    # List and delete old backups
    aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "backups/${DB_NAME}/" \
        --query "Contents[?LastModified<='$cutoff_date'].Key" \
        --output text \
        --region "$S3_REGION" | \
    while read -r key; do
        if [[ -n "$key" && "$key" != "None" ]]; then
            aws s3 rm "s3://$S3_BUCKET/$key" --region "$S3_REGION"
            log_info "Deleted old backup: $key"
        fi
    done

    log_success "S3 cleanup completed"
}

# Create backup manifest
create_manifest() {
    local manifest_file="$BACKUP_DIR/manifest_$DATE.json"

    cat > "$manifest_file" <<EOF
{
    "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database": {
        "host": "$DB_HOST",
        "port": "$DB_PORT",
        "name": "$DB_NAME",
        "user": "$DB_USER"
    },
    "backup": {
        "file": "$(basename $BACKUP_FILE)",
        "size": "$BACKUP_SIZE",
        "checksum": "$(cat ${BACKUP_FILE}.sha256 | cut -d' ' -f1)",
        "compressed": $COMPRESS_BACKUP,
        "encrypted": $ENCRYPT_BACKUP,
        "verification": "$VERIFY_BACKUP"
    },
    "configuration": {
        "retention_days": $RETENTION_DAYS,
        "parallel_jobs": $PARALLEL_JOBS,
        "exclude_tables": ["system_metrics", "audit_logs", "webhook_deliveries"]
    }
}
EOF

    log_info "Backup manifest created: $manifest_file"

    # Upload manifest
    aws s3 cp "$manifest_file" "s3://$S3_BUCKET/backups/${DB_NAME}/manifests/$(basename $manifest_file)" \
        --region "$S3_REGION" || log_warning "Failed to upload manifest"
}

# Main backup function
main() {
    log_info "Starting database backup process..."
    log_info "Database: $DB_NAME"
    log_info "Host: $DB_HOST:$DB_PORT"

    # Set trap for cleanup
    trap 'log_error "Backup interrupted"; send_notification "failure" "Database backup interrupted"; exit 1' INT TERM

    # Run backup pipeline
    check_prerequisites
    create_backup
    verify_backup
    upload_to_s3
    create_manifest
    cleanup_old_backups

    # Success
    log_success "Database backup completed successfully!"
    log_info "Backup file: $BACKUP_FILE"
    log_info "Size: $BACKUP_SIZE"

    send_notification "success" "Database backup completed for $DB_NAME\nSize: $BACKUP_SIZE\nFile: $(basename $BACKUP_FILE)"

    # Log summary
    log_info "Backup summary:"
    log_info "  - Database: $DB_NAME"
    log_info "  - Size: $BACKUP_SIZE"
    log_info "  - Compression: $COMPRESS_BACKUP"
    log_info "  - Encryption: $ENCRYPT_BACKUP"
    log_info "  - Verification: $VERIFY_BACKUP"
    log_info "  - Retention: $RETENTION_DAYS days"

    log_info "Backup log saved to: $LOG_FILE"
}

# Restore function
restore_backup() {
    local backup_file=$1
    local restore_db=${2:-${DB_NAME}_restore}

    if [[ -z "$backup_file" ]]; then
        log_error "Backup file required for restore"
        exit 1
    fi

    log_info "Starting database restore..."
    log_info "Backup: $backup_file"
    log_info "Target database: $restore_db"

    # Download from S3 if needed
    if [[ ! -f "$backup_file" ]]; then
        log_info "Downloading backup from S3..."
        aws s3 cp "s3://$S3_BUCKET/$backup_file" "$BACKUP_DIR/" --region "$S3_REGION"
        backup_file="$BACKUP_DIR/$(basename $backup_file)"
    fi

    # Create restore database
    PGPASSWORD="$DB_PASSWORD" createdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        "$restore_db" || {
        log_error "Failed to create restore database"
        exit 1
    }

    # Restore
    log_info "Restoring database..."

    local restore_opts=(
        "-h" "$DB_HOST"
        "-p" "$DB_PORT"
        "-U" "$DB_USER"
        "-d" "$restore_db"
        "--verbose"
        "--jobs=$PARALLEL_JOBS"
        "--no-owner"
        "--no-privileges"
        "--if-exists"
        "--clean"
    )

    if PGPASSWORD="$DB_PASSWORD" pg_restore "${restore_opts[@]}" "$backup_file"; then
        log_success "Database restore completed successfully!"
        log_info "Restored to: $restore_db"
    else
        log_error "Database restore failed"
        exit 1
    fi
}

# List backups
list_backups() {
    log_info "Listing available backups..."

    aws s3 ls "s3://$S3_BUCKET/backups/${DB_NAME}/" --recursive --human-readable --region "$S3_REGION" | \
    sort -r | \
    while read -r line; do
        echo "$line"
    done
}

# Parse command line arguments
case "${1:-backup}" in
    "backup")
        main
        ;;
    "restore")
        restore_backup "$2" "$3"
        ;;
    "list")
        list_backups
        ;;
    "verify")
        check_prerequisites
        if [[ -n "$2" ]]; then
            BACKUP_FILE="$2"
            verify_backup
        else
            log_error "Backup file required for verification"
            exit 1
        fi
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    *)
        echo "Usage: $0 {backup|restore <backup_file> [database]|list|verify <backup_file>|cleanup}"
        echo "  backup   - Create new backup"
        echo "  restore  - Restore from backup"
        echo "  list     - List available backups"
        echo "  verify   - Verify backup integrity"
        echo "  cleanup  - Clean up old backups"
        exit 1
        ;;
esac
