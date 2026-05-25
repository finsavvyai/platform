#!/bin/sh
# PushCI installer — https://pushci.dev
# Usage: curl -fsSL https://pushci.dev/install.sh | sh
set -e

VERSION="${PUSHCI_VERSION:-latest}"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" && exit 1 ;;
esac

if [ "$VERSION" = "latest" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/finsavvyai/pushci-cli/releases/latest" | grep '"tag_name"' | sed 's/.*"v//' | sed 's/".*//')
fi

URL="https://github.com/finsavvyai/pushci-cli/releases/download/v${VERSION}/pushci_${VERSION}_${OS}_${ARCH}.tar.gz"
INSTALL_DIR="${PUSHCI_INSTALL_DIR:-/usr/local/bin}"

echo "Installing PushCI v${VERSION} (${OS}/${ARCH})..."
TMP=$(mktemp -d)
curl -fsSL "$URL" -o "$TMP/pushci.tar.gz"
tar -xzf "$TMP/pushci.tar.gz" -C "$TMP"

# Create the install dir if it doesn't exist — avoids the "sudo needs a
# terminal" trap when PUSHCI_INSTALL_DIR points at a non-standard path
# that curl | sh users created seconds before running the installer.
if [ ! -d "$INSTALL_DIR" ]; then
  if ! mkdir -p "$INSTALL_DIR" 2>/dev/null; then
    sudo mkdir -p "$INSTALL_DIR"
  fi
fi

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP/pushci" "$INSTALL_DIR/pushci"
else
  sudo mv "$TMP/pushci" "$INSTALL_DIR/pushci"
fi
chmod +x "$INSTALL_DIR/pushci"
rm -rf "$TMP"

echo "PushCI v${VERSION} installed to ${INSTALL_DIR}/pushci"
echo ""
echo "Get started:"
echo "  pushci init          # detect stack and generate pipeline"
echo "  pushci run           # run CI locally"
echo "  pushci troubleshoot  # diagnose any issues"
echo ""
echo "https://pushci.dev"
