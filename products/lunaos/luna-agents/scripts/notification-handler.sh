#!/bin/bash

# Luna Notification Handler Hook
# Handles and logs Claude Code notifications in Luna context

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/notifications.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse notification details
NOTIFICATION_TYPE=$(echo "$1" | jq -r '.type // "unknown"')
NOTIFICATION_MESSAGE=$(echo "$1" | jq -r '.message // ""')
NOTIFICATION_TIMESTAMP=$(date -Iseconds)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔔 Notification: [$NOTIFICATION_TYPE] $NOTIFICATION_MESSAGE" >> "$LOG_FILE"

# Categorize notification
CATEGORY="general"
case "$NOTIFICATION_TYPE" in
    *permission*|*access*)
        CATEGORY="security"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔒 Security-related notification" >> "$LOG_FILE"
        ;;
    *error*|*failed*|*exception*)
        CATEGORY="error"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Error notification" >> "$LOG_FILE"
        ;;
    *warning*|*warn*)
        CATEGORY="warning"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Warning notification" >> "$LOG_FILE"
        ;;
    *success*|*completed*|*finished*)
        CATEGORY="success"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Success notification" >> "$LOG_FILE"
        ;;
    *input*|*prompt*|*question*)
        CATEGORY="interaction"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💬 Interaction required" >> "$LOG_FILE"
        ;;
esac

# Update notification analytics
ANALYTICS_FILE="${PLUGIN_ROOT}/data/notification-analytics.json"

if [[ -f "$ANALYTICS_FILE" ]]; then
    ANALYTICS=$(jq --arg type "$NOTIFICATION_TYPE" --arg category "$CATEGORY" --arg timestamp "$NOTIFICATION_TIMESTAMP" --arg message "$NOTIFICATION_MESSAGE" '
        .total_notifications += 1 |
        .types[$type] += 1 |
        .categories[$category] += 1 |
        .recent_notifications = [{timestamp: $timestamp, type: $type, category: $category, message: $message}] + .recent_notifications[0:9]
    ' "$ANALYTICS_FILE")
else
    ANALYTICS=$(cat << EOF
{
  "total_notifications": 1,
  "types": {
    "$NOTIFICATION_TYPE": 1
  },
  "categories": {
    "$category": 1
  },
  "recent_notifications": [
    {
      "timestamp": "$NOTIFICATION_TIMESTAMP",
      "type": "$NOTIFICATION_TYPE",
      "category": "$CATEGORY",
      "message": "$NOTIFICATION_MESSAGE"
    }
  ]
}
EOF
)
fi

echo "$ANALYTICS" > "$ANALYTICS_FILE"

# Log notification processing complete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Notification processed: $CATEGORY" >> "$LOG_FILE"

exit 0