#!/usr/bin/env bash
#
# Post-push deploy orchestrator — replacement for the PushCI deploy
# stage (which needs an agent daemon that isn't running).
#
# Auto-detects which surfaces changed since origin/main and deploys
# only those. Safe to re-run — idempotent wrangler deploys.
#
# Usage:
#   bash scripts/deploy-all.sh                # auto-detect + deploy
#   bash scripts/deploy-all.sh landing        # deploy only landing
#   bash scripts/deploy-all.sh api            # deploy only api
#   bash scripts/deploy-all.sh web            # deploy only svelte app
#   bash scripts/deploy-all.sh all            # deploy everything
#
# Env:
#   CLOUDFLARE_API_TOKEN   — needs Pages:Edit + Workers:Edit scopes
#   CLOUDFLARE_ACCOUNT_ID  — account id for pages/workers ops
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

TARGET="${1:-auto}"
DEPLOYED=()

# ── Detect changed paths since origin/main (last push window) ────
changed_paths() {
	git diff --name-only "origin/main@{5.minutes.ago}" HEAD 2>/dev/null \
		|| git diff --name-only HEAD~5 HEAD
}

wants_landing()  { changed_paths | grep -qE '^landing-page/' ; }
wants_api()      { changed_paths | grep -qE '^apps/api/|^packages/' ; }
wants_web()      { changed_paths | grep -qE '^apps/web/|^packages/' ; }

deploy_landing() {
	echo "→ landing (tenantiq.app)"
	npx wrangler pages deploy landing-page/deploy \
		--project-name=tenantiq-app \
		--branch=main \
		--commit-dirty=true
	DEPLOYED+=("landing")
}

deploy_api() {
	echo "→ api (api.tenantiq.app)"
	(cd apps/api && npx wrangler deploy)
	DEPLOYED+=("api")
}

deploy_web() {
	echo "→ web (app.tenantiq.app)"
	(cd apps/web && npm run build)
	npx wrangler pages deploy apps/web/.svelte-kit/cloudflare \
		--project-name=tenantiq-web \
		--branch=main \
		--commit-dirty=true
	DEPLOYED+=("web")
}

verify() {
	local url="$1" pattern="$2" retries="${3:-6}" interval="${4:-10}"
	local i
	for i in $(seq 1 "$retries"); do
		if curl -sfL "$url" 2>/dev/null | grep -qE "$pattern"; then
			echo "   ✓ $url → ok"
			return 0
		fi
		sleep "$interval"
	done
	echo "   ✗ $url failed to match \"$pattern\" after ${retries}×${interval}s"
	return 1
}

case "$TARGET" in
	auto)
		wants_landing && deploy_landing || true
		wants_api     && deploy_api     || true
		wants_web     && deploy_web     || true
		;;
	landing) deploy_landing ;;
	api)     deploy_api ;;
	web)     deploy_web ;;
	all)
		deploy_landing
		deploy_api
		deploy_web
		;;
	*)
		echo "unknown target: $TARGET (expected: auto | landing | api | web | all)" >&2
		exit 1
		;;
esac

if [[ ${#DEPLOYED[@]} -eq 0 ]]; then
	echo "Nothing to deploy (no changed paths matched in auto mode)."
	exit 0
fi

echo ""
echo "Verifying:"
for d in "${DEPLOYED[@]}"; do
	case "$d" in
		landing) verify https://tenantiq.app "(?i)<!doctype" 6 10 ;;
		api)     verify https://api.tenantiq.app/health "status.*healthy" 12 5 ;;
		web)     verify https://app.tenantiq.app/ "(?i)<!doctype|<html" 6 10 ;;
	esac
done

echo ""
echo "Deployed: ${DEPLOYED[*]}"
