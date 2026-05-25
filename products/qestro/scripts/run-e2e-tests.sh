#!/bin/bash
# run-e2e-tests.sh
# Smart test runner with health checks

set -e

echo "🧪 Questro E2E Test Runner"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

# Check if app is running
echo "🔍 Pre-flight checks..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_error "Application is not running at http://localhost:3000"
    echo ""
    echo "Please start the application first:"
    echo "  npm run dev:frontend"
    echo ""
    exit 1
fi
print_success "Application is running"

# Check Playwright installation
if ! npx playwright --version > /dev/null 2>&1; then
    print_error "Playwright is not installed"
    echo ""
    echo "Please run setup first:"
    echo "  ./scripts/test-setup.sh"
    echo ""
    exit 1
fi
print_success "Playwright is installed"

# Parse arguments
TEST_SUITE="${1:-all}"
MODE="${2:-headless}"

echo ""
echo "📋 Test Configuration:"
echo "   Suite: $TEST_SUITE"
echo "   Mode: $MODE"
echo ""

# Run tests based on arguments
case $TEST_SUITE in
    auth)
        print_info "Running authentication tests..."
        npx playwright test tests/e2e/auth/ "$@"
        ;;
    dashboard)
        print_info "Running dashboard tests..."
        npx playwright test tests/e2e/dashboard/ "$@"
        ;;
    projects)
        print_info "Running project tests..."
        npx playwright test tests/e2e/projects/ "$@"
        ;;
    smoke)
        print_info "Running smoke tests (critical paths only)..."
        npx playwright test tests/e2e/auth/01-login.spec.ts tests/e2e/dashboard/02-dashboard-navigation.spec.ts --grep "@smoke"
        ;;
    all)
        print_info "Running all E2E tests..."
        npx playwright test
        ;;
    *)
        print_error "Unknown test suite: $TEST_SUITE"
        echo ""
        echo "Available test suites:"
        echo "  all        - Run all tests (default)"
        echo "  auth       - Authentication tests only"
        echo "  dashboard  - Dashboard tests only"
        echo "  projects   - Project tests only"
        echo "  smoke      - Critical path tests only"
        echo ""
        echo "Usage:"
        echo "  ./scripts/run-e2e-tests.sh [suite] [mode]"
        echo ""
        echo "Examples:"
        echo "  ./scripts/run-e2e-tests.sh auth"
        echo "  ./scripts/run-e2e-tests.sh projects headed"
        echo "  ./scripts/run-e2e-tests.sh smoke"
        echo ""
        exit 1
        ;;
esac

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    print_success "All tests passed!"
    echo ""
    echo "📊 View detailed report:"
    echo "   npm run test:e2e:report"
else
    print_error "Some tests failed"
    echo ""
    echo "🔍 To debug:"
    echo "   npm run test:e2e:debug"
    echo ""
    echo "📊 View report:"
    echo "   npm run test:e2e:report"
fi

exit $EXIT_CODE
