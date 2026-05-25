#!/bin/bash
# Quick Status Check for FinSavvyAI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 FinSavvyAI Status Check"
echo "=========================="
echo ""

# Check Master
echo "🌐 Master Server (8000):"
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    STATUS=$(curl -s http://localhost:8000/cluster/status | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\"✅ Online - {d['online_nodes']}/{d['total_nodes']} nodes\")" 2>/dev/null || echo "✅ Online")
    echo "  $STATUS"
else
    echo "  ❌ Offline"
fi

# Check Worker
echo ""
echo "🤖 Worker Node (8001):"
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "  ✅ Online"
else
    echo "  ❌ Offline"
fi

# Check Gateway (try multiple ports)
echo ""
echo "🌐 API Gateway:"
GATEWAY_PORT=$(cat .gateway.port 2>/dev/null || echo "8081")
if curl -s http://localhost:$GATEWAY_PORT/health > /dev/null 2>&1; then
    echo "  ✅ Online (port $GATEWAY_PORT)"
elif curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "  ✅ Online (port 8080)"
elif curl -s http://localhost:8081/health > /dev/null 2>&1; then
    echo "  ✅ Online (port 8081)"
else
    echo "  ❌ Offline"
fi

# Show PIDs
echo ""
echo "📊 Process IDs:"
[ -f .master.pid ] && echo "  Master:  $(cat .master.pid) $(ps -p $(cat .master.pid) -o comm= 2>/dev/null || echo '[not running]')"
[ -f .worker.pid ] && echo "  Worker:  $(cat .worker.pid) $(ps -p $(cat .worker.pid) -o comm= 2>/dev/null || echo '[not running]')"
[ -f .gateway.pid ] && echo "  Gateway: $(cat .gateway.pid) $(ps -p $(cat .gateway.pid) -o comm= 2>/dev/null || echo '[not running]')"

echo ""
