#!/bin/bash

# Luna Command Validator Hook
# Validates shell commands for safety and compliance

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/security.log"
DANGEROUS_COMMANDS=(
    "rm -rf"
    "sudo rm"
    ":(){ :|:& };:"
    "chmod +x"
    "chown"
    "curl | sh"
    "wget | sh"
    "eval"
    "exec"
    "source ~/.*"
)

# Parse command from input
COMMAND=$(echo "$1" | jq -r '.tool_input.command // ""')
ARGS=$(echo "$1" | jq -r '.tool_input.command_args // [] | join(" ")')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Validating command: $COMMAND $ARGS" >> "$LOG_FILE"

# Check for dangerous commands
for dangerous in "${DANGEROUS_COMMANDS[@]}"; do
    if [[ "$COMMAND $ARGS" == *"$dangerous"* ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚫 BLOCKED: Dangerous command detected" >> "$LOG_FILE"
        echo "ERROR: Command '$COMMAND $ARGS' is not allowed for security reasons"
        exit 1
    fi
done

# Check for network access to external URLs
if [[ "$COMMAND $ARGS" =~ (curl|wget|ssh|ftp|telnet|nc) ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Network access detected: $COMMAND" >> "$LOG_FILE"
    # Allow but log network operations
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Command validation passed: $COMMAND" >> "$LOG_FILE"
exit 0