#!/usr/bin/env bash
# Enforce 200-line cap per CLAUDE.md. Non-test source files only.
set -euo pipefail

CAP=200
VIOLATIONS=0

while IFS= read -r f; do
  [[ "$f" == *.test.ts ]] && continue
  [[ "$f" == *.d.ts ]] && continue
  lines=$(wc -l < "$f")
  if (( lines > CAP )); then
    echo "::error file=$f::File $f has $lines lines (>${CAP})"
    VIOLATIONS=$((VIOLATIONS+1))
  fi
done < <(find sdk/src gateway/src -name "*.ts" 2>/dev/null)

if (( VIOLATIONS > 0 )); then
  echo "Line-cap violations: $VIOLATIONS"
  exit 1
fi
echo "Line-cap OK (all files ≤${CAP} lines)"
