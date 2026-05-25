#!/bin/bash
# Start API Gateway with intelligent routing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

MASTER_HOST="${1:-localhost}"
MASTER_PORT="${2:-8000}"
GATEWAY_PORT="${3:-8080}"
PYTHON_BIN="${FINSAVVYAI_PYTHON:-python3}"
if [ -z "${FINSAVVYAI_PYTHON:-}" ] && [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi

echo "🌐 Starting FinSavvyAI API Gateway..."
echo "   Master: $MASTER_HOST:$MASTER_PORT"
echo "   Gateway: http://localhost:$GATEWAY_PORT"
echo ""

"$PYTHON_BIN" src/api/gateway.py --master-host "$MASTER_HOST" --master-port "$MASTER_PORT" --port "$GATEWAY_PORT"
