#!/bin/bash

# Luna Compact Prep Hook
# Prepares Luna workspace for Claude Code compact operation

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/compact.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗜️ Preparing for compact operation..." >> "$LOG_FILE"

# Clean up temporary files
find "$PLUGIN_ROOT" -name "*.tmp" -delete 2>/dev/null || true
find "$PLUGIN_ROOT" -name "*.log.tmp" -delete 2>/dev/null || true

# Rotate large log files if needed
for log_file in "$PLUGIN_ROOT/logs/human-readable.log" "$PLUGIN_ROOT/logs/commands.log"; do
    if [[ -f "$log_file" ]] && [[ $(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo 0) -gt 1048576 ]]; then
        mv "$log_file" "${log_file}.old"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📄 Rotated large log: $(basename "$log_file")" >> "$LOG_FILE"
    fi
done

# Update workspace state with compact preparation
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
if [[ -f "$LUNA_STATE" ]]; then
    jq '.last_compact_prep = "'$(date -Iseconds)'"' "$LUNA_STATE" > "${LUNA_STATE}.tmp" && mv "${LUNA_STATE}.tmp" "$LUNA_STATE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Compact preparation complete" >> "$LOG_FILE"

exit 0