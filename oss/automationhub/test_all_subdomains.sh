#!/bin/bash

# UPM.Plus Comprehensive Subdomain Test Suite
# Tests all subdomains across all environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 UPM.Plus Comprehensive Subdomain Test Suite${NC}"
echo -e "${BLUE}Testing all subdomains across all environments${NC}"
echo

# Test function
test_endpoint() {
    local url="$1"
    local description="$2"
    local expected_content="$3"

    echo -e "${CYAN}Testing: ${url}${NC}"
    echo -e "   Description: ${description}"

    # Start timing
    start_time=$(date +%s.%N)

    # Make the request
    if response=$(curl -s -w "\n%{http_code}\n%{time_total}" -m 10 "$url" 2>/dev/null); then
        # Parse response
        http_code=$(echo "$response" | tail -n 2 | head -n 1)
        time_total=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | head -n -2)

        end_time=$(date +%s.%N)
        duration=$(echo "$end_time - $start_time" | bc -l)

        # Evaluate response
        if [[ "$http_code" =~ ^[23] ]]; then
            if [[ -n "$expected_content" ]] && [[ "$body" == *"$expected_content"* ]]; then
                echo -e "   ${GREEN}✅ SUCCESS${NC} - HTTP $http_code (${time_total}s)"
                echo -e "   ${GREEN}   Content matches expected: '${expected_content}'${NC}"
            elif [[ -n "$expected_content" ]]; then
                echo -e "   ${YELLOW}⚠️  PARTIAL${NC} - HTTP $http_code (${time_total}s)"
                echo -e "   ${YELLOW}   Content check failed, but request successful${NC}"
                echo -e "   ${YELLOW}   Expected: '${expected_content}'${NC}"
                echo -e "   ${YELLOW}   Received length: ${#body} characters${NC}"
            else
                echo -e "   ${GREEN}✅ SUCCESS${NC} - HTTP $http_code (${time_total}s)"
            fi
        else
            echo -e "   ${RED}❌ FAILED${NC} - HTTP $http_code (${time_total}s)"
            if [[ "$body" == *"522"* ]]; then
                echo -e "   ${RED}   Error: Connection timeout (522)${NC}"
            elif [[ "$body" == *"530"* ]]; then
                echo -e "   ${RED}   Error: Origin DNS error (530)${NC}"
            elif [[ "$body" == *"404"* ]]; then
                echo -e "   ${RED}   Error: Not found (404)${NC}"
            fi
        fi

        # Show first few lines of response for debugging
        if [[ ${#body} -gt 0 ]] && [[ ${#body} -lt 500 ]]; then
            echo -e "   ${MAGENTA}Response preview:${NC}"
            echo "$body" | head -5 | sed 's/^/      /'
        fi

    else
        echo -e "   ${RED}❌ FAILED${NC} - Connection error"
    fi

    echo
}

# DNS check function
check_dns() {
    local domain="$1"
    echo -e "${CYAN}DNS Check: ${domain}${NC}"

    if dig_result=$(dig +short "$domain" 2>/dev/null); then
        if [[ -n "$dig_result" ]]; then
            echo -e "   ${GREEN}✅ DNS resolves to: ${dig_result}${NC}"
        else
            echo -e "   ${RED}❌ DNS does not resolve${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️  DNS check failed${NC}"
    fi
    echo
}

echo -e "${MAGENTA}=== DNS Resolution Tests ===${NC}"
echo

# Check DNS for all domains and subdomains
environments=("upmplus.dev" "upmplus.io")
subdomains=("api" "app" "dashboard" "admin" "docs" "cdn" "static" "assets")

for env in "${environments[@]}"; do
    check_dns "$env"
    for sub in "${subdomains[@]}"; do
        check_dns "${sub}.${env}"
    done
done

echo -e "${MAGENTA}=== Main Domain Tests ===${NC}"
echo

# Test main domains
test_endpoint "https://upmplus.dev" "Development main site" "UPM.Plus"
test_endpoint "https://upmplus.io" "Staging main site" "UPM.Plus"

echo -e "${MAGENTA}=== API Endpoint Tests ===${NC}"
echo

# Test API endpoints
test_endpoint "https://upmplus.dev/api/health" "API Health" "healthy"
test_endpoint "https://upmplus.io/api/health" "API Health" "healthy"
test_endpoint "https://api.upmplus.dev/api/health" "API Subdomain Health" "healthy"
test_endpoint "https://api.upmplus.io/api/health" "API Subdomain Health" "healthy"

echo -e "${MAGENTA}=== Subdomain Tests ===${NC}"
echo

# Test all subdomains
subdomain_tests=(
    "https://dashboard.upmplus.dev:Dashboard Interface"
    "https://admin.upmplus.dev:Admin Interface"
    "https://docs.upmplus.dev:Documentation"
    "https://cdn.upmplus.dev:CDN Interface"
    "https://static.upmplus.dev:Static Files"
    "https://assets.upmplus.dev:Media Assets"
    "https://app.upmplus.dev:Application"
    "https://dashboard.upmplus.io:Dashboard Interface"
    "https://admin.upmplus.io:Admin Interface"
    "https://docs.upmplus.io:Documentation"
    "https://cdn.upmplus.io:CDN Interface"
    "https://static.upmplus.io:Static Files"
    "https://assets.upmplus.io:Media Assets"
    "https://app.upmplus.io:Application"
)

for test in "${subdomain_tests[@]}"; do
    IFS=':' read -r url description <<< "$test"
    test_endpoint "$url" "$description" "UPM.Plus"
done

echo -e "${MAGENTA}=== API Functionality Tests ===${NC}"
echo

# Test API functionality
api_tests=(
    "https://upmplus.dev/api/agents:Agents List"
    "https://upmplus.dev/api/tasks:Tasks List"
    "https://upmplus.dev/api/analytics:Analytics Data"
    "https://upmplus.dev/api/status:System Status"
    "https://upmplus.io/api/agents:Agents List"
    "https://upmplus.io/api/tasks:Tasks List"
    "https://upmplus.io/api/analytics:Analytics Data"
    "https://upmplus.io/api/status:System Status"
)

for test in "${api_tests[@]}"; do
    IFS=':' read -r url description <<< "$test"
    test_endpoint "$url" "$description" "browser-agent"
done

echo -e "${MAGENTA}=== Worker Configuration Tests ===${NC}"
echo

echo -e "${CYAN}Testing Worker Deployments:${NC}"

# Check worker deployment status
for env in "development" "staging"; do
    echo -e "   Checking ${env} environment..."
    if wrangler deployments list --env "$env" >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Worker deployed for ${env}${NC}"
    else
        echo -e "   ${RED}❌ Worker deployment check failed for ${env}${NC}"
    fi
done

echo
echo -e "${MAGENTA}=== Summary ===${NC}"
echo
echo -e "${BLUE}Test completed at: $(date)${NC}"
echo -e "${BLUE}Total tests run: $((${#environments[@]} * (1 + ${#subdomains[@]}) + ${#subdomain_tests[@]} + ${#api_tests[@]}))${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Review failed tests above"
echo -e "2. Check DNS propagation for failing domains"
echo -e "3. Verify Cloudflare Workers routing configuration"
echo -e "4. Update worker code if subdomain routing is broken"
echo