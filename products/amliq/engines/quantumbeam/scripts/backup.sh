#!/bin/bash

# QuantumBeam Backup Script
# This script handles database and application backups

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config"

# Default values
ENVIRONMENT="development"
BACKUP_TYPE="full"
CREATE_BACKUP=false
RESTORE_BACKUP=false
LIST_BACKUPS=false
DELETE_BACKUP=false
COMPRESS=true
ENCRYPT=false
RETENTION_DAYS=30
BACKUP_DIR="/tmp/quantumbeam-backups"
S3_BUCKET="quantumbeam-backups"
DRY_RUN=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

# Usage information
usage() {
    cat << EOF
QuantumBeam Backup Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (development, staging, production) [default: development]
    -t, --type TYPE                 Backup type (full, incremental, database, config) [default: full]
    --create-backup                   Create a new backup
    --restore-backup FILE            Restore from backup file
    --list-backups                    List available backups
    --delete-backup FILE             Delete specific backup
    --backup-dir DIRECTORY          Backup directory [default: /tmp/quantumbeam-backups]
    --s3-bucket BUCKET                S3 bucket for cloud backups [default: quantumbeam-backups]
    --compress                        Compress backup files [default: true]
    --encrypt                         Encrypt backup files [default: false]
    --retention-days DAYS             Backup retention period [default: 30]
    --dry-run                         Perform a dry run without making changes
    --verbose                         Enable verbose output
    -h, --help                       Show this help message

EXAMPLES:
    # Create a full backup
    $0 -e production --create-backup

    # Create database backup only
    $0 -e staging --type database --create-backup

    # List available backups
    $0 -e production --list-backups

    # Restore from backup
    $0 -e production --restore-backup backup-2023-10-15-full.tar.gz

    # Delete old backups
    $0 -e production --delete-backup backup-2023-09-15-full.tar.gz

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--type)
                BACKUP_TYPE="$2"
                shift 2
                ;;
            --create-backup)
                CREATE_BACKUP=true
                shift
                ;;
            --restore-backup)
                RESTORE_BACKUP=true
                BACKUP_FILE="$2"
                shift 2
                ;;
            --list-backups)
                LIST_BACKUPS=true
                shift
                ;;
            --delete-backup)
                DELETE_BACKUP=true
                BACKUP_FILE="$2"
                shift 2
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --s3-bucket)
                S3_BUCKET="$2"
                shift 2
                ;;
            --compress)
                COMPRESS=true
                shift
                ;;
            --no-compress)
                COMPRESS=false
                shift
                ;;
            --encrypt)
                ENCRYPT=true
                shift
                ;;
            --no-encrypt)
                ENCRYPT=false
                shift
                ;;
            --retention-days)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."

    # Check if required tools are installed
    local required_tools=("pg_dump" "psql" "aws" "jq" "tar" "gzip")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done

    # Check if we're in the project root
    if [[ ! -f "$PROJECT_ROOT/go.mod" ]]; then
        log_error "Script must be run from project root directory"
        exit 1
    fi

    # Check environment validity
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be one of: development, staging, production"
        exit 1
    fi

    # Check backup type validity
    if [[ ! "$BACKUP_TYPE" =~ ^(full|incremental|database|config)$ ]]; then
        log_error "Invalid backup type: $BACKUP_TYPE. Must be one of: full, incremental, database, config"
        exit 1
    fi

    # Create backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
    fi

    log_success "Prerequisites validation completed"
}

# Load configuration
load_config() {
    log "Loading configuration for environment: $ENVIRONMENT"

    # Load environment-specific configuration
    local config_file="$CONFIG_DIR/config.${ENVIRONMENT}.yaml"
    if [[ ! -f "$config_file" ]]; then
        log_error "Configuration file not found: $config_file"
        exit 1
    fi

    # Parse database configuration from config file
    # This would parse the YAML file to extract database connection details
    # For now, using environment variables
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-quantumbeam_${ENVIRONMENT}}"
    DB_USER="${DB_USER:-postgres}"
    DB_PASSWORD="${DB_PASSWORD:-}"

    # Construct database URL
    DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

    # Export backup configuration
    export BACKUP_ENVIRONMENT="$ENVIRONMENT"
    export BACKUP_TYPE="$BACKUP_TYPE"
    export BACKUP_DIR="$BACKUP_DIR"
    export S3_BUCKET="$S3_BUCKET"
    export COMPRESS="$COMPRESS"
    export ENCRYPT="$ENCRYPT"
    export RETENTION_DAYS="$RETENTION_DAYS"

    log_success "Configuration loaded successfully"
}

# Create database backup
create_database_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="database_${ENVIRONMENT}_${timestamp}.sql"
    local backup_path="$BACKUP_DIR/$backup_file"

    log "Creating database backup..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would create database backup at $backup_path"
        echo "$backup_file"
        return 0
    fi

    # Create database dump
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --verbose \
        --format=custom \
        --no-owner \
        --no-privileges \
        --file="$backup_path"

    if [[ $? -ne 0 ]]; then
        log_error "Database backup failed"
        exit 1
    fi

    # Compress backup if enabled
    if [[ "$COMPRESS" == true ]]; then
        log "Compressing database backup..."
        gzip "$backup_path"
        backup_file="${backup_file}.gz"
        backup_path="${backup_path}.gz"
    fi

    # Encrypt backup if enabled
    if [[ "$ENCRYPT" == true ]]; then
        log "Encrypting database backup..."
        # This would implement GPG encryption
        log_warning "Encryption not implemented yet"
    fi

    log_success "Database backup created: $backup_file"
    echo "$backup_file"
}

# Create application backup
create_application_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="application_${ENVIRONMENT}_${timestamp}.tar"
    local backup_path="$BACKUP_DIR/$backup_file"

    log "Creating application backup..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would create application backup at $backup_path"
        echo "$backup_file"
        return 0
    fi

    # Create temporary directory for backup
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Copy configuration files
    mkdir -p "$temp_dir/config"
    cp -r "$CONFIG_DIR"/* "$temp_dir/config/"

    # Copy data files if they exist
    if [[ -d "$PROJECT_ROOT/data" ]]; then
        mkdir -p "$temp_dir/data"
        cp -r "$PROJECT_ROOT/data"/* "$temp_dir/data/"
    fi

    # Create backup metadata
    local metadata_file="$temp_dir/metadata.json"
    cat > "$metadata_file" << EOF
{
    "backup_type": "application",
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -Iseconds)",
    "version": "$(git rev-parse HEAD)",
    "branch": "$(git rev-parse --abbrev-ref HEAD)",
    "created_by": "$(whoami)",
    "created_at": "$(date)",
    "backup_files": [
EOF

    # Add file list to metadata
    find "$temp_dir" -type f -not -path "$temp_dir/metadata.json" | while read -r file; do
        echo "      \"$file\"," >> "$metadata_file"
    done
    sed -i '$ s/,$//' "$metadata_file"
    echo "    ]" >> "$metadata_file"
    echo "}" >> "$metadata_file"

    # Create tar archive
    tar -cf "$backup_path" -C "$temp_dir" .

    if [[ $? -ne 0 ]]; then
        log_error "Application backup failed"
        exit 1
    fi

    # Compress backup if enabled
    if [[ "$COMPRESS" == true ]]; then
        log "Compressing application backup..."
        gzip "$backup_path"
        backup_file="${backup_file}.gz"
        backup_path="${backup_path}.gz"
    fi

    # Encrypt backup if enabled
    if [[ "$ENCRYPT" == true ]]; then
        log "Encrypting application backup..."
        # This would implement GPG encryption
        log_warning "Encryption not implemented yet"
    fi

    log_success "Application backup created: $backup_file"
    echo "$backup_file"
}

# Create full backup
create_full_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="full_${ENVIRONMENT}_${timestamp}.tar"
    local backup_path="$BACKUP_DIR/$backup_file"

    log "Creating full backup..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would create full backup at $backup_path"
        echo "$backup_file"
        return 0
    fi

    # Create temporary directory for backup
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Create database backup
    local db_backup_file=$(create_database_backup)
    if [[ -f "$BACKUP_DIR/$db_backup_file" ]]; then
        cp "$BACKUP_DIR/$db_backup_file" "$temp_dir/"
    fi

    # Create application backup
    local app_backup_file=$(create_application_backup)
    if [[ -f "$BACKUP_DIR/$app_backup_file" ]]; then
        cp "$BACKUP_DIR/$app_backup_file" "$temp_dir/"
    fi

    # Create backup metadata
    local metadata_file="$temp_dir/metadata.json"
    cat > "$metadata_file" << EOF
{
    "backup_type": "full",
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -Iseconds)",
    "version": "$(git rev-parse HEAD)",
    "branch": "$(git rev-parse --abbrev-ref HEAD)",
    "created_by": "$(whoami)",
    "created_at": "$(date)",
    "components": ["database", "application"],
    "backup_files": [
EOF

    # Add file list to metadata
    find "$temp_dir" -type f -not -path "$temp_dir/metadata.json" | while read -r file; do
        echo "      \"$(basename "$file")\"," >> "$metadata_file"
    done
    sed -i '$ s/,$//' "$metadata_file"
    echo "    ]" >> "$metadata_file"
    echo "}" >> "$metadata_file"

    # Create tar archive
    tar -cf "$backup_path" -C "$temp_dir" .

    if [[ $? -ne 0 ]]; then
        log_error "Full backup failed"
        exit 1
    fi

    # Compress backup if enabled
    if [[ "$COMPRESS" == true ]]; then
        log "Compressing full backup..."
        gzip "$backup_path"
        backup_file="${backup_file}.gz"
        backup_path="${backup_path}.gz"
    fi

    # Encrypt backup if enabled
    if [[ "$ENCRYPT" == true ]]; then
        log "Encrypting full backup..."
        # This would implement GPG encryption
        log_warning "Encryption not implemented yet"
    fi

    log_success "Full backup created: $backup_file"
    echo "$backup_file"
}

# Upload backup to S3
upload_to_s3() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would upload $backup_file to S3 bucket $S3_BUCKET"
        return 0
    fi

    log "Uploading backup to S3..."

    aws s3 cp "$backup_path" "s3://$S3_BUCKET/backups/$ENVIRONMENT/$backup_file"

    if [[ $? -ne 0 ]]; then
        log_error "Failed to upload backup to S3"
        return 1
    fi

    # Set S3 object metadata
    aws s3api put-object-tagging \
        --bucket "$S3_BUCKET" \
        --key "backups/$ENVIRONMENT/$backup_file" \
        --tagging "Environment=$ENVIRONMENT,BackupType=$BACKUP_TYPE,CreatedAt=$(date +%Y-%m-%d)"

    log_success "Backup uploaded to S3: $backup_file"
}

# List available backups
list_backups() {
    log "Listing available backups for environment: $ENVIRONMENT"

    # List local backups
    if [[ -d "$BACKUP_DIR" ]]; then
        log "Local backups:"
        find "$BACKUP_DIR" -name "*${ENVIRONMENT}*" -type f -exec ls -lh {} \; | \
            awk '{print $9 " (" $5 " - " $6 " " $7 ")"}'
    fi

    # List S3 backups
    log "S3 backups:"
    aws s3 ls "s3://$S3_BUCKET/backups/$ENVIRONMENT/" --recursive | \
        awk '{print $4 " (" $3 " bytes, " $1 ")"}'
}

# Delete backup
delete_backup() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"

    log "Deleting backup: $backup_file"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would delete backup: $backup_file"
        return 0
    fi

    # Delete local backup
    if [[ -f "$backup_path" ]]; then
        rm -f "$backup_path"
        log "Deleted local backup: $backup_file"
    fi

    # Delete S3 backup
    aws s3 rm "s3://$S3_BUCKET/backups/$ENVIRONMENT/$backup_file" 2>/dev/null || true

    log_success "Backup deleted: $backup_file"
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"

    log "Restoring from backup: $backup_file"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would restore from backup: $backup_file"
        return 0
    fi

    # Check if backup file exists locally
    if [[ ! -f "$backup_path" ]]; then
        log "Backup file not found locally, downloading from S3..."
        aws s3 cp "s3://$S3_BUCKET/backups/$ENVIRONMENT/$backup_file" "$backup_path"

        if [[ $? -ne 0 ]]; then
            log_error "Failed to download backup from S3"
            exit 1
        fi
    fi

    # Create temporary directory for restore
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Extract backup
    if [[ "$backup_file" == *.gz ]]; then
        tar -xzf "$backup_path" -C "$temp_dir"
    else
        tar -xf "$backup_path" -C "$temp_dir"
    fi

    # Restore database if present
    if [[ -f "$temp_dir"/*database*.sql* ]]; then
        log "Restoring database..."
        local db_file=$(find "$temp_dir" -name "*database*.sql*" | head -1)

        if [[ "$db_file" == *.gz ]]; then
            gunzip -c "$db_file" | psql "$DATABASE_URL"
        else
            psql "$DATABASE_URL" < "$db_file"
        fi

        if [[ $? -ne 0 ]]; then
            log_error "Database restore failed"
            exit 1
        fi

        log_success "Database restored successfully"
    fi

    # Restore application files if present
    if [[ -d "$temp_dir/config" ]]; then
        log "Restoring configuration files..."
        cp -r "$temp_dir/config"/* "$CONFIG_DIR/"
        log_success "Configuration files restored successfully"
    fi

    if [[ -d "$temp_dir/data" ]]; then
        log "Restoring data files..."
        mkdir -p "$PROJECT_ROOT/data"
        cp -r "$temp_dir/data"/* "$PROJECT_ROOT/data/"
        log_success "Data files restored successfully"
    fi

    log_success "Backup restored successfully: $backup_file"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would clean up old backups"
        return 0
    fi

    # Clean up local backups
    find "$BACKUP_DIR" -name "*${ENVIRONMENT}*" -type f -mtime +$RETENTION_DAYS -delete

    # Clean up S3 backups
    aws s3 ls "s3://$S3_BUCKET/backups/$ENVIRONMENT/" --recursive | \
        while read -r line; do
            local file_date=$(echo "$line" | awk '{print $1}')
            local file_path=$(echo "$line" | awk '{print $4}')
            local file_age=$(( ($(date +%s) - $(date -d "$file_date" +%s)) / 86400 ))

            if [[ $file_age -gt $RETENTION_DAYS ]]; then
                aws s3 rm "s3://$S3_BUCKET/$file_path"
                log "Deleted old S3 backup: $file_path"
            fi
        done

    log_success "Old backups cleanup completed"
}

# Main backup function
create_backup() {
    log "Starting backup process..."
    log "Environment: $ENVIRONMENT"
    log "Backup type: $BACKUP_TYPE"
    log "Backup directory: $BACKUP_DIR"

    local backup_file=""

    case "$BACKUP_TYPE" in
        "database")
            backup_file=$(create_database_backup)
            ;;
        "application")
            backup_file=$(create_application_backup)
            ;;
        "full")
            backup_file=$(create_full_backup)
            ;;
        *)
            log_error "Unknown backup type: $BACKUP_TYPE"
            exit 1
            ;;
    esac

    # Upload to S3
    upload_to_s3 "$backup_file"

    # Cleanup old backups
    cleanup_old_backups

    log_success "Backup process completed successfully!"
    log "Backup file: $backup_file"
}

# Main execution
main() {
    parse_args "$@"

    # Enable verbose mode if requested
    if [[ "$VERBOSE" == true ]]; then
        set -x
    fi

    # Execute based on action
    if [[ "$CREATE_BACKUP" == true ]]; then
        validate_prerequisites
        load_config
        create_backup
    elif [[ "$RESTORE_BACKUP" == true ]]; then
        validate_prerequisites
        load_config
        restore_backup "$BACKUP_FILE"
    elif [[ "$LIST_BACKUPS" == true ]]; then
        list_backups
    elif [[ "$DELETE_BACKUP" == true ]]; then
        validate_prerequisites
        load_config
        delete_backup "$BACKUP_FILE"
    else
        log_error "No action specified. Use --create-backup, --restore-backup, --list-backups, or --delete-backup"
        usage
        exit 1
    fi

    # If script reaches here, operation was successful
    exit 0
}

# Run main function with all arguments
main "$@"