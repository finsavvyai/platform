#!/bin/bash

# Luna Auto-Format Hook
# Automatically formats code files after edits

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/formatting.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Get file path from tool input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.command_args[1] // empty')

# Skip if file doesn't exist
[[ ! -f "$FILE_PATH" ]] && exit 0

# Determine file type and run appropriate formatter
case "$FILE_PATH" in
    *.ts|*.tsx|*.js|*.jsx)
        if command -v prettier >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎨 Formatting TypeScript/JavaScript: $FILE_PATH" >> "$LOG_FILE"
            prettier --write "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    *.go)
        if command -v gofmt >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎨 Formatting Go: $FILE_PATH" >> "$LOG_FILE"
            gofmt -w "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    *.py)
        if command -v black >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎨 Formatting Python: $FILE_PATH" >> "$LOG_FILE"
            black "$FILE_PATH" 2>/dev/null || true
        elif command -v autopep8 >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎨 Formatting Python: $FILE_PATH" >> "$LOG_FILE"
            autopep8 --in-place "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    *.rs)
        if command -v rustfmt >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎨 Formatting Rust: $FILE_PATH" >> "$LOG_FILE"
            rustfmt "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    *.java|*.kt)
        if command -v google-java-format >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎨 Formatting Java/Kotlin: $FILE_PATH" >> "$LOG_FILE"
            google-java-format --replace "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    *.json|*.yaml|*.yml)
        if command -v prettier >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎨 Formatting JSON/YAML: $FILE_PATH" >> "$LOG_FILE"
            prettier --write "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    *)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  No formatter available for: $FILE_PATH" >> "$LOG_FILE"
        ;;
esac

exit 0