#!/bin/bash
# Run Control Hub Node.js tests (node:test)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HUB_DIR="$REPO_ROOT/packages/control-hub-node"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Control Hub Node.js Tests${NC}"
echo "=========================="

if [ ! -d "$HUB_DIR" ]; then
    echo -e "${RED}packages/control-hub-node/ directory not found${NC}"
    exit 1
fi

cd "$HUB_DIR"

echo "Running tests..."
node --test 'tests/*.test.js'

echo ""
echo -e "${GREEN}Control Hub tests passed${NC}"
