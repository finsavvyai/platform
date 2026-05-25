#!/usr/bin/env bash
# demo.sh — Simulates PushCI CLI output with ANSI colors
# Usage: bash demo.sh | Record with asciinema or terminalizer

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
RESET='\033[0m'

slow_type() {
  local text="$1"
  printf "${CYAN}\$ ${RESET}"
  for ((i = 0; i < ${#text}; i++)); do
    printf "%s" "${text:$i:1}"
    sleep 0.04
  done
  printf "\n"
  sleep 0.5
}

step() { printf "  ${GREEN}%s${RESET} %s\n" "$1" "$2"; sleep 0.3; }
header() {
  printf "\n${BOLD}${WHITE}"
  printf '═%.0s' {1..35}
  printf "\n  %s\n" "$1"
  printf '═%.0s' {1..35}
  printf "${RESET}\n\n"
  sleep 0.4
}

# --- pushci init ---
slow_type "pushci init"
printf "Scanning project...\n"
sleep 0.6
step "✓" "Detected 3 service(s):"
printf "    ${BOLD}●${RESET} go ${DIM}(.)${RESET}\n"
printf "    ${BOLD}●${RESET} node ${DIM}(web/)${RESET}\n"
printf "    ${BOLD}●${RESET} docker ${DIM}(.)${RESET}\n"
sleep 0.3
step "✓" "Created pushci.yml"
step "✓" "Installed git hooks"
sleep 1

# --- pushci run ---
printf "\n"
slow_type "pushci run"
header "PushCI CI Pipeline"

steps=("Building Go" "Testing Go" "TypeScript check" "Running vitest")
times=("1.2s" "3.4s" "2.1s" "12.3s")
for i in "${!steps[@]}"; do
  n=$((i + 1))
  printf "  ${DIM}[%d/4]${RESET} ● %-22s" "$n" "${steps[$i]}..."
  sleep 0.8
  printf "${GREEN}✓${RESET} ${DIM}(%s)${RESET}\n" "${times[$i]}"
done

header "✓ CI PASSED (19.0s)"
sleep 1

# --- pushci doctor ---
slow_type "pushci doctor"
tools=("git" "go" "node" "docker" ".git" "pushci.yml" "hooks")
versions=("v2.43.0" "v1.22.0" "v20.11.0" "v25.0.3" "found" "found" "installed")
for i in "${!tools[@]}"; do
  printf "  ${GREEN}✓${RESET} %-14s %s\n" "${tools[$i]}" "${versions[$i]}"
  sleep 0.2
done
printf "\n  ${GREEN}${BOLD}7/7 checks passed${RESET}\n"
