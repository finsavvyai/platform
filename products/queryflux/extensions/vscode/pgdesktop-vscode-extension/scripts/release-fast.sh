#!/usr/bin/env bash

# Fast release builder for Ultimate DB Manager VS Code extension
# - Bumps version (patch|minor|major or explicit x.y.z)
# - Regenerates icon PNG
# - Packages VSIX without compiling TypeScript (uses existing out/)

set -euo pipefail

here="$(cd "$(dirname "$0")"/.. && pwd)"
cd "$here"

usage() {
  cat <<EOF
Usage: $(basename "$0") <bump>

<bump> can be one of: patch | minor | major | <x.y.z>

Examples:
  $(basename "$0") patch     # 1.0.1 -> 1.0.2
  $(basename "$0") minor     # 1.0.1 -> 1.1.0
  $(basename "$0") 1.2.3     # set exact version
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

bump="$1"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required on PATH" >&2
  exit 1
fi

# Ensure dependencies needed for packaging and icon generation are present
if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npm/npx is required on PATH" >&2
  exit 1
fi

echo "📦 Installing packaging deps (vsce, pngjs) if needed..."
npm --silent --yes install pngjs >/dev/null 2>&1 || true

echo "🖼  Generating PNG icon from script..."
node scripts/gen_icon.js

# Bump version without running any git hooks or creating tags
current_ver=$(node -p "require('./package.json').version")
echo "🔢 Current version: $current_ver"

if [[ "$bump" =~ ^(patch|minor|major)$ ]]; then
  npm version "$bump" --no-git-tag-version >/dev/null
else
  # explicit version
  if [[ ! "$bump" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    echo "Error: invalid version format: $bump" >&2
    exit 1
  fi
  npm version "$bump" --no-git-tag-version >/dev/null
fi

new_ver=$(node -p "require('./package.json').version")
echo "✅ Updated version to: $new_ver"

echo "📦 Packaging VSIX (skipping compile)..."
npx --yes vsce package

vsix="ultimate-db-manager-vscode-${new_ver}.vsix"
if [[ -f "$vsix" ]]; then
  echo "🎉 Done: $vsix"
  echo "👉 Install locally: code --install-extension $vsix"
else
  echo "❌ Packaging failed (VSIX not found)" >&2
  exit 1
fi

