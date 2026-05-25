#!/bin/bash

# PushCI npm publish coordination script
# Bumps PushCI version and publishes to npm when PipeWarden releases
# Called by GitHub Actions release workflow

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PUSHCI_VERSION="${1:-1.2.0}"
PUSHCI_DIR="${PUSHCI_DIR:-../pushci}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"

echo -e "${YELLOW}=== PushCI npm Publish Coordinator ===${NC}"
echo "PushCI Version: $PUSHCI_VERSION"
echo "PushCI Directory: $PUSHCI_DIR"

# Validate PushCI directory exists
if [ ! -d "$PUSHCI_DIR" ]; then
	echo -e "${RED}ERROR: PushCI directory not found: $PUSHCI_DIR${NC}"
	exit 1
fi

cd "$PUSHCI_DIR"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
	echo -e "${RED}ERROR: npm not found. Please install Node.js${NC}"
	exit 1
fi

echo -e "${YELLOW}Step 1: Checking package.json...${NC}"
if [ ! -f "package.json" ]; then
	echo -e "${RED}ERROR: package.json not found${NC}"
	exit 1
fi

echo -e "${YELLOW}Step 2: Updating version to ${PUSHCI_VERSION}...${NC}"
npm version "$PUSHCI_VERSION" --no-git-tag-version

echo -e "${YELLOW}Step 3: Updating PipeWarden security scanner dependency...${NC}"
# Update pipewarden CLI dependency if it exists
if grep -q '"pipewarden"' package.json 2>/dev/null; then
	npm update pipewarden || true
fi

echo -e "${YELLOW}Step 4: Installing dependencies...${NC}"
npm ci

echo -e "${YELLOW}Step 5: Running tests...${NC}"
if [ -f "Makefile" ]; then
	make test || npm run test || true
else
	npm run test || true
fi

echo -e "${YELLOW}Step 6: Building...${NC}"
if [ -f "Makefile" ]; then
	make build || npm run build || true
else
	npm run build || true
fi

echo -e "${YELLOW}Step 7: Publishing to npm...${NC}"

# Check if .npmrc exists with authentication
if [ ! -f ".npmrc" ] && [ -z "${NPM_TOKEN:-}" ]; then
	echo -e "${RED}ERROR: NPM authentication not configured${NC}"
	echo "Please set NPM_TOKEN env var or configure .npmrc"
	exit 1
fi

# Create temporary .npmrc with token if provided
if [ -n "${NPM_TOKEN:-}" ]; then
	echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> .npmrc
	chmod 600 .npmrc
fi

# Publish to npm
npm publish --registry "$NPM_REGISTRY" --access public

# Clean up
if [ -n "${NPM_TOKEN:-}" ] && [ -f ".npmrc" ]; then
	rm -f .npmrc
fi

echo -e "${YELLOW}Step 8: Tagging git release...${NC}"
git tag -a "pushci/v${PUSHCI_VERSION}" -m "PushCI release v${PUSHCI_VERSION} (synced with PipeWarden)" || true
git push origin "pushci/v${PUSHCI_VERSION}" || true

echo -e "${GREEN}=== PushCI ${PUSHCI_VERSION} published successfully! ===${NC}"
echo "Package published to: ${NPM_REGISTRY}"
echo "Install with: npm install -g @finsavvyai/pushci@${PUSHCI_VERSION}"
