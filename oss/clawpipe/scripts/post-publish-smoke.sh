#!/usr/bin/env bash
# Run after `npm publish` for SDK + MCP and `wrangler deploy` for gateway.
# Verifies: published packages installable + importable, gateway live,
# OpenAPI matches GATEWAY_VERSION, public stats endpoint responds.
#
# Usage:  bash scripts/post-publish-smoke.sh
# Exits 0 on full pass, non-zero on first failure.

set -euo pipefail

GATEWAY="${GATEWAY:-https://api.clawpipe.ai}"
SDK_VERSION="${SDK_VERSION:-3.7.0}"
MCP_VERSION="${MCP_VERSION:-3.2.0}"
GATEWAY_VERSION="${GATEWAY_VERSION:-1.1.0}"

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; exit 1; }

step "1/6  Gateway /health"
HEALTH=$(curl -fsS "$GATEWAY/health") || fail "gateway not reachable at $GATEWAY"
ok "$HEALTH"

step "2/6  Gateway /v1/openapi.json version pin"
OPENAPI_VERSION=$(curl -fsS "$GATEWAY/v1/openapi.json" | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).info.version))')
[ "$OPENAPI_VERSION" = "$GATEWAY_VERSION" ] \
  || fail "openapi.info.version=$OPENAPI_VERSION but expected $GATEWAY_VERSION"
ok "openapi.info.version = $OPENAPI_VERSION"

step "3/6  Gateway /v1/index (no auth, public stats)"
curl -fsS "$GATEWAY/v1/index" | node -e 'process.stdin.on("data",d=>{const j=JSON.parse(d); if(typeof j.period!=="string"||typeof j.totalPrompts!=="number") process.exit(1); console.log("period="+j.period+" totalPrompts="+j.totalPrompts)})' \
  || fail "/v1/index payload missing period or totalPrompts"
ok "public index endpoint live"

step "4/6  npm install clawpipe-ai@$SDK_VERSION clean-room"
SMOKE=$(mktemp -d)
cd "$SMOKE"
npm init -y >/dev/null
npm install --silent "clawpipe-ai@$SDK_VERSION" "clawpipe-mcp-server@$MCP_VERSION" 2>&1 | tail -2
node -e "const m=require('clawpipe-ai'); if(typeof m.ClawPipe!=='function') process.exit(1);" \
  || fail "CJS require('clawpipe-ai').ClawPipe is not a function"
ok "CJS require works"
node --input-type=module -e "import('clawpipe-ai').then(m=>{if(typeof m.ClawPipe!=='function') process.exit(1)});" \
  || fail "ESM import('clawpipe-ai').ClawPipe is not a function"
ok "ESM import works"

step "5/6  Published version stamps"
INSTALLED_SDK=$(node -e "console.log(require('clawpipe-ai/package.json').version)")
INSTALLED_MCP=$(node -e "console.log(require('clawpipe-mcp-server/package.json').version)")
[ "$INSTALLED_SDK" = "$SDK_VERSION" ] || fail "sdk installed $INSTALLED_SDK, expected $SDK_VERSION"
[ "$INSTALLED_MCP" = "$MCP_VERSION" ] || fail "mcp installed $INSTALLED_MCP, expected $MCP_VERSION"
ok "clawpipe-ai = $INSTALLED_SDK"
ok "clawpipe-mcp-server = $INSTALLED_MCP"

step "6/6  Gateway brand headers + X-ClawPipe-Version"
HEADERS=$(curl -fsS -D - "$GATEWAY/v1/openapi.json" -o /dev/null)
echo "$HEADERS" | grep -qi "^X-Powered-By: ClawPipe" || fail "missing X-Powered-By"
echo "$HEADERS" | grep -qi "^X-ClawPipe-Version: $GATEWAY_VERSION" \
  || fail "X-ClawPipe-Version != $GATEWAY_VERSION"
ok "brand headers present, version stamp matches"

cd / && rm -rf "$SMOKE"

printf "\n\033[1;32m✓ All 6 post-publish checks passed.\033[0m\n"
printf "  SDK %s · MCP %s · Gateway %s\n" "$SDK_VERSION" "$MCP_VERSION" "$GATEWAY_VERSION"
printf "  Next: open docs/promotion/launch-kit/launch-day-runbook.md → T-12h block.\n"
