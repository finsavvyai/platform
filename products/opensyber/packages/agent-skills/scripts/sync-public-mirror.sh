#!/usr/bin/env bash
#
# sync-public-mirror.sh — push packages/agent-skills/ to the public
# github.com/opensyber/agent-skills repo using git subtree.
#
# Source of truth stays in this monorepo. The public mirror exists so
# `npx skills add opensyber/agent-skills` (Anthropic Agent Skills standard)
# resolves cleanly without exposing the rest of the monorepo.
#
# Usage:
#   ./packages/agent-skills/scripts/sync-public-mirror.sh
#
# Prereqs:
#   - You have push access to github.com/opensyber/agent-skills
#   - The remote `agent-skills-mirror` is configured (this script adds it if missing)
#   - You are on the branch you want to publish from (usually main)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

REMOTE_NAME="agent-skills-mirror"
REMOTE_URL="git@github.com:opensyber/agent-skills.git"
SUBTREE_PREFIX="packages/agent-skills"
TARGET_BRANCH="main"

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "Adding remote $REMOTE_NAME -> $REMOTE_URL"
  git remote add "$REMOTE_NAME" "$REMOTE_URL"
fi

CURRENT_BRANCH="$(git branch --show-current)"
echo "Pushing $SUBTREE_PREFIX (from $CURRENT_BRANCH) to $REMOTE_NAME:$TARGET_BRANCH"

git subtree push --prefix="$SUBTREE_PREFIX" "$REMOTE_NAME" "$TARGET_BRANCH"

echo ""
echo "Done. Verify at https://github.com/opensyber/agent-skills/tree/$TARGET_BRANCH"
echo ""
echo "After the first push, also:"
echo "  1. Tag a release: gh release create v0.1.0 --repo opensyber/agent-skills --notes 'Initial 8-skill release'"
echo "  2. Publish to npm: cd packages/agent-skills && npm publish --access=public"
echo "  3. Submit to https://skills.sh and https://www.toolworthy.ai/tool/skills-sh for discoverability"
