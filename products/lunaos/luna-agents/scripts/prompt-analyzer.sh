#!/bin/bash

# Luna Prompt Analyzer Hook
# Analyzes user prompt for Luna context and task identification

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/prompts.log"
ANALYTICS_FILE="${PLUGIN_ROOT}/data/prompt-analytics.json"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$ANALYTICS_FILE")"

# Get user prompt from input
USER_PROMPT=$(echo "$1" | jq -r '.prompt // ""')
CURRENT_DIR=$(pwd)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 Analyzing prompt: ${USER_PROMPT:0:100}..." >> "$LOG_FILE"

# Analyze prompt for Luna workflow stage
PROMPT_STAGE="general"
TASK_TYPE="unknown"

case "$USER_PROMPT" in
    *requirements*|*analyze*|*understand*|*specifications*)
        PROMPT_STAGE="requirements"
        TASK_TYPE="analysis"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎯 Detected: Requirements analysis" >> "$LOG_FILE"
        ;;
    *design*|*architecture*|*plan*|*structure*)
        PROMPT_STAGE="design"
        TASK_TYPE="planning"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🏗️ Detected: Design/Architecture" >> "$LOG_FILE"
        ;;
    *implement*|*code*|*build*|*create*|*write*)
        PROMPT_STAGE="implementation"
        TASK_TYPE="development"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💻 Detected: Implementation" >> "$LOG_FILE"
        ;;
    *test*|*testing*|*validate*|*verify*)
        PROMPT_STAGE="testing"
        TASK_TYPE="validation"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧪 Detected: Testing" >> "$LOG_FILE"
        ;;
    *deploy*|*deployment*|*production*|*release*)
        PROMPT_STAGE="deployment"
        TASK_TYPE="deployment"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Detected: Deployment" >> "$LOG_FILE"
        ;;
    *monitor*|*observability*|*metrics*|*logging*)
        PROMPT_STAGE="monitoring"
        TASK_TYPE="monitoring"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Detected: Monitoring" >> "$LOG_FILE"
        ;;
    *review*|*refactor*|*improve*|*optimize*)
        PROMPT_STAGE="review"
        TASK_TYPE="review"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Detected: Review/Refactor" >> "$LOG_FILE"
        ;;
    *document*|*docs*|*readme*|*documentation*)
        PROMPT_STAGE="documentation"
        TASK_TYPE="documentation"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📚 Detected: Documentation" >> "$LOG_FILE"
        ;;
esac

# Check for specific Luna agent mentions
if [[ "$USER_PROMPT" =~ (requirements|design|plan|execute|review|test|deploy|monitor|docs) ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🤖 Luna agent context detected" >> "$LOG_FILE"
fi

# Update analytics
TIMESTAMP=$(date -Iseconds)
if [[ -f "$ANALYTICS_FILE" ]]; then
    # Update existing analytics
    ANALYTICS=$(jq --arg stage "$PROMPT_STAGE" --arg type "$TASK_TYPE" --arg timestamp "$TIMESTAMP" '
        .total_prompts += 1 |
        .stages[$stage] += 1 |
        .task_types[$type] += 1 |
        .recent_prompts = [{timestamp: $timestamp, stage: $stage, type: $type, preview: ($USER_PROMPT | if length > 50 then .[0:47] + "..." else . end)}] + .recent_prompts[0:9]
    ' "$ANALYTICS_FILE")
else
    # Create new analytics file
    ANALYTICS=$(cat << EOF
{
  "total_prompts": 1,
  "stages": {
    "requirements": $([[ "$PROMPT_STAGE" == "requirements" ]] && echo "1" || echo "0"),
    "design": $([[ "$PROMPT_STAGE" == "design" ]] && echo "1" || echo "0"),
    "implementation": $([[ "$PROMPT_STAGE" == "implementation" ]] && echo "1" || echo "0"),
    "testing": $([[ "$PROMPT_STAGE" == "testing" ]] && echo "1" || echo "0"),
    "deployment": $([[ "$PROMPT_STAGE" == "deployment" ]] && echo "1" || echo "0"),
    "monitoring": $([[ "$PROMPT_STAGE" == "monitoring" ]] && echo "1" || echo "0"),
    "review": $([[ "$PROMPT_STAGE" == "review" ]] && echo "1" || echo "0"),
    "documentation": $([[ "$PROMPT_STAGE" == "documentation" ]] && echo "1" || echo "0"),
    "general": $([[ "$PROMPT_STAGE" == "general" ]] && echo "1" || echo "0")
  },
  "task_types": {
    "analysis": $([[ "$TASK_TYPE" == "analysis" ]] && echo "1" || echo "0"),
    "planning": $([[ "$TASK_TYPE" == "planning" ]] && echo "1" || echo "0"),
    "development": $([[ "$TASK_TYPE" == "development" ]] && echo "1" || echo "0"),
    "validation": $([[ "$TASK_TYPE" == "validation" ]] && echo "1" || echo "0"),
    "deployment": $([[ "$TASK_TYPE" == "deployment" ]] && echo "1" || echo "0"),
    "monitoring": $([[ "$TASK_TYPE" == "monitoring" ]] && echo "1" || echo "0"),
    "review": $([[ "$TASK_TYPE" == "review" ]] && echo "1" || echo "0"),
    "documentation": $([[ "$TASK_TYPE" == "documentation" ]] && echo "1" || echo "0"),
    "unknown": $([[ "$TASK_TYPE" == "unknown" ]] && echo "1" || echo "0")
  },
  "recent_prompts": [
    {
      "timestamp": "$TIMESTAMP",
      "stage": "$PROMPT_STAGE",
      "type": "$TASK_TYPE",
      "preview": "${USER_PROMPT:0:50}$([[ ${#USER_PROMPT} -gt 50 ]] && echo "...")"
    }
  ]
}
EOF
)
fi

echo "$ANALYTICS" > "$ANALYTICS_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Prompt analysis complete: $PROMPT_STAGE / $TASK_TYPE" >> "$LOG_FILE"

exit 0