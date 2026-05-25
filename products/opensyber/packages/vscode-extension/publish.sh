#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Retrieve PAT from macOS Keychain
PAT=$(security find-generic-password -a "opensyber" -s "vsce-pat" -w 2>/dev/null || true)

if [ -z "$PAT" ]; then
  echo "ERROR: No PAT found in Keychain."
  echo ""
  echo "Store it first:"
  echo "  security add-generic-password -a \"opensyber\" -s \"vsce-pat\" -w \"YOUR_PAT\""
  exit 1
fi

# Build
echo "Compiling TypeScript..."
pnpm compile

# Package + publish
echo "Publishing to VS Code Marketplace..."
VSCE_PAT="$PAT" npx vsce publish

echo ""
echo "Done! Extension published."
