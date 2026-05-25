#!/bin/bash

# Luna Permission Check Hook
# Validates permission requests against Luna security policies

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
LOG_FILE="${PLUGIN_ROOT}/logs/permissions.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Parse command details
COMMAND=$(echo "$1" | jq -r '.tool_input.command // "unknown"')
ARGS=$(echo "$1" | jq -r '.tool_input.command_args // [] | join(" ")')
FULL_COMMAND="$COMMAND $ARGS"

TIMESTAMP=$(date -Iseconds)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Permission check: $FULL_COMMAND" >> "$LOG_FILE"

# Define security policies
ALLOWED_COMMANDS=(
    "git"
    "npm"
    "yarn"
    "pnpm"
    "node"
    "python"
    "python3"
    "pip"
    "pip3"
    "go"
    "cargo"
    "docker"
    "kubectl"
    "make"
    "cmake"
    "gcc"
    "clang"
    "javac"
    "java"
    "mvn"
    "gradle"
    "pytest"
    "jest"
    "go test"
    "prettier"
    "eslint"
    "black"
    "rustfmt"
    "gofmt"
)

RESTRICTED_PATHS=(
    "/etc"
    "/usr/bin"
    "/usr/sbin"
    "/bin"
    "/sbin"
    "/System"
    "~/.ssh"
    "~/.aws"
    "~/.config"
)

# Check if command is in allowed list
ALLOWED=false
for allowed_cmd in "${ALLOWED_COMMANDS[@]}"; do
    if [[ "$COMMAND" == "$allowed_cmd" ]] || [[ "$FULL_COMMAND" == "$allowed_cmd"* ]]; then
        ALLOWED=true
        break
    fi
done

# Check for restricted paths
RESTRICTED=false
for restricted_path in "${RESTRICTED_PATHS[@]}"; do
    if [[ "$FULL_COMMAND" == *"$restricted_path"* ]]; then
        RESTRICTED=true
        break
    fi
done

# Make permission decision
if [[ "$RESTRICTED" == "true" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚫 BLOCKED: Command accesses restricted path" >> "$LOG_FILE"
    echo "ERROR: Command '$FULL_COMMAND' attempts to access restricted system path"
    exit 1
elif [[ "$ALLOWED" == "true" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ ALLOWED: Command is in approved list" >> "$LOG_FILE"
    exit 0
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  UNKNOWN: Command not in allowlist, requiring user approval" >> "$LOG_FILE"
    exit 0  # Don't block, but log for review
fi