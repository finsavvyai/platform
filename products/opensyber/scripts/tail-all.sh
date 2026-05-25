#!/usr/bin/env bash
# Tail Cloudflare Workers logs for all OpenSyber services in parallel.
#
# Token:      macOS Keychain item `cf-write-token`
# Account ID: $CLOUDFLARE_ACCOUNT_ID from repo-root .env
#
# Usage:
#   ./scripts/tail-all.sh                         # tail every worker
#   ./scripts/tail-all.sh opensyber-api           # tail a single worker
#   ./scripts/tail-all.sh --format=json api claw  # JSON, multiple targets
#   ./scripts/tail-all.sh --grep=Authentication   # filter lines client-side

set -euo pipefail

# shellcheck source=./_cf-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/_cf-env.sh"

# All OpenSyber-deployed Cloudflare Workers (from apps/*/wrangler.toml).
WORKERS=(
  opensyber-api
  opensyber-web
  opensyber-redirects
  opensyber-ztna-proxy
  claw-gateway
  tokenforge-api
  tokenforge-proxy
  tokenforge-web
)

# Arg parsing.
FORMAT="pretty"
GREP_FILTER=""
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --format=*) FORMAT="${arg#--format=}" ;;
    --grep=*)   GREP_FILTER="${arg#--grep=}" ;;
    --help|-h)
      sed -n '2,11p' "$0"
      exit 0 ;;
    *)          TARGETS+=("$arg") ;;
  esac
done
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=("${WORKERS[@]}")
fi

# Cleanup child wrangler processes on exit.
PIDS=()
cleanup() {
  trap - INT TERM EXIT
  [[ ${#PIDS[@]} -gt 0 ]] && kill "${PIDS[@]}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[tail-all] streaming ${#TARGETS[@]} worker(s) — Ctrl-C to stop"

for worker in "${TARGETS[@]}"; do
  (
    if [[ -n "$GREP_FILTER" ]]; then
      npx --yes wrangler tail "$worker" --format "$FORMAT" 2>&1 \
        | grep --line-buffered -E "$GREP_FILTER" \
        | sed -u "s/^/[$worker] /"
    else
      npx --yes wrangler tail "$worker" --format "$FORMAT" 2>&1 \
        | sed -u "s/^/[$worker] /"
    fi
  ) &
  PIDS+=($!)
done

wait
