#!/bin/bash
# Health monitoring script for FinSavvyAI services

MASTER_URL="http://localhost:8000/health"
WORKER_URL="http://localhost:8001/health"
GATEWAY_URL="http://localhost:8080/health"

check_service() {
    local name=$1
    local url=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "✅ $name: Healthy"
        return 0
    else
        echo "❌ $name: Unhealthy"
        return 1
    fi
}

echo "🔍 FinSavvyAI Health Check"
echo "=========================="
echo ""

MASTER_OK=false
WORKER_OK=false
GATEWAY_OK=false

check_service "Master" "$MASTER_URL" && MASTER_OK=true
check_service "Worker" "$WORKER_URL" && WORKER_OK=true
check_service "Gateway" "$GATEWAY_URL" && GATEWAY_OK=true

echo ""

if [ "$MASTER_OK" = true ] && [ "$WORKER_OK" = true ] && [ "$GATEWAY_OK" = true ]; then
    echo "✅ All services healthy"
    exit 0
else
    echo "⚠️  Some services are unhealthy"
    exit 1
fi

