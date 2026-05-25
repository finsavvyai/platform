#!/bin/bash

# SDLC.ai - Automated Test and Deploy Script
# Run this before any deployment or launch

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                                                                    ║"
echo "║         🧪 SDLC.ai - Automated Testing & Deployment 🧪            ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│  Step 1: Running PII Detection Tests                              │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""

cd /Users/shaharsolomon/dev/projects/sdlc-platform

if npx tsx services/proxy-worker/src/pii-detector.test.ts > /tmp/pii-test.log 2>&1; then
    PASSED=$(grep -o "Passed: [0-9]*" /tmp/pii-test.log | grep -o "[0-9]*")
    print_status 0 "PII Detection Tests ($PASSED/25 passed)"
else
    print_status 1 "PII Detection Tests"
    cat /tmp/pii-test.log
fi

echo ""
echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│  Step 2: Running Rate Limiter Tests                               │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""

if npx tsx services/proxy-worker/src/rate-limiter.test.ts > /tmp/rate-test.log 2>&1; then
    PASSED=$(grep -o "Passed: [0-9]*" /tmp/rate-test.log | grep -o "[0-9]*")
    print_status 0 "Rate Limiter Tests ($PASSED/17 passed)"
else
    print_status 1 "Rate Limiter Tests"
    cat /tmp/rate-test.log
fi

echo ""
echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│  Step 3: Testing Live Deployments                                 │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""

# Test landing page
if curl -s -I https://sdlc-landing-page.pages.dev | grep -q "HTTP/2 200"; then
    print_status 0 "Landing page accessible (sdlc-landing-page.pages.dev)"
else
    print_status 1 "Landing page accessible"
fi

# Test investor page
if curl -s -I https://investors.opensyber.io | grep -q "HTTP/2 200"; then
    print_status 0 "Investor page accessible (investors.opensyber.io)"
else
    print_status 1 "Investor page accessible"
fi

# Test SEO meta tags
if curl -s https://sdlc-landing-page.pages.dev | grep -q "SDLC.ai - Enterprise AI Compliance"; then
    print_status 0 "SEO meta tags present"
else
    print_status 1 "SEO meta tags present"
fi

# Test Open Graph tags
if curl -s https://sdlc-landing-page.pages.dev | grep -q "og:title"; then
    print_status 0 "Open Graph tags present"
else
    print_status 1 "Open Graph tags present"
fi

# Test Schema.org structured data
if curl -s https://sdlc-landing-page.pages.dev | grep -q "schema.org"; then
    print_status 0 "Schema.org structured data present"
else
    print_status 1 "Schema.org structured data present"
fi

echo ""
echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│  Step 4: Verifying Social Media Content                           │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""

# Check social media posts exist
if [ -f "social-media-posts/hackernews-post.txt" ]; then
    print_status 0 "Hacker News post ready"
else
    print_status 1 "Hacker News post ready"
fi

if [ -f "social-media-posts/linkedin-post.txt" ]; then
    print_status 0 "LinkedIn post ready"
else
    print_status 1 "LinkedIn post ready"
fi

if [ -f "social-media-posts/reddit-machinelearning.txt" ]; then
    print_status 0 "Reddit posts ready"
else
    print_status 1 "Reddit posts ready"
fi

echo ""
echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│  Step 5: Checking Documentation                                   │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""

# Check key documentation files
DOCS=(
    "LAUNCH_CHECKLIST_TOMORROW.md"
    "PRODUCT_INTRODUCTION_QUICK_GUIDE.md"
    "PRODUCT_TEST_RESULTS.md"
    "README_START_HERE.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        print_status 0 "$doc exists"
    else
        print_status 1 "$doc exists"
    fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                                                                    ║"
echo "║                    📊 TEST RESULTS SUMMARY                         ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total Tests:  $TOTAL_TESTS"
echo -e "  ${GREEN}Passed:       $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed:       $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    SUCCESS_RATE="100.0"
else
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($TESTS_PASSED/$TOTAL_TESTS)*100}")
fi

echo "  Success Rate: ${SUCCESS_RATE}%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                    ║"
    echo "║              ✅ ALL TESTS PASSED - READY TO LAUNCH! ✅            ║"
    echo "║                                                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Read LAUNCH_CHECKLIST_TOMORROW.md"
    echo "   2. Post on Hacker News tomorrow at 8-10am PST"
    echo "   3. URL: https://sdlc-landing-page.pages.dev"
    echo ""
    exit 0
else
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                    ║"
    echo "║              ⚠️  SOME TESTS FAILED - REVIEW NEEDED ⚠️             ║"
    echo "║                                                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Please review failed tests above and fix issues before launching."
    echo ""
    exit 1
fi
