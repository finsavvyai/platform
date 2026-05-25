#!/usr/bin/env bash
# Smoke check: verify public endpoints return 200.
# Runs in the pre-push hook via pushci.yml smoke stage.
# Bypass: `git push --no-verify`.
set -euo pipefail

targets=(
  "https://clawpipe.ai/"
  "https://www.clawpipe.ai/"
  "https://app.clawpipe.ai/"
  "https://docs.clawpipe.ai/"
  "https://play.clawpipe.ai/"
  "https://calc.clawpipe.ai/"
  "https://api.clawpipe.ai/health"
)

fail=0
for url in "${targets[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -L "$url" 2>/dev/null || true)
  [ -z "$code" ] && code="000"
  if [ "$code" = "200" ]; then
    printf "  OK    %-40s  HTTP %s\n" "$url" "$code"
  else
    printf "  FAIL  %-40s  HTTP %s\n" "$url" "$code"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Reachability smoke failed. Fix prod or bypass with: git push --no-verify"
  exit 1
fi
