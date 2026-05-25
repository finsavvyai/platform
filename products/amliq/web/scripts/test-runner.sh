#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AMLIQ v2 — Interactive Test Runner
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

PASS_ICON="✅"
FAIL_ICON="❌"
SKIP_ICON="⏭️ "
RUN_ICON="🚀"
CLOCK_ICON="⏱️ "

WEB_DIR="$(cd "$(dirname "$0")/.." && pwd)"

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║     AMLIQ v2 — Test Runner          ║${RESET}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${RESET}"
  echo ""
}

separator() {
  echo -e "${DIM}──────────────────────────────────────${RESET}"
}

run_vitest() {
  echo -e "\n${RUN_ICON} ${BOLD}Running Component Tests (Vitest)...${RESET}"
  separator
  cd "$WEB_DIR"
  local start=$SECONDS
  if npx vitest run --reporter=verbose 2>&1; then
    local dur=$(( SECONDS - start ))
    echo -e "\n${PASS_ICON} ${GREEN}Component tests passed${RESET} ${CLOCK_ICON}${dur}s"
    return 0
  else
    local dur=$(( SECONDS - start ))
    echo -e "\n${FAIL_ICON} ${RED}Component tests failed${RESET} ${CLOCK_ICON}${dur}s"
    return 1
  fi
}

run_playwright() {
  local project="${1:-all}"
  echo -e "\n${RUN_ICON} ${BOLD}Running E2E Tests (Playwright${project:+ — $project})...${RESET}"
  separator
  cd "$WEB_DIR"

  # Ensure Vite is running
  if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting Vite dev server...${RESET}"
    npx vite --port 5173 &>/tmp/vite-test.log &
    VITE_PID=$!
    for i in $(seq 1 20); do
      curl -s http://localhost:5173 > /dev/null 2>&1 && break
      sleep 1
    done
  fi

  local start=$SECONDS
  local args=(--reporter=list)
  if [ "$project" != "all" ]; then
    args+=(--project="$project")
  fi

  if npx playwright test "${args[@]}" 2>&1; then
    local dur=$(( SECONDS - start ))
    echo -e "\n${PASS_ICON} ${GREEN}E2E tests passed${RESET} ${CLOCK_ICON}${dur}s"
    return 0
  else
    local dur=$(( SECONDS - start ))
    echo -e "\n${FAIL_ICON} ${RED}E2E tests failed${RESET} ${CLOCK_ICON}${dur}s"
    return 1
  fi
}

run_all() {
  local failures=0
  run_vitest || (( failures++ )) || true
  run_playwright "all" || (( failures++ )) || true

  echo ""
  separator
  if [ "$failures" -eq 0 ]; then
    echo -e "${PASS_ICON} ${GREEN}${BOLD}All test suites passed!${RESET}"
  else
    echo -e "${FAIL_ICON} ${RED}${BOLD}$failures suite(s) had failures${RESET}"
  fi
  return "$failures"
}

show_menu() {
  banner
  echo -e "  ${BOLD}1)${RESET} Run all tests"
  echo -e "  ${BOLD}2)${RESET} Component tests (Vitest)"
  echo -e "  ${BOLD}3)${RESET} E2E tests — Desktop (Chromium)"
  echo -e "  ${BOLD}4)${RESET} E2E tests — Mobile"
  echo -e "  ${BOLD}5)${RESET} E2E tests — All browsers"
  echo -e "  ${BOLD}6)${RESET} E2E tests — Headed mode"
  echo -e "  ${BOLD}q)${RESET} Quit"
  echo ""
  echo -ne "  ${CYAN}Pick an option: ${RESET}"
}

interactive() {
  while true; do
    show_menu
    read -r choice
    case "$choice" in
      1) run_all ;;
      2) run_vitest ;;
      3) run_playwright "chromium" ;;
      4) run_playwright "mobile" ;;
      5) run_playwright "all" ;;
      6)
        echo -e "\n${RUN_ICON} ${BOLD}Running E2E headed...${RESET}"
        cd "$WEB_DIR"
        npx playwright test --project=chromium --headed 2>&1
        ;;
      q|Q) echo -e "\n${DIM}Bye!${RESET}"; exit 0 ;;
      *) echo -e "${YELLOW}Invalid choice${RESET}" ;;
    esac
    echo ""
    echo -ne "${DIM}Press Enter to continue...${RESET}"
    read -r
  done
}

# CLI entry point
case "${1:-}" in
  --all)       run_all ;;
  --vitest)    run_vitest ;;
  --e2e)       run_playwright "${2:-all}" ;;
  --help|-h)
    echo "Usage: $0 [--all|--vitest|--e2e [project]|--help]"
    echo "  No args  → interactive menu"
    echo "  --all    → run all suites"
    echo "  --vitest → component tests only"
    echo "  --e2e    → E2E tests (optional: chromium|mobile)"
    ;;
  *)           interactive ;;
esac
