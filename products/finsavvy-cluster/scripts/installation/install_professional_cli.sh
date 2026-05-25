#!/bin/bash

# FinSavvyAI Professional CLI Installation
# AWS-style installation for system-wide usage

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly INSTALL_LOCATIONS=(
    "/usr/local/bin"
    "/opt/local/bin"
    "$HOME/.local/bin"
)

# Colors
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo "🚀 Installing FinSavvyAI Professional CLI"
echo "======================================"

# Find writable installation location
INSTALL_DIR=""
for location in "${INSTALL_LOCATIONS[@]}"; do
    if [ -w "$location" ]; then
        INSTALL_DIR="$location"
        break
    fi
done

if [ -z "$INSTALL_DIR" ]; then
    log_warning "No writable install location found"
    log_info "Creating $HOME/.local/bin..."
    mkdir -p "$HOME/.local/bin"
    INSTALL_DIR="$HOME/.local/bin"
fi

# Create symlink
ln -sf "$SCRIPT_DIR/finsavvyai" "$INSTALL_DIR/finsavvyai"
log_success "Installed to: $INSTALL_DIR/finsavvyai"

# Check if in PATH
if echo "$PATH" | grep -q "$INSTALL_DIR"; then
    log_success "Already in PATH"
else
    log_warning "Adding to PATH..."

    # Add to shell profiles
    for profile in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
        if [ -f "$profile" ]; then
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$profile"
        fi
    done
    log_warning "Please run: source ~/.bashrc or restart your terminal"
fi

echo ""
log_success "Installation complete!"
echo "Now you can use: finsavvyai --help"
