#!/bin/bash
# MCPOverflow Database Restore Script
# Restores PostgreSQL database from local or S3 backup

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/tmp/mcpoverflow-backups}"
S3_BUCKET="${S3_BUCKET:-mcpoverflow-backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mcpoverflow}"
DB_USER="${DB_USER:-postgres}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "Usage: $0 [options] <backup_file>"
    echo "Options:"
    echo "  -f, --force    Skip confirmation"
    echo "  -l, --latest   Restore latest local backup"
    echo "  -s, --s3       Restore latest S3 backup"
    exit 1
}

# Parse options
FORCE=false
RESTORE_LATEST=false
RESTORE_S3=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -f|--force) FORCE=true ;;
        -l|--latest) RESTORE_LATEST=true ;;
        -s|--s3) RESTORE_S3=true ;;
        -*) echo "Unknown option: $1"; usage ;;
        *) BACKUP_FILE="$1" ;;
    esac
    shift
done

# Determine backup file
if [ "$RESTORE_LATEST" = true ]; then
    BACKUP_FILE=$(find "$BACKUP_DIR" -name "mcpoverflow_*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -f2-)
    if [ -z "$BACKUP_FILE" ]; then
        log_error "No local backups found in $BACKUP_DIR"
        exit 1
    fi
    log_info "Selected latest local backup: $BACKUP_FILE"
elif [ "$RESTORE_S3" = true ]; then
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Cannot restore from S3."
        exit 1
    fi
    log_info "Finding latest backup in S3..."
    LATEST_KEY=$(aws s3 ls "s3://${S3_BUCKET}/" | grep "mcpoverflow_.*\.sql\.gz" | sort | tail -1 | awk '{print $4}')
    if [ -z "$LATEST_KEY" ]; then
        log_error "No backups found in s3://${S3_BUCKET}"
        exit 1
    fi
    BACKUP_FILE="${BACKUP_DIR}/${LATEST_KEY}"
    log_info "Downloading s3://${S3_BUCKET}/${LATEST_KEY} to ${BACKUP_FILE}..."
    mkdir -p "$BACKUP_DIR"
    aws s3 cp "s3://${S3_BUCKET}/${LATEST_KEY}" "$BACKUP_FILE"
elif [ -z "${BACKUP_FILE:-}" ]; then
    usage
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirmation
if [ "$FORCE" = false ]; then
    echo -e "${YELLOW}WARNING: This will overwite the database '$DB_NAME'.${NC}"
    echo -e "Target Host: $DB_HOST"
    echo -e "Backup File: $BACKUP_FILE"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled."
        exit 0
    fi
fi

# Perform Restore
log_info "Dropping valid connections to $DB_NAME..."
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

log_info "Recreating database $DB_NAME..."
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"

log_info "Restoring from backup..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
else
    PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    log_info "Restore completed successfully! ✓"
else
    log_error "Restore failed!"
    exit 1
fi
