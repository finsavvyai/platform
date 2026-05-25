#!/bin/bash
set -e
echo "======================================="
echo "  Local CI Pipeline"
echo "======================================="
FAIL=0
step() { echo ""; echo "[$1] $2..."; }
pass() { echo "  PASS"; }
fail() { echo "  FAIL"; FAIL=1; }
step "go" "Build (.)"
if (cd "." && go build ./...); then pass; else fail; fi
step "go" "Test (.)"
if (cd "." && go test ./... 2>&1 | tail -20); then pass; else fail; fi
if [ -d "./web/node_modules" ]; then
  step "node" "TypeScript (./web)"
  if (cd "./web" && npx tsc --noEmit 2>/dev/null); then pass; else fail; fi
  step "node" "Test (./web)"
  if grep -q vitest "./web/package.json" 2>/dev/null; then
    if (cd "./web" && npx vitest run 2>&1 | tail -5); then pass; else fail; fi
  elif grep -q jest "./web/package.json" 2>/dev/null; then
    if (cd "./web" && npx jest 2>&1 | tail -5); then pass; else fail; fi
  elif grep -q '"test"' "./web/package.json" 2>/dev/null; then
    if (cd "./web" && npm test 2>&1 | tail -5); then pass; else fail; fi
  fi
  step "node" "Build (./web)"
  if grep -q vite "./web/package.json" 2>/dev/null; then
    if (cd "./web" && npx vite build 2>&1 | tail -3); then pass; else fail; fi
  elif grep -q '"build"' "./web/package.json" 2>/dev/null; then
    if (cd "./web" && npm run build 2>&1 | tail -3); then pass; else fail; fi
  else echo "  SKIP (no build script)"; fi
else
  echo ""; echo "[node] SKIP ./web (npm install needed)"
fi
step "lint" "File line limit (100)"
OVER=$(find .  -not -path './.git/*' -not -path '*/.git/*' -not -path './vendor/*' -not -path '*/vendor/*' -not -path './node_modules/*' -not -path '*/node_modules/*' -not -path './target/*' -not -path '*/target/*' -not -path './dist/*' -not -path '*/dist/*' -not -path './build/*' -not -path '*/build/*' -not -path './.claude/*' -not -path '*/.claude/*' -not -path './.claude/skills/*' -not -path '*/.claude/skills/*' \
  \( -name "*.go" -o -name "*.ts" -o -name "*.tsx" \
     -o -name "*.py" -o -name "*.rs" -o -name "*.java" \) \
  -exec sh -c 'l=$(wc -l < "$1"); [ "$l" -gt 100 ] && echo "$l $1"' _ {} \;)
if [ -z "$OVER" ]; then pass
else echo "$OVER"; fail; fi
echo ""
echo "======================================="
if [ $FAIL -eq 0 ]; then echo "  CI PASSED"
else echo "  CI FAILED"; exit 1; fi
echo "======================================="
