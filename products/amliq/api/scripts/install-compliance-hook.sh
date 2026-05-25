#!/bin/bash
# Install the AMLIQ compliance pre-commit hook
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_SRC="$SCRIPT_DIR/compliance-check.sh"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-commit"

if [[ ! -f "$HOOK_SRC" ]]; then
  echo "ERROR: compliance-check.sh not found at $HOOK_SRC"
  exit 1
fi

if [[ ! -d "$REPO_ROOT/.git/hooks" ]]; then
  echo "ERROR: Not a git repository or .git/hooks missing"
  exit 1
fi

# Back up existing hook if present
if [[ -f "$HOOK_DST" ]]; then
  BACKUP="$HOOK_DST.backup.$(date +%s)"
  cp "$HOOK_DST" "$BACKUP"
  echo "Backed up existing pre-commit hook to $BACKUP"
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"

echo ""
echo "AMLIQ Compliance Hook installed."
echo ""
echo "What it does:"
echo "  - Scans staged files for potential sanctioned entity names"
echo "  - Screens extracted names against AMLIQ API"
echo "  - Warns if any match > 80% confidence (never blocks commits)"
echo ""
echo "Requirements:"
echo "  - AMLIQ API running: go run ./cmd/api/main.go"
echo "  - Or set AMLIQ_API_URL environment variable"
echo ""
echo "To uninstall: rm $HOOK_DST"
