#!/bin/bash

# Luna Input Notification Hook
# Sends notification when awaiting user input

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/notifications.log"

mkdir -p "$(dirname "$LOG_FILE")"

TIMESTAMP=$(date -Iseconds)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💬 INPUT NOTIFICATION: Awaiting user input" >> "$LOG_FILE"

# Log notification details that would be sent
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔔 Title: Luna Agents" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Message: Awaiting your input to continue..." >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔊 Sound: Enabled" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🖥️  Desktop: Enabled" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⏰ Timeout: 30000ms" >> "$LOG_FILE"

# Track input notifications
NOTIFICATION_TRACKER="${PLUGIN_ROOT}/data/input-notifications.json"
if [[ -f "$NOTIFICATION_TRACKER" ]]; then
    jq --arg timestamp "$TIMESTAMP" '
        .total_input_notifications += 1 |
        .last_notification = $timestamp |
        .recent_notifications = [{timestamp: $timestamp}] + .recent_notifications[0:4]
    ' "$NOTIFICATION_TRACKER" > "${NOTIFICATION_TRACKER}.tmp" && mv "${NOTIFICATION_TRACKER}.tmp" "$NOTIFICATION_TRACKER"
else
    cat > "$NOTIFICATION_TRACKER" << EOF
{
  "total_input_notifications": 1,
  "last_notification": "$TIMESTAMP",
  "recent_notifications": [
    {
      "timestamp": "$TIMESTAMP"
    }
  ]
}
EOF
fi

exit 0