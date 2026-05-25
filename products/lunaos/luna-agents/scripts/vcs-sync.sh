#!/bin/bash

# Luna VCS Sync Hook
# Syncs changes with version control if configured

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/vcs-sync.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Get file path from tool input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.command_args[1] // empty')

# Skip if file doesn't exist or not in a git repo
[[ ! -f "$FILE_PATH" ]] && exit 0
! git rev-parse --git-dir >/dev/null 2>&1 && exit 0

CURRENT_DIR=$(pwd)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 VCS sync check for: $FILE_PATH" >> "$LOG_FILE"

# Check if auto-sync is enabled
SYNC_CONFIG_FILE="${PLUGIN_ROOT}/config/vcs-sync.json"
if [[ -f "$SYNC_CONFIG_FILE" ]]; then
    AUTO_SYNC=$(jq -r '.auto_sync // false' "$SYNC_CONFIG_FILE")
else
    AUTO_SYNC=false
fi

if [[ "$AUTO_SYNC" != "true" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  Auto-sync disabled, skipping" >> "$LOG_FILE"
    exit 0
fi

# Check if the file is tracked by git
if git ls-files --error-unmatch "$FILE_PATH" >/dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 File is tracked, adding to git" >> "$LOG_FILE"

    # Add the file to git
    if git add "$FILE_PATH" 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Added to git: $FILE_PATH" >> "$LOG_FILE"

        # Check if there are staged changes
        if git diff --cached --quiet; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  No staged changes to commit" >> "$LOG_FILE"
        else
            # Create automatic commit if configured
            AUTO_COMMIT=$(jq -r '.auto_commit // false' "$SYNC_CONFIG_FILE" 2>/dev/null || echo "false")
            if [[ "$AUTO_COMMIT" == "true" ]]; then
                COMMIT_MSG="Auto-sync: Update $(basename "$FILE_PATH")"
                if git commit -m "$COMMIT_MSG" 2>/dev/null; then
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Auto-committed: $COMMIT_MSG" >> "$LOG_FILE"
                else
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Failed to auto-commit" >> "$LOG_FILE"
                fi
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💡 Staged changes ready for manual commit" >> "$LOG_FILE"
            fi
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Failed to add to git" >> "$LOG_FILE"
    fi
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  File not tracked by git" >> "$LOG_FILE"
fi

exit 0