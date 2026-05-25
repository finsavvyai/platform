#!/bin/bash

# Luna Subagent Complete Hook
# Handles Luna subagent completion and results processing

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/subagents.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse subagent details
SUBAGENT_TYPE=$(echo "$1" | jq -r '.subagent_type // "unknown"')
TASK_STATUS=$(echo "$1" | jq -r '.status // "unknown"')
EXECUTION_TIME=$(echo "$1" | jq -r '.execution_time // "unknown"')

TIMESTAMP=$(date -Iseconds)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🤖 Subagent completed: $SUBAGENT_TYPE ($TASK_STATUS)" >> "$LOG_FILE"

# Update subagent analytics
ANALYTICS_FILE="${PLUGIN_ROOT}/data/subagent-analytics.json"

if [[ -f "$ANALYTICS_FILE" ]]; then
    ANALYTICS=$(jq --arg type "$SUBAGENT_TYPE" --arg status "$TASK_STATUS" --arg time "$EXECUTION_TIME" --arg timestamp "$TIMESTAMP" '
        .total_subagent_calls += 1 |
        .subagent_types[$type] += 1 |
        .statuses[$status] += 1 |
        .recent_calls = [{timestamp: $timestamp, type: $type, status: $status, execution_time: $time}] + .recent_calls[0:9]
    ' "$ANALYTICS_FILE")
else
    ANALYTICS=$(cat << EOF
{
  "total_subagent_calls": 1,
  "subagent_types": {
    "$SUBAGENT_TYPE": 1
  },
  "statuses": {
    "$TASK_STATUS": 1
  },
  "recent_calls": [
    {
      "timestamp": "$TIMESTAMP",
      "type": "$SUBAGENT_TYPE",
      "status": "$TASK_STATUS",
      "execution_time": "$EXECUTION_TIME"
    }
  ]
}
EOF
)
fi

echo "$ANALYTICS" > "$ANALYTICS_FILE"

# Update workspace state if it exists
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
if [[ -f "$LUNA_STATE" ]]; then
    jq '.subagent_calls += 1 | .last_subagent = {type: "'$SUBAGENT_TYPE'", status: "'$TASK_STATUS'", timestamp: "'$TIMESTAMP'"}' "$LUNA_STATE" > "${LUNA_STATE}.tmp" && mv "${LUNA_STATE}.tmp" "$LUNA_STATE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Subagent completion processed" >> "$LOG_FILE"

exit 0