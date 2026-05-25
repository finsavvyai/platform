#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# ClawHub Publish Script — Qestro Skill
# 
# Packages and publishes the Qestro skill to the ClawHub marketplace.
# Usage: ./publish.sh [--dry-run]
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$SCRIPT_DIR/dist"
DRY_RUN="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[publish]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
fail() { echo -e "${RED}  ❌ $1${NC}"; exit 1; }

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  🧪 Qestro × ClawHub — Skill Publisher"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Validate ────────────────────────────────────────────────────────

log "Validating skill package..."

[[ -f "$SKILL_ROOT/SKILL.md" ]] || fail "SKILL.md not found in $SKILL_ROOT"
[[ -f "$SKILL_ROOT/scripts/qestro_client.py" ]] || fail "scripts/qestro_client.py not found"
[[ -f "$SKILL_ROOT/install.sh" ]] || fail "install.sh not found"
[[ -f "$SCRIPT_DIR/manifest.json" ]] || fail "manifest.json not found"
[[ -f "$SCRIPT_DIR/README.md" ]] || fail "README.md not found"

ok "All required files present"

# Validate manifest.json is valid JSON
if command -v python3 &>/dev/null; then
    python3 -c "import json; json.load(open('$SCRIPT_DIR/manifest.json'))" 2>/dev/null || fail "manifest.json is not valid JSON"
    ok "manifest.json is valid"
elif command -v jq &>/dev/null; then
    jq . "$SCRIPT_DIR/manifest.json" > /dev/null 2>&1 || fail "manifest.json is not valid JSON"
    ok "manifest.json is valid"
else
    warn "Cannot validate JSON (install python3 or jq)"
fi

# Extract version from manifest
VERSION=$(python3 -c "import json; print(json.load(open('$SCRIPT_DIR/manifest.json'))['version'])" 2>/dev/null || echo "1.0.0")
log "Package version: $VERSION"

# ─── Package ─────────────────────────────────────────────────────────

log "Creating distribution package..."

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/qestro"

# Copy skill files
cp "$SKILL_ROOT/SKILL.md" "$DIST_DIR/qestro/"
cp -r "$SKILL_ROOT/scripts" "$DIST_DIR/qestro/"
cp "$SKILL_ROOT/install.sh" "$DIST_DIR/qestro/"

# Copy ClawHub metadata
cp "$SCRIPT_DIR/manifest.json" "$DIST_DIR/qestro/"
cp "$SCRIPT_DIR/README.md" "$DIST_DIR/qestro/"

# Generate checksums
cd "$DIST_DIR"
if command -v sha256sum &>/dev/null; then
    find qestro -type f | sort | xargs sha256sum > qestro/CHECKSUMS.txt
elif command -v shasum &>/dev/null; then
    find qestro -type f | sort | xargs shasum -a 256 > qestro/CHECKSUMS.txt
fi

# Create tarball
ARCHIVE="qestro-skill-v${VERSION}.tar.gz"
tar -czf "$ARCHIVE" qestro/

ok "Package created: $DIST_DIR/$ARCHIVE"

# Show package contents
log "Package contents:"
echo ""
tar -tzf "$ARCHIVE" | sed 's/^/    /'
echo ""

# Calculate size
SIZE=$(du -sh "$ARCHIVE" | awk '{print $1}')
log "Package size: $SIZE"

# ─── Publish ─────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo ""
    warn "DRY RUN — Skipping publish"
    log "To publish for real, run: ./publish.sh"
    echo ""
else
    log "Publishing to ClawHub..."
    
    # Check for ClawHub CLI
    if command -v clawhub &>/dev/null; then
        clawhub publish "$DIST_DIR/$ARCHIVE" \
            --name qestro \
            --version "$VERSION" \
            --category "Developer Tools" \
            --tag qa,testing,automation,ai
        ok "Published qestro v${VERSION} to ClawHub! 🎉"
    else
        warn "ClawHub CLI not found."
        echo ""
        echo -e "    ${CYAN}Manual upload instructions:${NC}"
        echo "    1. Go to https://clawhub.openclaw.ai/publish"
        echo "    2. Upload: $DIST_DIR/$ARCHIVE"
        echo "    3. Fill in details from manifest.json"
        echo ""
        echo -e "    ${CYAN}Or install the CLI:${NC}"
        echo "    pip install clawhub-cli"
        echo "    clawhub login"
        echo "    clawhub publish $DIST_DIR/$ARCHIVE"
        echo ""
    fi
fi

# ─── Done ────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ✅ Qestro skill package ready for distribution!"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  📦 Archive: $DIST_DIR/$ARCHIVE"
echo "  📋 Version: $VERSION"
echo "  📄 Files:   $(tar -tzf "$DIST_DIR/$ARCHIVE" | wc -l | tr -d ' ') files"
echo ""
