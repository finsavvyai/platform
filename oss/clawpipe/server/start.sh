#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "Loaded .env configuration"
fi

# Defaults
HOST="${FINSAVVYAI_GATEWAY_HOST:-0.0.0.0}"
PORT="${FINSAVVYAI_GATEWAY_PORT:-8080}"

# Check for at least one provider
HAS_PROVIDER=false
if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "sk-..." ]; then
    echo "OpenAI provider: enabled"
    HAS_PROVIDER=true
fi
if [ -n "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "sk-ant-..." ]; then
    echo "Anthropic provider: enabled"
    HAS_PROVIDER=true
fi
# Check Ollama
if command -v ollama &>/dev/null || curl -s http://localhost:11434/api/tags &>/dev/null 2>&1; then
    echo "Ollama provider: available"
    HAS_PROVIDER=true
fi

if [ "$HAS_PROVIDER" = false ]; then
    echo ""
    echo "WARNING: No LLM providers configured!"
    echo "Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env"
    echo "Or install Ollama: https://ollama.ai"
    echo ""
fi

echo ""
echo "Starting FinSavvyAI LLM Gateway on http://${HOST}:${PORT}"
echo "Dashboard: http://localhost:${PORT}/dashboard"
echo ""

# Start the gateway
exec python -m src.api.gateway --host "$HOST" --port "$PORT"
