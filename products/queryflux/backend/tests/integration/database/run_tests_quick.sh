#!/bin/bash

# Quick Integration Test Runner for Database Adapters (Minimal Setup)
# This script uses only 4 core databases for fast testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 QueryFlux Quick Database Integration Tests${NC}"
echo "================================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Navigate to backend directory
cd "$(dirname "$0")/../../.."

# Stop any existing test containers
echo -e "${YELLOW}🧹 Stopping existing test containers...${NC}"
docker-compose -f docker-compose.test.minimal.yml down -v 2>/dev/null || true

# Start minimal test databases
echo -e "${YELLOW}🐳 Starting core test databases (PostgreSQL, MySQL, MongoDB, Redis)...${NC}"
docker-compose -f docker-compose.test.minimal.yml up -d

echo -e "${YELLOW}⏳ Waiting for databases to be ready...${NC}"
sleep 20

# Check database health
echo "Checking database health..."
healthy_count=0
total_count=4

for db in postgres-test mysql-test mongodb-test redis-test; do
    if docker-compose -f docker-compose.test.minimal.yml ps "$db" | grep -q "Up (healthy)"; then
        echo -e "${GREEN}✅ $db is healthy${NC}"
        healthy_count=$((healthy_count + 1))
    else
        echo -e "${YELLOW}⚠️  $db is still starting...${NC}"
    fi
done

echo -e "${GREEN}📊 $healthy_count/$total_count databases are healthy${NC}"

# Set environment variables
echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"
export POSTGRES_TEST_URL="postgres://test_user:test_password@localhost:5433/test_db?sslmode=disable"
export MYSQL_TEST_URL="test_user:test_password@tcp(localhost:3307)/test_db"
export MONGODB_TEST_URL="mongodb://test_user:test_password@localhost:27018/test_db"
export REDIS_TEST_URL="redis://:test_password@localhost:6380/0"

echo -e "${GREEN}✅ Environment variables set${NC}"

# Wait a bit more for databases to be fully ready
echo -e "${YELLOW}⏳ Giving databases extra time to initialize...${NC}"
sleep 10

# Set Go test environment
export CGO_ENABLED=1
export GO111MODULE=on

# Run tests for core databases
echo -e "${YELLOW}🧪 Running integration tests for core databases...${NC}"

for db in postgresql mysql mongodb redis; do
    echo -e "${BLUE}📋 Testing $db adapter...${NC}"
    db_capitalized=$(echo "$db" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')
    if go test -v ./tests/integration/database/... -run "Test${db_capitalized}Adapter_Integration" -timeout=60s; then
        echo -e "${GREEN}✅ $db tests passed${NC}"
    else
        echo -e "${RED}❌ $db tests failed${NC}"
    fi
    echo ""
done

# Run factory tests
echo -e "${BLUE}🏭 Running adapter factory tests...${NC}"
go test -v ./tests/integration/database/... -run "TestAdapterFactory_NewAdapters" -timeout=30s

echo -e "${GREEN}✅ Quick tests completed${NC}"

# Show logs if there were failures
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}📋 Showing database logs...${NC}"
    docker-compose -f docker-compose.test.minimal.yml logs --tail=20
fi

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up test databases...${NC}"
docker-compose -f docker-compose.test.minimal.yml down -v
echo -e "${GREEN}✅ Cleanup completed${NC}"

echo -e "${GREEN}🎉 Quick integration test run completed!${NC}"