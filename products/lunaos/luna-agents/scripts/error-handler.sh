#!/bin/bash

# Luna Error Handler Hook
# Handles and logs errors with Luna context and recovery suggestions

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/errors.log"
RECOVERY_FILE="${PLUGIN_ROOT}/data/error-recovery.json"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$RECOVERY_FILE")"

# Parse error details from input
ERROR_MSG=$(echo "$1" | jq -r '.error // "Unknown error"')
TOOL_COMMAND=$(echo "$1" | jq -r '.tool_input.command // "unknown"')
TOOL_ARGS=$(echo "$1" | jq -r '.tool_input.command_args // [] | join(" ")')
CURRENT_DIR=$(pwd)

TIMESTAMP=$(date -Iseconds)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 ERROR: $ERROR_MSG (in $TOOL_COMMAND $TOOL_ARGS)" >> "$LOG_FILE"

# Analyze error type and provide recovery suggestions
ERROR_TYPE="general"
RECOVERY_SUGGESTIONS=()

case "$ERROR_MSG" in
    *permission*|*denied*|*access*)
        ERROR_TYPE="permission"
        RECOVERY_SUGGESTIONS=("Check file permissions" "Run with appropriate user" "Verify directory access")
        ;;
    *not found*|*No such file*|*command not found*)
        ERROR_TYPE="file_not_found"
        RECOVERY_SUGGESTIONS=("Verify file path" "Check if file exists" "Confirm command installation")
        ;;
    *network*|*connection*|*timeout*)
        ERROR_TYPE="network"
        RECOVERY_SUGGESTIONS=("Check internet connection" "Verify endpoint availability" "Try again later")
        ;;
    *syntax*|*parse*|*invalid*)
        ERROR_TYPE="syntax"
        RECOVERY_SUGGESTIONS=("Check syntax rules" "Validate input format" "Review documentation")
        ;;
    *memory*|*out of memory*)
        ERROR_TYPE="memory"
        RECOVERY_SUGGESTIONS=("Free system memory" "Close other applications" "Increase memory limits")
        ;;
    *disk*|*space*|*storage*)
        ERROR_TYPE="disk"
        RECOVERY_SUGGESTIONS=("Free disk space" "Clean temporary files" "Check available storage")
        ;;
esac

# Log error analysis
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Error type: $ERROR_TYPE" >> "$LOG_FILE"

# Store recovery suggestions
for suggestion in "${RECOVERY_SUGGESTIONS[@]}"; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💡 Recovery suggestion: $suggestion" >> "$LOG_FILE"
done

# Update recovery analytics
if [[ -f "$RECOVERY_FILE" ]]; then
    RECOVERY_DATA=$(jq --arg type "$ERROR_TYPE" --arg timestamp "$TIMESTAMP" --arg msg "$ERROR_MSG" '
        .total_errors += 1 |
        .error_types[$type] += 1 |
        .recent_errors = [{timestamp: $timestamp, type: $type, message: $msg}] + .recent_errors[0:9]
    ' "$RECOVERY_FILE")
else
    RECOVERY_DATA=$(cat << EOF
{
  "total_errors": 1,
  "error_types": {
    "$ERROR_TYPE": 1
  },
  "recent_errors": [
    {
      "timestamp": "$TIMESTAMP",
      "type": "$ERROR_TYPE",
      "message": "$ERROR_MSG"
    }
  ]
}
EOF
)
fi

echo "$RECOVERY_DATA" > "$RECOVERY_FILE"

# Check if this is a recurring error
RECENT_COUNT=$(jq --arg type "$ERROR_TYPE" '.recent_errors | map(select(.type == $type)) | length' "$RECOVERY_FILE")
if [[ "$RECENT_COUNT" -gt 2 ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Recurring error type detected: $ERROR_TYPE" >> "$LOG_FILE"
fi

# Update workspace state if it exists
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
if [[ -f "$LUNA_STATE" ]]; then
    jq '.errors_encountered += 1 | .last_error = {timestamp: "'$TIMESTAMP'", type: "'$ERROR_TYPE'", message: "'$ERROR_MSG'"}' "$LUNA_STATE" > "${LUNA_STATE}.tmp" && mv "${LUNA_STATE}.tmp" "$LUNA_STATE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Error handling complete" >> "$LOG_FILE"

exit 0