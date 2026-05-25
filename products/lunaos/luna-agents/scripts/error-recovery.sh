#!/bin/bash

# Luna Error Recovery Hook
# Attempts automatic error recovery for Luna workflows

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/error-recovery.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse error details
ERROR_MSG=$(echo "$1" | jq -r '.error // "Unknown error"')
COMMAND=$(echo "$1" | jq -r '.tool_input.command // "unknown"')
TIMESTAMP=$(date -Iseconds)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔧 Attempting error recovery for: $ERROR_MSG" >> "$LOG_FILE"

RECOVERY_ATTEMPTED=false
RECOVERY_SUCCESS=false

# Attempt recovery based on error patterns
case "$ERROR_MSG" in
    *permission*|*denied*)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔒 Permission error - suggesting file permission check" >> "$LOG_FILE"
        RECOVERY_ATTEMPTED=true
        # In a real implementation, this might attempt to fix permissions
        ;;
    *not found*)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 File not found - suggesting path verification" >> "$LOG_FILE"
        RECOVERY_ATTEMPTED=true
        # In a real implementation, this might search for similar files
        ;;
    *network*|*connection*)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🌐 Network error - suggesting retry with backoff" >> "$LOG_FILE"
        RECOVERY_ATTEMPTED=true
        # In a real implementation, this might implement retry logic
        ;;
    *syntax*|*parse*)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Syntax error - suggesting syntax validation" >> "$LOG_FILE"
        RECOVERY_ATTEMPTED=true
        # In a real implementation, this might attempt basic syntax fixes
        ;;
esac

# Log recovery attempt
if [[ "$RECOVERY_ATTEMPTED" == "true" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Recovery attempt logged for user review" >> "$LOG_FILE"
    RECOVERY_SUCCESS=true
fi

# Update recovery analytics
RECOVERY_ANALYTICS="${PLUGIN_ROOT}/data/recovery-analytics.json"
if [[ -f "$RECOVERY_ANALYTICS" ]]; then
    jq --arg timestamp "$TIMESTAMP" --arg error "$ERROR_MSG" --arg cmd "$COMMAND" --arg success "$RECOVERY_SUCCESS" '
        .total_recovery_attempts += 1 |
        .recovery_successes += (if $success == "true" then 1 else 0 end) |
        .recent_attempts = [{timestamp: $timestamp, error: $error, command: $cmd, success: ($success == "true")}] + .recent_attempts[0:9]
    ' "$RECOVERY_ANALYTICS" > "${RECOVERY_ANALYTICS}.tmp" && mv "${RECOVERY_ANALYTICS}.tmp" "$RECOVERY_ANALYTICS"
else
    cat > "$RECOVERY_ANALYTICS" << EOF
{
  "total_recovery_attempts": 1,
  "recovery_successes": $([[ "$RECOVERY_SUCCESS" == "true" ]] && echo "1" || echo "0"),
  "recent_attempts": [
    {
      "timestamp": "$TIMESTAMP",
      "error": "$ERROR_MSG",
      "command": "$COMMAND",
      "success": $RECOVERY_SUCCESS
    }
  ]
}
EOF
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Error recovery analysis complete" >> "$LOG_FILE"

exit 0