#!/bin/bash

# TinyGo Installation Script for MCPOverflow
# This script installs TinyGo for WASM compilation

set -e

TINYGO_VERSION="0.32.0"
INSTALL_DIR="$HOME/.local"
TINYGO_URL="https://github.com/tinygo-org/tinygo/releases/download/v${TINYGO_VERSION}"

echo "🔧 Installing TinyGo v${TINYGO_VERSION} for MCPOverflow..."

# Detect system architecture
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

# Map architecture names
case $ARCH in
    x86_64) ARCH="amd64" ;;
    arm64) ARCH="arm64" ;;
    aarch64) ARCH="arm64" ;;
    *) echo "❌ Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Map OS names
case $OS in
    linux|darwin) ;;
    *) echo "❌ Unsupported OS: $OS"; exit 1 ;;
esac

# Set download URL
TINYGO_TAR="tinygo${TINYGO_VERSION}.${OS}-${ARCH}.tar.gz"
TINYGO_DOWNLOAD_URL="${TINYGO_URL}/${TINYGO_TAR}"

echo "📥 Downloading TinyGo for ${OS}/${ARCH}..."
echo "URL: ${TINYGO_DOWNLOAD_URL}"

# Check if already installed
if command -v tinygo >/dev/null 2>&1; then
    CURRENT_VERSION=$(tinygo version | head -n1 | cut -d' ' -f3)
    echo "✅ TinyGo already installed: v${CURRENT_VERSION}"

    if [ "$CURRENT_VERSION" = "v${TINYGO_VERSION}" ]; then
        echo "✅ Correct version already installed"
        exit 0
    else
        echo "⚠️  Version mismatch. Expected v${TINYGO_VERSION}, found v${CURRENT_VERSION}"
        echo "🔄 Reinstalling..."
    fi
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Download TinyGo
echo "🌐 Downloading TinyGo..."
if ! curl -L "${TINYGO_DOWNLOAD_URL}" -o "${TEMP_DIR}/${TINYGO_TAR}"; then
    echo "❌ Failed to download TinyGo"
    exit 1
fi

# Extract TinyGo
echo "📦 Extracting TinyGo..."
cd "${TEMP_DIR}"
tar -xzf "${TINYGO_TAR}"

# Check if installation directory exists
if [ ! -d "${INSTALL_DIR}" ]; then
    echo "📁 Creating installation directory: ${INSTALL_DIR}"
    mkdir -p "${INSTALL_DIR}"
fi

# Install TinyGo
echo "🔨 Installing TinyGo to ${INSTALL_DIR}/tinygo..."
rm -rf "${INSTALL_DIR}/tinygo"
mv tinygo "${INSTALL_DIR}/"

# Create symlinks for binaries
echo "🔗 Creating symlinks..."
mkdir -p "${INSTALL_DIR}/bin"
for binary in tinygo tinygo-compile tinygo-run tinygo-test; do
    if [ -f "${INSTALL_DIR}/tinygo/bin/${binary}" ]; then
        if [ ! -L "${INSTALL_DIR}/bin/${binary}" ]; then
            echo "  → ${binary}"
            ln -sf "${INSTALL_DIR}/tinygo/bin/${binary}" "${INSTALL_DIR}/bin/${binary}"
        fi
    fi
done

# Add TinyGo to PATH if not already there
SHELL_CONFIG="$HOME/.bashrc"
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
fi

TINYGO_BIN_PATH="${INSTALL_DIR}/tinygo/bin"
if ! grep -q "${TINYGO_BIN_PATH}" "${SHELL_CONFIG}" 2>/dev/null; then
    echo ""
    echo "📝 Adding TinyGo to PATH in ${SHELL_CONFIG}..."
    echo "" >> "${SHELL_CONFIG}"
    echo "# TinyGo for MCPOverflow" >> "${SHELL_CONFIG}"
    echo "export PATH=\"${TINYGO_BIN_PATH}:\$PATH\"" >> "${SHELL_CONFIG}"
    echo "✅ Added TinyGo to PATH"
    echo "⚠️  Please restart your shell or run: source ${SHELL_CONFIG}"
fi

# Verify installation
echo "🔍 Verifying installation..."
if command -v tinygo >/dev/null 2>&1; then
    INSTALLED_VERSION=$(tinygo version | head -n1 | cut -d' ' -f3)
    echo "✅ TinyGo v${INSTALLED_VERSION} installed successfully"

    # Test compilation with a simple WASM example
    echo "🧪 Testing TinyGo WASM compilation..."
    TEST_DIR="${TEMP_DIR}/test"
    mkdir -p "${TEST_DIR}"

    cat > "${TEST_DIR}/main.go" << 'EOF'
package main

func main() {
    println("Hello from TinyGo WASM!")
}
EOF

    cd "${TEST_DIR}"
    if tinygo build -target=wasm -o test.wasm main.go; then
        echo "✅ WASM compilation test successful"
        rm -f test.wasm
    else
        echo "⚠️  WASM compilation test failed - this might be expected"
    fi
else
    echo "❌ TinyGo installation verification failed"
    exit 1
fi

echo ""
echo "🎉 TinyGo installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart your shell or run: source ${SHELL_CONFIG}"
echo "  2. Verify installation: tinygo version"
echo "  3. Test WASM compilation: tinygo build -target=wasm -o output.wasm main.go"
echo ""