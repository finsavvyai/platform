#!/bin/bash
# Stop FinSavvyAI Services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 Stopping FinSavvyAI Services${NC}"
echo ""

# Stop by PID files
if [ -f .master.pid ]; then
    PID=$(cat .master.pid)
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}Stopping master (PID: $PID)...${NC}"
        kill $PID 2>/dev/null || true
        rm .master.pid
    fi
fi

if [ -f .worker.pid ]; then
    PID=$(cat .worker.pid)
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}Stopping worker (PID: $PID)...${NC}"
        kill $PID 2>/dev/null || true
        rm .worker.pid
    fi
fi

if [ -f .gateway.pid ]; then
    PID=$(cat .gateway.pid)
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}Stopping gateway (PID: $PID)...${NC}"
        kill $PID 2>/dev/null || true
        rm .gateway.pid
    fi
fi

# Stop by process name
echo -e "${YELLOW}Stopping any remaining processes...${NC}"
pkill -f "start_master.py" 2>/dev/null && echo -e "${GREEN}✅ Master stopped${NC}" || true
pkill -f "worker_node.py" 2>/dev/null && echo -e "${GREEN}✅ Worker stopped${NC}" || true
pkill -f "gateway.py" 2>/dev/null && echo -e "${GREEN}✅ Gateway stopped${NC}" || true

sleep 1

# Verify
if ! lsof -ti:8000,8001,8080 > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}✅ All services stopped${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Some services may still be running${NC}"
    echo "Check with: lsof -i :8000,8001,8080"
fi
