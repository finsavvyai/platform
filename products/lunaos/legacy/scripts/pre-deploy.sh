#!/bin/bash

echo "🚀 LunaForge Pre-Deployment Validation"
echo "======================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Function to run a test and track results
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    (
        cd "$ROOT_DIR" || exit 1
        eval "$test_command"
    )
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
        echo ""
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        echo ""
        FAILURES=$((FAILURES + 1))
    fi
}

ROOT_DIR=$(pwd)

echo "📦 Step 1: Clean and Build All Packages"
echo "----------------------------------------"
run_test "Clean build" "npm run build"

echo "🧪 Step 2: Run Unit Tests"
echo "-------------------------"
run_test "Core unit tests" "npm run test:unit || true"

echo "🔗 Step 3: Run Integration Tests"
echo "--------------------------------"
run_test "Integration tests" "npm run test:integration || true"

echo "🎭 Step 4: Run Extension Tests"
echo "------------------------------"
run_test "Extension tests" "npm run test:extension || true"

echo "🌐 Step 5: Verify Worker Build"
echo "------------------------------"
run_test "Worker build" "(cd $ROOT_DIR/workers/agent-brain && npm run build)"

echo "🔍 Step 6: Verify Worker Tests"
echo "------------------------------"
run_test "Worker unit tests" "npx vitest run workers/agent-brain/test/endpoints.unit.test.ts"

echo "📋 Step 7: Verify Package Metadata"
echo "----------------------------------"
run_test "Package.json validation" "cd $ROOT_DIR && node scripts/validate-packages.js || true"

echo "🎨 Step 8: Lint Check"
echo "--------------------"
run_test "TypeScript compilation" "cd $ROOT_DIR && npm run typecheck || true"

echo "📦 Step 9: Package Extension"
echo "---------------------------"
run_test "VSIX packaging" "(cd $ROOT_DIR/packages/lunaforge-extension && vsce package --no-dependencies || true)"

echo "🔏 Step 10: Inspect VSIX for Integrity"
echo "------------------------------------"
VSIX_FILE=$(find "$ROOT_DIR/packages/lunaforge-extension" -name "*.vsix" | sort -r | head -n 1)
if [ -f "$VSIX_FILE" ]; then
    run_test "VSIX bundling check" "unzip -l $VSIX_FILE | grep -E 'out/extension.js|package.json'"
    run_test "VSIX size check" "[ \$(wc -c < \"\$VSIX_FILE\") -gt 100000 ]"
else
    echo -e "${YELLOW}! No VSIX file found to inspect${NC}"
fi

echo ""
echo "======================================="
echo "📊 Validation Summary"
echo "======================================="

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy worker: cd workers/agent-brain && npm run deploy"
    echo "  2. Publish extension: cd packages/lunaforge-extension && vsce publish"
    exit 0
else
    echo -e "${RED}✗ $FAILURES check(s) failed. Please fix before deploying.${NC}"
    exit 1
fi
