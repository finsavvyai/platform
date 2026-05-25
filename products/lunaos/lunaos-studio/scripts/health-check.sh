#!/bin/bash

# Health Check Script for Luna Studio
# This script performs comprehensive health checks after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_URL="${1:-https://studio.lunaos.ai}"
MAX_RETRIES=5
RETRY_DELAY=10
TIMEOUT=30

echo "🏥 Starting health checks for: $DEPLOY_URL"
echo "================================================"

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to retry with exponential backoff
retry_with_backoff() {
    local max_attempts=$1
    shift
    local attempt=1
    local delay=$RETRY_DELAY

    while [ $attempt -le $max_attempts ]; do
        if "$@"; then
            return 0
        fi

        if [ $attempt -lt $max_attempts ]; then
            echo -e "${YELLOW}⚠${NC} Attempt $attempt failed. Retrying in ${delay}s..."
            sleep $delay
            delay=$((delay * 2))
        fi
        attempt=$((attempt + 1))
    done

    return 1
}

# Test 1: HTTP Status Check
echo ""
echo "Test 1: HTTP Status Check"
echo "-------------------------"
http_check() {
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DEPLOY_URL")
    if [ "$HTTP_CODE" -eq 200 ]; then
        return 0
    else
        echo "HTTP Status: $HTTP_CODE (expected 200)"
        return 1
    fi
}

if retry_with_backoff $MAX_RETRIES http_check; then
    print_status 0 "Site is accessible (HTTP 200)"
else
    print_status 1 "Site is not accessible"
    exit 1
fi

# Test 2: Response Time Check
echo ""
echo "Test 2: Response Time Check"
echo "---------------------------"
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$DEPLOY_URL")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)
RESPONSE_TIME_INT=${RESPONSE_TIME_MS%.*}

if [ "$RESPONSE_TIME_INT" -lt 5000 ]; then
    print_status 0 "Response time: ${RESPONSE_TIME_INT}ms (< 5000ms)"
else
    print_status 1 "Response time: ${RESPONSE_TIME_INT}ms (>= 5000ms)"
    echo -e "${YELLOW}⚠${NC} Warning: Slow response time detected"
fi

# Test 3: Content Check
echo ""
echo "Test 3: Content Check"
echo "---------------------"
content_check() {
    CONTENT=$(curl -s --max-time $TIMEOUT "$DEPLOY_URL")
    
    # Check for critical content
    if echo "$CONTENT" | grep -q "LunaOS"; then
        return 0
    else
        echo "Expected content not found"
        return 1
    fi
}

if retry_with_backoff 3 content_check; then
    print_status 0 "Expected content found"
else
    print_status 1 "Expected content not found"
    exit 1
fi

# Test 4: JavaScript Loading Check
echo ""
echo "Test 4: JavaScript Loading Check"
echo "---------------------------------"
js_check() {
    CONTENT=$(curl -s --max-time $TIMEOUT "$DEPLOY_URL")
    
    # Check for script tags
    if echo "$CONTENT" | grep -q "<script"; then
        return 0
    else
        echo "No script tags found"
        return 1
    fi
}

if retry_with_backoff 3 js_check; then
    print_status 0 "JavaScript files are referenced"
else
    print_status 1 "JavaScript files not found"
    exit 1
fi

# Test 5: CSS Loading Check
echo ""
echo "Test 5: CSS Loading Check"
echo "-------------------------"
css_check() {
    CONTENT=$(curl -s --max-time $TIMEOUT "$DEPLOY_URL")
    
    # Check for style tags or link tags
    if echo "$CONTENT" | grep -q -E "<style|<link.*stylesheet"; then
        return 0
    else
        echo "No CSS found"
        return 1
    fi
}

if retry_with_backoff 3 css_check; then
    print_status 0 "CSS files are referenced"
else
    print_status 1 "CSS files not found"
    echo -e "${YELLOW}⚠${NC} Warning: CSS may not be loading"
fi

# Test 6: Security Headers Check
echo ""
echo "Test 6: Security Headers Check"
echo "------------------------------"
HEADERS=$(curl -s -I --max-time $TIMEOUT "$DEPLOY_URL")

check_header() {
    local header=$1
    if echo "$HEADERS" | grep -qi "$header"; then
        print_status 0 "$header header present"
        return 0
    else
        print_status 1 "$header header missing"
        return 1
    fi
}

SECURITY_PASS=0
check_header "X-Frame-Options" || SECURITY_PASS=1
check_header "X-Content-Type-Options" || SECURITY_PASS=1
check_header "Content-Security-Policy" || SECURITY_PASS=1
check_header "Strict-Transport-Security" || SECURITY_PASS=1

if [ $SECURITY_PASS -eq 1 ]; then
    echo -e "${YELLOW}⚠${NC} Warning: Some security headers are missing"
fi

# Test 7: HTTPS Check
echo ""
echo "Test 7: HTTPS Check"
echo "-------------------"
if [[ "$DEPLOY_URL" == https://* ]]; then
    print_status 0 "Using HTTPS"
else
    print_status 1 "Not using HTTPS"
    echo -e "${YELLOW}⚠${NC} Warning: Site should use HTTPS in production"
fi

# Test 8: Asset Loading Check
echo ""
echo "Test 8: Asset Loading Check"
echo "---------------------------"
asset_check() {
    # Check if assets directory is accessible
    ASSET_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DEPLOY_URL/assets/")
    
    # 200 (accessible) or 403 (forbidden but exists) are both acceptable
    if [ "$ASSET_CODE" -eq 200 ] || [ "$ASSET_CODE" -eq 403 ]; then
        return 0
    else
        echo "Assets directory status: $ASSET_CODE"
        return 1
    fi
}

if retry_with_backoff 3 asset_check; then
    print_status 0 "Assets directory exists"
else
    print_status 1 "Assets directory not found"
    echo -e "${YELLOW}⚠${NC} Warning: Assets may not be deployed correctly"
fi

# Test 9: Favicon Check
echo ""
echo "Test 9: Favicon Check"
echo "---------------------"
FAVICON_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DEPLOY_URL/favicon.ico")
if [ "$FAVICON_CODE" -eq 200 ]; then
    print_status 0 "Favicon is accessible"
else
    print_status 1 "Favicon not found (HTTP $FAVICON_CODE)"
    echo -e "${YELLOW}⚠${NC} Warning: Favicon may be missing"
fi

# Test 10: Compression Check
echo ""
echo "Test 10: Compression Check"
echo "--------------------------"
ENCODING=$(curl -s -I -H "Accept-Encoding: gzip, deflate, br" --max-time $TIMEOUT "$DEPLOY_URL" | grep -i "content-encoding")
if echo "$ENCODING" | grep -qi "gzip\|br\|deflate"; then
    print_status 0 "Compression enabled: $ENCODING"
else
    print_status 1 "Compression not detected"
    echo -e "${YELLOW}⚠${NC} Warning: Compression should be enabled for better performance"
fi

# Summary
echo ""
echo "================================================"
echo "🏥 Health Check Summary"
echo "================================================"
echo "URL: $DEPLOY_URL"
echo "Response Time: ${RESPONSE_TIME_INT}ms"
echo "HTTP Status: 200 OK"
echo ""
echo -e "${GREEN}✓ All critical health checks passed!${NC}"
echo ""

exit 0
