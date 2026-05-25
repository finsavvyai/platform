#!/usr/bin/env bash
# LunaOS Lighthouse Performance Audit
# Runs Lighthouse against all LunaOS web products and checks score thresholds.
# Usage: ./lighthouse-audit.sh [--mobile] [--threshold 90]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/lighthouse-config.json"
RESULTS_DIR="${SCRIPT_DIR}/lighthouse-results"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
THRESHOLD=90
FORM_FACTOR="desktop"
EXIT_CODE=0

URLS=(
  "https://lunaos.ai"
  "https://agents.lunaos.ai"
  "https://studio.lunaos.ai"
  "https://docs.lunaos.ai"
)

LABELS=(
  "marketing"
  "dashboard"
  "studio"
  "docs"
)

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --mobile       Run audits with mobile emulation"
  echo "  --threshold N  Minimum score (0-100) for pass (default: 90)"
  echo "  --url URL      Audit a single URL instead of all products"
  echo "  --help         Show this help message"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mobile)    FORM_FACTOR="mobile"; shift ;;
    --threshold) THRESHOLD="$2"; shift 2 ;;
    --url)       URLS=("$2"); LABELS=("custom"); shift 2 ;;
    --help)      usage; exit 0 ;;
    *)           echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

check_dependencies() {
  if ! command -v npx &>/dev/null; then
    echo "ERROR: npx not found. Install Node.js 20+."
    exit 1
  fi
  if ! npx lighthouse --version &>/dev/null; then
    echo "Installing lighthouse..."
    npm install -g lighthouse
  fi
}

setup_results_dir() {
  mkdir -p "${RESULTS_DIR}"
  echo "Results will be saved to: ${RESULTS_DIR}"
}

run_audit() {
  local url="$1"
  local label="$2"
  local output_path="${RESULTS_DIR}/${label}_${FORM_FACTOR}_${TIMESTAMP}"

  echo ""
  echo "Auditing: ${url} (${FORM_FACTOR})"
  echo "-------------------------------------------"

  local form_factor_flag="--preset=desktop"
  if [[ "${FORM_FACTOR}" == "mobile" ]]; then
    form_factor_flag=""
  fi

  npx lighthouse "${url}" \
    --config-path="${CONFIG_FILE}" \
    --output=json \
    --output=html \
    --output-path="${output_path}" \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
    ${form_factor_flag} \
    --quiet \
    2>/dev/null || {
      echo "WARN: Lighthouse failed for ${url}. Site may be unreachable."
      echo "{\"unreachable\": true, \"url\": \"${url}\"}" > "${output_path}.report.json"
      return 1
    }

  echo "Saved: ${output_path}.report.json"
  echo "Saved: ${output_path}.report.html"
  return 0
}

extract_score() {
  local json_file="$1"
  local category="$2"
  if [[ ! -f "${json_file}" ]]; then
    echo "0"
    return
  fi
  local score
  score=$(node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('${json_file}', 'utf8'));
    if (data.unreachable) { console.log('N/A'); process.exit(0); }
    const cat = data.categories?.['${category}'];
    console.log(cat ? Math.round(cat.score * 100) : 'N/A');
  " 2>/dev/null || echo "N/A")
  echo "${score}"
}

check_threshold() {
  local score="$1"
  local category="$2"
  local label="$3"
  if [[ "${score}" == "N/A" ]]; then
    return 1
  fi
  if (( score < THRESHOLD )); then
    echo "FAIL: ${label} ${category} score ${score} < ${THRESHOLD}"
    return 1
  fi
  return 0
}

print_summary() {
  echo ""
  echo "============================================="
  echo " LunaOS Lighthouse Audit Summary"
  echo " Date: $(date '+%Y-%m-%d %H:%M:%S')"
  echo " Mode: ${FORM_FACTOR} | Threshold: ${THRESHOLD}"
  echo "============================================="
  printf "%-12s %-6s %-6s %-6s %-6s %-8s\n" \
    "Product" "Perf" "A11y" "BP" "SEO" "Status"
  echo "---------------------------------------------"

  local all_pass=true

  for i in "${!LABELS[@]}"; do
    local label="${LABELS[$i]}"
    local json="${RESULTS_DIR}/${label}_${FORM_FACTOR}_${TIMESTAMP}.report.json"

    local perf; perf=$(extract_score "${json}" "performance")
    local a11y; a11y=$(extract_score "${json}" "accessibility")
    local bp;   bp=$(extract_score "${json}" "best-practices")
    local seo;  seo=$(extract_score "${json}" "seo")

    local status="PASS"
    for pair in "performance:${perf}" "accessibility:${a11y}" "best-practices:${bp}" "seo:${seo}"; do
      local cat="${pair%%:*}"
      local val="${pair##*:}"
      if ! check_threshold "${val}" "${cat}" "${label}" 2>/dev/null; then
        status="FAIL"
        all_pass=false
      fi
    done

    printf "%-12s %-6s %-6s %-6s %-6s %-8s\n" \
      "${label}" "${perf}" "${a11y}" "${bp}" "${seo}" "${status}"
  done

  echo "============================================="

  if [[ "${all_pass}" == "false" ]]; then
    echo "RESULT: Some products did not meet the ${THRESHOLD}+ threshold."
    EXIT_CODE=1
  else
    echo "RESULT: All products meet the ${THRESHOLD}+ threshold."
  fi

  echo ""
  echo "Full reports: ${RESULTS_DIR}/"
}

main() {
  echo "LunaOS Lighthouse Audit"
  echo "======================="
  check_dependencies
  setup_results_dir

  for i in "${!URLS[@]}"; do
    run_audit "${URLS[$i]}" "${LABELS[$i]}" || true
  done

  print_summary
  exit "${EXIT_CODE}"
}

main
