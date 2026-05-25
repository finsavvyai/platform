#!/bin/bash
# Production Validation Script — Task 12
# Runs all validation checks required before and after production deployment.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
DEPLOY_URL="${DEPLOY_URL:-https://studio.lunaos.ai}"

section() { echo -e "\n${BLUE}══ $1 ══${NC}"; }
ok()      { echo -e "${GREEN}✓${NC} $1"; ((PASS++)) || true; }
fail()    { echo -e "${RED}✗${NC} $1"; ((FAIL++)) || true; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; ((WARN++)) || true; }

# ─── 12.1 Security Audit ────────────────────────────────────────────────────
section "12.1 Security Audit"

if npm audit --production --audit-level=high 2>&1 | grep -q "found 0"; then
  ok "No high/critical npm vulnerabilities"
else
  fail "High or critical npm vulnerabilities found — run: npm audit fix"
fi

if grep -r "dangerouslySetInnerHTML" src/ --include="*.tsx" --include="*.ts" -l 2>/dev/null | grep -q .; then
  fail "dangerouslySetInnerHTML usage detected"
else
  ok "No dangerouslySetInnerHTML usage"
fi

if grep -r "eval(" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null | grep -q .; then
  fail "eval() usage detected"
else
  ok "No eval() usage"
fi

if grep -r "innerHTML" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null | grep -q .; then
  warn "innerHTML usage detected — verify DOMPurify sanitization"
else
  ok "No raw innerHTML usage"
fi

CSP=$(grep "Content-Security-Policy" netlify.toml)
if [ -n "$CSP" ]; then
  ok "CSP header configured in netlify.toml"
else
  fail "CSP header missing from netlify.toml"
fi

# ─── 12.2 Performance Validation ────────────────────────────────────────────
section "12.2 Performance Validation"

if npm run build 2>&1 | grep -q "built in"; then
  ok "Production build succeeded"
else
  fail "Production build failed"
fi

BUNDLE_SIZE=$(du -sk dist/ 2>/dev/null | cut -f1)
if [ -n "$BUNDLE_SIZE" ] && [ "$BUNDLE_SIZE" -lt 5120 ]; then
  ok "Bundle size: ${BUNDLE_SIZE}KB (< 5 MB)"
else
  warn "Bundle size: ${BUNDLE_SIZE}KB — consider code splitting"
fi

if command -v lhci &>/dev/null; then
  if lhci autorun 2>&1 | grep -q "assertion passed"; then
    ok "Lighthouse CI assertions passed"
  else
    warn "Lighthouse CI assertions failed — check lighthouserc.js thresholds"
  fi
else
  warn "lhci not found — skipping Lighthouse validation"
fi

# ─── 12.3 Test Coverage ──────────────────────────────────────────────────────
section "12.3 Test Coverage"

COVERAGE_OUT=$(npm run test:coverage -- --json 2>/dev/null || echo "")
if [ -f coverage/coverage-summary.json ]; then
  LINES=$(node -e "const c=require('./coverage/coverage-summary.json'); console.log(c.total.lines.pct)" 2>/dev/null || echo "0")
  if (( $(echo "$LINES >= 80" | bc -l) )); then
    ok "Line coverage: ${LINES}% (≥ 80%)"
  else
    fail "Line coverage: ${LINES}% (< 80% required)"
  fi
else
  warn "Coverage summary not found — run: npm run test:coverage"
fi

if npm test 2>&1 | grep -q "Tests:.*passed"; then
  ok "All unit tests pass"
else
  fail "Unit tests failed"
fi

# ─── 12.4 Deployment Pipeline ───────────────────────────────────────────────
section "12.4 Deployment Pipeline"

if [ -f ".github/workflows/deploy.yml" ]; then
  ok "GitHub Actions deploy workflow exists"
else
  fail ".github/workflows/deploy.yml missing"
fi

if ./scripts/health-check.sh "$DEPLOY_URL" 2>&1 | grep -q "All critical health checks passed"; then
  ok "Health check passed: $DEPLOY_URL"
else
  fail "Health check failed: $DEPLOY_URL"
fi

if [ -f "scripts/rollback.sh" ] && [ -x "scripts/rollback.sh" ]; then
  ok "Rollback script is present and executable"
else
  fail "Rollback script missing or not executable"
fi

# ─── 12.5 Monitoring & Alerting ─────────────────────────────────────────────
section "12.5 Monitoring & Alerting"

if [ -f "monitoring/dashboards.json" ]; then
  ok "DataDog dashboards config present"
else
  fail "monitoring/dashboards.json missing"
fi

if [ -f "monitoring/alerts.json" ]; then
  ALERT_COUNT=$(node -e "const a=require('./monitoring/alerts.json'); console.log(a.alerts.length)" 2>/dev/null || echo "0")
  ok "Alert rules defined: ${ALERT_COUNT} alerts"
else
  fail "monitoring/alerts.json missing"
fi

if grep -q "VITE_SENTRY_DSN" .env.example 2>/dev/null; then
  ok "Sentry DSN documented in .env.example"
else
  warn "VITE_SENTRY_DSN not in .env.example"
fi

if grep -q "VITE_DATADOG_APP_ID" .env.example 2>/dev/null; then
  ok "DataDog config documented in .env.example"
else
  warn "VITE_DATADOG_APP_ID not in .env.example"
fi

# ─── 12.6 Accessibility Audit ───────────────────────────────────────────────
section "12.6 Accessibility Audit"

if npm run test:e2e 2>&1 | grep -q "passed"; then
  ok "E2E tests pass (includes a11y assertions)"
else
  warn "E2E tests not passing — verify accessibility assertions"
fi

if grep -r "aria-label\|role=" src/ --include="*.tsx" -l 2>/dev/null | grep -q .; then
  ok "ARIA labels present in components"
else
  warn "No ARIA labels found — check accessibility compliance"
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════"
echo "  Production Validation Summary"
echo "══════════════════════════════════════"
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}✗ Validation FAILED — do not deploy to production${NC}"
  exit 1
else
  echo -e "${GREEN}✓ Validation PASSED — ready for production${NC}"
  exit 0
fi
