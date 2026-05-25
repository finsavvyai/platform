#!/bin/bash

# Luna Agents Session Start Hook
# Initializes Luna session, loads workspace state, and validates environment

set -e

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
SESSION_LOG="${PLUGIN_ROOT}/logs/session.log"
WORKSPACE_ROOT="${PLUGIN_ROOT}/workspace"
LUNA_STATE="${WORKSPACE_ROOT}/.luna-state.json"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🌙 Luna Agents Session Starting..." >> "$SESSION_LOG"

# Create necessary directories
mkdir -p "$PLUGIN_ROOT"/{logs,workspace,data}

# Validate environment
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Validating Luna environment..." >> "$SESSION_LOG"

# Check if current directory is a valid Luna workspace
if [[ ! -d ".luna" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  No .luna directory found - initializing new workspace..." >> "$SESSION_LOG"
    mkdir -p ".luna/$(basename "$(pwd)")"
fi

# Load previous session state if exists
if [[ -f "$LUNA_STATE" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📂 Loading previous Luna session state..." >> "$SESSION_LOG"
    # State loading logic would go here
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🆕 Fresh Luna session initialized" >> "$SESSION_LOG"
    echo '{"session_start": "'$(date -Iseconds)'", "workspace": "'$(pwd)'", "tasks": {}}' > "$LUNA_STATE"
fi

# Validate MCP servers availability
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Validating MCP server connections..." >> "$SESSION_LOG"

# Check for required tools
for tool in npx docker node; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $tool is available" >> "$SESSION_LOG"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $tool not found - some features may be limited" >> "$SESSION_LOG"
    fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Luna Agents session ready!" >> "$SESSION_LOG"

# Set up workspace symlink to current directory
if [[ -d ".luna" ]]; then
    ln -sf "$(pwd)" "$WORKSPACE_ROOT/current-project" 2>/dev/null || true
fi