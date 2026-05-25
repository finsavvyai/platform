#!/usr/bin/env bash
# ai_provider_override.sh — verify PUSHCI_AI_PROVIDER picks the right backend
# and the user-facing banner is NOT misleading.
set -u
set -o pipefail

# Need at least two keys to exercise the override
have_anthropic=0; have_groq=0
[ -n "${ANTHROPIC_API_KEY:-}" ] && have_anthropic=1
[ -n "${GROQ_API_KEY:-}" ] && have_groq=1
if [ $have_anthropic -eq 0 ] || [ $have_groq -eq 0 ]; then
  echo "SKIP: need both ANTHROPIC_API_KEY and GROQ_API_KEY set to test override"
  exit 77
fi

tmp="$(mktemp -d)"
trap "rm -rf '$tmp'" EXIT
cd "$tmp"
git init -q
git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
# Make sure there's *something* for `ask` to look at so it doesn't trip on detection
cat > package.json <<'JSON'
{ "name": "fx", "version": "1.0.0", "scripts": { "test": "echo ok" } }
JSON
"$PUSHCI" init --yes >/dev/null 2>&1 || true

fails=0
note() { printf "  %s\n" "$*"; }

out_groq=$(PUSHCI_AI_PROVIDER=groq "$PUSHCI" ask "one word answer: ok" 2>&1 | head -5)
if echo "$out_groq" | grep -qi "Groq"; then
  note "✓ PUSHCI_AI_PROVIDER=groq selects Groq backend"
else
  note "✗ PUSHCI_AI_PROVIDER=groq did not select Groq (banner: $out_groq)"
  fails=$((fails+1))
fi

# Regression check: the "Using your own ANTHROPIC_API_KEY" banner currently
# prints for EVERY provider (hardcoded string). Flag this as a bug.
if echo "$out_groq" | grep -q "Using your own ANTHROPIC_API_KEY"; then
  note "⚠ misleading banner: says ANTHROPIC_API_KEY when Groq is the active provider"
fi

out_anthropic=$(PUSHCI_AI_PROVIDER=anthropic "$PUSHCI" ask "one word answer: ok" 2>&1 | head -5)
if echo "$out_anthropic" | grep -qi "Anthropic"; then
  note "✓ PUSHCI_AI_PROVIDER=anthropic selects Claude backend"
else
  note "✗ PUSHCI_AI_PROVIDER=anthropic did not select Anthropic"
  fails=$((fails+1))
fi

exit $fails
