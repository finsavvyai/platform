#!/usr/bin/env bash
set -euo pipefail

echo "=== PushCI Organic Submission Automation ==="
echo ""

# --- Dev.to Article ---
echo "[1/5] Dev.to Article..."
if [ -n "${DEV_TO_API_KEY:-}" ]; then
  TITLE="PushCI: I Built a Free CI/CD Tool That Replaces GitHub Actions in 30 Seconds"
  BODY=$(cat docs/launch/DEV_TO_ARTICLE.md | tail -n +3)
  PAYLOAD=$(python3 -c "
import json, sys
body = sys.stdin.read()
print(json.dumps({
  'article': {
    'title': '$TITLE',
    'body_markdown': body,
    'published': True,
    'tags': ['cicd', 'devops', 'githubactions', 'ai'],
    'canonical_url': 'https://pushci.dev/why'
  }
}))
" <<< "$BODY")
  RESP=$(curl -s -w "\n%{http_code}" -X POST "https://dev.to/api/articles" \
    -H "Content-Type: application/json" \
    -H "api-key: ${DEV_TO_API_KEY}" \
    -d "$PAYLOAD")
  CODE=$(echo "$RESP" | tail -1)
  if [ "$CODE" = "201" ]; then
    URL=$(echo "$RESP" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")
    echo "  Published: $URL"
  else
    echo "  Error: HTTP $CODE"
  fi
else
  echo "  DEV_TO_API_KEY not set. Get one at: https://dev.to/settings/extensions"
  echo "  Then: DEV_TO_API_KEY=xxx bash scripts/promote-organic-submit.sh"
fi

# --- AlternativeTo ---
echo ""
echo "[2/5] AlternativeTo..."
echo "  Submit manually: https://alternativeto.net/software/github-actions/"
echo "  Click 'Suggest Alternative' → Add PushCI (https://pushci.dev)"

# --- Product Hunt ---
echo ""
echo "[3/5] Product Hunt..."
echo "  Submit at: https://www.producthunt.com/posts/new"
echo "  Copy from: docs/launch/PRODUCT_HUNT_LAUNCH.md"

# --- Hacker News ---
echo ""
echo "[4/5] Hacker News..."
echo "  Submit at: https://news.ycombinator.com/submitlink"
echo "  URL: https://pushci.dev"
echo "  Title: Show HN: PushCI – AI-native CI/CD that replaces GitHub Actions in 30 seconds"

# --- Reddit ---
echo ""
echo "[5/5] Reddit..."
echo "  r/devops: https://reddit.com/r/devops/submit"
echo "  r/selfhosted: https://reddit.com/r/selfhosted/submit"
echo "  Title: I built a free CI/CD tool that replaces GitHub Actions with zero YAML"

echo ""
echo "=== Awesome List PRs (already submitted) ==="
echo "  awesome-mcp-servers: https://github.com/punkpeye/awesome-mcp-servers/pull/4334"
echo "  awesome-ciandcd: https://github.com/cicdops/awesome-ciandcd/pull/81"

echo ""
echo "=== Done ==="
