#!/bin/bash
# Test Cloudflare Worker using wrangler dev (no production DNS needed).
# Usage: ./test-cloudflare-wrangler.sh [env]
#   env: production (default), development, staging, ai-production
# Env: CLOUDFLARE_DEV_REMOTE=1 to use --remote (requires preview KV/D1 for that env)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV="${1:-production}"
# Default 8787; set CLOUDFLARE_DEV_PORT if you need another port
PORT="${CLOUDFLARE_DEV_PORT:-8787}"
BASE="http://localhost:${PORT}"
RETRIES=30
RETRY_INTERVAL=2
REMOTE_FLAG=""
[[ -n "${CLOUDFLARE_DEV_REMOTE}" ]] && REMOTE_FLAG="--remote"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Free default ports if in use (stale workerd from previous runs)
for p in 8787 8790; do
  PIDS=$(lsof -t -i ":$p" 2>/dev/null) || true
  if [[ -n "$PIDS" ]]; then
    echo -e "${YELLOW}Killing process(es) on port ${p}: ${PIDS}${NC}"
    kill $PIDS 2>/dev/null || true
    sleep 1
  fi
done

echo -e "${CYAN}Cloudflare Worker test via wrangler (env=${ENV})${NC}"
echo -e "${CYAN}Starting wrangler dev ${REMOTE_FLAG} --env ${ENV} on port ${PORT}...${NC}"

# Start wrangler dev in background
(cd "$PROJECT_DIR" && npx wrangler dev $REMOTE_FLAG --env "$ENV" --port "$PORT") &
WRANGLER_PID=$!

cleanup() {
  kill "$WRANGLER_PID" 2>/dev/null || true
  wait "$WRANGLER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for dev server to be ready (must get 200 or 503 from worker)
echo -e "${YELLOW}Waiting for worker to be ready on ${BASE}...${NC}"
for i in $(seq 1 "$RETRIES"); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "${BASE}/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "503" ]; then
    echo -e "${GREEN}Worker ready (${code}).${NC}"
    sleep 2
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo -e "${RED}Worker did not become ready in time (last code: ${code}).${NC}"
    exit 1
  fi
  sleep "$RETRY_INTERVAL"
done

# Smoke test: 200 = healthy, 503 = worker up but unhealthy (e.g. local D1/KV)
FAILED=0
for path in /health /api/health; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${BASE}${path}" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo -e "${GREEN}OK${NC} $code ${BASE}${path}"
  elif [ "$code" = "503" ]; then
    echo -e "${YELLOW}OK (degraded)${NC} $code ${BASE}${path}"
  else
    echo -e "${RED}FAIL${NC} $code ${BASE}${path}"
    FAILED=1
  fi
done

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}Wrangler smoke test passed.${NC}"
  exit 0
fi
echo -e "${RED}Wrangler smoke test failed.${NC}"
exit 1
