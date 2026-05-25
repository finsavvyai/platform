#!/usr/bin/env bash
set -euo pipefail

# ─── TokenForge SDK Publish Script ───────────────────────────────────────────
#
# Usage:
#   ./publish.sh              # Publish current version
#   ./publish.sh patch        # Bump patch (0.1.0 → 0.1.1) and publish
#   ./publish.sh minor        # Bump minor (0.1.0 → 0.2.0) and publish
#   ./publish.sh major        # Bump major (0.1.0 → 1.0.0) and publish
#   DRY_RUN=1 ./publish.sh   # Dry run (no actual publish)
#
# Prerequisites:
#   1. npm login (run: npm login --scope=@opensyber)
#   2. npm org access (you need publish rights to @opensyber)
#   3. All tests passing
#   4. Clean git working tree
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUMP="${1:-}"
DRY_RUN="${DRY_RUN:-0}"

echo "═══════════════════════════════════════════"
echo "  TokenForge SDK — Publish Pipeline"
echo "═══════════════════════════════════════════"
echo ""

# ─── Step 1: Pre-flight checks ──────────────────────────────────────────────
echo "▸ Step 1: Pre-flight checks"

# Check npm auth
if ! npm whoami &>/dev/null; then
  echo "  ✗ Not logged in to npm. Run: npm login --scope=@opensyber"
  exit 1
fi
NPM_USER=$(npm whoami)
echo "  ✓ Logged in as: $NPM_USER"

# Check git is clean
if [[ -n "$(git status --porcelain packages/tokenforge/)" ]]; then
  echo "  ✗ Uncommitted changes in packages/tokenforge/. Commit first."
  exit 1
fi
echo "  ✓ Git working tree clean"

# Check we're on main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  echo "  ⚠ Not on main branch (on: $BRANCH). Continue? [y/N]"
  read -r CONFIRM
  [[ "$CONFIRM" == "y" ]] || exit 1
fi
echo "  ✓ Branch: $BRANCH"
echo ""

# ─── Step 2: Run tests ──────────────────────────────────────────────────────
echo "▸ Step 2: Running tests"
pnpm test
echo "  ✓ All tests passed"
echo ""

# ─── Step 3: Build ──────────────────────────────────────────────────────────
echo "▸ Step 3: Building"
pnpm run clean
pnpm run build
echo "  ✓ Build complete"
echo ""

# ─── Step 4: Version bump (optional) ────────────────────────────────────────
if [[ -n "$BUMP" ]]; then
  echo "▸ Step 4: Bumping version ($BUMP)"
  npm version "$BUMP" --no-git-tag-version
  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "  ✓ Version: $NEW_VERSION"
  echo ""
else
  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "▸ Step 4: Skipped (publishing v$NEW_VERSION as-is)"
  echo ""
fi

# ─── Step 5: Verify package contents ────────────────────────────────────────
echo "▸ Step 5: Package contents"
npm pack --dry-run 2>&1 | grep -E "^npm notice (📦|Tarball|Total)" || true
echo ""

# Verify no test files or source maps leaked
PACK_FILES=$(npm pack --dry-run 2>&1)
if echo "$PACK_FILES" | grep -q "\.test\."; then
  echo "  ✗ Test files found in package! Check 'files' field in package.json."
  exit 1
fi
echo "  ✓ No test files in package"

if echo "$PACK_FILES" | grep -q "\.env"; then
  echo "  ✗ .env files found in package!"
  exit 1
fi
echo "  ✓ No secret files in package"
echo ""

# ─── Step 6: Publish ────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "1" ]]; then
  echo "▸ Step 6: DRY RUN — skipping actual publish"
  npm publish --access public --dry-run
else
  echo "▸ Step 6: Publishing to npm"
  echo "  Publishing @opensyber/tokenforge@$NEW_VERSION..."
  npm publish --access public
  echo ""
  echo "  ✓ Published! https://www.npmjs.com/package/@opensyber/tokenforge"
fi
echo ""

# ─── Step 7: Git tag (if version was bumped) ────────────────────────────────
if [[ -n "$BUMP" && "$DRY_RUN" != "1" ]]; then
  echo "▸ Step 7: Git tag"
  git add packages/tokenforge/package.json
  git commit -m "release(tokenforge): v$NEW_VERSION"
  git tag "tokenforge-v$NEW_VERSION"
  echo "  ✓ Tagged tokenforge-v$NEW_VERSION"
  echo "  → Push with: git push && git push --tags"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Done!"
echo "═══════════════════════════════════════════"
