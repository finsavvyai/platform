#!/bin/bash

# UPM.Plus Comprehensive Test Suite
# Tests all environments and services thoroughly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 COMPREHENSIVE UPM.Plus TEST SUITE${NC}"
echo -e "${BLUE}Testing all environments and services${NC}"
echo

# Test development environment
echo -e "${MAGENTA}=== DEVELOPMENT ENVIRONMENT TESTS ===${NC}"
echo

services=(
    "https://upmplus.dev:main:UPM.Plus"
    "https://upmplus.dev/dashboard:dashboard:Dashboard"
    "https://upmplus.dev/admin:admin:Admin"
    "https://upmplus.dev/docs:docs:Documentation"
    "https://upmplus.dev/cdn:cdn:CDN"
    "https://upmplus.dev/app:app:Application"
)

dev_passed=0
dev_total=${#services[@]}

for service_info in "${services[@]}"; do
    IFS=':' read -r url name expected_content <<< "$service_info"
    echo -n "Testing $name... "

    if response=$(curl -s "$url" 2>/dev/null); then
        if echo "$response" | grep -q "$expected_content"; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((dev_passed++))
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
done

echo -e "${CYAN}Development Environment: $dev_passed/$dev_total services passed${NC}"
echo

# Test staging environment
echo -e "${MAGENTA}=== STAGING ENVIRONMENT TESTS ===${NC}"
echo

staging_services=(
    "https://upmplus.io:main:UPM.Plus"
    "https://upmplus.io/dashboard:dashboard:Dashboard"
    "https://upmplus.io/admin:admin:Admin"
    "https://upmplus.io/docs:docs:Documentation"
)

staging_passed=0
staging_total=${#staging_services[@]}

for service_info in "${staging_services[@]}"; do
    IFS=':' read -r url name expected_content <<< "$service_info"
    echo -n "Testing $name... "

    if response=$(curl -s "$url" 2>/dev/null); then
        if echo "$response" | grep -q "$expected_content"; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((staging_passed++))
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
done

echo -e "${CYAN}Staging Environment: $staging_passed/$staging_total services passed${NC}"
echo

# Test API endpoints
echo -e "${MAGENTA}=== API ENDPOINT TESTS ===${NC}"
echo

api_tests=(
    "https://upmplus.dev/api/health:health:healthy"
    "https://upmplus.dev/api/agents:agents:browser-agent"
    "https://upmplus.dev/api/analytics:analytics:total_agents"
    "https://upmplus.io/api/health:health:healthy"
)

api_passed=0
api_total=${#api_tests[@]}

for api_info in "${api_tests[@]}"; do
    IFS=':' read -r url name expected_content <<< "$api_info"
    echo -n "Testing $name API... "

    if response=$(curl -s "$url" 2>/dev/null); then
        if echo "$response" | grep -q "$expected_content"; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((api_passed++))
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
done

echo -e "${CYAN}API Endpoints: $api_passed/$api_total tests passed${NC}"
echo

# Performance tests
echo -e "${MAGENTA}=== PERFORMANCE TESTS ===${NC}"
echo

performance_urls=(
    "https://upmplus.dev"
    "https://upmplus.dev/dashboard"
    "https://upmplus.dev/api/health"
)

echo -e "${CYAN}Testing response times...${NC}"

fast_count=0
for url in "${performance_urls[@]}"; do
    if response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url" 2>/dev/null); then
        if (( $(echo "$response_time < 1.0" | bc -l) )); then
            echo -e "   ${GREEN}✅ $url: ${response_time}s (Fast)${NC}"
            ((fast_count++))
        else
            echo -e "   ${YELLOW}⚠️  $url: ${response_time}s (Slow)${NC}"
        fi
    else
        echo -e "   ${RED}❌ $url: Failed${NC}"
    fi
done

echo -e "${CYAN}Performance: $fast_count/${#performance_urls[@]} responses under 1s${NC}"
echo

# Environment detection tests
echo -e "${MAGENTA}=== ENVIRONMENT DETECTION TESTS ===${NC}"
echo

dev_env=$(curl -s "https://upmplus.dev/api/health" 2>/dev/null | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)
staging_env=$(curl -s "https://upmplus.io/api/health" 2>/dev/null | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)

echo -e "${CYAN}Environment Detection:${NC}"
echo -e "   Development detected: $dev_env"
echo -e "   Staging detected: $staging_env"

if [[ "$dev_env" == "development" ]] && [[ "$staging_env" == "staging" ]]; then
    echo -e "   ${GREEN}✅ Environment detection: WORKING${NC}"
else
    echo -e "   ${RED}❌ Environment detection: ISSUES${NC}"
fi

echo

# Overall results
total_passed=$((dev_passed + staging_passed + api_passed))
total_tests=$((dev_total + staging_total + api_total))

echo -e "${MAGENTA}=== FINAL TEST RESULTS ===${NC}"
echo -e "${BLUE}Total Tests: $total_passed/$total_tests${NC}"
echo -e "${BLUE}Development: $dev_passed/$dev_total${NC}"
echo -e "${BLUE}Staging: $staging_passed/$staging_total${NC}"
echo -e "${BLUE}API Endpoints: $api_passed/$api_total${NC}"

if [[ $total_passed -eq $total_tests ]]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}UPM.Plus is FULLY OPERATIONAL${NC}"
else
    echo -e "${YELLOW}⚠️  SOME TESTS FAILED${NC}"
    echo -e "${YELLOW}Please check the failed services above${NC}"
fi

echo
echo -e "${CYAN}Test completed at: $(date)${NC}"