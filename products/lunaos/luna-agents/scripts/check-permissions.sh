#!/bin/bash

# Luna Permissions Check Hook
# Validates file paths and blocks modifications to sensitive files

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/security.log"
PROTECTED_PATTERNS=(
    "/etc/"
    "/usr/bin/"
    "/usr/local/bin/"
    "~/.ssh/"
    "~/.aws/"
    "node_modules/"
    ".git/objects/"
    "*.key"
    "*.pem"
    "*.crt"
    "production"
    "prod"
)

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Get file path from tool input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.command_args[1] // empty')

# Check if file path is protected
for pattern in "${PROTECTED_PATTERNS[@]}"; do
    if [[ "$FILE_PATH" == *"$pattern"* ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚫 BLOCKED: Attempt to modify protected path: $FILE_PATH" >> "$LOG_FILE"
        echo "ERROR: Cannot modify protected file: $FILE_PATH"
        exit 1
    fi
done

# Check if file is in current project directory
if [[ "$FILE_PATH" != /* ]] && [[ "$FILE_PATH" != "~/"* ]]; then
    # Relative path - check if within current project
    CURRENT_DIR=$(pwd)
    ABSOLUTE_PATH="$CURRENT_DIR/$FILE_PATH"

    if [[ ! "$ABSOLUTE_PATH" == "$CURRENT_DIR"* ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  WARNING: File outside project directory: $FILE_PATH" >> "$LOG_FILE"
        echo "WARNING: Modifying file outside current project: $FILE_PATH"
    fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Permission check passed for: $FILE_PATH" >> "$LOG_FILE"
exit 0