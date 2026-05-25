#!/bin/bash

# Luna Command Logger Hook
# Logs all executed commands for compliance and debugging

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/commands.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse tool input to get command details
TOOL_INPUT="$1"
TOOL_COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // "unknown"')
TOOL_ARGS=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command_args // [] | join(" ")')

CURRENT_DIR=$(pwd)
TIMESTAMP=$(date -Iseconds)
USER=$(whoami)

# Log the command with context
cat >> "$LOG_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "user": "$USER",
  "directory": "$CURRENT_DIR",
  "tool": "$TOOL_COMMAND",
  "args": $TOOL_ARGS,
  "raw_input": $TOOL_INPUT
}
EOF

# Also create a human-readable log entry
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 $TOOL_COMMAND $TOOL_ARGS" >> "$PLUGIN_ROOT/logs/human-readable.log"

# Track Luna-specific commands
if [[ "$TOOL_COMMAND" =~ (Write|Edit|Bash|Shell) ]]; then
    # Update command count
    COUNT_FILE="$PLUGIN_ROOT/data/command-count.json"
    if [[ -f "$COUNT_FILE" ]]; then
        COUNT=$(jq ".total += 1" "$COUNT_FILE")
    else
        COUNT='{"total": 1, "last_reset": "'$(date -Iseconds)'"}'
    fi
    echo "$COUNT" > "$COUNT_FILE"
fi

exit 0