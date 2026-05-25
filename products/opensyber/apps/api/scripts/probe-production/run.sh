#!/bin/bash
#
# Orchestrator for the production probe suite. Runs probe.sh (latency),
# assert.sh (content), then dashboard.sh (aggregate) and prints the
# dashboard to stdout.
#
# Usage:
#   ./run.sh                  # informational smoke test, always exits 0
#   ./run.sh --fail           # CI-gate mode, exits non-zero on:
#                             #   - any content assertion FAIL
#                             #   - any 5xx in the latency probe
#                             #   - any script invocation failure
#   OUT_DIR=./out ./run.sh    # write results under ./out
#
# Wire it into pushci.yml as a post-deploy verification step:
#
#   deploy:
#     trigger: push
#     run: ./deploy.sh && ./apps/api/scripts/probe-production/run.sh --fail
#     only_on: [main]
#
# Requires: curl, awk, grep, sed (all POSIX).
# No network dependencies beyond the target URLs themselves.
# Safe to run from CI — all outputs are self-contained.

set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export OUT_DIR="${OUT_DIR:-/tmp/opensyber-probe}"
mkdir -p "$OUT_DIR"

FAIL_ON_REGRESSION=0
for arg in "$@"; do
  case "$arg" in
    --fail|--exit-on-failure) FAIL_ON_REGRESSION=1 ;;
    -h|--help)
      sed -n '2,25p' "$0" | sed 's|^# \?||'
      exit 0
      ;;
    *) echo "run.sh: unknown flag: $arg" >&2; exit 2 ;;
  esac
done

echo ">>> [1/3] latency probe (5 runs per endpoint)"
"$SCRIPT_DIR/probe.sh" || { echo "probe.sh failed"; exit 1; }

echo ">>> [2/3] content assertions"
"$SCRIPT_DIR/assert.sh" || { echo "assert.sh failed"; exit 1; }

echo ">>> [3/3] dashboard"
"$SCRIPT_DIR/dashboard.sh" || { echo "dashboard.sh failed"; exit 1; }

echo
cat "$OUT_DIR/dashboard.md"

if [ "$FAIL_ON_REGRESSION" -eq 1 ]; then
  echo
  echo ">>> [gate] checking for regressions"
  fails=$(awk -F'\t' 'NR>1 && $3=="FAIL"' "$OUT_DIR/assertions.tsv" | wc -l | tr -d ' ')
  errors_5xx=$(awk -F'\t' 'NR>1 && $5>=500 && $5<600' "$OUT_DIR/results.tsv" | wc -l | tr -d ' ')
  echo "    assertion failures: $fails"
  echo "    5xx responses:      $errors_5xx"
  if [ "$fails" -gt 0 ] || [ "$errors_5xx" -gt 0 ]; then
    echo
    echo "    GATE FAILED — production probe found regressions. Commit blocked."
    exit 1
  fi
  echo "    GATE PASSED — all assertions green and zero 5xx."
fi
