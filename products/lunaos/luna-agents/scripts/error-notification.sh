#!/bin/bash

# Luna Error Notification Hook
# Sends critical error notifications

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/notifications.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse error details
ERROR_MSG=$(echo "$1" | jq -r '.error // "Unknown error"')
TIMESTAMP=$(date -Iseconds)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 ERROR NOTIFICATION: $ERROR_MSG" >> "$LOG_FILE"

# In a real implementation, this would send desktop notifications, emails, or alerts
# For now, we'll log the notification that would be sent

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📧 Would send critical error notification" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔔 Title: Luna Error" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Message: $ERROR_MSG" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔊 Sound: Enabled" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚡ Urgency: Critical" >> "$LOG_FILE"

# Track error notifications
NOTIFICATION_TRACKER="${PLUGIN_ROOT}/data/error-notifications.json"
if [[ -f "$NOTIFICATION_TRACKER" ]]; then
    jq --arg timestamp "$TIMESTAMP" --arg msg "$ERROR_MSG" '
        .total_error_notifications += 1 |
        .recent_errors = [{timestamp: $timestamp, message: $msg}] + .recent_errors[0:4]
    ' "$NOTIFICATION_TRACKER" > "${NOTIFICATION_TRACKER}.tmp" && mv "${NOTIFICATION_TRACKER}.tmp" "$NOTIFICATION_TRACKER"
else
    cat > "$NOTIFICATION_TRACKER" << EOF
{
  "total_error_notifications": 1,
  "recent_errors": [
    {
      "timestamp": "$TIMESTAMP",
      "message": "$ERROR_MSG"
    }
  ]
}
EOF
fi

exit 0