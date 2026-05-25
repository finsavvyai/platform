#!/bin/bash

######################################################################
# FinSavvyAI Quick Production Deployment
######################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     FinSavvyAI - Quick Production Deployment                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Kill any existing gateway
echo -e "${GREEN}▶ Stopping any existing gateway...${NC}"
lsof -ti :8080 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Start production gateway
echo -e "${GREEN}▶ Starting production gateway...${NC}"
export FINSAVVYAI_ENV=production
export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
export FINSAVVYAI_SOURCES_PATH=./sources
export FINSAVVYAI_NOTEBOOKS_PATH=./notebooks
export LMSTUDIO_BASE_URL=http://localhost:1234

mkdir -p sources notebooks logs/production

nohup python3 -m src.api.gateway > logs/production/gateway.log 2>&1 &
echo $! > .gateway.pid

sleep 5

# Verify
echo -e "${GREEN}▶ Verifying deployment...${NC}"
if curl -sf http://localhost:8080/health > /dev/null; then
    echo -e "${GREEN}✓ Gateway is healthy!${NC}"
else
    echo -e "${YELLOW}⚠ Gateway not responding. Check logs:${NC}"
    echo "   tail -f logs/production/gateway.log"
    exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ PRODUCTION DEPLOYMENT COMPLETE! ✅               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📊 Production Services:"
echo "   • Gateway: http://localhost:8080"
echo "   • Health: http://localhost:8080/health"
echo "   • Metrics: http://localhost:8080/metrics"
echo ""
echo "📚 API Endpoints:"
echo "   • Sources: http://localhost:8080/api/notebook/sources"
echo "   • Notebooks: http://localhost:8080/api/notebook/notebooks"
echo ""
echo "🔧 Management:"
echo "   • Logs: tail -f logs/production/gateway.log"
echo "   • Stop: kill \$(cat .gateway.pid)"
echo "   • Restart: ./start_production.sh"
echo ""
echo "📖 Documentation: docs/PRODUCTION_DEPLOYMENT.md"
echo ""
