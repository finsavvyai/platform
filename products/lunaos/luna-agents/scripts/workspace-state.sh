#!/bin/bash

# Luna Workspace State Hook
# Updates workspace state and progress indicators

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"

mkdir -p "$(dirname "$LUNA_STATE")"

# Update timestamp and activity
if [[ -f "$LUNA_STATE" ]]; then
    jq '.last_activity = "'$(date -Iseconds)'" | .session_duration = (now - fromisoformat(.session_start)) | floor' "$LUNA_STATE" > "${LUNA_STATE}.tmp" && mv "${LUNA_STATE}.tmp" "$LUNA_STATE"
else
    # Create new state if it doesn't exist
    cat > "$LUNA_STATE" << EOF
{
  "session_id": "$(date +%s)",
  "session_start": "$(date -Iseconds)",
  "last_activity": "$(date -Iseconds)",
  "user": "$(whoami)",
  "workspace": "$(pwd)",
  "commands_executed": 0,
  "files_modified": 0,
  "errors_encountered": 0
}
EOF
fi

# Check for implementation plan progress
if [[ -f "implementation-plan.md" ]]; then
    COMPLETED_TASKS=$(grep -c "^\- \[x\]" "implementation-plan.md" 2>/dev/null || echo "0")
    TOTAL_TASKS=$(grep -c "^\- \[\]" "implementation-plan.md" 2>/dev/null || echo "0")
    PROGRESS=$((TOTAL_TASKS > 0 ? (COMPLETED_TASKS * 100) / TOTAL_TASKS : 0))

    # Update progress in state
    jq --arg completed "$COMPLETED_TASKS" --arg total "$TOTAL_TASKS" --arg progress "$PROGRESS" '
        .implementation_plan = {completed: ($completed | tonumber), total: ($total | tonumber), progress_percent: ($progress | tonumber)}
    ' "$LUNA_STATE" > "${LUNA_STATE}.tmp" && mv "${LUNA_STATE}.tmp" "$LUNA_STATE"
fi

exit 0