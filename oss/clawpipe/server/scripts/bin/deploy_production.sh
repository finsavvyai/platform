#!/bin/bash
# Production Deployment Script for FinSavvyAI
# Includes security, monitoring, and production best practices

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo -e "${BLUE}🚀 FinSavvyAI Production Deployment${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Load environment variables if .env exists
if [ -f .env ]; then
    echo -e "${GREEN}📝 Loading environment variables from .env${NC}"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Create necessary directories
mkdir -p logs
mkdir -p ~/.finsavvyai

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    return 1
}

# Stop existing services
echo -e "${YELLOW}🧹 Stopping existing services...${NC}"
pkill -f "start_master.py" 2>/dev/null || true
pkill -f "worker_node.py" 2>/dev/null || true
pkill -f "gateway.py" 2>/dev/null || true
sleep 2

# Generate API key if auth is enabled and no key exists
if [ "${FINSAVVYAI_AUTH_ENABLED:-false}" = "true" ]; then
    echo -e "${GREEN}🔐 Checking API keys...${NC}"
    if [ ! -f ~/.finsavvyai/api-keys.json ]; then
        echo -e "${YELLOW}⚠️  No API keys found. Generating default key...${NC}"
        python3 << EOF
from src.core.auth import APIKeyManager
manager = APIKeyManager()
key_data = manager.generate_key("production", "Production API Key")
print(f"✅ API Key generated: {key_data['key']}")
print("⚠️  Save this key securely! It won't be shown again.")
EOF
    fi
fi

# Start Master
echo -e "${GREEN}🌐 Starting Master Server...${NC}"
if check_port 8000; then
    echo -e "${YELLOW}⚠️  Port 8000 already in use${NC}"
else
    cd "$REPO_ROOT"
    nohup python3 src/core/start_master.py --port ${FINSAVVYAI_MASTER_PORT:-8000} >> logs/master.log 2>&1 &
    MASTER_PID=$!
    echo $MASTER_PID > .master.pid

    if wait_for_service "http://localhost:${FINSAVVYAI_MASTER_PORT:-8000}/health" "Master"; then
        echo -e "${GREEN}✅ Master started (PID: $MASTER_PID)${NC}"
    else
        echo -e "${RED}❌ Master failed to start${NC}"
        echo "Check logs: tail -f logs/master.log"
        exit 1
    fi
fi

# Start Worker
echo -e "${GREEN}🤖 Starting Worker Node...${NC}"
if check_port 8001; then
    echo -e "${YELLOW}⚠️  Port 8001 already in use${NC}"
else
    cd "$REPO_ROOT"
    nohup python3 src/workers/worker_node.py \
        --master ${FINSAVVYAI_MASTER_HOST:-localhost} \
        --port ${FINSAVVYAI_WORKER_DEFAULT_PORT:-8001} \
        >> logs/worker.log 2>&1 &
    WORKER_PID=$!
    echo $WORKER_PID > .worker.pid
    sleep 3

    if wait_for_service "http://localhost:${FINSAVVYAI_WORKER_DEFAULT_PORT:-8001}/health" "Worker"; then
        echo -e "${GREEN}✅ Worker started (PID: $WORKER_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  Worker may still be starting...${NC}"
    fi
fi

# Start Gateway
echo -e "${GREEN}🌐 Starting API Gateway...${NC}"
GATEWAY_PORT=${FINSAVVYAI_GATEWAY_PORT:-8080}
# Try to find a free port
for port in $GATEWAY_PORT 8081 8082 8083; do
    if ! check_port $port; then
        GATEWAY_PORT=$port
        break
    fi
done
if check_port $GATEWAY_PORT; then
    echo -e "${YELLOW}⚠️  Port $GATEWAY_PORT already in use${NC}"
fi

cd "$REPO_ROOT"
nohup python3 src/api/gateway.py \
    --master-host ${FINSAVVYAI_MASTER_HOST:-localhost} \
    --master-port ${FINSAVVYAI_MASTER_PORT:-8000} \
    --port $GATEWAY_PORT \
    >> logs/gateway.log 2>&1 &
GATEWAY_PID=$!
echo $GATEWAY_PID > .gateway.pid
echo $GATEWAY_PORT > .gateway.port
sleep 3

if wait_for_service "http://localhost:$GATEWAY_PORT/health" "Gateway"; then
    echo -e "${GREEN}✅ Gateway started on port $GATEWAY_PORT (PID: $GATEWAY_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  Gateway may still be starting on port $GATEWAY_PORT...${NC}"
fi

# Final verification
echo ""
echo -e "${BLUE}🔍 Final Verification${NC}"
echo "================================"

SERVICES_OK=true

# Check Master
if curl -s http://localhost:${FINSAVVYAI_MASTER_PORT:-8000}/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Master: http://localhost:${FINSAVVYAI_MASTER_PORT:-8000}${NC}"
else
    echo -e "${RED}❌ Master: Not responding${NC}"
    SERVICES_OK=false
fi

# Check Worker
if curl -s http://localhost:${FINSAVVYAI_WORKER_DEFAULT_PORT:-8001}/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Worker: http://localhost:${FINSAVVYAI_WORKER_DEFAULT_PORT:-8001}${NC}"
else
    echo -e "${YELLOW}⚠️  Worker: Not responding (may still be starting)${NC}"
fi

# Check Gateway
GATEWAY_PORT=$(cat .gateway.port 2>/dev/null || echo ${FINSAVVYAI_GATEWAY_PORT:-8081})
if curl -s http://localhost:$GATEWAY_PORT/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Gateway: http://localhost:$GATEWAY_PORT${NC}"
else
    echo -e "${YELLOW}⚠️  Gateway: Not responding on port $GATEWAY_PORT (may still be starting)${NC}"
fi

# Show status
echo ""
echo -e "${BLUE}📊 Deployment Status${NC}"
echo "================================"
echo ""
GATEWAY_PORT=$(cat .gateway.port 2>/dev/null || echo ${FINSAVVYAI_GATEWAY_PORT:-8081})
echo "Services:"
echo "  Master:  http://localhost:${FINSAVVYAI_MASTER_PORT:-8000}"
echo "  Worker:  http://localhost:${FINSAVVYAI_WORKER_DEFAULT_PORT:-8001}"
echo "  Gateway: http://localhost:$GATEWAY_PORT"
echo ""
echo "Endpoints:"
echo "  Cluster Status: http://localhost:${FINSAVVYAI_MASTER_PORT:-8000}/cluster/status"
echo "  API Gateway:    http://localhost:$GATEWAY_PORT/v1/chat/completions"
echo "  Models:         http://localhost:$GATEWAY_PORT/v1/models"
echo ""

# Security status
if [ "${FINSAVVYAI_AUTH_ENABLED:-false}" = "true" ]; then
    echo -e "${YELLOW}🔐 Security: API Key Authentication ENABLED${NC}"
    echo "  Generate keys: python3 -c 'from src.core.auth import APIKeyManager; m=APIKeyManager(); print(m.generate_key(\"name\", \"desc\")[\"key\"])'"
else
    echo -e "${YELLOW}⚠️  Security: API Key Authentication DISABLED${NC}"
    echo "  Enable in .env: FINSAVVYAI_AUTH_ENABLED=true"
fi

if [ "${FINSAVVYAI_RATE_LIMIT_ENABLED:-true}" = "true" ]; then
    echo -e "${GREEN}✅ Rate Limiting: ENABLED${NC}"
    echo "  Limit: ${FINSAVVYAI_RATE_LIMIT_REQUESTS:-100} requests per ${FINSAVVYAI_RATE_LIMIT_WINDOW:-60}s"
else
    echo -e "${YELLOW}⚠️  Rate Limiting: DISABLED${NC}"
fi

echo ""
echo "PIDs:"
[ -f .master.pid ] && echo "  Master:  $(cat .master.pid)"
[ -f .worker.pid ] && echo "  Worker:  $(cat .worker.pid)"
[ -f .gateway.pid ] && echo "  Gateway: $(cat .gateway.pid)"
echo ""
echo "Logs:"
echo "  tail -f logs/master.log"
echo "  tail -f logs/worker.log"
echo "  tail -f logs/gateway.log"
echo ""

if [ "$SERVICES_OK" = true ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Test the deployment:"
    echo "  curl http://localhost:${FINSAVVYAI_MASTER_PORT:-8000}/cluster/status"
    echo "  curl http://localhost:$GATEWAY_PORT/v1/models"
    exit 0
else
    echo -e "${YELLOW}⚠️  Deployment completed with warnings${NC}"
    echo "Check logs for details"
    exit 0
fi
