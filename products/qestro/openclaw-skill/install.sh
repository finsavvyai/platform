#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Qestro OpenClaw Skill Installer
# ═══════════════════════════════════════════════════════════════════════
#
# Installs the Qestro QA skill into your OpenClaw workspace.
#
# Usage:
#   ./install.sh                    # Install to default workspace
#   ./install.sh /path/to/workspace # Install to custom workspace
#
# Prerequisites:
#   - OpenClaw installed and running
#   - Python 3.6+ available
#
# ═══════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${CYAN}🦞 ═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Qestro × OpenClaw Skill Installer${NC}"
echo -e "${CYAN}🦞 ═══════════════════════════════════════════════════${NC}"
echo ""

# Determine workspace directory
WORKSPACE="${1:-$HOME/.openclaw/workspace}"
SKILL_DIR="$WORKSPACE/skills/qestro"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check for Python 3
if command -v python3 &> /dev/null; then
    PYTHON="python3"
elif command -v python &> /dev/null; then
    PYTHON="python"
else
    echo -e "${RED}❌ Python 3 is required but not found.${NC}"
    echo "   Install Python 3: https://www.python.org/downloads/"
    exit 1
fi

echo -e "${BLUE}📁 Workspace:${NC} $WORKSPACE"
echo -e "${BLUE}📦 Skill Dir:${NC} $SKILL_DIR"
echo -e "${BLUE}🐍 Python:${NC}    $($PYTHON --version 2>&1)"
echo ""

# Create skill directory
echo -e "${YELLOW}⏳ Creating skill directory...${NC}"
mkdir -p "$SKILL_DIR/scripts"

# Copy skill files
echo -e "${YELLOW}⏳ Copying skill files...${NC}"
cp "$SCRIPT_DIR/SKILL.md" "$SKILL_DIR/SKILL.md"
cp "$SCRIPT_DIR/scripts/qestro_client.py" "$SKILL_DIR/scripts/qestro_client.py"
chmod +x "$SKILL_DIR/scripts/qestro_client.py"

echo -e "${GREEN}✅ Skill files installed${NC}"

# Check if OpenClaw config exists
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
if [ -f "$OPENCLAW_CONFIG" ]; then
    echo -e "${GREEN}✅ OpenClaw config found at $OPENCLAW_CONFIG${NC}"
else
    echo -e "${YELLOW}⚠️  OpenClaw config not found at $OPENCLAW_CONFIG${NC}"
    echo "   Run 'openclaw onboard' to set up OpenClaw first."
fi

# Prompt for Qestro API configuration
echo ""
echo -e "${BOLD}━━━━━ Configuration ━━━━━${NC}"
echo ""

if [ -z "$QESTRO_API_URL" ]; then
    read -p "  Qestro API URL [http://localhost:3020]: " input_url
    QESTRO_API_URL="${input_url:-http://localhost:3020}"
fi

if [ -z "$QESTRO_API_KEY" ]; then
    read -p "  Qestro API Key (optional, press Enter to skip): " input_key
    QESTRO_API_KEY="${input_key:-}"
fi

# Create a local config file for the skill
cat > "$SKILL_DIR/scripts/config.env" << EOF
# Qestro OpenClaw Skill Configuration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
QESTRO_API_URL=$QESTRO_API_URL
QESTRO_API_KEY=$QESTRO_API_KEY
EOF

echo -e "${GREEN}✅ Configuration saved to $SKILL_DIR/scripts/config.env${NC}"

# Verify installation
echo ""
echo -e "${YELLOW}⏳ Verifying installation...${NC}"

if [ -f "$SKILL_DIR/SKILL.md" ] && [ -f "$SKILL_DIR/scripts/qestro_client.py" ]; then
    echo -e "${GREEN}✅ SKILL.md found${NC}"
    echo -e "${GREEN}✅ qestro_client.py found${NC}"
    
    # Test the client
    QESTRO_API_URL="$QESTRO_API_URL" QESTRO_API_KEY="$QESTRO_API_KEY" \
        $PYTHON "$SKILL_DIR/scripts/qestro_client.py" 2>/dev/null && \
        echo -e "${GREEN}✅ Client script is valid${NC}" || \
        echo -e "${YELLOW}⚠️  Client script check returned non-zero (API may not be running)${NC}"
else
    echo -e "${RED}❌ Installation verification failed${NC}"
    exit 1
fi

# Print summary
echo ""
echo -e "${CYAN}🦞 ═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ Qestro skill installed successfully!${NC}"
echo -e "${CYAN}🦞 ═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}What's next:${NC}"
echo ""
echo -e "  1. ${BLUE}Start Qestro backend:${NC}"
echo -e "     cd qestro/backend && npm run dev"
echo ""
echo -e "  2. ${BLUE}Enable webhooks in OpenClaw config:${NC}"
echo -e "     Edit ~/.openclaw/openclaw.json:"
echo -e '     { "hooks": { "enabled": true, "token": "your-secret" } }'
echo ""
echo -e "  3. ${BLUE}Set env vars in OpenClaw:${NC}"
echo -e '     Add to skills.entries.qestro.env in openclaw.json:'
echo -e "     QESTRO_API_URL=$QESTRO_API_URL"
echo ""
echo -e "  4. ${BLUE}Restart OpenClaw and try:${NC}"
echo -e '     "Show my QA dashboard"'
echo -e '     "Run the login regression suite"'
echo -e '     "Generate tests for checkout flow"'
echo ""
