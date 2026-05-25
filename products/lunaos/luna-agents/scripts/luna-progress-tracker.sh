#!/bin/bash

# Luna Progress Tracker Hook
# Tracks Luna task progress and updates implementation plan

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/progress.log"
WORKSPACE_ROOT="${PLUGIN_ROOT}/workspace"

mkdir -p "$(dirname "$LOG_FILE")" "$WORKSPACE_ROOT"

# Get current directory
CURRENT_DIR=$(pwd)
PROJECT_NAME=$(basename "$CURRENT_DIR")
LUNA_DIR="$CURRENT_DIR/.luna/$PROJECT_NAME"

# Get file operation details
OPERATION=$(echo "$1" | jq -r '.tool_input.command // "unknown"')
FILE_PATH=$(echo "$1" | jq -r '.tool_input.command_args[1] // "unknown"')

# Log the operation
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 $OPERATION: $FILE_PATH" >> "$LOG_FILE"

# Update Luna implementation plan if it exists
IMPLEMENTATION_PLAN="$LUNA_DIR/implementation-plan.md"

if [[ -f "$IMPLEMENTATION_PLAN" ]]; then
    # Count completed tasks
    COMPLETED_TASKS=$(grep -c "\[x\]" "$IMPLEMENTATION_PLAN" || echo "0")
    TOTAL_TASKS=$(grep -c "\[[ ]" "$IMPLEMENTATION_PLAN" || echo "0")

    # Update progress state
    cat > "$WORKSPACE_ROOT/progress.json" << EOF
{
  "project": "$PROJECT_NAME",
  "workspace": "$CURRENT_DIR",
  "last_updated": "$(date -Iseconds)",
  "implementation_plan": {
    "completed_tasks": $COMPLETED_TASKS,
    "total_tasks": $TOTAL_TASKS,
    "progress_percentage": $((COMPLETED_TASKS * 100 / TOTAL_TASKS)),
    "last_operation": "$OPERATION",
    "last_file": "$FILE_PATH"
  }
}
EOF

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Progress: $COMPLETED_TASKS/$TOTAL_TASKS ($((COMPLETED_TASKS * 100 / TOTAL_TASKS))%" >> "$LOG_FILE"
fi

# Track file changes for documentation
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📁 File modified: $FILE_PATH" >> "$WORKSPACE_ROOT/changes.log"

exit 0