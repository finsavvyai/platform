#!/bin/bash

# ============================================================================
# QuantumBeam Production Readiness Verification Script
# ============================================================================
# This script verifies that all components are ready for production deployment
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Print functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_check() {
    echo -e "${BLUE}▶ Checking:${NC} $1"
}

print_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((FAILED++))
}

print_warn() {
    echo -e "${YELLOW}⚠ WARN:${NC} $1"
    ((WARNINGS++))
}

# Check function
check_file() {
    local file=$1
    local description=$2

    print_check "$description"
    if [ -f "$file" ]; then
        print_pass "$description exists"
        return 0
    else
        print_fail "$description not found at: $file"
        return 1
    fi
}

check_directory() {
    local dir=$1
    local description=$2

    print_check "$description"
    if [ -d "$dir" ]; then
        print_pass "$description exists"
        return 0
    else
        print_fail "$description not found at: $dir"
        return 1
    fi
}

# ============================================================================
# Start Verification
# ============================================================================

echo -e "${GREEN}"
cat << "EOF"
   ___                  _                  ____
  / _ \ _   _  __ _ _ __ | |_ _   _ _ __ ___ | __ )  ___  __ _ _ __ ___
 | | | | | | |/ _` | '_ \| __| | | | '_ ` _ \|  _ \ / _ \/ _` | '_ ` _ \
 | |_| | |_| | (_| | | | | |_| |_| | | | | | | |_) |  __/ (_| | | | | | |
  \__\_\\__,_|\__,_|_| |_|\__|\__,_|_| |_| |_|____/ \___|\__,_|_| |_| |_|

  Production Readiness Verification
EOF
echo -e "${NC}"

# ============================================================================
# 1. Backend Production Features
# ============================================================================
print_header "1. Backend Production Features"

check_file "internal/fraud/production_features.go" "Production wrapper service"
check_file "internal/fraud/service_production_test.go" "Production integration tests"
check_file "internal/fraud/health_handlers.go" "Health check handlers"

# Check for critical functions in production features
if [ -f "internal/fraud/production_features.go" ]; then
    print_check "Circuit breaker implementation"
    if grep -q "CircuitBreaker" internal/fraud/production_features.go; then
        print_pass "Circuit breaker found"
    else
        print_fail "Circuit breaker not implemented"
    fi

    print_check "Rate limiting implementation"
    if grep -q "RateLimiter\|rate.Limiter" internal/fraud/production_features.go; then
        print_pass "Rate limiting found"
    else
        print_fail "Rate limiting not implemented"
    fi

    print_check "Caching implementation"
    if grep -q "cache\|Cache" internal/fraud/production_features.go; then
        print_pass "Caching found"
    else
        print_fail "Caching not implemented"
    fi
fi

# ============================================================================
# 2. Docker and Deployment
# ============================================================================
print_header "2. Docker and Deployment"

check_file "Dockerfile.production" "Production Dockerfile"
check_file "docker-compose.production.yml" "Production Docker Compose"
check_file ".env.production.example" "Environment template"
check_file "scripts/deploy-production.sh" "Deployment script"
check_file "QUICK_DEPLOY.sh" "Quick deployment script"

# Check Dockerfile security features
if [ -f "Dockerfile.production" ]; then
    print_check "Non-root user in Dockerfile"
    if grep -q "USER appuser" Dockerfile.production; then
        print_pass "Non-root user configured"
    else
        print_fail "Container runs as root (security risk)"
    fi

    print_check "Health check in Dockerfile"
    if grep -q "HEALTHCHECK" Dockerfile.production; then
        print_pass "Health check configured"
    else
        print_warn "No health check configured"
    fi

    print_check "Multi-stage build"
    if grep -q "FROM.*AS builder" Dockerfile.production; then
        print_pass "Multi-stage build configured"
    else
        print_warn "Single-stage build (larger image size)"
    fi
fi

# ============================================================================
# 3. Documentation
# ============================================================================
print_header "3. Documentation"

check_file "README_PRODUCTION.md" "Production README"
check_file "DEPLOYMENT_SUMMARY.md" "Deployment summary"
check_file "DEPLOY_TO_PRODUCTION.md" "Platform deployment guides"
check_file "PRODUCTION_READINESS.md" "Production checklist"

# ============================================================================
# 4. Website
# ============================================================================
print_header "4. Marketing Website"

check_directory "web/marketing" "Marketing website directory"
check_file "web/marketing/package.json" "Website package.json"
check_file "web/marketing/app/page.tsx" "Website homepage"
check_file "web/marketing/app/globals.css" "Website styles"
check_file "web/marketing/QODO_DESIGN_UPDATE.md" "Design documentation"

# Try to build the website
if [ -d "web/marketing" ]; then
    print_check "Website build test"
    cd web/marketing
    if npm run build > /tmp/build.log 2>&1; then
        print_pass "Website builds successfully"
    else
        print_fail "Website build failed (check /tmp/build.log)"
    fi
    cd ../..
fi

# ============================================================================
# 5. Database Setup
# ============================================================================
print_header "5. Database Configuration"

check_directory "database" "Database directory"
check_directory "database/schemas" "Database schemas"
check_directory "migrations" "Database migrations"
check_file "database/init-databases.sh" "Database initialization script"

# Count migration files
if [ -d "migrations" ]; then
    MIGRATION_COUNT=$(ls -1 migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
    print_check "Migration files"
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        print_pass "Found $MIGRATION_COUNT migration files"
    else
        print_warn "No migration files found"
    fi
fi

# ============================================================================
# 6. Monitoring and Observability
# ============================================================================
print_header "6. Monitoring Stack"

check_directory "config/prometheus" "Prometheus configuration" || print_warn "Prometheus config not found (optional)"
check_directory "config/grafana" "Grafana configuration" || print_warn "Grafana config not found (optional)"

# Check for health endpoints in code
print_check "Health check endpoints"
if grep -r "health/live\|health/ready" internal/ > /dev/null 2>&1; then
    print_pass "Health endpoints implemented"
else
    print_warn "Health endpoints not found"
fi

# ============================================================================
# 7. Security
# ============================================================================
print_header "7. Security Configuration"

print_check "Environment template has security settings"
if [ -f ".env.production.example" ]; then
    if grep -q "JWT_SECRET\|API_KEY_ENCRYPTION" .env.production.example; then
        print_pass "Security environment variables documented"
    else
        print_fail "Missing security environment variables"
    fi
fi

print_check "No secrets in git"
if git check-ignore .env.production > /dev/null 2>&1; then
    print_pass ".env.production is gitignored"
else
    print_warn ".env.production should be in .gitignore"
fi

# ============================================================================
# 8. Testing
# ============================================================================
print_header "8. Test Coverage"

print_check "Production tests exist"
TEST_FILES=$(find internal -name "*_test.go" | wc -l | tr -d ' ')
if [ "$TEST_FILES" -gt 0 ]; then
    print_pass "Found $TEST_FILES test files"
else
    print_fail "No test files found"
fi

print_check "Integration tests"
if [ -d "tests/integration" ]; then
    INT_TEST_FILES=$(find tests/integration -name "*_test.go" | wc -l | tr -d ' ')
    print_pass "Found $INT_TEST_FILES integration test files"
else
    print_warn "No integration tests directory"
fi

# ============================================================================
# 9. Build Tools
# ============================================================================
print_header "9. Build Tools and Dependencies"

print_check "Docker installed"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    print_pass "Docker $DOCKER_VERSION installed"
else
    print_fail "Docker not installed"
fi

print_check "Docker Compose installed"
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f4 | tr -d ',')
    print_pass "Docker Compose $COMPOSE_VERSION installed"
else
    print_warn "Docker Compose not installed (optional)"
fi

print_check "Go installed"
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | cut -d' ' -f3)
    print_pass "$GO_VERSION installed"
else
    print_fail "Go not installed"
fi

print_check "Node.js installed"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_pass "Node.js $NODE_VERSION installed"
else
    print_warn "Node.js not installed (needed for website)"
fi

# ============================================================================
# 10. Go Module Dependencies
# ============================================================================
print_header "10. Go Dependencies"

print_check "go.mod exists"
if [ -f "go.mod" ]; then
    print_pass "go.mod found"

    print_check "Go modules are valid"
    if go mod verify > /dev/null 2>&1; then
        print_pass "Go modules verified"
    else
        print_warn "Go modules need verification (run: go mod tidy)"
    fi
else
    print_fail "go.mod not found"
fi

# ============================================================================
# Summary
# ============================================================================
print_header "Verification Summary"

echo -e "${BLUE}Results:${NC}"
echo -e "  ${GREEN}✓ Passed:${NC}   $PASSED"
echo -e "  ${RED}✗ Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}⚠ Warnings:${NC} $WARNINGS"
echo ""

# Calculate percentage
TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    PERCENTAGE=$((PASSED * 100 / TOTAL))
    echo -e "${BLUE}Success Rate:${NC} $PERCENTAGE%"
fi

echo ""

# Final verdict
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ PRODUCTION READY!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}You can now deploy to production using:${NC}"
    echo -e "  ${BLUE}1.${NC} ./QUICK_DEPLOY.sh               (fastest)"
    echo -e "  ${BLUE}2.${NC} ./scripts/deploy-production.sh  (full automation)"
    echo -e "  ${BLUE}3.${NC} railway up                       (cloud deploy)"
    echo ""
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Note: $WARNINGS warnings found (non-critical)${NC}"
    fi
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}✗ NOT READY FOR PRODUCTION${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${RED}Please fix the $FAILED failed checks before deploying.${NC}"
    echo ""
    exit 1
fi
