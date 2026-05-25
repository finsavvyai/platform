#!/bin/bash
# LunaOS Smoke Test — validates all subdomains are live and healthy
# Run: ./scripts/smoke-test.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"

    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    if [ "$status" = "$expected_status" ]; then
        echo -e "  ${GREEN}PASS${NC} $name ($url) → $status"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $name ($url) → $status (expected $expected_status)"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "🌙 LunaOS Smoke Test"
echo "━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Subdomains:"
check "Marketing"      "https://lunaos.ai"
check "API Health"     "https://api.lunaos.ai/health"
check "Dashboard"      "https://agents.lunaos.ai"
check "Studio"         "https://studio.lunaos.ai"
check "Docs"           "https://docs.lunaos.ai"

echo ""
echo "API Endpoints:"
check "API Root"       "https://api.lunaos.ai/"
check "Auth (401)"     "https://api.lunaos.ai/auth/me"               "401"
check "Billing (401)"  "https://api.lunaos.ai/billing/subscription"   "401"
check "Agents List"    "https://api.lunaos.ai/agents/list"
check "404 Handler"    "https://api.lunaos.ai/nonexistent"            "404"

echo ""
echo "Security Headers:"
HEADERS=$(curl -s -I --max-time 10 "https://api.lunaos.ai/health" 2>/dev/null)

for header in "strict-transport-security" "x-content-type-options" "x-frame-options"; do
    if echo "$HEADERS" | grep -qi "$header"; then
        echo -e "  ${GREEN}PASS${NC} $header present"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $header missing"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "DNS & SSL:"
for domain in lunaos.ai api.lunaos.ai agents.lunaos.ai studio.lunaos.ai docs.lunaos.ai; do
    if curl -s --max-time 5 "https://$domain" -o /dev/null 2>/dev/null; then
        echo -e "  ${GREEN}PASS${NC} $domain SSL valid"
        PASS=$((PASS + 1))
    else
        echo -e "  ${YELLOW}SKIP${NC} $domain (not reachable)"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━"
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}Some checks failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All checks passed!${NC}"
fi
