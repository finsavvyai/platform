#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/publish-tokenforge.sh [patch|minor|major]
# Bumps version, commits, pushes — PushCI deploy.sh auto-publishes to npm.
# Requires NPM_TOKEN in .env.

BUMP="${1:-patch}"
PKG_DIR="packages/tokenforge"

cd "$(git rev-parse --show-toplevel)"

# Bump version in package.json
cd "$PKG_DIR"
NEW_VERSION=$(node -e "
  const pkg = require('./package.json');
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  const bump = process.argv[1];
  if (bump === 'major') console.log(\`\${major+1}.0.0\`);
  else if (bump === 'minor') console.log(\`\${major}.\${minor+1}.0\`);
  else console.log(\`\${major}.\${minor}.\${patch+1}\`);
" "$BUMP")

node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
cd ../..

echo "Bumped @opensyber/tokenforge to v$NEW_VERSION"

# Build + test
pnpm --filter @opensyber/tokenforge build
pnpm --filter @opensyber/tokenforge test

# Commit + push (PushCI handles npm publish via deploy.sh)
git add "$PKG_DIR/package.json"
git commit -m "chore(tokenforge): bump to v$NEW_VERSION"

echo ""
echo "Committed. Push to publish:"
echo "  set -a && source .env && set +a && TERM=xterm-256color git push origin main"
echo ""
echo "PushCI will run tests → deploy → npm publish automatically."
