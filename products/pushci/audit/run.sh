#!/usr/bin/env bash
# audit/run.sh — rerunnable PushCI audit harness.
#
# Runs every check under audit/checks/*.sh, writes JSON results to
# audit/results/summary.json, prints a table, and exits non-zero if
# any check failed. Idempotent: safe to run locally or in CI.
#
# Usage:
#   bash audit/run.sh                # run all checks
#   bash audit/run.sh cli            # run only checks/cli.sh
#   CHECKS="cli promises" bash audit/run.sh
#
# Env:
#   PUSHCI       override binary path (default: autodetect)
#   PUSHCI_LIVE  if "1", include live-site network checks (requires egress)
#   AUDIT_JSON   path to summary JSON (default: audit/results/summary.json)
set -u
set -o pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo"

CHECKS_DIR="$repo/audit/checks"
RESULTS_DIR="$repo/audit/results"
mkdir -p "$RESULTS_DIR"
SUMMARY="${AUDIT_JSON:-$RESULTS_DIR/summary.json}"

# Autodetect pushci binary
if [ -z "${PUSHCI:-}" ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64)  PUSHCI="$repo/bin/pushci-darwin-arm64" ;;
    Darwin-x86_64) PUSHCI="$repo/bin/pushci-darwin-amd64" ;;
    Linux-aarch64|Linux-arm64) PUSHCI="$repo/bin/pushci-linux-arm64" ;;
    Linux-x86_64)  PUSHCI="$repo/bin/pushci-linux-amd64" ;;
    *) PUSHCI="$repo/pushci" ;;
  esac
fi
export PUSHCI
chmod +x "$PUSHCI" 2>/dev/null || true

# Ensure basics
if [ ! -x "$PUSHCI" ]; then
  echo "FATAL: pushci binary not found or not executable at $PUSHCI" >&2
  exit 2
fi

checks="${CHECKS:-${1:-}}"
if [ -z "$checks" ]; then
  checks="$(ls "$CHECKS_DIR" | sed 's/\.sh$//' | tr '\n' ' ')"
fi

pass=0; fail=0; skip=0
declare -a rows=()
start_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for name in $checks; do
  f="$CHECKS_DIR/$name.sh"
  if [ ! -f "$f" ]; then
    echo "skip: no such check '$name'"
    continue
  fi
  tstart=$(date +%s)
  printf "[run] %-14s ... " "$name"
  out="$(bash "$f" 2>&1)"
  rc=$?
  tend=$(date +%s); dur=$((tend - tstart))
  if [ $rc -eq 0 ]; then
    printf "PASS (%ss)\n" "$dur"
    pass=$((pass + 1))
    status="pass"
  elif [ $rc -eq 77 ]; then
    # 77 = skipped (POSIX-style convention)
    printf "SKIP (%ss)\n" "$dur"
    skip=$((skip + 1))
    status="skip"
  else
    printf "FAIL (rc=%d, %ss)\n" "$rc" "$dur"
    fail=$((fail + 1))
    status="fail"
  fi
  # Capture log for JSON summary
  log_file="$RESULTS_DIR/${name}.log"
  printf "%s\n" "$out" > "$log_file"
  rows+=("{\"name\":\"$name\",\"status\":\"$status\",\"rc\":$rc,\"duration_s\":$dur,\"log\":\"audit/results/${name}.log\"}")
done

end_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
total=$((pass + fail + skip))

# Build JSON summary
{
  printf '{\n'
  printf '  "started_at": "%s",\n' "$start_ts"
  printf '  "ended_at": "%s",\n' "$end_ts"
  printf '  "pushci_binary": "%s",\n' "$PUSHCI"
  printf '  "pushci_version": "%s",\n' "$("$PUSHCI" --version 2>/dev/null | tr -d '\n')"
  printf '  "totals": {"pass":%d,"fail":%d,"skip":%d,"total":%d},\n' "$pass" "$fail" "$skip" "$total"
  printf '  "checks": [\n'
  IFS=','; printf '    %s\n' "${rows[*]}"; IFS=$' \t\n'
  printf '  ]\n'
  printf '}\n'
} > "$SUMMARY"

echo
echo "Results: pass=$pass fail=$fail skip=$skip  (summary: $SUMMARY)"
[ $fail -eq 0 ]
