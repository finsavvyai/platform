#!/bin/bash
# Aggregate results.tsv into a markdown dashboard.
# - Groups by endpoint
# - Computes cold (run=1) + warm p50 + warm p95 latency
# - Reports HTTP code stability across 5 runs
# - Joins with assertions.tsv for content verdict
# - Outputs to dashboard.md

R=/tmp/opensyber-probe/results.tsv
A=/tmp/opensyber-probe/assertions.tsv
OUT=/tmp/opensyber-probe/dashboard.md

{
  echo "# OpenSyber Production Probe — $(date '+%Y-%m-%d %H:%M UTC')"
  echo
  echo "5 runs per endpoint, cold + 4 warm, real HTTPS against opensyber.cloud / api.opensyber.cloud."
  echo
  echo "## Latency + status"
  echo
  echo "| Group | Endpoint | Code | Cold ms | Warm p50 | Warm p95 | Size | Cache-Control |"
  echo "|---|---|---|---|---|---|---|---|"
} > "$OUT"

# Walk unique (group, endpoint, method) triples
awk -F'\t' 'NR>1 {print $1 "\t" $2 "\t" $3}' "$R" | sort -u | while IFS=$'\t' read -r group ep method; do
  # Grab all rows for this endpoint
  rows=$(awk -F'\t' -v g="$group" -v e="$ep" -v m="$method" \
    '$1==g && $2==e && $3==m' "$R")

  code=$(printf '%s\n' "$rows" | awk -F'\t' 'NR==1{print $5}')
  codes_all=$(printf '%s\n' "$rows" | awk -F'\t' '{print $5}' | sort -u | tr '\n' ',' | sed 's/,$//')
  size=$(printf '%s\n' "$rows" | awk -F'\t' 'NR==1{print $6}')
  cc=$(printf '%s\n' "$rows" | awk -F'\t' 'NR==1{print $9}')

  cold=$(printf '%s\n' "$rows" | awk -F'\t' '$4==1{print $8}')
  warm_sorted=$(printf '%s\n' "$rows" | awk -F'\t' '$4>=2{print $8}' | sort -n)
  warm_count=$(printf '%s\n' "$warm_sorted" | wc -l | tr -d ' ')
  p50=$(printf '%s\n' "$warm_sorted" | awk 'NR==2{print}')       # 2nd of 4 warm runs ≈ p50
  p95=$(printf '%s\n' "$warm_sorted" | awk 'END{print}')         # max of 4 warm runs ≈ p95

  # Truncate cache-control if too long
  cc_short=$(printf '%s' "$cc" | cut -c1-32)
  [ "${#cc}" -gt 32 ] && cc_short="${cc_short}..."

  # Short endpoint name for readability
  short_ep=$(printf '%s' "$ep" | sed 's|https://||' | sed 's|opensyber\.cloud||' | sed 's|api\.|api:|' | head -c 60)

  # Smart code-stability flag. Three distinct cases we care about:
  #   1. Any 5xx in the distribution — always warn, even if it's 1 of 5.
  #   2. Mixed distinct 4xx codes (e.g. 401 + 403) — warn, something
  #      rotated under us.
  #   3. Stable single code — no warning, regardless of what the code is.
  #
  # Previously we fired a warning on ANY distinct-code count > 1, which
  # turned out to fire constantly on macOS because `wc -c` returns
  # "       0" (7 leading spaces) and the string compare `!= "0"` saw
  # padded-zero as non-zero. Numeric comparison fixes that AND the logic
  # is actually what we want.
  comma_count=$(printf '%s' "$codes_all" | tr -cd ',' | wc -c | tr -d ' ')
  has_5xx=$(printf '%s' "$codes_all" | grep -cE '(^|,)5[0-9]{2}(,|$)')
  code_cell="$code"
  if [ "$has_5xx" -gt 0 ]; then
    code_cell="$codes_all ⚠"
  elif [ "$comma_count" -gt 0 ]; then
    # 2+ distinct codes that are all non-5xx — less urgent, still worth
    # surfacing so a human can eyeball. Use a lighter marker.
    code_cell="$codes_all ◦"
  fi

  echo "| ${group} | \`${short_ep}\` | ${code_cell} | ${cold} | ${p50} | ${p95} | ${size} | \`${cc_short}\` |" >> "$OUT"
done

# Content assertion table
{
  echo
  echo "## Content assertions"
  echo
  echo "| Endpoint | Check | Verdict | Evidence |"
  echo "|---|---|---|---|"
  awk -F'\t' 'NR>1 {
    short = $1
    gsub(/https:\/\//, "", short)
    gsub(/opensyber\.cloud/, "", short)
    ev = $4
    if (length(ev) > 60) ev = substr(ev, 1, 60) "..."
    gsub(/\|/, "\\|", ev)
    verdict = ($3 == "PASS") ? "**PASS**" : "**FAIL**"
    printf "| `%s` | %s | %s | `%s` |\n", short, $2, verdict, ev
  }' "$A"
} >> "$OUT"

# Summary
{
  echo
  echo "## Summary"
  echo
  total=$(tail -n +2 "$A" | wc -l | tr -d ' ')
  passed=$(awk -F'\t' 'NR>1 && $3=="PASS"' "$A" | wc -l | tr -d ' ')
  failed=$(awk -F'\t' 'NR>1 && $3=="FAIL"' "$A" | wc -l | tr -d ' ')
  echo "- **Content assertions:** ${passed}/${total} passed (${failed} failed)"

  endpoints=$(awk -F'\t' 'NR>1 {print $2}' "$R" | sort -u | wc -l | tr -d ' ')
  total_probes=$(tail -n +2 "$R" | wc -l | tr -d ' ')
  errors=$(awk -F'\t' 'NR>1 && ($5>=500 || $5=="000")' "$R" | wc -l | tr -d ' ')
  echo "- **Latency probes:** ${total_probes} requests across ${endpoints} endpoints, ${errors} 5xx/connection errors"

  # Fastest + slowest warm endpoints
  fastest=$(awk -F'\t' 'NR>1 && $4>=2 {print $8 "\t" $2}' "$R" | sort -n | head -1)
  slowest=$(awk -F'\t' 'NR>1 && $4>=2 {print $8 "\t" $2}' "$R" | sort -n | tail -1)
  echo "- **Fastest warm:** ${fastest}"
  echo "- **Slowest warm:** ${slowest}"
} >> "$OUT"

echo "=== dashboard written to $OUT ==="
wc -l "$OUT"
