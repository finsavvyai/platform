#!/bin/bash

# Luna Session Notification Hook
# Sends welcome notification for new Luna session

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/session.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🌙 Luna Agents Session Started" >> "$LOG_FILE"

# Get session info
USER=$(whoami)
WORKSPACE=$(pwd)
SESSION_ID=$(date +%s)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 👤 User: $USER" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📁 Workspace: $WORKSPACE" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🆔 Session ID: $SESSION_ID" >> "$LOG_FILE"

# Create session state file
LUNA_STATE="${PLUGIN_ROOT}/workspace/.luna-state.json"
mkdir -p "$(dirname "$LUNA_STATE")"

cat > "$LUNA_STATE" << EOF
{
  "session_id": "$SESSION_ID",
  "session_start": "$(date -Iseconds)",
  "user": "$USER",
  "workspace": "$WORKSPACE",
  "plugin_root": "$PLUGIN_ROOT",
  "commands_executed": 0,
  "files_modified": 0,
  "errors_encountered": 0
}
EOF

# Check for existing implementation plan
if [[ -f "implementation-plan.md" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📋 Found existing implementation plan" >> "$LOG_FILE"
elif [[ -f ".luna/implementation-plan.md" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📋 Found existing implementation plan in .luna/" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  No implementation plan found" >> "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Luna session initialization complete" >> "$LOG_FILE"

exit 0