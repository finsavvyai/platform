#!/bin/bash

# 🚀 Questro Status Checker
# Quick verification of development environment

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}╔══════════════════════════════════════════════════════════╗"
echo -e "║                QUESTRO STATUS CHECK                      ║"
echo -e "╚══════════════════════════════════════════════════════════╝${NC}"

echo
echo -e "${BLUE}🌟 DEVELOPMENT ENVIRONMENT STATUS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check backend server
echo -n "Backend Server (8000): "
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ RUNNING${NC}"
    BACKEND_STATUS="✅"
else
    echo -e "${RED}❌ OFFLINE${NC}"
    BACKEND_STATUS="❌"
fi

# Check frontend server
echo -n "Frontend Server (3002): "
if curl -s http://localhost:3002 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ RUNNING${NC}"
    FRONTEND_STATUS="✅"
else
    echo -e "${RED}❌ OFFLINE${NC}"
    FRONTEND_STATUS="❌"
fi

echo
echo -e "${CYAN}📊 API ENDPOINT TESTS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test API endpoints if backend is running
if [[ $BACKEND_STATUS == "✅" ]]; then
    # Test health endpoint
    echo -n "Health Check: "
    HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
    if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
        echo -e "${GREEN}✅ HEALTHY${NC}"
    else
        echo -e "${YELLOW}⚠️  DEGRADED${NC}"
    fi
    
    # Test API info
    echo -n "API Info: "
    API_RESPONSE=$(curl -s http://localhost:8000/api)
    if echo "$API_RESPONSE" | grep -q "Questro API Server"; then
        echo -e "${GREEN}✅ RESPONDING${NC}"
    else
        echo -e "${RED}❌ ERROR${NC}"
    fi
    
    # Test auth endpoint
    echo -n "Auth Endpoint: "
    AUTH_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/register \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' 2>/dev/null)
    if echo "$AUTH_RESPONSE" | grep -q "successfully"; then
        echo -e "${GREEN}✅ FUNCTIONAL${NC}"
    else
        echo -e "${YELLOW}⚠️  ISSUES${NC}"
    fi
    
    # Test AI endpoint
    echo -n "AI Generation: "
    AI_RESPONSE=$(curl -s -X POST http://localhost:8000/api/ai/generate-test \
        -H "Content-Type: application/json" \
        -d '{"description":"test","framework":"playwright"}' 2>/dev/null)
    if echo "$AI_RESPONSE" | grep -q "Generated test"; then
        echo -e "${GREEN}✅ FUNCTIONAL${NC}"
    else
        echo -e "${YELLOW}⚠️  ISSUES${NC}"
    fi
else
    echo -e "${RED}❌ Backend offline - skipping API tests${NC}"
fi

echo
echo -e "${CYAN}🔧 CONFIGURATION STATUS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check environment files
echo -n "Backend .env: "
if [[ -f "backend/.env" ]]; then
    echo -e "${GREEN}✅ CONFIGURED${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

echo -n "Frontend .env: "
if [[ -f "frontend/.env" ]]; then
    echo -e "${GREEN}✅ CONFIGURED${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

echo -n "Production .env: "
if [[ -f "backend/.env.production" ]] || grep -q "questro.io" backend/.env 2>/dev/null; then
    echo -e "${GREEN}✅ CONFIGURED${NC}"
else
    echo -e "${YELLOW}⚠️  DEVELOPMENT ONLY${NC}"
fi

# Check deployment files
echo -n "Render Config: "
if [[ -f "render.yaml" ]]; then
    echo -e "${GREEN}✅ READY${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

echo -n "Deployment Scripts: "
if [[ -f "scripts/deploy-questro-io.sh" ]]; then
    echo -e "${GREEN}✅ READY${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

echo
echo -e "${CYAN}💰 BUSINESS READINESS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Pricing Plans: "
if [[ $BACKEND_STATUS == "✅" ]]; then
    PLANS_RESPONSE=$(curl -s http://localhost:8000/api/subscriptions/plans)
    if echo "$PLANS_RESPONSE" | grep -q "Free"; then
        echo -e "${GREEN}✅ CONFIGURED${NC}"
    else
        echo -e "${RED}❌ ERROR${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UNTESTED${NC}"
fi

echo -n "Marketing Materials: "
if [[ -f "scripts/marketing-launch.sh" ]]; then
    echo -e "${GREEN}✅ PREPARED${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

echo -n "Domain Strategy: "
if grep -q "questro.io" backend/.env 2>/dev/null; then
    echo -e "${GREEN}✅ PLANNED${NC}"
else
    echo -e "${YELLOW}⚠️  DEVELOPMENT ONLY${NC}"
fi

echo
echo -e "${PURPLE}📋 QUICK ACCESS LINKS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FRONTEND_STATUS == "✅" ]]; then
    echo -e "🌐 Frontend App: ${CYAN}http://localhost:3002${NC}"
fi

if [[ $BACKEND_STATUS == "✅" ]]; then
    echo -e "🔧 Backend API: ${CYAN}http://localhost:8000${NC}"
    echo -e "🏥 Health Check: ${CYAN}http://localhost:8000/health${NC}"
    echo -e "📊 API Info: ${CYAN}http://localhost:8000/api${NC}"
fi

echo
echo -e "${PURPLE}🎯 DEPLOYMENT READINESS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

READINESS_SCORE=0
TOTAL_CHECKS=6

# Check deployment readiness
if [[ $BACKEND_STATUS == "✅" ]]; then ((READINESS_SCORE++)); fi
if [[ $FRONTEND_STATUS == "✅" ]]; then ((READINESS_SCORE++)); fi
if [[ -f "backend/.env" ]]; then ((READINESS_SCORE++)); fi
if [[ -f "render.yaml" ]]; then ((READINESS_SCORE++)); fi
if [[ -f "scripts/deploy-questro-io.sh" ]]; then ((READINESS_SCORE++)); fi
if [[ -f "scripts/marketing-launch.sh" ]]; then ((READINESS_SCORE++)); fi

READINESS_PERCENT=$((READINESS_SCORE * 100 / TOTAL_CHECKS))

echo -n "Deployment Readiness: "
if [[ $READINESS_PERCENT -ge 90 ]]; then
    echo -e "${GREEN}${READINESS_PERCENT}% - READY TO DEPLOY! 🚀${NC}"
elif [[ $READINESS_PERCENT -ge 75 ]]; then
    echo -e "${YELLOW}${READINESS_PERCENT}% - Almost ready${NC}"
else
    echo -e "${RED}${READINESS_PERCENT}% - Needs work${NC}"
fi

echo
echo -e "${CYAN}💡 NEXT STEPS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $READINESS_PERCENT -ge 90 ]]; then
    echo -e "${GREEN}✅ Ready for production deployment!${NC}"
    echo "   1. Purchase questro.io domain"
    echo "   2. Run: ./scripts/deploy-questro-io.sh"
    echo "   3. Launch marketing campaign"
elif [[ $BACKEND_STATUS == "❌" ]]; then
    echo -e "${RED}🔧 Start development servers first:${NC}"
    echo "   ./scripts/start-dev.sh"
elif [[ $FRONTEND_STATUS == "❌" ]]; then
    echo -e "${YELLOW}🔧 Start frontend server:${NC}"
    echo "   cd frontend && npm run dev"
else
    echo -e "${BLUE}📝 Review implementation status:${NC}"
    echo "   cat IMPLEMENTATION_STATUS.md"
fi

echo
echo -e "${PURPLE}Status check complete! ${NC}"