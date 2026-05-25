#!/usr/bin/env bash
# Deploy Cloudflare Workers for OpenSyber services.
#
# Token:      macOS Keychain item `cf-write-token`
# Account ID: $CLOUDFLARE_ACCOUNT_ID from repo-root .env
#
# Usage:
#   ./scripts/deploy-all.sh                  # deploy every worker (sequential)
#   ./scripts/deploy-all.sh api              # deploy only opensyber-api
#   ./scripts/deploy-all.sh api claw-gateway # multiple targets
#   ./scripts/deploy-all.sh --dry-run        # print what would deploy
#
# Each app is deployed via `pnpm --filter <pkg> deploy` from repo root so
# turbo's build cache is reused. Sequential to keep wrangler output readable
# and avoid R2/D1 contention.

set -euo pipefail

# shellcheck source=./_cf-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/_cf-env.sh"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Worker name → pnpm filter (from apps/*/package.json + wrangler.toml).
declare -A APPS=(
  [opensyber-api]="@opensyber/api"
  [opensyber-web]="@opensyber/web"
  [opensyber-redirects]="@opensyber/redirects"
  [opensyber-ztna-proxy]="@opensyber/ztna-proxy"
  [claw-gateway]="@opensyber/claw-gateway"
  [tokenforge-api]="@opensyber/tokenforge-api"
  [tokenforge-proxy]="@opensyber/tokenforge-proxy"
  [tokenforge-web]="@opensyber/tokenforge-web"
)

# Default deploy order: API + lightweight workers first, Next.js OpenNext last
# (those take 1-3 min each). Adjust if you only need a subset.
DEPLOY_ORDER=(
  opensyber-api
  claw-gateway
  tokenforge-api
  opensyber-redirects
  opensyber-ztna-proxy
  tokenforge-proxy
  opensyber-web
  tokenforge-web
)

# Arg parsing.
DRY_RUN=0
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --help|-h) sed -n '2,15p' "$0"; exit 0 ;;
    *)
      # Accept short aliases: "api" → "opensyber-api"
      case "$arg" in
        api)      TARGETS+=(opensyber-api) ;;
        web)      TARGETS+=(opensyber-web) ;;
        redirects)TARGETS+=(opensyber-redirects) ;;
        ztna)     TARGETS+=(opensyber-ztna-proxy) ;;
        claw)     TARGETS+=(claw-gateway) ;;
        tf-api)   TARGETS+=(tokenforge-api) ;;
        tf-proxy) TARGETS+=(tokenforge-proxy) ;;
        tf-web)   TARGETS+=(tokenforge-web) ;;
        *)        TARGETS+=("$arg") ;;
      esac
      ;;
  esac
done
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=("${DEPLOY_ORDER[@]}")
fi

# Validate every target is known.
for worker in "${TARGETS[@]}"; do
  if [[ -z "${APPS[$worker]:-}" ]]; then
    echo "error: unknown worker '$worker'. Known:" >&2
    printf '  %s\n' "${!APPS[@]}" | sort >&2
    exit 1
  fi
done

cd "$REPO_ROOT"
echo "[deploy-all] deploying ${#TARGETS[@]} worker(s)"

FAILED=()
SUCCEEDED=()
for worker in "${TARGETS[@]}"; do
  filter="${APPS[$worker]}"
  echo
  echo "════════════════════════════════════════════════════════════════"
  echo "  Deploying: $worker ($filter)"
  echo "════════════════════════════════════════════════════════════════"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [dry-run] pnpm --filter $filter deploy"
    SUCCEEDED+=("$worker")
    continue
  fi
  if pnpm --filter "$filter" run deploy; then
    SUCCEEDED+=("$worker")
  else
    FAILED+=("$worker")
    echo "  ✗ deploy failed: $worker"
  fi
done

echo
echo "[deploy-all] summary: ${#SUCCEEDED[@]} succeeded, ${#FAILED[@]} failed"
[[ ${#SUCCEEDED[@]} -gt 0 ]] && printf '  ✓ %s\n' "${SUCCEEDED[@]}"
[[ ${#FAILED[@]} -gt 0 ]]    && printf '  ✗ %s\n' "${FAILED[@]}"
[[ ${#FAILED[@]} -eq 0 ]]
