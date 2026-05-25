#!/bin/bash
# Pre-commit compliance hook: scans staged files for sanctioned entity names
# Warns (does not block) if any name matches with confidence > 80%
set -euo pipefail

API_URL="${AMLIQ_API_URL:-http://localhost:8080}"
ENDPOINT="/api/v1/screen/public-demo"
WARN_THRESHOLD=0.8
FOUND_WARNINGS=0

# Get staged text files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | \
  grep -E '\.(txt|md|json|csv|doc|go|ts|tsx|js|yaml|yml)$' || true)

if [[ -z "$STAGED_FILES" ]]; then
  exit 0
fi

# Extract capitalized multi-word names (potential entity names)
extract_names() {
  grep -oE '\b[A-Z][a-z]+ [A-Z][a-z]+( [A-Z][a-z]+)*\b' "$1" 2>/dev/null | \
    sort -u | head -20
}

screen_name() {
  local name="$1"
  local file="$2"
  local result
  result=$(curl -s -m 3 "${API_URL}${ENDPOINT}" \
    -X POST -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"fuzzy_min\":$WARN_THRESHOLD}" 2>/dev/null) || return 0

  # Check for high-confidence matches
  python3 -c "
import json, sys
try:
    d = json.loads('''$result''').get('data', {})
    for m in d.get('matches', []):
        conf = m.get('confidence', 0)
        if conf >= $WARN_THRESHOLD:
            ename = m.get('entity_name', '?')
            lid = m.get('list_id', '?')
            pct = conf * 100
            print(f'WARNING: {\"$file\"} mentions \"{\"$name\"}\" -- {ename} on {lid} ({pct:.0f}%)')
            sys.exit(1)
except:
    pass
sys.exit(0)
" 2>/dev/null
  return $?
}

echo "AMLIQ Compliance Check: scanning staged files..."

for file in $STAGED_FILES; do
  if [[ ! -f "$file" ]]; then
    continue
  fi
  NAMES=$(extract_names "$file")
  if [[ -z "$NAMES" ]]; then
    continue
  fi
  while IFS= read -r name; do
    if [[ ${#name} -lt 5 ]]; then
      continue
    fi
    if screen_name "$name" "$file"; then
      : # clean
    else
      FOUND_WARNINGS=$((FOUND_WARNINGS + 1))
    fi
  done <<< "$NAMES"
done

if [[ $FOUND_WARNINGS -gt 0 ]]; then
  echo ""
  echo "Found $FOUND_WARNINGS potential sanctions matches in staged files."
  echo "Review before committing. This is a WARNING — commit proceeds."
  echo ""
fi

# Always allow commit (warning only, never blocks)
exit 0
