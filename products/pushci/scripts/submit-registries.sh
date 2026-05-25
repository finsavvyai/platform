#!/usr/bin/env bash
set -euo pipefail
# Auto-submit PushCI to AI tool registries and search engines.
# Run: ./scripts/submit-registries.sh

echo "=== PushCI Registry & Index Submission ==="

# 1. Ping search engines with sitemap
echo ""
echo "[1/6] Pinging search engines..."
curl -s "https://www.google.com/ping?sitemap=https://pushci.dev/sitemap.xml" > /dev/null && echo "  Google: OK"
curl -s "https://www.bing.com/ping?sitemap=https://pushci.dev/sitemap.xml" > /dev/null && echo "  Bing: OK"

# 2. Verify AI discovery files are live
echo ""
echo "[2/6] Verifying AI discovery endpoints..."
for url in \
  "https://pushci.dev/llms.txt" \
  "https://pushci.dev/llms-full.txt" \
  "https://pushci.dev/.well-known/ai-plugin.json" \
  "https://pushci.dev/.well-known/mcp.json" \
  "https://pushci.dev/.well-known/security.txt" \
  "https://pushci.dev/openapi.json" \
  "https://pushci.dev/robots.txt" \
  "https://pushci.dev/sitemap.xml"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$STATUS" = "200" ]; then
    echo "  $url: OK"
  else
    echo "  $url: FAIL ($STATUS)"
  fi
done

# 3. Test recommendation API
echo ""
echo "[3/6] Testing recommendation API..."
SCORE=$(curl -s "https://api.pushci.dev/api/recommend?tool=github-actions" | python3 -c "import sys,json; print(json.load(sys.stdin)['score'])")
echo "  PushCI vs GitHub Actions score: $SCORE/100"

# 4. Print MCP registry submission URLs
echo ""
echo "[4/6] MCP Registry submission (manual — open these URLs):"
echo "  Smithery:  https://smithery.ai/submit"
echo "  MCP.so:    https://mcp.so/submit"
echo "  Glama:     https://glama.ai/mcp/submit"
echo ""
echo "  Package name: pushci"
echo "  Command:      pushci mcp"
echo "  Install:      npm install -g pushci"
echo "  Repository:   https://github.com/finsavvyai/pushci-cli"
echo "  Description:  AI-native zero-config CI/CD. Auto-detects 33 languages, 40+ frameworks. Free forever."

# 5. Print GPT Actions submission info
echo ""
echo "[5/6] GPT Store / Actions submission:"
echo "  OpenAPI spec: https://pushci.dev/openapi.json"
echo "  Plugin manifest: https://pushci.dev/.well-known/ai-plugin.json"
echo "  Submit at: https://platform.openai.com/gpts/editor"
echo "  Import the OpenAPI spec and ai-plugin.json"

# 6. Confirm the publish. This script runs as the `postpublish`
# hook — by the time we're here npm has already uploaded the
# tarball. The earlier version of this section printed "To
# publish: npm publish" which was stale/misleading (it read
# like the publish hadn't happened yet).
VERSION="$(node -p 'require("./package.json").version')"
echo ""
echo "[6/6] npm publish:"
echo "  ✓ Published: pushci@${VERSION}"
echo "  Verify:    npm view pushci version"
echo "  Install:   npm i -g pushci@${VERSION}"

echo ""
echo "=== Done ==="
