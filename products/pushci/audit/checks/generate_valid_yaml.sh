#!/usr/bin/env bash
# generate_valid_yaml.sh — when an AI provider is configured, `pushci generate`
# must produce a pushci.yml the runner can actually execute. Skips if no key.
set -o pipefail

have_key=0
for k in ANTHROPIC_API_KEY GROQ_API_KEY OPEN_AI_KEY OPENAI_API_KEY DEEPSEEK_API_KEY GEMINI_API_KEY; do
  v="${!k:-}"
  [ -n "$v" ] && have_key=1 && break
done
if [ $have_key -eq 0 ]; then
  echo "SKIP: no AI provider key in env"
  exit 77
fi

tmp="$(mktemp -d)"
trap "rm -rf '$tmp'" EXIT
cd "$tmp"
cat > package.json <<'JSON'
{ "name": "fx", "version": "1.0.0", "scripts": { "test": "echo ok", "build": "echo built" } }
JSON
git init -q
git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init

fails=0
note() { printf "  %s\n" "$*"; }

if ! "$PUSHCI" generate >/tmp/pushci-gen.log 2>&1; then
  note "✗ generate returned non-zero"
  fails=$((fails+1))
fi

if [ ! -s pushci.yml ]; then
  note "✗ pushci.yml empty or missing"
  fails=$((fails+1))
fi

# It must contain the canonical top-level keys or the runner can't execute it.
# Regression: v1.7.0 generates `checks:` at root (no `stages:`) and bare
# "build" / "test" commands that shell-out to missing binaries.
if grep -q "^stages:" pushci.yml; then
  note "✓ generated yml has stages: key"
else
  note "✗ generated yml missing 'stages:' (regression: v1.7.0 emits flat 'checks:' at root)"
  fails=$((fails+1))
fi

# And the generated file must actually run.
if "$PUSHCI" run >/tmp/pushci-gen-run.log 2>&1; then
  note "✓ generated pipeline runs"
else
  note "✗ generated pipeline fails to run — see /tmp/pushci-gen-run.log"
  fails=$((fails+1))
fi

exit $fails
