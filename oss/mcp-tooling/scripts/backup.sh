#!/bin/bash
# MCPOverflow Database Backup Script
# Performs automated PostgreSQL backups with S3 upload

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/tmp/mcpoverflow-backups}"
S3_BUCKET="${S3_BUCKET:-mcpoverflow-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mcpoverflow}"
DB_USER="${DB_USER:-postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mcpoverflow_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create backup directory
mkdir -p "$BACKUP_DIR"

log_info "Starting backup of database: $DB_NAME"
log_info "Timestamp: $TIMESTAMP"

# Perform backup
log_info "Creating compressed backup..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose \
    2>/dev/null | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log_info "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Verify backup integrity
log_info "Verifying backup integrity..."
if gunzip -t "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null; then
    log_info "Backup integrity verified ✓"
else
    log_error "Backup integrity check failed!"
    exit 1
fi

# Upload to S3
if command -v aws &> /dev/null; then
    log_info "Uploading to S3: s3://${S3_BUCKET}/${BACKUP_FILE}"
    aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/${BACKUP_FILE}" \
        --storage-class STANDARD_IA \
        --sse aws:kms

    if [ $? -eq 0 ]; then
        log_info "S3 upload complete ✓"
        
        # Tag with metadata
        aws s3api put-object-tagging \
            --bucket "$S3_BUCKET" \
            --key "$BACKUP_FILE" \
            --tagging "TagSet=[{Key=Environment,Value=${ENVIRONMENT:-production}},{Key=Database,Value=$DB_NAME},{Key=Timestamp,Value=$TIMESTAMP}]"
    else
        log_error "S3 upload failed!"
    fi
else
    log_warn "AWS CLI not available, skipping S3 upload"
fi

# Cleanup old local backups
log_info "Cleaning up local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "mcpoverflow_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
LOCAL_COUNT=$(find "$BACKUP_DIR" -name "mcpoverflow_*.sql.gz" | wc -l)
log_info "Local backups remaining: $LOCAL_COUNT"

# Cleanup old S3 backups (if AWS CLI available)
if command -v aws &> /dev/null; then
    log_info "Cleaning up S3 backups older than ${RETENTION_DAYS} days..."
    CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)
    
    aws s3 ls "s3://${S3_BUCKET}/" | while read -r line; do
        FILE_DATE=$(echo "$line" | awk '{print $1}')
        FILE_NAME=$(echo "$line" | awk '{print $4}')
        
        if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]] && [[ "$FILE_NAME" == mcpoverflow_*.sql.gz ]]; then
            aws s3 rm "s3://${S3_BUCKET}/${FILE_NAME}"
            log_info "Deleted old backup: $FILE_NAME"
        fi
    done
fi

log_info "Backup completed successfully!"
echo ""
echo "=========================================="
echo "Backup Summary"
echo "=========================================="
echo "File: ${BACKUP_FILE}"
echo "Size: ${BACKUP_SIZE}"
echo "Location: ${BACKUP_DIR}/${BACKUP_FILE}"
if command -v aws &> /dev/null; then
    echo "S3: s3://${S3_BUCKET}/${BACKUP_FILE}"
fi
echo "=========================================="
