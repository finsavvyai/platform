#!/bin/bash
# FinSavvyAI Cluster Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Starting FinSavvyAI Cluster..."
echo ""

PYTHON_BIN="${FINSAVVYAI_PYTHON:-python3}"
if [ -z "${FINSAVVYAI_PYTHON:-}" ] && [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi

# Check Python interpreter
if ! ([ -x "$PYTHON_BIN" ] || command -v "$PYTHON_BIN" &> /dev/null); then
    echo "❌ Python interpreter not found: $PYTHON_BIN"
    exit 1
fi
echo "🐍 Using Python: $PYTHON_BIN"

# Check dependencies
echo "📦 Checking dependencies..."
if ! "$PYTHON_BIN" -c "import aiohttp" 2>/dev/null; then
    echo "❌ Missing dependency: aiohttp"
    echo "   Install with: $PYTHON_BIN -m pip install -r requirements.txt"
    exit 1
fi

# Start master server
echo "🌐 Starting cluster master..."
"$PYTHON_BIN" src/core/start_master.py &
MASTER_PID=$!
echo "   Master PID: $MASTER_PID"

# Wait a moment for master to start
sleep 2

# Start worker node
echo "🤖 Starting worker node..."
"$PYTHON_BIN" src/workers/worker_node.py --master localhost &
WORKER_PID=$!
echo "   Worker PID: $WORKER_PID"

echo ""
echo "✅ Cluster started!"
echo "   Master: http://localhost:8000"
echo "   Worker: http://localhost:8001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo ''; echo '🛑 Stopping cluster...'; kill $MASTER_PID $WORKER_PID 2>/dev/null; exit 0" INT TERM

wait
