#!/bin/bash

# Luna Feedback Hook
# Provides automated feedback on code quality and conventions

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/feedback.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Get file path from tool input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.command_args[1] // empty')

# Skip if file doesn't exist
[[ ! -f "$FILE_PATH" ]] && exit 0

FILE_EXTENSION="${FILE_PATH##*.}"
ISSUES_FOUND=0

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Analyzing code quality: $FILE_PATH" >> "$LOG_FILE"

# Check for common code quality issues
case "$FILE_EXTENSION" in
    *.ts|*.tsx|*.js|*.jsx)
        # Check for console.log statements
        if grep -q "console\.log" "$FILE_PATH"; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Found console.log statements in $FILE_PATH" >> "$LOG_FILE"
            ((ISSUES_FOUND++))
        fi

        # Check for TODO comments without JIRA tickets
        if grep -q "TODO\|FIXME\|HACK" "$FILE_PATH" && ! grep -q "TODO-[A-Z]+-[0-9]\+" "$FILE_PATH"; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Found TODO/FIXME without ticket reference in $FILE_PATH" >> "$LOG_FILE"
            ((ISSUES_FOUND++))
        fi

        # Check for very long lines
        if awk 'length > 120 { print "Line " NR ": " $0 }' "$FILE_PATH" | head -3 | grep -q .; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Lines longer than 120 characters in $FILE_PATH" >> "$LOG_FILE"
            ((ISSUES_FOUND++))
        fi
        ;;

    *.py)
        # Check for print statements
        if grep -q "print(" "$FILE_PATH" && ! grep -q "# noqa: " "$FILE_PATH"; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Found print statements in $FILE_PATH" >> "$LOG_FILE"
            ((ISSUES_FOUND++))
        fi

        # Check for bare except clauses
        if grep -q "except:" "$FILE_PATH"; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Found bare except clause in $FILE_PATH" >> "$LOG_FILE"
            ((ISSUES_FOUND++))
        fi
        ;;

    *.go)
        # Check for unhandled errors
        if grep -q "panic(" "$FILE_PATH"; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Found panic statement in $FILE_PATH" >> "$LOG_FILE"
            ((ISSUES_FOUND++))
        fi

        # Check for commented out code
        if grep -q "//.*TODO\|//.*FIXME" "$FILE_PATH"; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Found commented TODO/FIXME in $FILE_PATH" >> "$LOG_FILE"
            ((ISSUES_FOUND++))
        fi
        ;;
esac

# Check for files without proper documentation
if [[ ! -f "${FILE_PATH%.*}.md" ]] && [[ $(wc -l < "$FILE_PATH") -gt 20 ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💡 Consider adding documentation for: $FILE_PATH" >> "$LOG_FILE"
fi

# Summary
if [[ $ISSUES_FOUND -gt 0 ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📝 $ISSUES_FOUND issues found in $FILE_PATH" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Code quality check passed for: $FILE_PATH" >> "$LOG_FILE"
fi

exit 0