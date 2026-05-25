#!/bin/bash

# Luna File Backup Hook
# Creates backup of files before modification

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
BACKUP_DIR="${PLUGIN_ROOT}/backups"
LOG_FILE="${PLUGIN_ROOT}/logs/backup.log"

mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")"

# Get file path from tool input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.command_args[1] // empty')

# Skip if file doesn't exist
[[ ! -f "$FILE_PATH" ]] && exit 0

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RELATIVE_PATH=$(echo "$FILE_PATH" | sed "s|$PLUGIN_ROOT/||")
BACKUP_FILE="${BACKUP_DIR}/${RELATIVE_PATH}.${TIMESTAMP}.backup"

# Create backup directory structure
mkdir -p "$(dirname "$BACKUP_FILE")"

# Create backup
cp "$FILE_PATH" "$BACKUP_FILE" 2>/dev/null || {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Failed to backup: $FILE_PATH" >> "$LOG_FILE"
    exit 1
}

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💾 Backed up: $RELATIVE_PATH -> $(basename "$BACKUP_FILE")" >> "$LOG_FILE"

# Clean old backups (keep last 10 per file)
find "$(dirname "$BACKUP_FILE")" -name "$(basename "$FILE_PATH").*.backup" | sort -r | tail -n +11 | xargs rm -f 2>/dev/null || true

exit 0