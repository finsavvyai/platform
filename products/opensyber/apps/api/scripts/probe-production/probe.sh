#!/bin/bash
# No `set -e` — individual probe failures must not kill the whole run.
mkdir -p /tmp/opensyber-probe
OUT=/tmp/opensyber-probe/results.tsv
: > "$OUT"
printf "group\tendpoint\tmethod\trun\tcode\tsize\tttfb_ms\ttotal_ms\tcache_control\n" >> "$OUT"

probe_get() {
  local group="$1" url="$2" run="$3"
  local fmt='%{http_code}\t%{size_download}\t%{time_starttransfer}\t%{time_total}'
  local result cc code size ttfb total ttfb_ms total_ms
  result=$(curl -sS -o /tmp/opensyber-probe/body -D /tmp/opensyber-probe/hdr \
            -w "$fmt" "$url" 2>&1) || true
  cc=$(grep -i "^cache-control:" /tmp/opensyber-probe/hdr 2>/dev/null \
       | head -1 | tr -d '\r\n' | sed 's/.*: //')
  [ -z "$cc" ] && cc="-"
  code=$(printf '%s' "$result" | cut -f1)
  size=$(printf '%s' "$result" | cut -f2)
  ttfb=$(printf '%s' "$result" | cut -f3)
  total=$(printf '%s' "$result" | cut -f4)
  ttfb_ms=$(awk -v t="$ttfb" 'BEGIN{printf "%d", t*1000}')
  total_ms=$(awk -v t="$total" 'BEGIN{printf "%d", t*1000}')
  printf '%s\t%s\tGET\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$group" "$url" "$run" "$code" "$size" "$ttfb_ms" "$total_ms" "$cc" >> "$OUT"
}

probe_post() {
  local group="$1" url="$2" run="$3"
  shift 3
  local fmt='%{http_code}\t%{size_download}\t%{time_starttransfer}\t%{time_total}'
  local result cc code size ttfb total ttfb_ms total_ms
  result=$(curl -sS -o /tmp/opensyber-probe/body -D /tmp/opensyber-probe/hdr \
            -w "$fmt" -X POST "$@" "$url" 2>&1) || true
  cc=$(grep -i "^cache-control:" /tmp/opensyber-probe/hdr 2>/dev/null \
       | head -1 | tr -d '\r\n' | sed 's/.*: //')
  [ -z "$cc" ] && cc="-"
  code=$(printf '%s' "$result" | cut -f1)
  size=$(printf '%s' "$result" | cut -f2)
  ttfb=$(printf '%s' "$result" | cut -f3)
  total=$(printf '%s' "$result" | cut -f4)
  ttfb_ms=$(awk -v t="$ttfb" 'BEGIN{printf "%d", t*1000}')
  total_ms=$(awk -v t="$total" 'BEGIN{printf "%d", t*1000}')
  printf '%s\t%s\tPOST\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$group" "$url" "$run" "$code" "$size" "$ttfb_ms" "$total_ms" "$cc" >> "$OUT"
}

for run in 1 2 3 4 5; do
  # marketing (cold)
  probe_get "marketing" "https://opensyber.cloud/" "$run"
  probe_get "marketing" "https://opensyber.cloud/docs/connect-agent" "$run"
  probe_get "marketing" "https://opensyber.cloud/pricing" "$run"

  # web proxy routes (new this session)
  probe_get  "web-proxy" "https://opensyber.cloud/api/proxy/badges/probe/security-score" "$run"
  probe_get  "web-proxy" "https://opensyber.cloud/api/proxy/instances/probe/gateway-token" "$run"
  probe_post "web-proxy" "https://opensyber.cloud/api/proxy/instances/probe/events/test" "$run" \
             -H 'Content-Type: application/json' -d '{}'

  # API public
  probe_get "api-public" "https://api.opensyber.cloud/health" "$run"
  probe_get "api-public" "https://api.opensyber.cloud/api/badges/probe/security-score" "$run"

  # API instance-events (no headers — tests the route presence via my 401 message)
  probe_post "api-events-noheaders" \
             "https://api.opensyber.cloud/api/instances/probe/events" "$run" \
             -H 'Content-Type: application/json' -d '{}'

  # API instance-events with fake token + matching id (exercises token lookup path)
  probe_post "api-events-faketoken" \
             "https://api.opensyber.cloud/api/instances/probe/events" "$run" \
             -H 'X-Gateway-Token: fake' -H 'X-Instance-Id: probe' \
             -H 'Content-Type: application/json' \
             -d '{"eventType":"x","severity":"info"}'

  # API auth-gated reads
  probe_get "api-auth" "https://api.opensyber.cloud/api/instances/probe/gateway-token" "$run"
  probe_get "api-auth" "https://api.opensyber.cloud/api/search/skills?q=test" "$run"
  probe_get "api-auth" "https://api.opensyber.cloud/api/search/findings?q=test" "$run"
  probe_get "api-auth" "https://api.opensyber.cloud/api/attack-paths/graph/probe" "$run"
  probe_get "api-auth" "https://api.opensyber.cloud/api/admin/traces/00000000-0000-0000-0000-000000000000" "$run"
done

echo "=== Rows captured ==="
wc -l "$OUT"
