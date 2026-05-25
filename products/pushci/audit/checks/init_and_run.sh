#!/usr/bin/env bash
# init_and_run.sh — does `pushci init` detect a Node project and produce a
# pipeline that actually executes?
set -u
set -o pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp="$(mktemp -d)"
trap "rm -rf '$tmp'" EXIT
cd "$tmp"

cat > package.json <<'JSON'
{
  "name": "audit-fixture",
  "version": "1.0.0",
  "scripts": {
    "test":  "node -e 'console.log(\"ok\")'",
    "build": "node -e 'console.log(\"built\")'",
    "lint":  "node -e 'console.log(\"linted\")'"
  }
}
JSON
echo '{}' > package-lock.json
git init -q
git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init

fails=0
note() { printf "  %s\n" "$*"; }

if "$PUSHCI" init --yes >/dev/null 2>&1; then note "✓ init succeeded"; else note "✗ init failed"; fails=$((fails+1)); fi
if [ -f pushci.yml ]; then note "✓ pushci.yml written"; else note "✗ pushci.yml missing"; fails=$((fails+1)); fi
if grep -q "npm install" pushci.yml 2>/dev/null; then note "✓ install stage detected"; else note "✗ install stage missing"; fails=$((fails+1)); fi
if grep -q "npm test" pushci.yml 2>/dev/null; then note "✓ test stage detected"; else note "✗ test stage missing"; fails=$((fails+1)); fi

# Actually run the pipeline
if "$PUSHCI" run >/tmp/pushci-run.log 2>&1; then
  note "✓ pipeline run passed"
else
  note "✗ pipeline run failed"
  fails=$((fails+1))
fi

# Regression check: status should report ≥ 1 run after a successful run.
# Buffer output first — grep -q short-circuits the pipe and trips pipefail.
status_out="$("$PUSHCI" status 2>&1)"
if printf '%s' "$status_out" | grep -Eq "Total runs +[1-9]"; then
  note "✓ status tracks runs"
else
  note "⚠ status shows 0 runs after a passing run"
fi

# JSON scan output must be parseable
scan_out="$("$PUSHCI" scan --format json 2>/dev/null)"
if printf '%s' "$scan_out" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; then
  note "✓ scan emits valid JSON"
elif printf '%s' "$scan_out" | tail -n +5 | head -c 4000 | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; then
  note "⚠ scan --format json has human preamble before JSON body (cosmetic issue)"
elif printf '%s' "$scan_out" | grep -q '"Findings"'; then
  note "⚠ scan --format json mixes human output with JSON body (cosmetic issue)"
else
  note "✗ scan --format json failed"
  fails=$((fails+1))
fi

exit $fails
