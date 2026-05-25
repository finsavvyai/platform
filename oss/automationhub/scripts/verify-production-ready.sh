#!/usr/bin/env bash
# Pre-deploy production readiness verification.
# Usage: ./scripts/verify-production-ready.sh [--skip-migrations] [--health-url URL]
# Run from repo root. Set PRODUCTION=1 or ENVIRONMENT=production to enforce prod checks.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SKIP_MIGRATIONS=false
HEALTH_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-migrations) SKIP_MIGRATIONS=true; shift ;;
    --health-url)      HEALTH_URL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--skip-migrations] [--health-url URL]"
      echo "  --skip-migrations  Do not run alembic migration check"
      echo "  --health-url URL   Optional: curl GET URL and expect 200"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

fail() { echo -e "${RED}FAIL:${NC} $1"; exit 1; }
ok()   { echo -e "${GREEN}OK:${NC} $1"; }
warn() { echo -e "${YELLOW}WARN:${NC} $1"; }

echo "Verifying production readiness (root: $ROOT_DIR)"
echo ""

# Required env vars when production mode is indicated
if [[ "${PRODUCTION:-}" == "1" || "${PRODUCTION:-}" == "true" || "${ENVIRONMENT:-}" == "production" ]]; then
  [[ -n "${SECRET_KEY:-}" ]] || fail "SECRET_KEY is not set"
  [[ ${#SECRET_KEY} -ge 32 ]] || fail "SECRET_KEY must be at least 32 characters"
  if [[ "${SECRET_KEY}" == *"dev"* || "${SECRET_KEY}" == *"test"* ]]; then
    fail "SECRET_KEY must not contain 'dev' or 'test' in production"
  fi
  ok "SECRET_KEY set and valid"
  if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == *"sqlite"* ]]; then
    fail "DATABASE_URL must not use SQLite in production"
  fi
  [[ -n "${DATABASE_URL:-}" ]] || warn "DATABASE_URL not set (required for backend)"
  [[ "${DEBUG:-}" != "true" && "${DEBUG:-}" != "1" ]] || fail "DEBUG must be false in production"
  ok "Production env checks passed"
else
  echo "PRODUCTION/ENVIRONMENT not set to production — skipping strict env checks"
  [[ -n "${SECRET_KEY:-}" ]] && ok "SECRET_KEY set" || warn "SECRET_KEY not set (required for production)"
  [[ -n "${DATABASE_URL:-}" ]] && ok "DATABASE_URL set" || warn "DATABASE_URL not set"
fi

# Backend dir and alembic
if [[ -d "$BACKEND_DIR" ]]; then
  if [[ "$SKIP_MIGRATIONS" != true ]]; then
    if [[ -f "$BACKEND_DIR/alembic.ini" ]]; then
      (cd "$BACKEND_DIR" && alembic current 2>/dev/null) && ok "Alembic current" || warn "Alembic current failed (run: cd backend && alembic upgrade head)"
    else
      warn "No alembic.ini in backend — skipping migration check"
    fi
  fi
else
  warn "Backend dir not found: $BACKEND_DIR"
fi

# Optional health URL check
if [[ -n "$HEALTH_URL" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    ok "Health URL $HEALTH_URL returned 200"
  else
    fail "Health URL $HEALTH_URL returned $code (expected 200)"
  fi
fi

echo ""
echo -e "${GREEN}Verification complete.${NC} Run tests: cd backend && pytest -v --tb=short"
