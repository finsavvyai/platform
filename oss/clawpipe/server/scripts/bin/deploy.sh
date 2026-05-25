#!/bin/bash
# FinSavvyAI Deployment Script

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

echo -e "${BLUE}🚀 FinSavvyAI Deployment${NC}"
echo -e "${BLUE}========================${NC}"
echo ""

# Check if services are already running
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Kill existing processes
cleanup_services() {
    echo -e "${YELLOW}🧹 Cleaning up existing services...${NC}"
    pkill -f "start_master.py" 2>/dev/null || true
    pkill -f "worker_node.py" 2>/dev/null || true
    pkill -f "gateway.py" 2>/dev/null || true
    sleep 2
}

# Start master
start_master() {
    if check_port 8000; then
        echo -e "${YELLOW}⚠️  Master already running on port 8000${NC}"
    else
        echo -e "${GREEN}🌐 Starting master server...${NC}"
        nohup python3 src/core/start_master.py --port 8000 > logs/master.log 2>&1 &
        MASTER_PID=$!
        echo $MASTER_PID > .master.pid
        sleep 3

        if check_port 8000; then
            echo -e "${GREEN}✅ Master started (PID: $MASTER_PID)${NC}"
        else
            echo -e "${YELLOW}⚠️  Master may still be starting, check logs: tail -f logs/master.log${NC}"
            # Don't exit, let it continue
        fi
    fi
}

# Start worker
start_worker() {
    if check_port 8001; then
        echo -e "${YELLOW}⚠️  Worker already running on port 8001${NC}"
    else
        echo -e "${GREEN}🤖 Starting worker node...${NC}"
        nohup python3 src/workers/worker_node.py --master localhost --port 8001 > logs/worker.log 2>&1 &
        WORKER_PID=$!
        echo $WORKER_PID > .worker.pid
        sleep 4

        if check_port 8001; then
            echo -e "${GREEN}✅ Worker started (PID: $WORKER_PID)${NC}"
        else
            echo -e "${YELLOW}⚠️  Worker may still be starting...${NC}"
        fi
    fi
}

# Start gateway
start_gateway() {
    if check_port 8080; then
        echo -e "${YELLOW}⚠️  Gateway already running on port 8080${NC}"
    else
        echo -e "${GREEN}🌐 Starting API gateway...${NC}"
        nohup python3 src/api/gateway.py --master-host localhost --master-port 8000 --port 8080 > logs/gateway.log 2>&1 &
        GATEWAY_PID=$!
        echo $GATEWAY_PID > .gateway.pid
        sleep 3

        if check_port 8080; then
            echo -e "${GREEN}✅ Gateway started (PID: $GATEWAY_PID)${NC}"
        else
            echo -e "${YELLOW}⚠️  Gateway may still be starting...${NC}"
        fi
    fi
}

# Verify deployment
verify_deployment() {
    echo ""
    echo -e "${BLUE}🔍 Verifying deployment...${NC}"
    sleep 2

    # Check master
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Master: http://localhost:8000${NC}"
    else
        echo -e "${RED}❌ Master: Not responding${NC}"
    fi

    # Check worker
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Worker: http://localhost:8001${NC}"
    else
        echo -e "${YELLOW}⚠️  Worker: Not responding (may still be starting)${NC}"
    fi

    # Check gateway
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Gateway: http://localhost:8080${NC}"
    else
        echo -e "${YELLOW}⚠️  Gateway: Not responding (may still be starting)${NC}"
    fi
}

# Show status
show_status() {
    echo ""
    echo -e "${BLUE}📊 Deployment Status${NC}"
    echo "================================"
    echo ""
    echo "Services:"
    echo "  Master:  http://localhost:8000"
    echo "  Worker:  http://localhost:8001"
    echo "  Gateway: http://localhost:8080"
    echo ""
    echo "Endpoints:"
    echo "  Cluster Status: http://localhost:8000/cluster/status"
    echo "  API Gateway:    http://localhost:8080/v1/chat/completions"
    echo "  Models:         http://localhost:8080/v1/models"
    echo ""
    echo "Logs:"
    echo "  Master:  logs/master.log"
    echo "  Worker:  logs/worker.log"
    echo "  Gateway: logs/gateway.log"
    echo ""
    echo "PIDs:"
    [ -f .master.pid ] && echo "  Master:  $(cat .master.pid)"
    [ -f .worker.pid ] && echo "  Worker:  $(cat .worker.pid)"
    [ -f .gateway.pid ] && echo "  Gateway: $(cat .gateway.pid)"
    echo ""
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    echo ""
    echo "To stop services:"
    echo "  ./stop.sh"
    echo "  or"
    echo "  pkill -f 'start_master.py|worker_node.py|gateway.py'"
}

# Main deployment
main() {
    # Create logs directory
    mkdir -p logs

    # Cleanup if requested
    if [ "$1" = "--clean" ]; then
        cleanup_services
    fi

    # Start services
    start_master
    start_worker
    start_gateway

    # Verify
    verify_deployment

    # Show status
    show_status
}

# Run deployment
main "$@"
