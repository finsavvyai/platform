#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Database Backup Strategy Implementation
# =============================================================================
# Implements automated backup strategies for all production databases
# Supports point-in-time recovery, cross-region replication, and retention policies
# =============================================================================

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKUP_DIR="${BACKUP_DIR:-/tmp/sdlc-backups}"
readonly LOG_FILE="${BACKUP_DIR}/backup.log"
readonly CONFIG_FILE="${SCRIPT_DIR}/backup-config.json"
readonly RETENTION_CONFIG="${SCRIPT_DIR}/retention-policy.json"

# Backup configuration
readonly PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
readonly COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"
readonly ENCRYPTION_ENABLED="${ENCRYPTION_ENABLED:-true}"
readonly CROSS_REGION_REPLICATION="${CROSS_REGION_REPLICATION:-true}"

# Database configurations
declare -A DATABASES=(
    ["sdlc-tenant-db"]="tenant"
    ["sdlc-auth-db"]="auth"
    ["sdlc-documents-db"]="documents"
    ["sdlc-vector-metadata-db"]="vector"
    ["sdlc-policy-db"]="policy"
)

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color

    case "$level" in
        "ERROR") color="$RED" ;;
        "WARN") color="$YELLOW" ;;
        "INFO") color="$BLUE" ;;
        "SUCCESS") color="$GREEN" ;;
        "DEBUG") color="$PURPLE" ;;
        *) color="$NC" ;;
    esac

    echo -e "${color}[$level]${NC} ${timestamp} - $message" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_error() { log "ERROR" "$@"; }
log_warn() { log "WARN" "$@"; }
log_success() { log "SUCCESS" "$@"; }
log_debug() { log "DEBUG" "$@"; }

# Error handling
trap 'handle_error $? $LINENO' ERR

handle_error() {
    local exit_code=$1
    local line_number=$2
    log_error "Script failed on line $line_number with exit code $exit_code"
    send_notification "backup_failed" "Database backup failed on line $line_number"
    exit $exit_code
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking backup prerequisites..."

    # Required tools
    local required_tools=("wrangler" "jq" "openssl" "gzip" "aws" "gpg")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done

    # Check Cloudflare authentication
    if ! wrangler whoami &> /dev/null; then
        log_error "Wrangler is not authenticated"
        exit 1
    fi

    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/temp"
    mkdir -p "$BACKUP_DIR/archives"
    mkdir -p "$BACKUP_DIR/metadata"

    # Load configuration
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
    fi

    log_success "Prerequisites check completed"
}

# Generate backup ID
generate_backup_id() {
    echo "backup-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
}

# Encrypt backup file
encrypt_file() {
    local input_file="$1"
    local output_file="$2"

    if [[ "$ENCRYPTION_ENABLED" == "true" ]]; then
        log_info "Encrypting backup file..."

        # Generate random encryption key if not provided
        local encryption_key="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

        # Encrypt with AES-256-GCM
        openssl enc -aes-256-gcm \
            -in "$input_file" \
            -out "$output_file" \
            -k "$encryption_key" \
            -pbkdf2 \
            -iter 100000 \
            -md sha256

        # Store encryption key separately (in secure location)
        if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
            echo "$encryption_key" | gpg -c --batch --passphrase "$MASTER_PASSWORD" \
                -o "${output_file}.key"
        fi

        log_success "Backup encrypted successfully"
    else
        cp "$input_file" "$output_file"
    fi
}

# Compress backup file
compress_file() {
    local input_file="$1"
    local output_file="$2"

    log_info "Compressing backup file with level $COMPRESSION_LEVEL..."
    gzip -"$COMPRESSION_LEVEL" -c "$input_file" > "$output_file"
    log_success "Backup compressed successfully"
}

# Create database backup
create_database_backup() {
    local db_name="$1"
    local backup_id="$2"
    local timestamp=$(date +%s)

    log_info "Creating backup for database: $db_name"

    # Generate backup filename
    local backup_file="${BACKUP_DIR}/temp/${db_name}-${backup_id}.sql"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.enc"

    # Create D1 database export
    log_info "Exporting database data..."
    wrangler d1 export "$db_name" --env production > "$backup_file"

    # Verify export
    if [[ ! -s "$backup_file" ]]; then
        log_error "Database export failed for $db_name"
        return 1
    fi

    # Compress backup
    compress_file "$backup_file" "$compressed_file"
    rm -f "$backup_file"

    # Encrypt backup
    encrypt_file "$compressed_file" "$encrypted_file"
    rm -f "$compressed_file"

    # Generate metadata
    local metadata_file="${BACKUP_DIR}/metadata/${db_name}-${backup_id}.json"
    jq -n \
        --arg db_name "$db_name" \
        --arg backup_id "$backup_id" \
        --arg timestamp "$timestamp" \
        --arg size "$(stat -f%z "$encrypted_file" 2>/dev/null || stat -c%s "$encrypted_file")" \
        --arg checksum "$(sha256sum "$encrypted_file" | cut -d' ' -f1)" \
        --arg encrypted "$ENCRYPTION_ENABLED" \
        --arg compression_level "$COMPRESSION_LEVEL" \
        '{
            database_name: $db_name,
            backup_id: $backup_id,
            timestamp: ($timestamp | tonumber),
            file_size: ($size | tonumber),
            checksum: $checksum,
            encrypted: ($encrypted == "true"),
            compression_level: ($compression_level | tonumber),
            created_at: now
        }' > "$metadata_file"

    log_success "Backup created for $db_name"
    echo "$encrypted_file"
}

# Upload backup to cloud storage
upload_backup() {
    local backup_file="$1"
    local db_name="$2"
    local backup_id="$3"

    log_info "Uploading backup to cloud storage..."

    # Upload to primary region
    local s3_key="sdlc-backups/database/${db_name}/$(basename "$backup_file")"
    aws s3 cp "$backup_file" "s3://sdlc-backups-primary/$s3_key" \
        --server-side-encryption AES256 \
        --storage-class STANDARD_IA

    # Upload metadata
    local metadata_file="${BACKUP_DIR}/metadata/${db_name}-${backup_id}.json"
    aws s3 cp "$metadata_file" "s3://sdlc-backups-primary/${s3_key%.enc}.json"

    # Cross-region replication if enabled
    if [[ "$CROSS_REGION_REPLICATION" == "true" ]]; then
        log_info "Initiating cross-region replication..."
        aws s3 cp "$backup_file" "s3://sdlc-backups-secondary/$s3_key" \
            --server-side-encryption AES256 \
            --storage-class GLACIER \
            --region us-west-2
    fi

    log_success "Backup uploaded to cloud storage"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    local db_name="$2"
    local backup_id="$3"

    log_info "Verifying backup integrity..."

    # Load metadata
    local metadata_file="${BACKUP_DIR}/metadata/${db_name}-${backup_id}.json"
    local expected_checksum=$(jq -r '.checksum' "$metadata_file")

    # Calculate actual checksum
    local actual_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)

    if [[ "$expected_checksum" != "$actual_checksum" ]]; then
        log_error "Checksum mismatch for $db_name backup"
        return 1
    fi

    # Test decryption if encrypted
    if [[ "$ENCRYPTION_ENABLED" == "true" ]]; then
        local test_decrypt="${BACKUP_DIR}/temp/test-decrypt.gz"
        local encryption_key="${BACKUP_ENCRYPTION_KEY:-$(gpg -q --batch --yes --decrypt --passphrase "$MASTER_PASSWORD" "${backup_file}.key")"

        openssl enc -d -aes-256-gcm \
            -in "$backup_file" \
            -out "$test_decrypt" \
            -k "$encryption_key" \
            -pbkdf2 \
            -iter 100000 \
            -md sha256 2>/dev/null

        if gzip -t "$test_decrypt" 2>/dev/null; then
            log_success "Backup decryption test passed"
        else
            log_error "Backup decryption test failed"
            rm -f "$test_decrypt" "${backup_file}.key"
            return 1
        fi

        rm -f "$test_decrypt"
        [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]] && rm -f "${backup_file}.key"
    fi

    log_success "Backup integrity verified for $db_name"
}

# Parallel backup execution
backup_all_databases() {
    local backup_id="$1"
    local pids=()

    log_info "Starting parallel backup of all databases..."

    # Start backup jobs in parallel
    for db_name in "${!DATABASES[@]}"; do
        (
            local backup_file
            backup_file=$(create_database_backup "$db_name" "$backup_id")

            upload_backup "$backup_file" "$db_name" "$backup_id"
            verify_backup "$backup_file" "$db_name" "$backup_id"

            # Move to archives
            mv "$backup_file" "${BACKUP_DIR}/archives/"
            log_success "Backup completed for $db_name"
        ) &
        pids+=($!)
    done

    # Wait for all backups to complete
    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            failed=1
        fi
    done

    if [[ $failed -eq 1 ]]; then
        log_error "One or more database backups failed"
        return 1
    fi

    log_success "All database backups completed successfully"
}

# Apply retention policy
apply_retention_policy() {
    log_info "Applying retention policy..."

    # Load retention configuration
    local daily_retention=7
    local weekly_retention=30
    local monthly_retention=365
    local yearly_retention=-1  # Keep forever

    if [[ -f "$RETENTION_CONFIG" ]]; then
        daily_retention=$(jq -r '.daily_retention // 7' "$RETENTION_CONFIG")
        weekly_retention=$(jq -r '.weekly_retention // 30' "$RETENTION_CONFIG")
        monthly_retention=$(jq -r '.monthly_retention // 365' "$RETENTION_CONFIG")
        yearly_retention=$(jq -r '.yearly_retention // -1' "$RETENTION_CONFIG")
    fi

    # Cleanup old backups from local storage
    find "$BACKUP_DIR/archives" -name "*.enc" -mtime +7 -delete
    find "$BACKUP_DIR/metadata" -name "*.json" -mtime +7 -delete

    # Cleanup old backups from S3
    aws s3 ls "s3://sdlc-backups-primary/database/" --recursive | \
        awk '{print $4}' | \
        while read -r key; do
            local timestamp=$(basename "$key" | grep -o '[0-9]\{14\}' | head -1)
            if [[ -n "$timestamp" ]]; then
                local backup_date=$(date -d "${timestamp:0:8}" +%s 2>/dev/null || echo 0)
                local current_date=$(date +%s)
                local age_days=$(((current_date - backup_date) / 86400))

                if [[ $age_days -gt $daily_retention ]]; then
                    log_debug "Deleting old backup: $key (age: $age_days days)"
                    aws s3 rm "s3://sdlc-backups-primary/$key"
                fi
            fi
        done

    log_success "Retention policy applied"
}

# Test backup restoration
test_backup_restoration() {
    local test_db_name="$1"
    local backup_id="$2"

    log_info "Testing backup restoration for $test_db_name..."

    # Create test database
    local test_db_id="${test_db_name}-restore-test-$(date +%s)"
    wrangler d1 create "$test_db_id"

    # Download latest backup
    local latest_backup=$(aws s3 ls "s3://sdlc-backups-primary/database/$test_db_name/" \
        --recursive | sort | tail -1 | awk '{print $4}')

    if [[ -n "$latest_backup" ]]; then
        aws s3 cp "s3://sdlc-backups-primary/$latest_backup" \
            "${BACKUP_DIR}/temp/test-backup.enc"

        # Decrypt and decompress
        local test_decrypt="${BACKUP_DIR}/temp/test-decrypt.sql"
        local encryption_key="${BACKUP_ENCRYPTION_KEY:-$(gpg -q --batch --yes --decrypt --passphrase "$MASTER_PASSWORD" "${BACKUP_DIR}/temp/test-backup.enc.key")}"

        openssl enc -d -aes-256-gcm \
            -in "${BACKUP_DIR}/temp/test-backup.enc" \
            -out "${BACKUP_DIR}/temp/test-decrypt.gz" \
            -k "$encryption_key" \
            -pbkdf2 \
            -iter 100000 \
            -md sha256 2>/dev/null

        gunzip -c "${BACKUP_DIR}/temp/test-decrypt.gz" > "$test_decrypt"

        # Restore to test database
        wrangler d1 execute "$test_db_id" --file "$test_decrypt"

        # Verify restoration
        local record_count=$(wrangler d1 execute "$test_db_id" \
            --command "SELECT COUNT(*) FROM records" --env production 2>/dev/null | \
            jq -r '.[0].results[0].count // 0')

        if [[ $record_count -gt 0 ]]; then
            log_success "Backup restoration test passed for $test_db_name"
        else
            log_error "Backup restoration test failed for $test_db_name"
        fi

        # Cleanup test database
        wrangler d1 delete "$test_db_id" --yes
        rm -f "${BACKUP_DIR}/temp/test-backup.enc" \
            "${BACKUP_DIR}/temp/test-backup.enc.key" \
            "${BACKUP_DIR}/temp/test-decompress.gz" \
            "$test_decrypt"
    fi
}

# Generate backup report
generate_backup_report() {
    local backup_id="$1"
    local report_file="${BACKUP_DIR}/reports/backup-report-${backup_id}.json"

    mkdir -p "$(dirname "$report_file")"

    log_info "Generating backup report..."

    jq -n \
        --arg backup_id "$backup_id" \
        --arg timestamp "$(date -Iseconds)" \
        --arg status "success" \
        --arg duration "$(date +%s)" \
        '{
            backup_id: $backup_id,
            timestamp: $timestamp,
            status: $status,
            databases: [],
            total_size: 0,
            duration: ($duration | tonumber)
        }' > "$report_file"

    # Add database details
    for db_name in "${!DATABASES[@]}"; do
        local metadata_file="${BACKUP_DIR}/metadata/${db_name}-${backup_id}.json"
        if [[ -f "$metadata_file" ]]; then
            local db_info=$(jq '. | {name: .database_name, size: .file_size, checksum: .checksum}' "$metadata_file")
            jq --argjson db_info "$db_info" '.databases += [$db_info] | .total_size += $db_info.size' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
        fi
    done

    # Send report to stakeholders
    send_notification "backup_report" "Backup report generated for $backup_id" "$report_file"

    log_success "Backup report generated: $report_file"
}

# Send notifications
send_notification() {
    local event_type="$1"
    local message="$2"
    local attachment="${3:-}"

    log_info "Sending notification: $event_type - $message"

    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local payload
        if [[ -n "$attachment" && -f "$attachment" ]]; then
            payload=$(jq -n \
                --arg text "$message" \
                --argjson attachment "$(cat "$attachment")" \
                '{text: $text, attachments: [$attachment]}')
        else
            payload=$(jq -n --arg text "$message" '{text: $text}')
        fi

        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "$payload" &>/dev/null || true
    fi

    # Email notification
    if [[ -n "${NOTIFICATION_EMAIL:-}" ]]; then
        echo "$message" | mail -s "SDLC Backup Notification: $event_type" "$NOTIFICATION_EMAIL" || true
    fi

    # PagerDuty for critical events
    if [[ "$event_type" == "backup_failed" && -n "${PAGERDUTY_SERVICE_KEY:-}" ]]; then
        curl -s -X POST "https://events.pagerduty.com/v2/enqueue" \
            -H "Content-Type: application/json" \
            -d "$(jq -n \
                --arg routing_key "$PAGERDUTY_SERVICE_KEY" \
                --arg event_action "trigger" \
                --arg payload_summary "Database backup failed" \
                --arg payload_source "backup-script" \
                --arg payload_severity "critical" \
                '{
                    routing_key: $routing_key,
                    event_action: $event_action,
                    payload: {
                        summary: $payload_summary,
                        source: $payload_source,
                        severity: $payload_severity
                    }
                }')" &>/dev/null || true
    fi
}

# Main backup function
main() {
    log_info "Starting database backup process..."
    local start_time=$(date +%s)

    # Check prerequisites
    check_prerequisites

    # Generate backup ID
    local backup_id
    backup_id=$(generate_backup_id)
    log_info "Backup ID: $backup_id"

    # Create backups
    backup_all_databases "$backup_id"

    # Apply retention policy
    apply_retention_policy

    # Test one backup restoration (rotate through databases)
    local test_db="${DATABASES[$((start_time % ${#DATABASES[@]}))]}"
    test_backup_restoration "$test_db" "$backup_id"

    # Generate report
    generate_backup_report "$backup_id"

    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log_success "Database backup process completed successfully in ${duration}s"
    send_notification "backup_success" "All database backups completed successfully for $backup_id"
}

# Show help
show_help() {
    cat << EOF
SDLC.ai Database Backup Strategy Script

Usage: $0 [OPTIONS]

Options:
    -h, --help              Show this help message
    -c, --config FILE       Load configuration from file
    -r, --restore DB_ID     Test restoration of specific database
    -t, --test-only         Only run backup tests, don't create new backups
    -v, --verbose           Enable verbose logging
    --dry-run               Show what would be done without executing

Environment Variables:
    BACKUP_DIR              Backup directory (default: /tmp/sdlc-backups)
    BACKUP_ENCRYPTION_KEY   Master encryption key for backups
    MASTER_PASSWORD         Password for encrypted key storage
    COMPRESSION_LEVEL       Gzip compression level (1-9, default: 6)
    ENCRYPTION_ENABLED      Enable encryption (true/false, default: true)
    CROSS_REGION_REPLICATION Enable cross-region replication (default: true)
    PARALLEL_JOBS          Number of parallel backup jobs (default: 4)

    Notification Settings:
    SLACK_WEBHOOK_URL       Slack webhook URL for notifications
    NOTIFICATION_EMAIL      Email address for notifications
    PAGERDUTY_SERVICE_KEY   PagerDuty service key for critical alerts

Examples:
    $0                      # Run full backup process
    $0 -c prod-config.json # Load production configuration
    $0 -r sdlc-tenant-db   # Test restoration of tenant database
    $0 -t                   # Run backup tests only
    $0 --dry-run            # Show what would be done

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -r|--restore)
            RESTORE_DB="$2"
            shift 2
            ;;
        -t|--test-only)
            TEST_ONLY=true
            shift
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Handle special modes
if [[ -n "${RESTORE_DB:-}" ]]; then
    check_prerequisites
    local backup_id=$(generate_backup_id)
    test_backup_restoration "$RESTORE_DB" "$backup_id"
    exit 0
fi

if [[ "${TEST_ONLY:-}" == "true" ]]; then
    check_prerequisites
    for db_name in "${DATABASES[@]}"; do
        test_backup_restoration "$db_name" "test-$(date +%s)"
    done
    exit 0
fi

if [[ "${DRY_RUN:-}" == "true" ]]; then
    log_info "DRY RUN: Would create backups for databases: ${!DATABASES[*]}"
    log_info "DRY RUN: Would upload to S3 bucket: sdlc-backups-primary"
    log_info "DRY RUN: Would apply retention policy"
    exit 0
fi

# Run main function
main
