#!/bin/bash
# Run Go Desktop App tests with coverage

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GO_DIR="$REPO_ROOT/desktop-app/src-go"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Go Desktop App Tests${NC}"
echo "====================="

if [ ! -d "$GO_DIR" ]; then
    echo -e "${RED}desktop-app/src-go/ directory not found${NC}"
    exit 1
fi

cd "$GO_DIR"

echo "Running tests with coverage..."
go test ./... -v -count=1 -coverprofile=coverage.out

echo ""
echo "Coverage summary:"
go tool cover -func=coverage.out | tail -1

echo ""
echo -e "${GREEN}Go Desktop App tests passed${NC}"
