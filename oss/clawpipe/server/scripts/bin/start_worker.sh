#!/bin/bash
# Start only a worker node

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

MASTER_HOST="${1:-localhost}"
PYTHON_BIN="${FINSAVVYAI_PYTHON:-python3}"
if [ -z "${FINSAVVYAI_PYTHON:-}" ] && [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi

echo "🤖 Starting worker node (master: $MASTER_HOST)..."

"$PYTHON_BIN" src/workers/worker_node.py --master "$MASTER_HOST"
