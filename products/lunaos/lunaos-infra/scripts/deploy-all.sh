#!/bin/bash
# LunaOS Full Deployment — staging → production
# Run: ./scripts/deploy-all.sh [staging|production]

set -euo pipefail

ENV="${1:-staging}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo "🌙 LunaOS Deploy — $ENV"
echo "━━━━━━━━━━━━━━━━━━━━━━"
echo ""

deploy() {
    local name="$1"
    local dir="$2"
    local cmd="$3"

    echo -n "  Deploying $name..."
    if (cd "$dir" && eval "$cmd" > /dev/null 2>&1); then
        echo -e " ${GREEN}done${NC}"
    else
        echo -e " ${RED}failed${NC}"
        return 1
    fi
}

# 1. Engine API
deploy "Engine API" "$ROOT/lunaos-engine/packages/api" \
    "npx wrangler deploy --env $ENV"

# 2. Dashboard
deploy "Dashboard" "$ROOT/lunaos-dashboard" \
    "npm run build && npx wrangler pages deploy out --project-name luna-agent --commit-dirty=true"

# 3. Studio
deploy "Studio" "$ROOT/lunaos-studio" \
    "npm run build && npx wrangler pages deploy dist --project-name lunaos-studio"

# 4. Docs
deploy "Docs" "$ROOT/lunaos-docs" \
    "npm run build && npx wrangler pages deploy docs/.vitepress/dist --project-name lunaos-docs"

# 5. Marketing
deploy "Marketing" "$ROOT/lunaos-marketing" \
    "npx wrangler pages deploy . --project-name lunaos-website --commit-dirty=true"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}All deployments complete!${NC}"
echo ""
echo "Run smoke test: ./scripts/smoke-test.sh"
