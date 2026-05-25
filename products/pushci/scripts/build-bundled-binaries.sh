#!/usr/bin/env bash
# Cross-compile the 6 platform binaries the npm tarball ships.
#
# Runs automatically before `npm pack` and `npm publish` via the
# `prepack` script hook in package.json. Never run this manually
# during dev — it's a ~15 second cross-compile burst that's only
# needed at release time.
#
# Why this exists: v1.4.0–v1.4.2 shipped broken npm tarballs
# because the shim assumed binaries at bin/pushci-<os>-<arch>
# but nothing in the publish pipeline actually built them. Users
# in sandboxes (no network, no Go, no Homebrew) had no working
# install path. v1.4.3 fixed it by adding this script + adding
# the binaries to package.json's `files:` array. Don't delete
# this without also moving to the optionalDependencies pattern
# (see CLAUDE.md v1.5.0 plan).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

VERSION="$(node -p 'require("./package.json").version')"
LDFLAGS="-s -w -X main.version=${VERSION}"

TARGETS=(
  "linux/amd64"
  "linux/arm64"
  "darwin/amd64"
  "darwin/arm64"
  "windows/amd64"
  "windows/arm64"
)

echo "=== Building bundled binaries for pushci v${VERSION} ==="

for target in "${TARGETS[@]}"; do
  OS="${target%/*}"
  ARCH="${target#*/}"
  EXT=""
  if [ "$OS" = "windows" ]; then EXT=".exe"; fi
  OUT="bin/pushci-${OS}-${ARCH}${EXT}"
  printf "  building %-36s" "$OUT"
  GOOS="$OS" GOARCH="$ARCH" CGO_ENABLED=0 go build -ldflags "$LDFLAGS" -o "$OUT" ./cmd/pushci
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "  ($SIZE)"
done

echo "=== Done ==="
