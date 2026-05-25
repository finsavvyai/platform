#!/bin/bash

# 🛑 Qestro Stop Script
# Stops all running Qestro services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}  🛑 Stopping Qestro Services${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Stop backend
if [ -f "$BACKEND_DIR/.backend.pid" ]; then
    BACKEND_PID=$(cat "$BACKEND_DIR/.backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}🛑 Stopping backend (PID: $BACKEND_PID)${NC}"
        kill $BACKEND_PID
        echo -e "${GREEN}✅ Backend stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend process not found${NC}"
    fi
    rm -f "$BACKEND_DIR/.backend.pid"
else
    echo -e "${YELLOW}ℹ️  No backend PID file found${NC}"
fi

# Stop frontend
if [ -f "$FRONTEND_DIR/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$FRONTEND_DIR/.frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}🛑 Stopping frontend (PID: $FRONTEND_PID)${NC}"
        kill $FRONTEND_PID
        echo -e "${GREEN}✅ Frontend stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend process not found${NC}"
    fi
    rm -f "$FRONTEND_DIR/.frontend.pid"
else
    echo -e "${YELLOW}ℹ️  No frontend PID file found${NC}"
fi

# Stop any remaining Node.js processes on common ports
echo -e "${YELLOW}🧹 Cleaning up any remaining processes...${NC}"

# Kill processes on port 8000 (backend)
if lsof -ti:8000 > /dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Stopping process on port 8000${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
fi

# Kill processes on port 3000 (frontend)
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Stopping process on port 3000${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

# Check for running QestroDesktop app
if pgrep -f "QestroDesktop.app" > /dev/null 2>&1; then
    echo -e "${YELLOW}ℹ️  QestroDesktop app is still running (close manually if needed)${NC}"
else
    echo -e "${GREEN}✅ No desktop app processes running${NC}"
fi

echo ""
echo -e "${GREEN}✅ All Qestro services stopped${NC}"