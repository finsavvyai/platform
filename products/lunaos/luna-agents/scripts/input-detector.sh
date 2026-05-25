#!/bin/bash

# Luna Input Detector Hook
# Detects and logs when Luna is awaiting user input

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/input-events.log"

mkdir -p "$(dirname "$LOG_FILE")"

TIMESTAMP=$(date -Iseconds)
CURRENT_TASK="unknown"

# Try to determine current task from workspace state
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
if [[ -f "$LUNA_STATE" ]]; then
    CURRENT_TASK=$(jq -r '.current_task // "unknown"' "$LUNA_STATE")
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🤔 Luna awaiting user input (task: $CURRENT_TASK)" >> "$LOG_FILE"

# Update input events analytics
ANALYTICS_FILE="${PLUGIN_ROOT}/data/input-events.json"

if [[ -f "$ANALYTICS_FILE" ]]; then
    ANALYTICS=$(jq --arg timestamp "$TIMESTAMP" --arg task "$CURRENT_TASK" '
        .total_input_events += 1 |
        .tasks[$task] += 1 |
        .recent_events = [{timestamp: $timestamp, task: $task}] + .recent_events[0:4]
    ' "$ANALYTICS_FILE")
else
    ANALYTICS=$(cat << EOF
{
  "total_input_events": 1,
  "tasks": {
    "$CURRENT_TASK": 1
  },
  "recent_events": [
    {
      "timestamp": "$TIMESTAMP",
      "task": "$CURRENT_TASK"
    }
  ]
}
EOF
)
fi

echo "$ANALYTICS" > "$ANALYTICS_FILE"

exit 0