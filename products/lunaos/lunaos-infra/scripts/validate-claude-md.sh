#!/usr/bin/env bash
# validate-claude-md.sh
# Validates that all LunaOS product repos have fully populated CLAUDE.md files.
# Checks for the 5 required sections and ensures none are empty stubs.
# Usage: bash scripts/validate-claude-md.sh [/path/to/luna-os]
# Exit 0 on success, exit 1 on any failure.

set -euo pipefail

LUNA_ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"

REPOS=(
  "lunaos-engine"
  "lunaos-dashboard"
  "lunaos-studio"
  "luna-agents"
  "lunaos-mobile"
  "lunaos-docs"
  "lunaos-infra"
  "OpenHands"
)

REQUIRED_SECTIONS=(
  "## Product Mission And Target User"
  "## Product-Specific Architecture Constraints"
  "## Product-Specific Test Matrix"
  "## Product-Specific Security Controls"
  "## Product-Specific Release Checklist"
)

ERRORS=0

check_section_populated() {
  local file="$1"
  local section="$2"
  local next_section="$3"

  # Extract content between this section header and the next
  local content
  if [ -n "$next_section" ]; then
    content=$(sed -n "/^${section}$/,/^## /{ /^${section}$/d; /^## /d; p; }" "$file")
  else
    content=$(sed -n "/^${section}$/,\${ /^${section}$/d; p; }" "$file")
  fi

  # Strip blank lines, comments, and placeholder-only lines
  local meaningful
  meaningful=$(echo "$content" | grep -v '^\s*$' | grep -v '^\s*#' || true)

  # Check for empty stub markers (lines that end with just a colon or are placeholder)
  local stubs
  stubs=$(echo "$meaningful" \
    | grep -cE '^\s*-\s+\w[^:]*:\s*$' || true)
  local total
  total=$(echo "$meaningful" | grep -c '.' || true)

  if [ "$total" -eq 0 ]; then
    echo "  FAIL: Section '$section' is empty"
    return 1
  fi

  # If every non-blank line is a stub (key with no value), fail
  if [ "$stubs" -eq "$total" ] && [ "$total" -gt 0 ]; then
    echo "  FAIL: Section '$section' contains only empty placeholders"
    return 1
  fi

  return 0
}

echo "Validating CLAUDE.md files across ${#REPOS[@]} repos..."
echo "Root: $LUNA_ROOT"
echo ""

for repo in "${REPOS[@]}"; do
  claude_file="$LUNA_ROOT/$repo/CLAUDE.md"
  echo "Checking $repo/CLAUDE.md..."

  if [ ! -f "$claude_file" ]; then
    echo "  FAIL: File does not exist"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  repo_errors=0

  for i in "${!REQUIRED_SECTIONS[@]}"; do
    section="${REQUIRED_SECTIONS[$i]}"

    # Check section header exists
    if ! grep -qF "$section" "$claude_file"; then
      echo "  FAIL: Missing section '$section'"
      repo_errors=$((repo_errors + 1))
      continue
    fi

    # Determine next section for content extraction boundary
    next_idx=$((i + 1))
    next_section=""
    if [ "$next_idx" -lt "${#REQUIRED_SECTIONS[@]}" ]; then
      next_section="${REQUIRED_SECTIONS[$next_idx]}"
    fi

    if ! check_section_populated "$claude_file" "$section" "$next_section"; then
      repo_errors=$((repo_errors + 1))
    fi
  done

  if [ "$repo_errors" -eq 0 ]; then
    echo "  OK: All 5 sections populated"
  else
    ERRORS=$((ERRORS + repo_errors))
  fi
  echo ""
done

echo "========================================"
if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS issue(s) found across CLAUDE.md files"
  exit 1
else
  echo "PASSED: All ${#REPOS[@]} CLAUDE.md files validated successfully"
  exit 0
fi
