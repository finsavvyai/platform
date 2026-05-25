#!/usr/bin/env bash
#
# publish-oss.sh — mirror sdlc-gateway-oss/ to its own GitHub repo.
#
# The OSS build lives in this monorepo so refactors stay coherent with the
# hosted enterprise stack. The public consumption surface — ghcr.io image,
# `go get`, Helm chart — expects a standalone repo at
# github.com/finsavvyai/sdlc-gateway.
#
# Workflow:
#   1. git subtree split `sdlc-gateway-oss/` onto a throwaway branch
#   2. force-push that branch to the mirror repo's main
#   3. optionally tag and push the tag to trigger release.yml
#
# Usage:
#   scripts/publish-oss.sh                # mirror only
#   scripts/publish-oss.sh v0.1.0         # mirror + tag + push tag
#
# Required env:
#   OSS_REMOTE   — SSH url of the mirror repo. Default:
#                  git@github.com:finsavvyai/sdlc-gateway.git

set -euo pipefail

REMOTE="${OSS_REMOTE:-git@github.com:finsavvyai/sdlc-gateway.git}"
PREFIX="sdlc-gateway-oss"
SPLIT_BRANCH="oss-split-$(date -u +%Y%m%d%H%M%S)"
TAG="${1:-}"

if [[ ! -d "$PREFIX" ]]; then
  echo "error: $PREFIX not found at repo root" >&2
  exit 1
fi

# Only require the subtree source itself to be clean. Other paths may carry
# unrelated in-flight work; subtree split reads commit history, not the
# working tree, so only uncommitted changes under $PREFIX would be lost.
if ! git diff --quiet -- "$PREFIX" || ! git diff --cached --quiet -- "$PREFIX"; then
  echo "error: uncommitted changes under $PREFIX; commit or stash first" >&2
  exit 1
fi

echo "[1/4] splitting $PREFIX → $SPLIT_BRANCH"
git subtree split --prefix "$PREFIX" -b "$SPLIT_BRANCH"

echo "[2/4] force-pushing $SPLIT_BRANCH → $REMOTE main"
git push --force "$REMOTE" "$SPLIT_BRANCH:main"

if [[ -n "$TAG" ]]; then
  echo "[3/4] tagging $TAG on $SPLIT_BRANCH"
  git tag "$TAG" "$SPLIT_BRANCH"
  echo "[4/4] pushing tag to trigger release.yml"
  git push "$REMOTE" "$TAG"
else
  echo "[3/4] no tag requested — skipping release trigger"
fi

echo "[cleanup] deleting local $SPLIT_BRANCH"
git branch -D "$SPLIT_BRANCH"

echo "done. Mirror: $REMOTE"
