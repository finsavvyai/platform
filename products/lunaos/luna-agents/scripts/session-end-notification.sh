#!/bin/bash

# Luna Session End Notification Hook
# Session completion notification

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/notifications.log"

mkdir -p "$(dirname "$LOG_FILE")"

TIMESTAMP=$(date -Iseconds)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 👋 SESSION END NOTIFICATION: Luna session completed" >> "$LOG_FILE"

# Log notification details
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔔 Title: Luna Session Complete" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Message: Development session ended. Workspace state saved." >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔊 Sound: Enabled" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚡ Urgency: Low" >> "$LOG_FILE"

# Get session statistics for the notification
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
if [[ -f "$LUNA_STATE" ]]; then
    COMMANDS_EXECUTED=$(jq -r '.commands_executed // 0' "$LUNA_STATE")
    ERRORS_ENCOUNTERED=$(jq -r '.errors_encountered // 0' "$LUNA_STATE")
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Session Stats: $COMMANDS_EXECUTED commands, $ERRORS_ENCOUNTERED errors" >> "$LOG_FILE"
fi

# Track session end notifications
NOTIFICATION_TRACKER="${PLUGIN_ROOT}/data/session-notifications.json"
if [[ -f "$NOTIFICATION_TRACKER" ]]; then
    jq --arg timestamp "$TIMESTAMP" '
        .total_sessions_completed += 1 |
        .last_session_end = $timestamp |
        .recent_sessions = [{timestamp: $timestamp}] + .recent_sessions[0:4]
    ' "$NOTIFICATION_TRACKER" > "${NOTIFICATION_TRACKER}.tmp" && mv "${NOTIFICATION_TRACKER}.tmp" "$NOTIFICATION_TRACKER"
else
    cat > "$NOTIFICATION_TRACKER" << EOF
{
  "total_sessions_completed": 1,
  "last_session_end": "$TIMESTAMP",
  "recent_sessions": [
    {
      "timestamp": "$TIMESTAMP"
    }
  ]
}
EOF
fi

exit 0