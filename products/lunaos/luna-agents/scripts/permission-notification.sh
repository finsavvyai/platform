#!/bin/bash

# Luna Permission Notification Hook
# Sends notification for permission requests

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/notifications.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse command details
COMMAND=$(echo "$1" | jq -r '.tool_input.command // "unknown"')
ARGS=$(echo "$1" | jq -r '.tool_input.command_args // [] | join(" ")')
TIMESTAMP=$(date -Iseconds)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔐 PERMISSION NOTIFICATION: Command requires approval" >> "$LOG_FILE"

# Log notification details
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔔 Title: Luna Permission Required" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Message: Claude Code is requesting permission to run a command" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💻 Command: $COMMAND $ARGS" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔊 Sound: Enabled" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚡ Urgency: Normal" >> "$LOG_FILE"

# Track permission notifications
NOTIFICATION_TRACKER="${PLUGIN_ROOT}/data/permission-notifications.json"
if [[ -f "$NOTIFICATION_TRACKER" ]]; then
    jq --arg timestamp "$TIMESTAMP" --arg cmd "$COMMAND" '
        .total_permission_notifications += 1 |
        .commands[$cmd] += 1 |
        .recent_notifications = [{timestamp: $timestamp, command: $cmd}] + .recent_notifications[0:4]
    ' "$NOTIFICATION_TRACKER" > "${NOTIFICATION_TRACKER}.tmp" && mv "${NOTIFICATION_TRACKER}.tmp" "$NOTIFICATION_TRACKER"
else
    cat > "$NOTIFICATION_TRACKER" << EOF
{
  "total_permission_notifications": 1,
  "commands": {
    "$COMMAND": 1
  },
  "recent_notifications": [
    {
      "timestamp": "$TIMESTAMP",
      "command": "$COMMAND"
    }
  ]
}
EOF
fi

exit 0