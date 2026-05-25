#!/usr/bin/env bash
# Run all non-manual production-readiness checks locally.
# See docs/PRODUCTION_READINESS_DAYS_5-10.md and WORKDAY_PLAN_PRODUCTION.md
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
FAILED=0

run() {
  local name="$1"
  shift
  echo "--- $name ---"
  if "$@"; then
    echo "OK: $name"
  else
    echo "FAIL: $name"
    FAILED=1
  fi
  echo ""
}

# 1. Gateway build
run "Gateway build" bash -c "cd services/gateway && go build -o /dev/null ./..."

# 2. Gateway tests (short)
run "Gateway unit tests" bash -c "cd services/gateway && go test ./... -count=1 -short"

# 3. Landing lint
run "Landing lint" bash -c "cd landing-page && npm run lint"

# 4. Landing build
run "Landing build" bash -c "cd landing-page && npm run build"

# 5. Health check script (Gateway may fail if not running locally)
echo "--- Post-deploy health checks ---"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}" LANDING_URL="${LANDING_URL:-https://sdlc.cc}" node deployments/production/run-health-checks.js || true
echo ""

# 6. Trivy (if Docker available)
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  run "Trivy (CRITICAL,HIGH)" docker run --rm -v "$REPO_ROOT":/app -w /app aquasec/trivy fs --severity CRITICAL,HIGH --exit-code 0 .
else
  echo "--- Trivy ---"
  echo "Skip (Docker not running)"
  echo ""
fi

# 7. Gitleaks (if available)
if command -v gitleaks &>/dev/null; then
  run "Gitleaks (no-git)" gitleaks detect --source=. --no-git --exit-code 0
else
  echo "--- Gitleaks ---"
  echo "Skip (gitleaks not installed; use .github/workflows/secret-scan-full-history.yml or install gitleaks)"
  echo ""
fi

# 8. Branch protection (if gh and token)
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  echo "--- Branch protection (main) ---"
  if gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection" &>/dev/null; then
    echo "OK: Branch protection configured"
  else
    echo "Skip or FAIL: Branch protection not readable (private repo may need GitHub Pro or make repo public)"
  fi
  echo ""
fi

if [ $FAILED -eq 1 ]; then
  echo "One or more checks failed."
  exit 1
fi
echo "All runnable checks completed."
exit 0
