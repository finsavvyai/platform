#!/usr/bin/env bash
# CLAUDE.md hard rule: max 200 LOC per source file in services/* and packages/*.
#
# Mode A (default): "delta" — fail only on files that have grown to/past the
# cap on this branch vs. origin/main. Lets the existing burn-down stay green
# while preventing regressions.
#
# Mode B: "all" — fail on any production source file >200 LOC. Run locally to
# see the full violation list; not used in CI until burn-down completes.
set -euo pipefail

MAX_LINES=${MAX_LINES:-200}
MODE=${1:-delta}
BASE_REF=${BASE_REF:-origin/main}

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

is_prod_source() {
  local f=$1
  case "$f" in
    */node_modules/*|*/.venv/*|*/vendor/*|*/.next/*|*/dist/*|*/build/*) return 1 ;;
    */.wrangler/*|*/.egg-info/*) return 1 ;;
    *_test.go|*.test.ts|*.test.tsx|test_*.py|*_test.py) return 1 ;;
    *.generated.ts|*.gen.go|*_pb.go|*.pb.go) return 1 ;;
  esac
  case "$f" in
    services/*|packages/*) ;;
    *) return 1 ;;
  esac
  case "$f" in
    *.go|*.py|*.ts|*.tsx|*.js|*.jsx) return 0 ;;
  esac
  return 1
}

violations=0
report=""

check_file() {
  local f=$1
  is_prod_source "$f" || return 0
  [ -f "$f" ] || return 0
  local lines
  lines=$(wc -l < "$f" | tr -d ' ')
  if [ "$lines" -gt "$MAX_LINES" ]; then
    report+=$'\n  '"$lines  $f"
    violations=$((violations + 1))
  fi
}

file_lines_at_ref() {
  local ref=$1 f=$2
  git show "$ref:$f" 2>/dev/null | wc -l | tr -d ' '
}

check_delta() {
  local f=$1
  is_prod_source "$f" || return 0
  [ -f "$f" ] || return 0
  local now_lines base_lines
  now_lines=$(wc -l < "$f" | tr -d ' ')
  base_lines=$(file_lines_at_ref "$BASE_REF" "$f")
  if [ "$now_lines" -le "$MAX_LINES" ]; then
    return 0
  fi
  # Over the cap. Flag only if (a) net-new file, or (b) grew vs base.
  if [ "$base_lines" = "0" ] || [ "$now_lines" -gt "$base_lines" ]; then
    report+=$'\n  '"$now_lines  $f  (was $base_lines @ $BASE_REF)"
    violations=$((violations + 1))
  fi
}

case "$MODE" in
  delta)
    git fetch --no-tags --depth=1 origin main >/dev/null 2>&1 || true
    changed=$(git diff --name-only --diff-filter=AM "$BASE_REF"...HEAD 2>/dev/null || true)
    if [ -z "$changed" ]; then
      changed=$(git diff --name-only --diff-filter=AM HEAD 2>/dev/null || true)
    fi
    for f in $changed; do check_delta "$f"; done
    ;;
  all)
    while IFS= read -r f; do check_file "$f"; done < <(git ls-files 'services/*' 'packages/*')
    ;;
  *)
    echo "usage: $0 [delta|all]" >&2
    exit 2
    ;;
esac

if [ "$violations" -gt 0 ]; then
  echo "FAIL: $violations file(s) exceed CLAUDE.md cap of $MAX_LINES lines (mode=$MODE):"
  echo "$report"
  echo
  echo "Refactor: split by feature/module responsibility. See CLAUDE.md."
  exit 1
fi

echo "OK: no source files over $MAX_LINES lines (mode=$MODE)."
