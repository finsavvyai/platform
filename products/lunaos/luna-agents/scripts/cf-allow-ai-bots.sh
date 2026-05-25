#!/usr/bin/env bash
# cf-allow-ai-bots.sh — make Cloudflare stop blocking Claude-User and friends
# for agents.lunaos.ai (zone: lunaos.ai).
#
# What it does, in order:
#   1. Disable Bot Fight Mode + Super Bot Fight Mode on the zone.
#   2. Create a WAF custom Skip rule that bypasses managed rules, bot
#      detection, and rate limiting for the Anthropic + OpenAI crawler
#      user agents. Placed at the top of the rule order.
#   3. Verify with a Claude-User fetch.
#
# It does NOT:
#   - Touch AI Crawl Control (no public API yet; dashboard only).
#     See dashboard steps printed at the end.
#
# Run:
#   CF_ZONE_TOKEN=<token-with-Zone:Edit+Bot:Edit+WAF:Edit> \
#     bash scripts/cf-allow-ai-bots.sh
#
# To revert the WAF rule:
#   CF_ZONE_TOKEN=... bash scripts/cf-allow-ai-bots.sh --revert

set -euo pipefail

ZONE_NAME="lunaos.ai"
RULE_DESCRIPTION="luna-pipes: allow AI crawlers (Claude, GPT, Perplexity)"
UA_REGEX='(?i)(Claude-User|ClaudeBot|Claude-SearchBot|GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|Google-Extended)'

if [[ -z "${CF_ZONE_TOKEN:-}" ]]; then
  echo "ERROR: set CF_ZONE_TOKEN env var to a Cloudflare API token with:"
  echo "  - Zone:Read"
  echo "  - Zone Settings:Edit (for Bot Fight Mode)"
  echo "  - Zone WAF:Edit (for the custom rule)"
  echo "Create one at https://dash.cloudflare.com/profile/api-tokens"
  exit 2
fi

api() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "https://api.cloudflare.com/client/v4$path" \
      -H "Authorization: Bearer $CF_ZONE_TOKEN" \
      -H "Content-Type: application/json" -d "$body"
  else
    curl -sS -X "$method" "https://api.cloudflare.com/client/v4$path" \
      -H "Authorization: Bearer $CF_ZONE_TOKEN"
  fi
}

echo "==> resolving zone id for $ZONE_NAME"
ZID=$(api GET "/zones?name=$ZONE_NAME" | python3 -c "import sys,json;print((json.load(sys.stdin).get('result') or [{}])[0].get('id') or '')")
if [[ -z "$ZID" ]]; then
  echo "ERROR: zone $ZONE_NAME not found or token lacks Zone:Read"
  exit 1
fi
echo "    zone_id=$ZID"

# --- revert path ------------------------------------------------------------
if [[ "${1:-}" == "--revert" ]]; then
  echo "==> looking up existing skip rule by description"
  RID=$(api GET "/zones/$ZID/firewall/rules" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('result') or []:
    if r.get('description')=='$RULE_DESCRIPTION':
        print(r.get('id')); break")
  if [[ -n "$RID" ]]; then
    api DELETE "/zones/$ZID/firewall/rules/$RID" >/dev/null
    echo "    deleted firewall rule $RID"
  else
    echo "    no matching rule found"
  fi
  exit 0
fi

# --- step 1: bot fight mode --------------------------------------------------
echo "==> disabling Bot Fight Mode"
api PATCH "/zones/$ZID/settings/bot_fight_mode" '{"value":"off"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('    ok' if d.get('success') else '    skip:',d.get('errors'))"

echo "==> disabling Super Bot Fight Mode (best effort, Pro+ plans only)"
api PUT "/zones/$ZID/bot_management" '{"fight_mode":false,"using_latest_model":true}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('    ok' if d.get('success') else '    skip:',d.get('errors'))" \
  || echo "    skip: not available on this plan"

# --- step 2: WAF skip rule ---------------------------------------------------
echo "==> creating WAF skip rule for AI crawler user agents"
# Check if rule already exists (idempotent)
EXISTING=$(api GET "/zones/$ZID/firewall/rules" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('result') or []:
    if r.get('description')=='$RULE_DESCRIPTION':
        print(r.get('id')); break")
if [[ -n "$EXISTING" ]]; then
  echo "    already exists: $EXISTING (idempotent skip)"
else
  PAYLOAD=$(python3 -c "
import json
print(json.dumps([{
  'description': '$RULE_DESCRIPTION',
  'action': 'bypass',
  'products': ['waf','rateLimit','securityLevel','bic','uaBlock','hot','zoneLockdown'],
  'priority': 1,
  'paused': False,
  'filter': {
    'expression': '(http.user_agent matches \"$UA_REGEX\")',
    'paused': False,
  },
}]))")
  RESP=$(api POST "/zones/$ZID/firewall/rules" "$PAYLOAD")
  echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    print('    ok: created rule', (d.get('result') or [{}])[0].get('id'))
else:
    print('    fail:', d.get('errors'))"
fi

# --- step 3: verify ----------------------------------------------------------
echo "==> verifying fetch as Claude-User"
CODE=$(curl -sA "Claude-User" -o /dev/null -w "%{http_code}" https://agents.lunaos.ai/)
SIZE=$(curl -sA "Claude-User" -o /dev/null -w "%{size_download}" https://agents.lunaos.ai/)
echo "    HTTP $CODE  body=${SIZE}B"
if [[ "$CODE" == "200" ]] && [[ "$SIZE" -gt 1000 ]]; then
  echo "==> done. Claude-User can fetch agents.lunaos.ai."
else
  echo "==> done, but verification did not look healthy."
fi

cat <<'EOF'

--- manual step (dashboard, no public API yet) ---
AI Crawl Control may still be blocking from Anthropic's IP ranges even
after the above. To finish:

  https://dash.cloudflare.com/?to=/:account/:zone/security/settings
    → AI Crawl Control
    → set Claude-User, ClaudeBot, Claude-SearchBot to Allow
    → set global "Block AI bots" to Off (or Allow individual entries)
    → AI Crawl Control → Manage robots.txt → disable Cloudflare-managed
      robots.txt so our /robots.txt wins

After that, repeat from a known-blocked client (e.g. claude.ai by pasting
the URL into a chat).
EOF
