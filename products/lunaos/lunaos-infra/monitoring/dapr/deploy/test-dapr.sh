#!/bin/bash

# LunaOS Dapr Test Script
# This script tests the Dapr setup and service communication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing LunaOS Dapr Setup...${NC}"

# Test 1: Check if Dapr is running
echo -e "${YELLOW}Test 1: Checking Dapr status...${NC}"
if dapr status &> /dev/null; then
    echo -e "${GREEN}✅ Dapr is running${NC}"
else
    echo -e "${RED}❌ Dapr is not running${NC}"
    exit 1
fi

# Test 2: Check if Redis is accessible
echo -e "${YELLOW}Test 2: Checking Redis connection...${NC}"
if nc -z localhost 6379; then
    echo -e "${GREEN}✅ Redis is accessible${NC}"
else
    echo -e "${RED}❌ Redis is not accessible${NC}"
    exit 1
fi

# Test 3: Test state store
echo -e "${YELLOW}Test 3: Testing state store...${NC}"
curl -X POST http://localhost:3500/v1.0/state/statestore \
  -H "Content-Type: application/json" \
  -d '[{"key": "test-key", "value": "test-value"}]' \
  -s > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ State store write successful${NC}"
else
    echo -e "${RED}❌ State store write failed${NC}"
fi

# Test 4: Test state store read
echo -e "${YELLOW}Test 4: Testing state store read...${NC}"
RESULT=$(curl -s http://localhost:3500/v1.0/state/statestore/test-key)
if [ "$RESULT" = "test-value" ]; then
    echo -e "${GREEN}✅ State store read successful${NC}"
else
    echo -e "${RED}❌ State store read failed${NC}"
fi

# Test 5: Test service invocation (if LunaOS API is running)
echo -e "${YELLOW}Test 5: Testing service invocation...${NC}"
if curl -s http://localhost:8001/health > /dev/null; then
    RESULT=$(curl -s http://localhost:3500/v1.0/invoke/lunaos-api/method/health)
    if echo "$RESULT" | grep -q "healthy"; then
        echo -e "${GREEN}✅ Service invocation successful${NC}"
    else
        echo -e "${RED}❌ Service invocation failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  LunaOS API not running, skipping service invocation test${NC}"
fi

# Test 6: Test pub/sub (if available)
echo -e "${YELLOW}Test 6: Testing pub/sub...${NC}"
curl -X POST http://localhost:3500/v1.0/publish/pubsub/test-topic \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}' \
  -s > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Pub/sub publish successful${NC}"
else
    echo -e "${RED}❌ Pub/sub publish failed${NC}"
fi

# Test 7: Check Dapr metrics
echo -e "${YELLOW}Test 7: Checking Dapr metrics...${NC}"
if curl -s http://localhost:9090/metrics > /dev/null; then
    echo -e "${GREEN}✅ Dapr metrics accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Dapr metrics not accessible (may not be enabled)${NC}"
fi

echo -e "${GREEN}🎉 Dapr testing completed!${NC}"
echo -e "${BLUE}📊 Test Summary:${NC}"
echo -e "  • Dapr Status: $(dapr status --short 2>/dev/null || echo 'Not available')"
echo -e "  • Redis: $(nc -z localhost 6379 && echo 'Running' || echo 'Not running')"
echo -e "  • LunaOS API: $(curl -s http://localhost:8001/health > /dev/null && echo 'Running' || echo 'Not running')"
echo -e "  • Dapr API: $(curl -s http://localhost:3500/v1.0/healthz > /dev/null && echo 'Running' || echo 'Not running')"
