#!/bin/bash

# FinSavvyAI CLI - Installation Script
# Installs the finsavvyai command system-wide

echo "🚀 Installing FinSavvyAI CLI"
echo "=========================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create symbolic link
if [ -w "/usr/local/bin" ]; then
    sudo ln -sf "$SCRIPT_DIR/finsavvyai.py" /usr/local/bin/finsavvyai
    echo "✅ Installed to /usr/local/bin/finsavvyai"
elif [ -w "$HOME/.local/bin" ]; then
    mkdir -p "$HOME/.local/bin"
    ln -sf "$SCRIPT_DIR/finsavvyai.py" "$HOME/.local/bin/finsavvyai"
    echo "✅ Installed to $HOME/.local/bin/finsavvyai"

    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
        echo "🔧 Added $HOME/.local/bin to PATH"
    fi
else
    echo "⚠️  Could not install globally. Run with python3 finsavvyai.py"
fi

echo ""
echo "🎉 FinSavvyAI CLI is ready!"
echo "Usage: finsavvyai --help"
