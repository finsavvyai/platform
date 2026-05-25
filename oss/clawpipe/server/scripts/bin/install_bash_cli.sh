#!/bin/bash

# Global installer for FinSavvyAI CLI
# Installs the Bash CLI system-wide

set -euo pipefail

# Colors
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

echo "🚀 Installing FinSavvyAI CLI (Bash)"
echo "================================="

# Get script directory
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install locations to try
readonly INSTALL_LOCATIONS=(
    "/usr/local/bin"
    "$HOME/.local/bin"
    "/opt/local/bin"
)

# Find writable location
INSTALL_DIR=""
for location in "${INSTALL_LOCATIONS[@]}"; do
    if [ -w "$location" ]; then
        INSTALL_DIR="$location"
        break
    fi
done

if [ -z "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠️  No writable install location found${NC}"
    echo "Creating $HOME/.local/bin..."
    mkdir -p "$HOME/.local/bin"
    INSTALL_DIR="$HOME/.local/bin"
fi

# Create symlink
ln -sf "$SCRIPT_DIR/finsavvyai" "$INSTALL_DIR/finsavvyai"

echo -e "${GREEN}✅ Installed to: $INSTALL_DIR/finsavvyai${NC}"

# Check if in PATH
if echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo -e "${GREEN}✅ Already in PATH${NC}"
else
    echo -e "${YELLOW}⚠️  Adding to PATH...${NC}"

    # Add to shell profiles
    for profile in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
        if [ -f "$profile" ]; then
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$profile"
            echo "📝 Added to $profile"
        fi
    done

    echo -e "${YELLOW}⚠️  Please run: source ~/.bashrc or restart your terminal${NC}"
fi

echo ""
echo "🎉 FinSavvyAI CLI is ready!"
echo ""
echo "Usage: finsavvyai --help"
echo "Status: finsavvyai status"
echo "Start: finsavvyai start"
echo "Monitor: finsavvyai monitor"
