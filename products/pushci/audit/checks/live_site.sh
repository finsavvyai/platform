#!/usr/bin/env bash
# live_site.sh — optional live-network probe. Only runs if PUSHCI_LIVE=1.
set -u
set -o pipefail

if [ "${PUSHCI_LIVE:-0}" != "1" ]; then
  echo "SKIP: set PUSHCI_LIVE=1 to enable live site probes"
  exit 77
fi
if ! command -v curl >/dev/null; then
  echo "SKIP: curl not installed"
  exit 77
fi

fails=0
note() { printf "  %s\n" "$*"; }

probe() {
  local label="$1" url="$2" expect_codes="${3:-200}"
  local code
  # Accept either the non-redirected status or the final code after -L.
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" || echo 000)"
  case " $expect_codes " in
    *" $code "*)  note "✓ $label ($url → $code)"; return ;;
  esac
  note "✗ $label ($url → $code, wanted one of $expect_codes)"
  fails=$((fails+1))
}

probe "landing"          "https://pushci.dev"                   "200"
probe "pricing"          "https://pushci.dev/pricing"           "200"
probe "docs"             "https://pushci.dev/docs"              "200"
probe "api health"       "https://api.pushci.dev/health"        "200"
probe "dashboard"        "https://app.pushci.dev"               "200"
# GitHub redirects /releases/latest → /releases/tag/<version>. 302 is healthy.
probe "GitHub release"   "https://github.com/finsavvyai/pushci-cli/releases/latest" "200 301 302"

# Homepage should serve HTML with the expected h1 slug text
hero="$(curl -sS --max-time 10 https://pushci.dev | head -c 50000 || true)"
if printf "%s" "$hero" | grep -qi "CI/CD"; then
  note "✓ landing HTML mentions CI/CD"
else
  note "✗ landing HTML missing 'CI/CD' string"
  fails=$((fails+1))
fi

exit $fails
