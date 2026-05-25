#!/bin/bash
# test-diagnostic.sh
# Comprehensive diagnostic script for E2E testing issues

echo "🔍 Questro E2E Testing Diagnostic"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_section() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━ $1 ━━━${NC}"
    echo ""
}

# 1. Check Node.js
print_section "Node.js Environment"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_check 0 "Node.js installed: $NODE_VERSION"
else
    print_check 1 "Node.js not found"
    exit 1
fi

# 2. Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_check 0 "npm installed: $NPM_VERSION"
else
    print_check 1 "npm not found"
    exit 1
fi

# 3. Check project structure
print_section "Project Structure"

if [ -f "package.json" ]; then
    print_check 0 "package.json exists"
else
    print_check 1 "package.json missing"
fi

if [ -f "playwright.config.ts" ]; then
    print_check 0 "playwright.config.ts exists"
else
    print_check 1 "playwright.config.ts missing"
fi

if [ -d "tests/e2e" ]; then
    print_check 0 "tests/e2e directory exists"

    # Count test files
    TEST_COUNT=$(find tests/e2e -name "*.spec.ts" -type f | wc -l | xargs)
    print_info "Found $TEST_COUNT test files"
else
    print_check 1 "tests/e2e directory missing"
fi

# 4. Check dependencies
print_section "Dependencies"

if [ -d "node_modules" ]; then
    print_check 0 "node_modules exists"

    if [ -d "node_modules/@playwright/test" ]; then
        print_check 0 "Playwright installed"

        # Check Playwright version
        PLAYWRIGHT_VERSION=$(cat node_modules/@playwright/test/package.json | grep '"version"' | head -1 | cut -d'"' -f4)
        print_info "Playwright version: $PLAYWRIGHT_VERSION"
    else
        print_check 1 "Playwright not installed"
        echo ""
        echo "Run: npm install"
    fi
else
    print_check 1 "node_modules missing"
    echo ""
    echo "Run: npm install"
fi

# 5. Check Playwright browsers
print_section "Playwright Browsers"

if [ -d "$HOME/Library/Caches/ms-playwright" ] || [ -d "$HOME/.cache/ms-playwright" ]; then
    print_check 0 "Playwright browsers installed"

    # Count browsers
    BROWSER_COUNT=0
    if [ -d "$HOME/Library/Caches/ms-playwright" ]; then
        BROWSER_COUNT=$(ls -1 "$HOME/Library/Caches/ms-playwright" 2>/dev/null | wc -l | xargs)
    elif [ -d "$HOME/.cache/ms-playwright" ]; then
        BROWSER_COUNT=$(ls -1 "$HOME/.cache/ms-playwright" 2>/dev/null | wc -l | xargs)
    fi
    print_info "Found $BROWSER_COUNT browser installations"
else
    print_check 1 "Playwright browsers not installed"
    echo ""
    echo "Run: npx playwright install"
fi

# 6. Check test files
print_section "Test Files"

if [ -f "tests/e2e/auth/01-login.spec.ts" ]; then
    print_check 0 "Auth tests exist"
else
    print_check 1 "Auth tests missing"
fi

if [ -f "tests/e2e/dashboard/02-dashboard-navigation.spec.ts" ]; then
    print_check 0 "Dashboard tests exist"
else
    print_check 1 "Dashboard tests missing"
fi

if [ -f "tests/e2e/projects/03-project-creation.spec.ts" ]; then
    print_check 0 "Project tests exist"
else
    print_check 1 "Project tests missing"
fi

# 7. Check page objects
print_section "Page Objects"

if [ -f "tests/e2e/page-objects/LoginPage.ts" ]; then
    print_check 0 "LoginPage exists"
else
    print_check 1 "LoginPage missing"
fi

if [ -f "tests/e2e/page-objects/DashboardPage.ts" ]; then
    print_check 0 "DashboardPage exists"
else
    print_check 1 "DashboardPage missing"
fi

if [ -f "tests/e2e/page-objects/ProjectsPage.ts" ]; then
    print_check 0 "ProjectsPage exists"
else
    print_check 1 "ProjectsPage missing"
fi

# 8. Check utilities
print_section "Test Utilities"

if [ -f "tests/e2e/utils/test-helpers.ts" ]; then
    print_check 0 "test-helpers.ts exists"
else
    print_check 1 "test-helpers.ts missing"
fi

if [ -f "tests/e2e/fixtures/test-users.ts" ]; then
    print_check 0 "test-users.ts exists"
else
    print_check 1 "test-users.ts missing"
fi

# 9. Check application
print_section "Application Status"

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_check 0 "Application is running at http://localhost:3000"
else
    print_check 1 "Application is NOT running at http://localhost:3000"
    echo ""
    echo -e "${YELLOW}⚠${NC} Start the application first:"
    echo "  Terminal 1: npm run dev:frontend"
fi

# 10. Check Playwright config
print_section "Playwright Configuration"

if grep -q "testDir: './tests/e2e'" playwright.config.ts 2>/dev/null; then
    print_check 0 "Test directory configured correctly"
else
    print_check 1 "Test directory may be misconfigured"
fi

# 11. Validate package.json
print_section "Package.json Validation"

if python3 -m json.tool package.json > /dev/null 2>&1; then
    print_check 0 "package.json is valid JSON"
else
    print_check 1 "package.json has syntax errors"
fi

# Check for duplicate keys (common issue)
if grep -o '"test:e2e:dashboard"' package.json | wc -l | grep -q "^1$"; then
    print_check 0 "No duplicate keys in package.json"
else
    DUPLICATE_COUNT=$(grep -o '"test:e2e:dashboard"' package.json | wc -l | xargs)
    if [ "$DUPLICATE_COUNT" -gt 1 ]; then
        print_check 1 "Found duplicate 'test:e2e:dashboard' key"
    else
        print_check 0 "No duplicate keys detected"
    fi
fi

# 12. Test TypeScript compilation
print_section "TypeScript"

if [ -f "tsconfig.json" ]; then
    print_check 0 "tsconfig.json exists"
else
    print_check 1 "tsconfig.json missing"
fi

# Summary
print_section "Summary"

echo "Diagnostic complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. If dependencies are missing:"
echo "   npm install"
echo ""
echo "2. If browsers are missing:"
echo "   npx playwright install"
echo ""
echo "3. If application is not running:"
echo "   npm run dev:frontend"
echo ""
echo "4. Then run tests:"
echo "   npm run test:e2e:ui"
echo ""
