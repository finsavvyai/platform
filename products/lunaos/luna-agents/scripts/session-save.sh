#!/bin/bash

# Luna Session Save Hook
# Saves Luna session state before compact operation

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
SESSION_LOG="${PLUGIN_ROOT}/logs/session.log"
BACKUP_DIR="${PLUGIN_ROOT}/backups/sessions"

mkdir -p "$BACKUP_DIR" "$(dirname "$SESSION_LOG")"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SESSION_ID=$(date +%s)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💾 Saving session state before compact..." >> "$SESSION_LOG"

# Find current Luna state files
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
WORKSPACE_STATE="${PLUGIN_ROOT}/workspace/.luna-workspace.json"

# Create session backup
SESSION_BACKUP="${BACKUP_DIR}/session-${TIMESTAMP}.tar.gz"
TEMP_DIR="${BACKUP_DIR}/temp-${SESSION_ID}"
mkdir -p "$TEMP_DIR"

# Copy state files
if [[ -f "$LUNA_STATE" ]]; then
    cp "$LUNA_STATE" "$TEMP_DIR/luna-state.json"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💾 Saved Luna state" >> "$SESSION_LOG"
fi

if [[ -f "$WORKSPACE_STATE" ]]; then
    cp "$WORKSPACE_STATE" "$TEMP_DIR/workspace-state.json"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💾 Saved workspace state" >> "$SESSION_LOG"
fi

# Copy recent logs
for log_file in "$PLUGIN_ROOT/logs"/human-readable.log "$PLUGIN_ROOT/logs/commands.log; do
    if [[ -f "$log_file" ]]; then
        cp "$log_file" "$TEMP_DIR/"
    fi
done

# Copy implementation plan if it exists
for impl_file in implementation-plan.md .luna/implementation-plan.md; do
    if [[ -f "$impl_file" ]]; then
        cp "$impl_file" "$TEMP_DIR/"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💾 Saved implementation plan" >> "$SESSION_LOG"
        break
    fi
done

# Create session metadata
cat > "$TEMP_DIR/session-metadata.json" << EOF
{
  "session_id": "$SESSION_ID",
  "timestamp": "$(date -Iseconds)",
  "pre_compact": true,
  "workspace": "$(pwd)",
  "files_in_backup": $(find "$TEMP_DIR" -type f | wc -l),
  "backup_size_bytes": $(du -sb "$TEMP_DIR" | cut -f1)
}
EOF

# Create compressed backup
tar -czf "$SESSION_BACKUP" -C "$TEMP_DIR" . 2>/dev/null

# Cleanup temp directory
rm -rf "$TEMP_DIR"

if [[ -f "$SESSION_BACKUP" ]]; then
    BACKUP_SIZE=$(du -h "$SESSION_BACKUP" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Session saved: $SESSION_BACKUP ($BACKUP_SIZE)" >> "$SESSION_LOG"

    # Clean old session backups (keep last 10)
    find "$BACKUP_DIR" -name "session-*.tar.gz" | sort -r | tail -n +11 | xargs rm -f 2>/dev/null || true
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Failed to create session backup" >> "$SESSION_LOG"
    exit 1
fi

exit 0