#!/bin/bash
# Unified cross-language test runner for FinSavvyAI
# Runs: Python (pytest), JS (vitest), Go, Node.js (node:test), Playwright E2E

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

PYTHON_BIN="${FINSAVVYAI_PYTHON:-python3}"
if [ -z "${FINSAVVYAI_PYTHON:-}" ] && [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi

RUN_E2E="${RUN_E2E:-0}"
RUN_PYTHON="${RUN_PYTHON:-1}"
RUN_CF="${RUN_CF:-1}"
RUN_GO="${RUN_GO:-1}"
RUN_NODE="${RUN_NODE:-1}"

run_suite() {
    local name="$1"
    local cmd="$2"
    echo -e "\n${BLUE}--- $name ---${NC}"
    if eval "$cmd"; then
        echo -e "${GREEN}PASS: $name${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL: $name${NC}"
        FAILED=$((FAILED + 1))
    fi
}

skip_suite() {
    local name="$1"
    local reason="$2"
    echo -e "\n${YELLOW}SKIP: $name ($reason)${NC}"
    SKIPPED=$((SKIPPED + 1))
}

echo -e "${BLUE}FinSavvyAI Full Test Suite${NC}"
echo "=========================="
echo ""

# 1. Python unit tests
if [ "$RUN_PYTHON" = "1" ]; then
    if command -v "$PYTHON_BIN" &>/dev/null; then
        run_suite "Python unit tests (pytest)" \
            "\"$PYTHON_BIN\" -m pytest tests/ --maxfail=5 --disable-warnings -q"
    else
        skip_suite "Python unit tests" "python3 not found"
    fi
else
    skip_suite "Python unit tests" "RUN_PYTHON=0"
fi

# 2. Cloudflare Worker tests
if [ "$RUN_CF" = "1" ]; then
    if [ -d "$REPO_ROOT/cloudflare-api" ]; then
        run_suite "Cloudflare Worker tests (vitest)" \
            "bash \"$SCRIPT_DIR/test-cf-worker.sh\""
    else
        skip_suite "Cloudflare Worker tests" "cloudflare-api/ not found"
    fi
else
    skip_suite "Cloudflare Worker tests" "RUN_CF=0"
fi

# 3. Go Desktop App tests
if [ "$RUN_GO" = "1" ]; then
    if [ -d "$REPO_ROOT/desktop-app/src-go" ] && command -v go &>/dev/null; then
        run_suite "Go Desktop App tests" \
            "bash \"$SCRIPT_DIR/test-desktop.sh\""
    else
        skip_suite "Go Desktop App tests" "go or desktop-app/src-go/ not found"
    fi
else
    skip_suite "Go Desktop App tests" "RUN_GO=0"
fi

# 4. Control Hub Node.js tests
if [ "$RUN_NODE" = "1" ]; then
    if [ -d "$REPO_ROOT/packages/control-hub-node" ] && command -v node &>/dev/null; then
        run_suite "Control Hub Node.js tests" \
            "bash \"$SCRIPT_DIR/test-control-hub.sh\""
    else
        skip_suite "Control Hub Node.js tests" "node or packages/control-hub-node/ not found"
    fi
else
    skip_suite "Control Hub Node.js tests" "RUN_NODE=0"
fi

# 5. Playwright E2E tests (opt-in)
if [ "$RUN_E2E" = "1" ]; then
    if command -v npx &>/dev/null; then
        run_suite "Playwright E2E tests" \
            "npx playwright test --config=tests/playwright.config.js"
    else
        skip_suite "Playwright E2E tests" "npx not found"
    fi
else
    skip_suite "Playwright E2E tests" "RUN_E2E=0 (set RUN_E2E=1 to enable)"
fi

# Summary
echo ""
echo -e "${BLUE}=============================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}=============================${NC}"
echo -e "${GREEN}Passed : $PASSED${NC}"
echo -e "${RED}Failed : $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All executed test suites passed.${NC}"
    exit 0
else
    echo -e "${RED}$FAILED suite(s) failed.${NC}"
    exit 1
fi
