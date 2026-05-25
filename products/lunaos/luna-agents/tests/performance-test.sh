#!/bin/bash

# Luna Vision RAG™ - Performance Test Suite
# Tests response times and throughput

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="https://luna-vision-rag.broad-dew-49ad.workers.dev"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Luna Vision RAG™ - Performance Test Suite           ║${NC}"
echo -e "${BLUE}║       Testing response times and throughput                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to measure response time
measure_response_time() {
    local endpoint=$1
    local name=$2
    
    echo -e "${BLUE}Testing:${NC} $name"
    
    # Measure 5 requests
    total_time=0
    for i in {1..5}; do
        response_time=$(curl -o /dev/null -s -w '%{time_total}' "${BASE_URL}${endpoint}")
        total_time=$(awk "BEGIN {print $total_time + $response_time}")
        echo -e "  Request $i: ${response_time}s"
    done
    
    avg_time=$(awk "BEGIN {printf \"%.3f\", $total_time / 5}")
    echo -e "${GREEN}Average:${NC} ${avg_time}s"
    
    # Check if under 1 second
    if (( $(awk "BEGIN {print ($avg_time < 1.0)}") )); then
        echo -e "${GREEN}✓ PASSED${NC} - Response time under 1s"
    else
        echo -e "${YELLOW}⚠ WARNING${NC} - Response time over 1s"
    fi
    echo ""
}

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}RESPONSE TIME TESTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

measure_response_time "/health" "Health Check"
measure_response_time "/api" "API Info"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}CONCURRENT REQUESTS TEST${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Testing:${NC} 10 concurrent requests"
start_time=$(date +%s.%N)

for i in {1..10}; do
    curl -s "${BASE_URL}/health" > /dev/null &
done

wait

end_time=$(date +%s.%N)
duration=$(awk "BEGIN {printf \"%.3f\", $end_time - $start_time}")

echo -e "${GREEN}Completed:${NC} 10 requests in ${duration}s"
echo -e "${GREEN}Throughput:${NC} $(awk "BEGIN {printf \"%.2f\", 10 / $duration}") req/s"
echo ""

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}GLOBAL LATENCY TEST${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Testing:${NC} DNS resolution and connection time"

curl -w "\n\nDNS Lookup:       %{time_namelookup}s\nTCP Connection:   %{time_connect}s\nTLS Handshake:    %{time_appconnect}s\nTime to First Byte: %{time_starttransfer}s\nTotal Time:       %{time_total}s\n" \
    -o /dev/null -s "${BASE_URL}/health"

echo ""
echo -e "${GREEN}✓ Performance tests completed!${NC}"
