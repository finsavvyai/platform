#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-dev}"
BINARY="pushci"
BUILD_DIR="bin/release"
CHECKSUM_FILE="$BUILD_DIR/checksums-sha256.txt"

TARGETS=(
  "linux/amd64"
  "linux/arm64"
  "darwin/amd64"
  "darwin/arm64"
  "windows/amd64"
  "windows/arm64"
)

LDFLAGS="-s -w -X main.version=${VERSION}"

echo "=== PushCI Release Build v${VERSION} ==="
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

for target in "${TARGETS[@]}"; do
  OS="${target%/*}"
  ARCH="${target#*/}"
  EXT=""
  if [ "$OS" = "windows" ]; then EXT=".exe"; fi

  OUTNAME="${BINARY}-${OS}-${ARCH}${EXT}"
  echo "Building ${OS}/${ARCH}..."
  GOOS="$OS" GOARCH="$ARCH" go build -ldflags "$LDFLAGS" \
    -o "$BUILD_DIR/$OUTNAME" ./cmd/pushci
done

echo ""
echo "=== Creating tarballs ==="
cd "$BUILD_DIR"

for target in "${TARGETS[@]}"; do
  OS="${target%/*}"
  ARCH="${target#*/}"
  EXT=""
  if [ "$OS" = "windows" ]; then EXT=".exe"; fi

  OUTNAME="${BINARY}-${OS}-${ARCH}${EXT}"
  ARCHIVE="${BINARY}_${VERSION}_${OS}_${ARCH}"

  if [ "$OS" = "windows" ]; then
    zip "${ARCHIVE}.zip" "$OUTNAME"
  else
    tar czf "${ARCHIVE}.tar.gz" "$OUTNAME"
  fi
done

echo ""
echo "=== Generating SHA256 checksums ==="
sha256sum *.tar.gz *.zip 2>/dev/null > "checksums-sha256.txt"
cat "checksums-sha256.txt"

echo ""
echo "Release artifacts in ${BUILD_DIR}/"
