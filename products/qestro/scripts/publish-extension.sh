#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXTENSION_ROOT="$PROJECT_ROOT/browser-extension"
OUTPUT_DIR="${OUTPUT_DIR:-$EXTENSION_ROOT/published}"
VERSION="$(node -p "require('$EXTENSION_ROOT/package.json').version")"

echo "Questro Extension Publisher"
echo "Project root: $PROJECT_ROOT"
echo "Extension root: $EXTENSION_ROOT"
echo "Version: $VERSION"

if [ ! -d "$EXTENSION_ROOT" ]; then
  echo "ERROR: browser-extension package not found at $EXTENSION_ROOT"
  exit 1
fi

echo "Building browser extension artifacts..."
npm --prefix "$EXTENSION_ROOT" run build

mkdir -p "$OUTPUT_DIR"

for browser in chrome firefox edge; do
  artifact="$EXTENSION_ROOT/dist/$browser/questro-$browser-v$VERSION.zip"
  if [ ! -f "$artifact" ]; then
    echo "ERROR: missing artifact $artifact"
    exit 1
  fi

  cp "$artifact" "$OUTPUT_DIR/"
done

cat > "$OUTPUT_DIR/questro-extension-v$VERSION-PUBLISHING.md" <<EOF
# Questro Browser Extension Release

Version: $VERSION

Artifacts:
- questro-chrome-v$VERSION.zip
- questro-firefox-v$VERSION.zip
- questro-edge-v$VERSION.zip

Load unpacked for local testing:
- $EXTENSION_ROOT
- $EXTENSION_ROOT/dist/chrome/unpacked

Store submission targets:
- Chrome Web Store
- Firefox Add-ons
- Microsoft Edge Add-ons
EOF

echo "Extension artifacts copied to $OUTPUT_DIR"
ls -1 "$OUTPUT_DIR"
