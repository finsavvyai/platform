#!/bin/bash

# Luna Task Completion Check Hook
# Checks if Luna tasks are complete and updates status

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/task-completion.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Checking task completion status..." >> "$LOG_FILE"

# Check implementation plan progress
for impl_file in implementation-plan.md .luna/implementation-plan.md; do
    if [[ -f "$impl_file" ]]; then
        COMPLETED_TASKS=$(grep -c "^\- \[x\]" "$impl_file" 2>/dev/null || echo "0")
        TOTAL_TASKS=$(grep -c "^\- \[\]" "$impl_file" 2>/dev/null || echo "0")

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Progress: $COMPLETED_TASKS/$TOTAL_TASKS tasks completed" >> "$LOG_FILE"

        # Check if all tasks are complete
        if [[ "$COMPLETED_TASKS" -eq "$TOTAL_TASKS" ]] && [[ "$TOTAL_TASKS" -gt 0 ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎉 All tasks completed in implementation plan!" >> "$LOG_FILE"

            # Update workspace state
            LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
            if [[ -f "$LUNA_STATE" ]]; then
                jq '.all_tasks_completed = true | .completion_date = "'$(date -Iseconds)'"' "$LUNA_STATE" > "${LUNA_STATE}.tmp" && mv "${LUNA_STATE}.tmp" "$LUNA_STATE"
            fi
        fi
        break
    fi
done

# Check for recent file modifications
RECENT_CHANGES=$(find . -name "*.md" -o -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -newer "$PLUGIN_ROOT/logs/session.log" 2>/dev/null | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Recent file changes: $RECENT_CHANGES" >> "$LOG_FILE"

exit 0