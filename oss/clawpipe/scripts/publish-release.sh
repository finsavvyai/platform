#!/usr/bin/env bash
# One-shot local release via PushCI secrets — no GitHub Actions needed.
#
# First-time setup (once):
#   pushci secret set NPM_TOKEN <your-npm-token>
#
# Then run:
#   ./scripts/publish-release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Resolve NPM_TOKEN: env > .env > pushci secret.
if [[ -z "${NPM_TOKEN:-}" && -f "$ROOT/.env" ]]; then
  NPM_TOKEN="$(grep -E '^NPM_TOKEN=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"'"'" || true)"
fi
if [[ -z "${NPM_TOKEN:-}" ]]; then
  if command -v pushci >/dev/null 2>&1; then
    NPM_TOKEN="$(pushci secret get NPM_TOKEN 2>/dev/null || true)"
  fi
fi
if [[ -z "${NPM_TOKEN:-}" ]]; then
  echo "❌ NPM_TOKEN not found."
  echo "   Run: pushci secret set NPM_TOKEN <token>"
  echo "   Or:  export NPM_TOKEN=<token>"
  exit 1
fi
export NPM_TOKEN

# Temp .npmrc so npm picks up the token for this run only.
NPMRC_TMP="$(mktemp)"
trap 'rm -f "$NPMRC_TMP"' EXIT
printf '//registry.npmjs.org/:_authToken=%s\nregistry=https://registry.npmjs.org/\n' "$NPM_TOKEN" > "$NPMRC_TMP"
export npm_config_userconfig="$NPMRC_TMP"

publish_if_new() {
  local dir=$1
  local pkg=$(node -p "require('./$dir/package.json').name")
  local ver=$(node -p "require('./$dir/package.json').version")
  local latest=$(npm view "$pkg" version 2>/dev/null || true)
  if [[ "$ver" == "$latest" ]]; then
    echo "==> $pkg@$ver already published — skipping"
    return 0
  fi
  echo "==> publishing $pkg@$ver"
  (cd "$dir" && npm publish --access public)
}

cd "$ROOT/sdk"
npm ci
npm run build
npm test
cd "$ROOT"
publish_if_new sdk

cd "$ROOT/mcp-server"
npm install
npm run build
cd "$ROOT"
publish_if_new mcp-server

VERSION=$(node -p "require('./sdk/package.json').version")
git tag -a "v${VERSION}" -m "v${VERSION}" 2>/dev/null || echo "tag v${VERSION} already exists"
git push origin "v${VERSION}" 2>/dev/null || true

echo
echo "✅ Release v${VERSION}"
echo "   • clawpipe-ai@${VERSION}"
echo "   • clawpipe-mcp-server@$(node -p "require('./mcp-server/package.json').version")"
echo
echo "Next (browser, 5 min each):"
echo "  1. https://registry.modelcontextprotocol.io/submit  — paste mcp-server/server.json"
echo "  2. https://smithery.ai/new                           — connect GitHub repo"
echo "  3. https://search.google.com/search-console/sitemaps — submit clawpipe.ai/sitemap.xml"
