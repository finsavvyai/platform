#!/bin/bash
# Content assertion per endpoint — fetch ONCE and grep for the marker that
# proves the session's code is live.

OUT=/tmp/opensyber-probe/assertions.tsv
: > "$OUT"
printf "endpoint\tcheck\tresult\tevidence\n" >> "$OUT"

# Helper: fetch body, grep -c for a marker, record PASS/FAIL
assert_get() {
  local url="$1" marker="$2" label="$3"
  local body count evidence
  body=$(curl -sS "$url" 2>/dev/null)
  count=$(printf '%s' "$body" | grep -cE "$marker" 2>/dev/null)
  if [ "${count:-0}" -gt 0 ]; then
    evidence=$(printf '%s' "$body" | grep -oE "$marker" 2>/dev/null | head -1 | tr '\n' ' ' | cut -c1-80)
    printf "%s\t%s\tPASS\t%s\n" "$url" "$label" "$evidence" >> "$OUT"
  else
    evidence=$(printf '%s' "$body" | head -c 80 | tr '\n' ' ')
    printf "%s\t%s\tFAIL\t%s\n" "$url" "$label" "$evidence" >> "$OUT"
  fi
}

assert_post() {
  local url="$1" marker="$2" label="$3"
  shift 3
  local body count evidence
  body=$(curl -sS -X POST "$@" "$url" 2>/dev/null)
  count=$(printf '%s' "$body" | grep -cE "$marker" 2>/dev/null)
  if [ "${count:-0}" -gt 0 ]; then
    evidence=$(printf '%s' "$body" | grep -oE "$marker" 2>/dev/null | head -1 | cut -c1-80)
    printf "%s\t%s\tPASS\t%s\n" "$url" "$label" "$evidence" >> "$OUT"
  else
    evidence=$(printf '%s' "$body" | head -c 80 | tr '\n' ' ')
    printf "%s\t%s\tFAIL\t%s\n" "$url" "$label" "$evidence" >> "$OUT"
  fi
}

# ── Marketing: new copy from J4 ───────────────────────────────────────────
assert_get "https://opensyber.cloud/" \
  "DEPLOY\. CONNECT\. WATCH|Deploy an agent|connect your machine|opensyber login|@opensyber/cli" \
  "new_hero_copy"

# ── Docs: /docs/connect-agent page exists ──────────────────────────────────
assert_get "https://opensyber.cloud/docs/connect-agent" \
  "Connect your agent|Choose your client|claude_desktop_config|Troubleshooting" \
  "connect_docs_content"

# ── Pricing: new comparison table + launch offer banner ────────────────────
assert_get "https://opensyber.cloud/pricing" \
  "Comparison|Wiz|Snyk|launch offer|LAUNCH40|Pro|Team" \
  "pricing_new_components"

# ── Web proxy: badge preview returns SVG ───────────────────────────────────
assert_get "https://opensyber.cloud/api/proxy/badges/probe/security-score" \
  "<svg |xmlns.*svg|OpenSyber Security" \
  "badge_proxy_svg"

# ── API: ingestion endpoint returns MY 401 string, not Auth.js ─────────────
assert_post "https://api.opensyber.cloud/api/instances/probe/events" \
  "Missing X-Gateway-Token or X-Instance-Id header" \
  "api_events_auth_string" \
  -H "Content-Type: application/json" -d '{}'

# ── API: ingestion with fake token returns MY 403 ─────────────────────────
assert_post "https://api.opensyber.cloud/api/instances/probe/events" \
  "Invalid gateway token for instance" \
  "api_events_fake_token" \
  -H "X-Gateway-Token: fake" -H "X-Instance-Id: probe" \
  -H "Content-Type: application/json" -d '{"eventType":"x","severity":"info"}'

# ── API: ingestion with mismatched IDs returns MY 403 mismatch ────────────
assert_post "https://api.opensyber.cloud/api/instances/one/events" \
  "Instance ID mismatch" \
  "api_events_id_mismatch" \
  -H "X-Gateway-Token: fake" -H "X-Instance-Id: two" \
  -H "Content-Type: application/json" -d '{"eventType":"x","severity":"info"}'

# ── API: gateway-token endpoint exists (returns Auth.js 401 — correct) ─────
assert_get "https://api.opensyber.cloud/api/instances/probe/gateway-token" \
  "Missing or invalid authorization header|Unauthorized" \
  "api_token_auth_gate"

# ── API: semantic search endpoint exists ──────────────────────────────────
assert_get "https://api.opensyber.cloud/api/search/skills?q=test" \
  "Missing or invalid authorization header|Unauthorized|Vector search not configured" \
  "api_search_skills_exists"

# ── API: semantic search findings exists ──────────────────────────────────
assert_get "https://api.opensyber.cloud/api/search/findings?q=test" \
  "Missing or invalid authorization header|Unauthorized|Vector search not configured" \
  "api_search_findings_exists"

# ── API: attack-paths graph route exists ──────────────────────────────────
assert_get "https://api.opensyber.cloud/api/attack-paths/graph/probe" \
  "Missing or invalid authorization header|Unauthorized" \
  "api_attack_paths_graph_exists"

# ── API: admin traces route exists ────────────────────────────────────────
assert_get "https://api.opensyber.cloud/api/admin/traces/00000000-0000-0000-0000-000000000000" \
  "Missing or invalid authorization header|Unauthorized" \
  "api_admin_traces_exists"

# ── API health ────────────────────────────────────────────────────────────
assert_get "https://api.opensyber.cloud/health" \
  "\"status\":\"healthy\"|\"d1\".*\"ok\"" \
  "api_health_subsystems_ok"

# ── API public badge endpoint still works ─────────────────────────────────
assert_get "https://api.opensyber.cloud/api/badges/probe/security-score" \
  "<svg |OpenSyber Security" \
  "api_badge_public_svg"

echo "=== assertions captured ==="
wc -l "$OUT"
