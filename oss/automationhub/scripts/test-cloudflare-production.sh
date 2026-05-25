#!/bin/bash
# Automated Cloudflare production smoke tests.
# Usage: ./test-cloudflare-production.sh [BASE_URL...]
#   BASE_URL defaults to CLOUDFLARE_PRODUCTION_URL or https://upm.plus
# Env: CLOUDFLARE_PRODUCTION_URL, CLOUDFLARE_TEST_RETRIES (default 3), CLOUDFLARE_TEST_INTERVAL (default 15)
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

RETRIES="${CLOUDFLARE_TEST_RETRIES:-3}"
INTERVAL="${CLOUDFLARE_TEST_INTERVAL:-15}"
PATHS="/health /api/health"
FAILED=0

test_url() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo -e "${GREEN}OK${NC} $code $url"
    return 0
  fi
  echo -e "${RED}FAIL${NC} $code $url"
  return 1
}

test_base() {
  local base="$1"
  local path path_fail=0
  echo -e "${CYAN}Testing: $base${NC}"
  for path in $PATHS; do
    if ! test_url "${base}${path}"; then
      path_fail=1
      FAILED=1
    fi
  done
  return $path_fail
}

run_with_retries() {
  local bases=("$@")
  local attempt=1
  while [ $attempt -le "$RETRIES" ]; do
    echo ""
    echo -e "${CYAN}=== Attempt $attempt/$RETRIES ===${NC}"
    FAILED=0
    for base in "${bases[@]}"; do
      test_base "$base" || true
    done
    [ $FAILED -eq 0 ] && return 0
    if [ $attempt -lt "$RETRIES" ]; then
      echo -e "${YELLOW}Waiting ${INTERVAL}s before retry...${NC}"
      sleep "$INTERVAL"
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

# Resolve bases: args, or env, or default
DEFAULT_BASE="${CLOUDFLARE_PRODUCTION_URL:-https://upm.plus}"
if [ $# -gt 0 ]; then
  BASES=("$@")
else
  BASES=("$DEFAULT_BASE" "https://upmplus.dev")
fi

# Pass if at least one base passes all paths (unreachable domains don't fail the run)
echo "Cloudflare production smoke test"
echo "Bases: ${BASES[*]} | Retries: $RETRIES | Interval: ${INTERVAL}s"
run_with_retries "${BASES[@]}" && exit 0
echo ""
echo -e "${YELLOW}One or more bases failed (e.g. DNS unreachable). Checking if any base passed...${NC}"
# Final attempt: at least one base has /api/health 200 and /health 200 or 503 (degraded OK)
PASSED=0
for base in "${BASES[@]}"; do
  c1=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "${base}/health" 2>/dev/null || echo "000")
  c2=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "${base}/api/health" 2>/dev/null || echo "000")
  if [ "$c2" = "200" ] && { [ "$c1" = "200" ] || [ "$c1" = "503" ]; }; then
    PASSED=1
    echo -e "${GREEN}At least one base OK: $base${NC}"
    break
  fi
done
if [ "$PASSED" -eq 1 ]; then
  echo -e "${GREEN}Production smoke test passed (at least one domain healthy).${NC}"
  exit 0
fi
echo -e "${RED}All bases failed.${NC}"
exit 1
