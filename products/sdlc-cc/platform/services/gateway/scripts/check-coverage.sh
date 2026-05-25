#!/bin/bash
# Fail if total Go coverage falls below the given threshold percentage.
# Usage: check-coverage.sh <coverage.out> <min-percent>

set -euo pipefail

COVERAGE_FILE="${1:-coverage.out}"
THRESHOLD="${2:-90.0}"

if [ ! -f "$COVERAGE_FILE" ]; then
  echo "ERROR: coverage file not found: $COVERAGE_FILE" >&2
  exit 2
fi

TOTAL=$(go tool cover -func="$COVERAGE_FILE" | tail -1 | awk '{print $3}' | tr -d '%')

if [ -z "$TOTAL" ]; then
  echo "ERROR: could not parse coverage from $COVERAGE_FILE" >&2
  exit 2
fi

PASS=$(awk -v t="$TOTAL" -v th="$THRESHOLD" 'BEGIN { print (t+0 >= th+0) ? "1" : "0" }')

if [ "$PASS" = "1" ]; then
  printf "Coverage %.1f%% meets threshold %.1f%%\n" "$TOTAL" "$THRESHOLD"
  exit 0
fi

printf "FAIL: coverage %.1f%% below threshold %.1f%%\n" "$TOTAL" "$THRESHOLD" >&2
echo "Top uncovered functions:" >&2
go tool cover -func="$COVERAGE_FILE" | sort -k 3 -n | head -20 >&2
exit 1
