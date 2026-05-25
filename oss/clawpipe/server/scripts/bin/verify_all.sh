#!/bin/bash
# Complete Verification Script for FinSavvyAI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 FinSavvyAI Complete Verification${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check Python
echo "📦 Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ $PYTHON_VERSION${NC}"
else
    echo -e "${RED}❌ Python 3 not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Go
echo ""
echo "📦 Checking Go..."
if command -v go &> /dev/null; then
    GO_VERSION=$(go version)
    echo -e "${GREEN}✅ $GO_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Go not found (optional for desktop app)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Node.js
echo ""
echo "📦 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js not found (needed for tests)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Python dependencies
echo ""
echo "📦 Checking Python dependencies..."
REQUIRED_DEPS=("aiohttp" "psutil" "requests")
for dep in "${REQUIRED_DEPS[@]}"; do
    if python3 -c "import $dep" 2>/dev/null; then
        echo -e "${GREEN}✅ $dep${NC}"
    else
        echo -e "${RED}❌ $dep not installed${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check Playwright
echo ""
echo "📦 Checking Playwright..."
if [ -d "node_modules/@playwright" ]; then
    PLAYWRIGHT_VERSION=$(npm list @playwright/test 2>/dev/null | grep @playwright | head -1 | awk '{print $2}' || echo "installed")
    echo -e "${GREEN}✅ Playwright $PLAYWRIGHT_VERSION${NC}"

    # Check browsers
    if [ -d "$HOME/.cache/ms-playwright" ]; then
        echo -e "${GREEN}✅ Playwright browsers installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Playwright browsers not installed (run: npx playwright install)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Playwright not installed${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check core files
echo ""
echo "📁 Checking core files..."
CORE_FILES=(
    "src/core/master_server.py"
    "src/core/start_master.py"
    "src/core/config.py"
    "src/core/logger.py"
    "src/workers/worker_node.py"
    "src/api/gateway.py"
    "src/cli/finsavvyai_cli.py"
    "main.py"
)
for file in "${CORE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check test files
echo ""
echo "🧪 Checking test files..."
TEST_FILES=(
    "tests/playwright.config.js"
    "tests/functional/cluster-api.spec.js"
    "tests/functional/cli.spec.js"
    "tests/functional/desktop-app.spec.js"
    "tests/run_tests.sh"
)
for file in "${TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check scripts
echo ""
echo "📜 Checking scripts..."
SCRIPTS=(
    "start_cluster.sh"
    "start_master.sh"
    "start_worker.sh"
    "start_gateway.sh"
    "install.sh"
    "test_basic.py"
    "verify_setup.sh"
)
for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo -e "${GREEN}✅ $script${NC}"
    elif [ -f "scripts/bin/$script" ] && [ -x "scripts/bin/$script" ]; then
        echo -e "${GREEN}✅ scripts/bin/$script${NC}"
    elif [ -f "$script" ]; then
        echo -e "${YELLOW}⚠️  $script exists but not executable${NC}"
        chmod +x "$script"
        echo -e "${GREEN}   (made executable)${NC}"
    else
        echo -e "${RED}❌ $script not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check macOS app build script
echo ""
echo "🍎 Checking macOS app build..."
if [ -f "desktop-app/build_macos_app.sh" ] && [ -x "desktop-app/build_macos_app.sh" ]; then
    echo -e "${GREEN}✅ macOS app build script${NC}"
elif [ -f "desktop-app/build.sh" ] && [ -x "desktop-app/build.sh" ]; then
    echo -e "${GREEN}✅ desktop-app/build.sh${NC}"
else
    if [ -f "desktop-app/build_macos_app.sh" ]; then
        chmod +x "desktop-app/build_macos_app.sh"
        echo -e "${GREEN}✅ macOS app build script (made executable)${NC}"
    else
        echo -e "${RED}❌ macOS app build script not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Test imports
echo ""
echo "🧪 Testing Python imports..."
if python3 -c "
from src.core.master_server import MasterServer
from src.core.config import ClusterConfig
from src.core.logger import get_logger
from src.workers.worker_node import WorkerNode
from src.api.gateway import APIGateway
from src.cli.finsavvyai_cli import FinSavvyAICLI
print('✅ All imports successful')
" 2>/dev/null; then
    echo -e "${GREEN}✅ All Python imports work${NC}"
else
    echo -e "${RED}❌ Python import test failed${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "============================================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Everything is ready.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run tests: npm test"
    echo "  2. Build macOS app: cd desktop-app && ./build_macos_app.sh"
    echo "  3. Start cluster: ./start_cluster.sh"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  All critical checks passed with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Warnings are non-critical. You can proceed."
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix errors before proceeding."
    exit 1
fi
