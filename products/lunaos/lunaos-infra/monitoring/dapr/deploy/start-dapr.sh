#!/bin/bash

# LunaOS Dapr Deployment Script
# This script starts all LunaOS services with Dapr sidecars

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DAPR_CONFIG_PATH="./infra/dapr/config.yaml"
DAPR_COMPONENTS_PATH="./infra/dapr/components"
REDIS_HOST="localhost:6379"

echo -e "${BLUE}🌙 Starting LunaOS with Dapr...${NC}"

# Check if Dapr is installed
if ! command -v dapr &> /dev/null; then
    echo -e "${RED}❌ Dapr CLI not found. Please install Dapr first.${NC}"
    echo "Run: curl -fsSL https://raw.githubusercontent.com/dapr/cli/master/install/install.sh | /bin/bash"
    exit 1
fi

# Check if Dapr is initialized
if ! dapr status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Dapr not initialized. Initializing...${NC}"
    dapr init
fi

# Check if Redis is running
if ! nc -z localhost 6379; then
    echo -e "${YELLOW}⚠️  Redis not running. Starting Redis...${NC}"
    if command -v docker &> /dev/null; then
        docker run -d --name lunaos-redis -p 6379:6379 redis:alpine
        echo -e "${GREEN}✅ Redis started with Docker${NC}"
    else
        echo -e "${RED}❌ Redis not available and Docker not found. Please start Redis manually.${NC}"
        exit 1
    fi
fi

# Wait for Redis to be ready
echo -e "${BLUE}⏳ Waiting for Redis to be ready...${NC}"
until nc -z localhost 6379; do
    sleep 1
done
echo -e "${GREEN}✅ Redis is ready${NC}"

# Start LunaOS API with Dapr
echo -e "${BLUE}🚀 Starting LunaOS API with Dapr...${NC}"
dapr run \
    --app-id lunaos-api \
    --app-port 8001 \
    --dapr-http-port 3500 \
    --dapr-grpc-port 50001 \
    --config-file "$DAPR_CONFIG_PATH" \
    --components-path "$DAPR_COMPONENTS_PATH" \
    --log-level info \
    -- python -m lunaos.api.server &

API_PID=$!
echo -e "${GREEN}✅ LunaOS API started (PID: $API_PID)${NC}"

# Start Agent Runtime with Dapr
echo -e "${BLUE}🤖 Starting Agent Runtime with Dapr...${NC}"
dapr run \
    --app-id lunaos-agent-runtime \
    --app-port 8003 \
    --dapr-http-port 3501 \
    --dapr-grpc-port 50002 \
    --config-file "$DAPR_CONFIG_PATH" \
    --components-path "$DAPR_COMPONENTS_PATH" \
    --log-level info \
    -- python -m lunaos.core.runtime &

RUNTIME_PID=$!
echo -e "${GREEN}✅ Agent Runtime started (PID: $RUNTIME_PID)${NC}"

# Start Plugin Gateway with Dapr
echo -e "${BLUE}🔌 Starting Plugin Gateway with Dapr...${NC}"
dapr run \
    --app-id lunaos-plugin-gateway \
    --app-port 8004 \
    --dapr-http-port 3502 \
    --dapr-grpc-port 50003 \
    --config-file "$DAPR_CONFIG_PATH" \
    --components-path "$DAPR_COMPONENTS_PATH" \
    --log-level info \
    -- python -m lunaos.plugins.gateway &

GATEWAY_PID=$!
echo -e "${GREEN}✅ Plugin Gateway started (PID: $GATEWAY_PID)${NC}"

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Health check
echo -e "${BLUE}🔍 Performing health checks...${NC}"

# Check LunaOS API
if curl -s http://localhost:8001/health > /dev/null; then
    echo -e "${GREEN}✅ LunaOS API is healthy${NC}"
else
    echo -e "${RED}❌ LunaOS API health check failed${NC}"
fi

# Check Dapr API
if curl -s http://localhost:3500/v1.0/healthz > /dev/null; then
    echo -e "${GREEN}✅ Dapr API is healthy${NC}"
else
    echo -e "${RED}❌ Dapr API health check failed${NC}"
fi

echo -e "${GREEN}🎉 LunaOS with Dapr is running!${NC}"
echo -e "${BLUE}📊 Services:${NC}"
echo -e "  • LunaOS API: http://localhost:8001"
echo -e "  • Dapr API: http://localhost:3500"
echo -e "  • Agent Runtime: http://localhost:8003"
echo -e "  • Plugin Gateway: http://localhost:8004"
echo -e "  • Redis: localhost:6379"
echo ""
echo -e "${BLUE}🔧 Dapr Commands:${NC}"
echo -e "  • View logs: dapr logs --app-id lunaos-api"
echo -e "  • Check status: dapr status"
echo -e "  • Stop services: ./infra/dapr/deploy/stop-dapr.sh"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping LunaOS services...${NC}"
    kill $API_PID $RUNTIME_PID $GATEWAY_PID 2>/dev/null || true
    dapr stop --app-id lunaos-api 2>/dev/null || true
    dapr stop --app-id lunaos-agent-runtime 2>/dev/null || true
    dapr stop --app-id lunaos-plugin-gateway 2>/dev/null || true
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
