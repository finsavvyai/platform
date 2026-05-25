#!/bin/bash
# Run Cloudflare Worker unit tests (vitest)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CF_DIR="$REPO_ROOT/cloudflare-api"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Cloudflare Worker Tests (vitest)${NC}"
echo "================================="

if [ ! -d "$CF_DIR" ]; then
    echo -e "${RED}cloudflare-api/ directory not found${NC}"
    exit 1
fi

cd "$CF_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --silent
fi

echo "Running tests..."
npx vitest run

echo ""
echo -e "${GREEN}Cloudflare Worker tests passed${NC}"
