#!/bin/bash

# Luna Workspace Check Hook
# Checks if current directory is a valid Luna workspace

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/workspace.log"

mkdir -p "$(dirname "$LOG_FILE")"

CURRENT_DIR=$(pwd)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Checking workspace: $CURRENT_DIR" >> "$LOG_FILE"

# Check for Luna workspace indicators
IS_LUNA_WORKSPACE=false

if [[ -f "implementation-plan.md" ]]; then
    IS_LUNA_WORKSPACE=true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Found implementation-plan.md" >> "$LOG_FILE"
elif [[ -f ".luna/implementation-plan.md" ]]; then
    IS_LUNA_WORKSPACE=true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Found .luna/implementation-plan.md" >> "$LOG_FILE"
elif [[ -f "README.md" ]] && grep -q "luna\|Luna" "README.md"; then
    IS_LUNA_WORKSPACE=true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Found Luna project in README.md" >> "$LOG_FILE"
elif [[ -d ".luna" ]]; then
    IS_LUNA_WORKSPACE=true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Found .luna directory" >> "$LOG_FILE"
fi

# Check for common project files that might indicate this is a development project
if [[ "$IS_LUNA_WORKSPACE" == "false" ]]; then
    for file in package.json Cargo.toml go.mod requirements.txt composer.json pom.xml build.gradle; do
        if [[ -f "$file" ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💡 Found project file: $file (considering as potential Luna workspace)" >> "$LOG_FILE"
            IS_LUNA_WORKSPACE=true
            break
        fi
    done
fi

if [[ "$IS_LUNA_WORKSPACE" == "true" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Validated as Luna workspace" >> "$LOG_FILE"

    # Create workspace state file if it doesn't exist
    WORKSPACE_STATE="${PLUGIN_ROOT}/workspace/.luna-workspace.json"
    mkdir -p "$(dirname "$WORKSPACE_STATE")"

    if [[ ! -f "$WORKSPACE_STATE" ]]; then
        cat > "$WORKSPACE_STATE" << EOF
{
  "workspace_path": "$CURRENT_DIR",
  "workspace_type": "luna",
  "first_detected": "$(date -Iseconds)",
  "last_activity": "$(date -Iseconds)",
  "session_count": 1
}
EOF
    else
        # Update existing workspace state
        jq '.last_activity = "'$(date -Iseconds)'" | .session_count += 1' "$WORKSPACE_STATE" > "${WORKSPACE_STATE}.tmp" && mv "${WORKSPACE_STATE}.tmp" "$WORKSPACE_STATE"
    fi

    exit 0
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Not recognized as Luna workspace" >> "$LOG_FILE"
    echo "💡 To enable Luna features, create an implementation-plan.md or .luna/ directory" >> "$LOG_FILE"
    exit 1
fi