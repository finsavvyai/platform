#!/bin/bash
set -e

echo "🔍 Post-Build Verification"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0

check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
    else
        echo -e "${RED}✗${NC} $description: $file (MISSING)"
        FAILURES=$((FAILURES + 1))
    fi
}

check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description: $dir"
    else
        echo -e "${RED}✗${NC} $description: $dir (MISSING)"
        FAILURES=$((FAILURES + 1))
    fi
}

echo "📦 Checking Core Package Builds"
echo "-------------------------------"
check_dir "packages/lunaforge-core/dist" "Core dist"
check_file "packages/lunaforge-core/dist/index.js" "Core index"
check_file "packages/lunaforge-core/dist/index.d.ts" "Core types"

echo ""
echo "🎯 Checking Mode Package Builds"
echo "-------------------------------"
for mode in galaxy guardian timetravel codeflow composer autopsy prophecy mythic dream parallel-universe ritual; do
    check_dir "packages/lunaforge-$mode/dist" "$mode dist"
done

echo ""
echo "🔌 Checking Extension Build"
echo "---------------------------"
check_dir "packages/lunaforge-extension/dist" "Extension dist"
check_file "packages/lunaforge-extension/dist/extension.js" "Extension bundle"

echo ""
echo "☁️  Checking Worker Build"
echo "------------------------"
check_file "workers/agent-brain/src/index.ts" "Worker source"
check_file "workers/agent-brain/src/providers.ts" "Worker providers"
check_file "workers/agent-brain/wrangler.toml" "Worker config"

echo ""
echo "📄 Checking Documentation"
echo "-------------------------"
check_file "README.md" "Main README"
check_file "packages/lunaforge-extension/README.md" "Extension README"
check_file "packages/lunaforge-extension/CHANGELOG.md" "CHANGELOG"
check_file "DEPLOYMENT.md" "Deployment guide"
check_file "QUICKSTART.md" "Quick start guide"

echo ""
echo "⚙️  Checking Configuration"
echo "-------------------------"
check_file "package.json" "Root package.json"
check_file "packages/lunaforge-extension/package.json" "Extension package.json"
check_file "tsconfig.json" "Root tsconfig"
check_file "vitest.config.ts" "Vitest config"

echo ""
echo "=========================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All build artifacts verified!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILURES verification(s) failed!${NC}"
    exit 1
fi
