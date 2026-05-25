#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "Installing git hooks..."
for hook in pre-commit pre-push; do
  if [ -f "scripts/$hook" ]; then
    cp "scripts/$hook" ".git/hooks/$hook"
    chmod +x ".git/hooks/$hook"
    echo "  Installed: $hook"
  fi
done
echo "Done. Hooks active."
