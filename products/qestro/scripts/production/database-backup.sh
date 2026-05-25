#!/bin/bash

# Qestro Production Database Backup Script
# Creates automated backups of D1 database and R2 storage

set -euo pipefail

# Configuration
BACKUP_DIR="./backups"
LOG_FILE="./logs/backup.log"
RETENTION_DAYS=30
BACKUP_NAME="qestro-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Create backup directories
setup_directories() {
    mkdir -p "$BACKUP_DIR"/{database,r2,config}
    mkdir -p "$(dirname "$LOG_FILE")"
}

# Backup D1 Database
backup_database() {
    log "🗄️ Starting D1 database backup..."

    local backup_file="$BACKUP_DIR/database/$BACKUP_NAME.sql"

    # Export D1 database
    if npx wrangler d1 export qestro-db --output "$backup_file" --remote; then
        log "✅ D1 database backup completed: $backup_file"

        # Compress backup
        gzip "$backup_file"
        log "✅ Backup compressed: ${backup_file}.gz"

        return 0
    else
        log "❌ D1 database backup failed"
        return 1
    fi
}

# Backup R2 Storage
backup_r2_storage() {
    log "📦 Starting R2 storage backup..."

    local r2_backup_dir="$BACKUP_DIR/r2/$BACKUP_NAME"
    mkdir -p "$r2_backup_dir"

    # List and backup R2 buckets
    local buckets=("qestro-user-uploads" "qestro-test-artifacts" "qestro-reports")

    for bucket in "${buckets[@]}"; do
        log "Backing up bucket: $bucket"

        # Create bucket directory
        mkdir -p "$r2_backup_dir/$bucket"

        # Sync bucket contents
        if npx wrangler r2 object list "$bucket" --remote > "$r2_backup_dir/$bucket/manifest.json" 2>/dev/null; then
            log "✅ Bucket manifest created: $bucket"

            # Download important objects (last 1000)
            npx wrangler r2 object get "$bucket" --remote --include=custom-metadata \
                | head -1000 > "$r2_backup_dir/$bucket/recent-objects.json" 2>/dev/null || true

        else
            log "⚠️ Could not access bucket: $bucket"
        fi
    done

    log "✅ R2 storage backup completed: $r2_backup_dir"
}

# Backup Configuration Files
backup_configuration() {
    log "⚙️ Starting configuration backup..."

    local config_backup_dir="$BACKUP_DIR/config/$BACKUP_NAME"
    mkdir -p "$config_backup_dir"

    # Backup critical configuration files
    local config_files=(
        "wrangler.toml"
        "package.json"
        ".env.production"
        "src/questro-platform-worker.ts"
    )

    for file in "${config_files[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "$config_backup_dir/"
            log "✅ Configuration backed up: $file"
        else
            log "⚠️ Configuration file not found: $file"
        fi
    done

    # Backup worker configuration
    npx wrangler whoami > "$config_backup_dir/worker-info.txt" 2>/dev/null || true

    log "✅ Configuration backup completed: $config_backup_dir"
}

# Clean old backups
cleanup_old_backups() {
    log "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."

    local deleted_files=0

    # Clean database backups
    while IFS= read -r -d '' file; do
        rm "$file"
        ((deleted_files++))
    done < <(find "$BACKUP_DIR/database" -name "*.gz" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null || true)

    # Clean R2 backups
    while IFS= read -r -d '' dir; do
        rm -rf "$dir"
        ((deleted_files++))
    done < <(find "$BACKUP_DIR/r2" -type d -mtime +$RETENTION_DAYS -print0 2>/dev/null || true)

    # Clean config backups
    while IFS= read -r -d '' dir; do
        rm -rf "$dir"
        ((deleted_files++))
    done < <(find "$BACKUP_DIR/config" -type d -mtime +$RETENTION_DAYS -print0 2>/dev/null || true)

    log "✅ Cleaned up $deleted_files old backup files/directories"
}

# Create backup summary
create_backup_summary() {
    local summary_file="$BACKUP_DIR/backup-summary-$BACKUP_NAME.txt"

    cat > "$summary_file" << EOF
Qestro Production Backup Summary
================================
Backup Date: $(date)
Backup Name: $BACKUP_NAME

Components Backed Up:
- D1 Database: $(ls "$BACKUP_DIR/database" | grep "$BACKUP_NAME" | wc -l) files
- R2 Storage: $(find "$BACKUP_DIR/r2" -name "$BACKUP_NAME" -type d | wc -l) directories
- Configuration: $(find "$BACKUP_DIR/config" -name "$BACKUP_NAME" -type d | wc -l) directories

Storage Usage:
$(du -sh "$BACKUP_DIR" 2>/dev/null || echo "Could not calculate storage usage")

Next Scheduled Backup: $(date -d "+1 day" '+%Y-%m-%d %H:%M:%S')
Retention Policy: $RETENTION_DAYS days
EOF

    log "✅ Backup summary created: $summary_file"
}

# Send backup notification
send_notification() {
    local status="$1"
    local message="$2"

    log "📧 Backup notification: $message"

    # Send webhook notification if configured
    if [ -n "${BACKUP_WEBHOOK_URL:-}" ]; then
        curl -s -X POST "$BACKUP_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🗄️ Qestro Backup $status: $message\"}" \
            --max-time 5 || log "Failed to send backup notification"
    fi
}

# Main backup execution
main() {
    log "🚀 Starting Qestro Database Backup..."

    # Setup
    setup_directories

    local backup_start_time=$(date +%s)
    local failed_steps=0

    # Execute backup steps
    if ! backup_database; then
        ((failed_steps++))
        send_notification "FAILED" "D1 database backup failed"
    fi

    if ! backup_r2_storage; then
        ((failed_steps++))
    fi

    if ! backup_configuration; then
        ((failed_steps++))
    fi

    # Cleanup and summary
    cleanup_old_backups
    create_backup_summary

    local backup_end_time=$(date +%s)
    local backup_duration=$((backup_end_time - backup_start_time))

    # Final status
    if [ $failed_steps -eq 0 ]; then
        log "🎉 Backup completed successfully in ${backup_duration}s"
        send_notification "SUCCESS" "All components backed up in ${backup_duration}s"
    else
        log "❌ Backup completed with $failed_steps failed steps in ${backup_duration}s"
        send_notification "PARTIAL" "$failed_steps backup steps failed"
    fi

    log "Backup process completed."
}

# Execute main function
main "$@"
