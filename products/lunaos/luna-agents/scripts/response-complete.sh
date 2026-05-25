#!/bin/bash

# Luna Response Complete Hook
# Processes Claude Code response completion for Luna workflow

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/responses.log"

mkdir -p "$(dirname "$LOG_FILE")"

TIMESTAMP=$(date -Iseconds)
RESPONSE_LENGTH=$(echo "$1" | jq -r '.response | length // 0')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💬 Response completed (${RESPONSE_LENGTH} characters)" >> "$LOG_FILE"

# Update response analytics
ANALYTICS_FILE="${PLUGIN_ROOT}/data/response-analytics.json"

if [[ -f "$ANALYTICS_FILE" ]]; then
    ANALYTICS=$(jq --arg timestamp "$TIMESTAMP" --arg length "$RESPONSE_LENGTH" '
        .total_responses += 1 |
        .total_characters += ($length | tonumber) |
        .average_length = (.total_characters / .total_responses | floor) |
        .recent_responses = [{timestamp: $timestamp, length: ($length | tonumber)}] + .recent_responses[0:9]
    ' "$ANALYTICS_FILE")
else
    ANALYTICS=$(cat << EOF
{
  "total_responses": 1,
  "total_characters": $RESPONSE_LENGTH,
  "average_length": $RESPONSE_LENGTH,
  "recent_responses": [
    {
      "timestamp": "$TIMESTAMP",
      "length": $RESPONSE_LENGTH
    }
  ]
}
EOF
)
fi

echo "$ANALYTICS" > "$ANALYTICS_FILE"

# Update workspace state
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
if [[ -f "$LUNA_STATE" ]]; then
    jq '.responses_processed += 1 | .last_response = "'$TIMESTAMP'"' "$LUNA_STATE" > "${LUNA_STATE}.tmp" && mv "${LUNA_STATE}.tmp" "$LUNA_STATE"
fi

exit 0