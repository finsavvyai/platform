#!/bin/bash

# SDLC Staging Environment - Startup Script
# This script starts the staging environment and waits for all services to be healthy

set -e

SDLC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SDLC_DIR"

echo "🚀 Starting SDLC Staging Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Start services
echo "📦 Starting services..."
docker-compose -f docker-compose.staging.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
echo ""

# Wait for health checks
MAX_WAIT=120  # 2 minutes
WAIT_TIME=0
SLEEP_INTERVAL=5

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    # Check postgres
    POSTGRES_HEALTHY=$(docker-compose -f docker-compose.staging.yml ps postgres | grep -c "healthy" || echo "0")
    
    # Check redis
    REDIS_HEALTHY=$(docker-compose -f docker-compose.staging.yml ps redis | grep -c "healthy" || echo "0")
    
    # Check gateway
    GATEWAY_HEALTHY=$(docker-compose -f docker-compose.staging.yml ps gateway | grep -c "healthy" || echo "0")
    
    # Check if kafka is running
    KAFKA_RUNNING=$(docker-compose -f docker-compose.staging.yml ps kafka | grep -c "Up" || echo "0")
    
    if [ "$POSTGRES_HEALTHY" -eq "1" ] && [ "$REDIS_HEALTHY" -eq "1" ] && [ "$GATEWAY_HEALTHY" -eq "1" ] && [ "$KAFKA_RUNNING" -eq "1" ]; then
        echo -e "${GREEN}✅ All critical services are healthy!${NC}"
        break
    fi
    
    echo "   Waiting... ($WAIT_TIME/$MAX_WAIT seconds)"
    echo "   - Postgres: $([ "$POSTGRES_HEALTHY" -eq "1" ] && echo "✅" || echo "⏳")"
    echo "   - Redis: $([ "$REDIS_HEALTHY" -eq "1" ] && echo "✅" || echo "⏳")"
    echo "   - Gateway: $([ "$GATEWAY_HEALTHY" -eq "1" ] && echo "✅" || echo "⏳")"
    echo "   - Kafka: $([ "$KAFKA_RUNNING" -eq "1" ] && echo "✅" || echo "⏳")"
    echo ""
    
    sleep $SLEEP_INTERVAL
    WAIT_TIME=$((WAIT_TIME + SLEEP_INTERVAL))
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}⚠️  Timeout waiting for all services to be healthy${NC}"
    echo ""
    echo "Current status:"
    docker-compose -f docker-compose.staging.yml ps
    echo ""
    echo "You can check logs with:"
    echo "  docker-compose -f docker-compose.staging.yml logs -f"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 SDLC Staging Environment is Ready!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""
echo "Services available at:"
echo -e "  • Admin UI:       ${GREEN}http://localhost:3000${NC}"
echo -e "  • Gateway API:    ${GREEN}http://localhost:8080${NC}"
echo -e "  • Postgres:       ${GREEN}localhost:5434${NC}"
echo -e "  • Redis:          ${GREEN}localhost:6381${NC}"
echo -e "  • Kafka:          ${GREEN}localhost:9092${NC}"
echo -e "  • MinIO:          ${GREEN}http://localhost:9000${NC}"
echo -e "  • Grafana:        ${GREEN}http://localhost:3010${NC}"
echo -e "  • Prometheus:     ${GREEN}http://localhost:9090${NC}"
echo -e "  • Jaeger:         ${GREEN}http://localhost:16686${NC}"
echo ""
echo "To run tests:"
echo -e "  ${YELLOW}cd tests && npx playwright test${NC}"
echo ""
echo "To stop staging:"
echo -e "  ${YELLOW}docker-compose -f docker-compose.staging.yml down${NC}"
echo ""
echo "View logs:"
echo -e "  ${YELLOW}docker-compose -f docker-compose.staging.yml logs -f${NC}"
echo ""
