#!/usr/bin/env bash
# landing_seo.sh — static checks on the landing HTML head + legal pages.
# No network required.
set -u
set -o pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo"

fails=0
pass() { printf "  ✓ %s\n" "$*"; }
fail() { printf "  ✗ %s\n" "$*"; fails=$((fails+1)); }
warn() { printf "  ⚠ %s\n" "$*"; }  # tracked but does not fail the check

check_warn() {
  local label="$1" pattern="$2"
  if printf "%s" "$h" | grep -qE "$pattern"; then pass "$label"; else warn "$label (missing — nice-to-have, not a blocker)"; fi
}

h="$(cat web/landing/index.html 2>/dev/null || true)"
if [ -z "$h" ]; then
  echo "FATAL: web/landing/index.html not found"
  exit 1
fi

check_any() {
  local label="$1" pattern="$2"
  if printf "%s" "$h" | grep -qE "$pattern"; then pass "$label"; else fail "$label"; fi
}

check_any "has <title>"                                        '<title>'
check_any "meta description present"                           '<meta[^>]+name=["'"'"']description["'"'"']'
check_any "OG title present"                                   'property=["'"'"']og:title["'"'"']'
check_any "OG image present"                                   'property=["'"'"']og:image["'"'"']'
check_any "Twitter card present"                               'name=["'"'"']twitter:card["'"'"']'
check_any "canonical link present"                             'rel=["'"'"']canonical["'"'"']'
check_any "JSON-LD structured data present"                    'application/ld\+json'
check_any "viewport meta present"                              'name=["'"'"']viewport["'"'"']'
# These are nice-to-haves, not blockers. Surface as warnings so the check
# still passes when everything critical is in place.
check_warn "theme-color present"                               'name=["'"'"']theme-color["'"'"']'
check_warn "robots meta present on landing"                    'name=["'"'"']robots["'"'"']'
# Dashboard should be noindex
dh="$(cat web/dashboard/index.html 2>/dev/null || true)"
if printf "%s" "$dh" | grep -qE 'name=["'"'"']robots["'"'"'][^>]*noindex'; then
  pass "dashboard marked noindex"
else
  fail "dashboard should be <meta name=\"robots\" content=\"noindex,follow\">"
fi

# Legal pages exist
for p in PrivacyPage TermsPage RefundPage; do
  if [ -f "web/landing/src/pages/$p.tsx" ]; then
    pass "legal page: $p"
  else
    fail "missing legal page: $p"
  fi
done

# Claim consistency: hero social-proof line in Hero.tsx should mention
# the same number of deploy targets as package.json.
hero_targets=$(grep -oE '[0-9]+[[:space:]]+deploy targets' web/landing/src/components/Hero.tsx 2>/dev/null | head -1 | grep -oE '[0-9]+')
pkg_targets=$(grep -oE '[0-9]+ deploy targets' package.json 2>/dev/null | head -1 | grep -oE '[0-9]+')
if [ "$hero_targets" = "$pkg_targets" ] && [ -n "$hero_targets" ]; then
  pass "Hero deploy-target count matches package.json ($hero_targets)"
else
  fail "Hero deploy-target count ($hero_targets) does not match package.json ($pkg_targets)"
fi

exit $fails
