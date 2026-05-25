#!/bin/bash

# Luna Result Analyzer Hook
# Analyzes shell command results for Luna context

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/command-results.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse command details from input
TOOL_INPUT="$1"
TOOL_COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // "unknown"')
TOOL_ARGS=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command_args // [] | join(" ")')
RESULT=$(echo "$TOOL_INPUT" | jq -r '.result // ""')
EXIT_CODE=$(echo "$TOOL_INPUT" | jq -r '.exit_code // "unknown"')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Analyzing result: $TOOL_COMMAND $TOOL_ARGS" >> "$LOG_FILE"

# Analyze exit code
if [[ "$EXIT_CODE" == "0" ]]; then
    STATUS="success"
    ICON="✅"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $ICON Command succeeded" >> "$LOG_FILE"
else
    STATUS="failed"
    ICON="❌"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $ICON Command failed with exit code: $EXIT_CODE" >> "$LOG_FILE"
fi

# Analyze command output for Luna-specific patterns
case "$TOOL_COMMAND" in
    *git*)
        if [[ "$RESULT" =~ (modified|added|deleted|created) ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Git operation detected changes" >> "$LOG_FILE"
        fi
        ;;
    *npm*|*yarn*|*pnpm*)
        if [[ "$RESULT" =~ (dependencies|packages|installed) ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 Package management operation" >> "$LOG_FILE"
        fi
        ;;
    *docker*|*podman*)
        if [[ "$RESULT" =~ (container|image|build) ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🐳 Container operation detected" >> "$LOG_FILE"
        fi
        ;;
    *test*|*jest*|*pytest*|*go test*)
        if [[ "$RESULT" =~ (pass|fail|assert|spec) ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧪 Test execution detected" >> "$LOG_FILE"

            # Count test results
            if [[ "$RESULT" =~ ([0-9]+)\ +passing ]]; then
                PASSED="${BASH_REMATCH[1]}"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Test results: $PASSED passing" >> "$LOG_FILE"
            fi
        fi
        ;;
esac

# Check for error patterns in result
if [[ "$STATUS" == "failed" ]]; then
    if [[ "$RESULT" =~ (permission|denied|access) ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔒 Permission error detected" >> "$LOG_FILE"
    elif [[ "$RESULT" =~ (not found|No such file|command not found) ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 File/command not found error" >> "$LOG_FILE"
    elif [[ "$RESULT" =~ (network|connection|timeout) ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🌐 Network-related error" >> "$LOG_FILE"
    fi
fi

# Store result analytics
ANALYTICS_FILE="${PLUGIN_ROOT}/data/command-analytics.json"
TIMESTAMP=$(date -Iseconds)

if [[ -f "$ANALYTICS_FILE" ]]; then
    ANALYTICS=$(jq --arg cmd "$TOOL_COMMAND" --arg status "$status" --arg timestamp "$TIMESTAMP" '
        .total_commands += 1 |
        .commands[$cmd] += 1 |
        .results[$status] += 1 |
        .recent_results = [{timestamp: $timestamp, command: $cmd, status: $status}] + .recent_results[0:9]
    ' "$ANALYTICS_FILE")
else
    ANALYTICS=$(cat << EOF
{
  "total_commands": 1,
  "commands": {
    "$TOOL_COMMAND": 1
  },
  "results": {
    "$status": 1
  },
  "recent_results": [
    {
      "timestamp": "$TIMESTAMP",
      "command": "$TOOL_COMMAND",
      "status": "$status"
    }
  ]
}
EOF
)
fi

echo "$ANALYTICS" > "$ANALYTICS_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Result analysis complete" >> "$LOG_FILE"

exit 0