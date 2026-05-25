#!/usr/bin/env bash
# promises.sh — verify the marketing numbers on the landing page against
# the actual code counts. Fails if the marketing claim diverges.
#
# The repo root (../) is the ground truth. Claims come from:
#   - package.json "description"
#   - web/landing/index.html meta tags
#   - web/landing/src/components/*.ts feature data
set -u
set -o pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo"

fails=0
pass_line() { printf "  ✓ %s\n" "$*"; }
fail_line() { printf "  ✗ %s\n" "$*"; fails=$((fails+1)); }

# --- Deploy targets ---
# Count the targets the CLI actually advertises in `pushci deploy --help`.
# Strip ANSI before parsing.
strip_ansi() { sed -E 's/\x1b\[[0-9;]*[mGKH]//g'; }
deploy_help="$("$PUSHCI" deploy --help 2>&1 | strip_ansi || true)"
actual_targets=$(printf "%s" "$deploy_help" | awk '/^Targets:/{flag=1; next} flag{print; exit}' | tr ',' '\n' | awk 'NF' | wc -l | tr -d ' ')
claimed_targets=$(grep -oE '"[0-9]+ deploy targets"|"23 deploy targets"' package.json web/landing/index.html 2>/dev/null | grep -oE '[0-9]+' | head -1)
claimed_targets=${claimed_targets:-?}
if [ "$actual_targets" -gt 0 ] && [ "$actual_targets" = "$claimed_targets" ]; then
  pass_line "deploy targets: claim=$claimed_targets actual=$actual_targets"
else
  fail_line "deploy targets: claim=$claimed_targets actual=$actual_targets (fix index.html or add/remove targets)"
fi

# Cross-check the landing-page feature card number (separate file)
landing_targets_num=$(grep -hE '[0-9]+\s*Deploy Target' web/landing/src/**/*.ts web/landing/src/**/*.tsx 2>/dev/null | grep -oE '[0-9]+' | head -1)
if [ -n "$landing_targets_num" ]; then
  if [ "$landing_targets_num" = "$actual_targets" ]; then
    pass_line "landing featuresData deploy targets: $landing_targets_num matches actual"
  else
    fail_line "landing featuresData says $landing_targets_num deploy targets — actual is $actual_targets"
  fi
fi

# --- Installable skills ---
# Source of truth: api/src/skills.ts skill catalog entries.
if [ -f api/src/skills.ts ]; then
  actual_skills=$(grep -cE '^\s*\{[[:space:]]*id:' api/src/skills.ts || echo 0)
else
  actual_skills=0
fi
claimed_skills=$(grep -oE '"[0-9]+ installable skills"' package.json 2>/dev/null | grep -oE '[0-9]+' | head -1)
claimed_skills=${claimed_skills:-0}
if [ "$claimed_skills" -gt 0 ]; then
  # Allow claim to be lower than actual, but not higher.
  if [ "$claimed_skills" -le "$actual_skills" ]; then
    if [ "$claimed_skills" = "$actual_skills" ]; then
      pass_line "installable skills: claim=$claimed_skills actual=$actual_skills"
    else
      pass_line "installable skills: claim=$claimed_skills actual=$actual_skills (undercount is safe but stale)"
    fi
  else
    fail_line "installable skills: claim=$claimed_skills but catalog only has $actual_skills"
  fi
fi

# --- CLI command count ---
# The help text should list at least the 24 commands package.json claims.
visible=$("$PUSHCI" --help 2>&1 | strip_ansi | awk '/^Commands:/,/^$/ {print}' | grep -cE '^  [a-z][a-z-]*')
if [ "$visible" -ge 24 ]; then
  pass_line "visible CLI commands: $visible (≥ 24 claimed)"
else
  fail_line "visible CLI commands: $visible (< 24 claimed)"
fi

# --- CLI version vs package.json ---
pkg_ver=$(grep -oE '"version"\s*:\s*"[^"]+"' package.json | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
cli_ver=$("$PUSHCI" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [ "$pkg_ver" = "$cli_ver" ]; then
  pass_line "version: package.json $pkg_ver matches CLI $cli_ver"
else
  fail_line "version: package.json $pkg_ver != CLI $cli_ver"
fi

# --- CLAUDE.md staleness ---
cm_ver=$(grep -oE 'v1\.[0-9]+\.[0-9]+' CLAUDE.md | head -1 | tr -d v)
if [ "$cm_ver" = "$cli_ver" ] || [ -z "$cm_ver" ]; then
  pass_line "CLAUDE.md version matches ($cm_ver)"
else
  fail_line "CLAUDE.md references $cm_ver but CLI is $cli_ver (doc is stale)"
fi

exit $fails
