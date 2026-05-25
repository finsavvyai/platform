#!/usr/bin/env bash
# Tail logs for all clawpipe Workers in parallel.
# Token sourced from macOS keychain (security find-generic-password -s cf-write-token).
# Pages projects (landing, dashboard) print to a separate stream — use
# `wrangler pages deployment tail` for those if needed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TOKEN="$(security find-generic-password -s cf-write-token -w 2>/dev/null || true)"
if [[ -z "$TOKEN" ]]; then
  echo "no cf-write-token in keychain; run: security add-generic-password -s cf-write-token -a \$USER -w <token>" >&2
  exit 1
fi
export CLOUDFLARE_API_TOKEN="$TOKEN"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"

SERVICES=(
  clawpipe-gateway
  clawpipe-landing
  clawpipe-dashboard
  clawpipe-docs
  clawpipe-playground
  clawpipe-calculator
)

PIDS=()
cleanup() {
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

for s in "${SERVICES[@]}"; do
  (
    cd "$ROOT/gateway" 2>/dev/null || cd "$ROOT"
    npx wrangler tail "$s" --format=pretty 2>&1 | sed "s/^/[$s] /"
  ) &
  PIDS+=($!)
done

echo "tailing ${#SERVICES[@]} services; ctrl-c to stop"
wait
