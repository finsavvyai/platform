#!/bin/bash

# Qestro CLI Installation Script
# Professional installation for development teams

set -e

QESTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QESTRO_BIN="$QESTRO_DIR/.build/debug/qestro"
INSTALL_DIR="/usr/local/bin"

echo "🚀 Qestro CLI Professional Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if qestro binary exists
if [ ! -f "$QESTRO_BIN" ]; then
    echo "❌ Qestro binary not found. Please run 'swift build' first."
    exit 1
fi

echo "📍 Found Qestro binary: $QESTRO_BIN"
echo "📏 Binary size: $(ls -lh "$QESTRO_BIN" | awk '{print $5}')"
echo ""

# Method 1: Global installation (requires sudo)
echo "🔧 Installation Method 1: Global Installation"
echo "Command: sudo cp '$QESTRO_BIN' '$INSTALL_DIR/qestro'"
echo ""

# Method 2: User bin directory
USER_BIN="$HOME/.local/bin"
echo "🔧 Installation Method 2: User Installation (Recommended)"
echo "Command: mkdir -p '$USER_BIN' && cp '$QESTRO_BIN' '$USER_BIN/qestro'"
echo ""

# Method 3: Shell alias
echo "🔧 Installation Method 3: Shell Alias"
echo "Add to ~/.zshrc or ~/.bashrc:"
echo "alias qestro='$QESTRO_BIN'"
echo ""

# Method 4: Package.json integration
echo "🔧 Installation Method 4: NPM Scripts Integration"
echo "Add to your project's package.json:"
cat << 'EOF'
{
  "scripts": {
    "qestro": "qestro",
    "test:api": "qestro api test",
    "test:voice": "qestro voice record",
    "test:ai": "qestro ai generate"
  }
}
EOF
echo ""

# Interactive installation
read -p "Choose installation method (1-4) or 'skip' to continue: " choice

case $choice in
    1)
        echo "🔐 Installing globally (requires sudo)..."
        sudo cp "$QESTRO_BIN" "$INSTALL_DIR/qestro"
        sudo chmod +x "$INSTALL_DIR/qestro"
        echo "✅ Qestro installed globally at $INSTALL_DIR/qestro"
        ;;
    2)
        echo "📦 Installing to user directory..."
        mkdir -p "$USER_BIN"
        cp "$QESTRO_BIN" "$USER_BIN/qestro"
        chmod +x "$USER_BIN/qestro"
        echo "✅ Qestro installed at $USER_BIN/qestro"
        echo "💡 Add $USER_BIN to your PATH: export PATH=\"\$PATH:$USER_BIN\""
        ;;
    3)
        echo "🔗 Creating shell alias..."
        if [[ "$SHELL" == *"zsh"* ]]; then
            echo "alias qestro='$QESTRO_BIN'" >> ~/.zshrc
            echo "✅ Alias added to ~/.zshrc"
        else
            echo "alias qestro='$QESTRO_BIN'" >> ~/.bashrc
            echo "✅ Alias added to ~/.bashrc"
        fi
        echo "💡 Restart your shell or run: source ~/.zshrc"
        ;;
    4)
        echo "📝 Use the NPM scripts example above in your package.json"
        echo "Then run: npm run qestro -- status"
        ;;
    *)
        echo "⏭️  Skipping installation"
        ;;
esac

echo ""
echo "🎯 Usage Examples for ScanGenie Project:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "# Test ScanGenie API"
echo "qestro api test http://localhost:3000/api/health"
echo ""
echo "# Voice-guided ScanGenie testing"
echo "qestro voice record --platform web --framework playwright"
echo ""
echo "# AI test generation for ScanGenie"
echo "qestro ai generate --type web --target http://localhost:3000"
echo ""
echo "# Check platform status"
echo "qestro status"
echo ""
echo "✅ Qestro CLI is ready for professional use!"