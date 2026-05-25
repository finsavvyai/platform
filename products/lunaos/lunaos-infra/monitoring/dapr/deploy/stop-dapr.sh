#!/bin/bash

# LunaOS Dapr Stop Script
# This script stops all LunaOS services with Dapr sidecars

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping LunaOS Dapr services...${NC}"

# Stop Dapr applications
echo -e "${YELLOW}⏳ Stopping Dapr applications...${NC}"

dapr stop --app-id lunaos-api 2>/dev/null || echo -e "${YELLOW}⚠️  lunaos-api not running${NC}"
dapr stop --app-id lunaos-agent-runtime 2>/dev/null || echo -e "${YELLOW}⚠️  lunaos-agent-runtime not running${NC}"
dapr stop --app-id lunaos-plugin-gateway 2>/dev/null || echo -e "${YELLOW}⚠️  lunaos-plugin-gateway not running${NC}"

# Kill any remaining processes
echo -e "${YELLOW}⏳ Killing remaining processes...${NC}"

# Kill processes by port
for port in 8001 8003 8004 3500 3501 3502; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}Killing process on port $port (PID: $PID)${NC}"
        kill $PID 2>/dev/null || true
    fi
done

# Wait a moment for processes to stop
sleep 2

# Force kill if necessary
for port in 8001 8003 8004 3500 3501 3502; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$PID" ]; then
        echo -e "${RED}Force killing process on port $port (PID: $PID)${NC}"
        kill -9 $PID 2>/dev/null || true
    fi
done

echo -e "${GREEN}✅ All LunaOS Dapr services stopped${NC}"

# Optional: Stop Redis if it was started by this script
if [ "$1" = "--stop-redis" ]; then
    echo -e "${YELLOW}⏳ Stopping Redis...${NC}"
    docker stop lunaos-redis 2>/dev/null || echo -e "${YELLOW}⚠️  Redis container not found${NC}"
    docker rm lunaos-redis 2>/dev/null || echo -e "${YELLOW}⚠️  Redis container not found${NC}"
    echo -e "${GREEN}✅ Redis stopped${NC}"
fi
