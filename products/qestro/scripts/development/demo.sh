#!/bin/bash

# 🎯 Qestro Professional Demo Script
# Demonstrates all CLI capabilities

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}  🎯 QESTRO PROFESSIONAL CLI DEMONSTRATION${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if qestro-pro is installed
if ! command -v qestro-pro &> /dev/null; then
    echo -e "${YELLOW}⚠️  qestro-pro not found. Running quick-start first...${NC}"
    ./quick-start.sh &
    sleep 10
fi

# Demo functions
pause() {
    echo ""
    echo -e "${YELLOW}Press any key to continue...${NC}"
    read -n 1 -s -r
    echo ""
}

demo_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Start demo
echo -e "${GREEN}Welcome to the Qestro Professional Testing Platform!${NC}"
echo -e "${WHITE}This demo will showcase the complete CLI capabilities.${NC}"
pause

# 1. Health Check
demo_section "1. BACKEND HEALTH CHECK"
echo -e "${BLUE}$ qestro-pro health${NC}"
qestro-pro health
pause

# 2. Platform Status
demo_section "2. PLATFORM STATUS"
echo -e "${BLUE}$ qestro-pro status${NC}"
qestro-pro status
pause

# 3. Recording Capabilities
demo_section "3. RECORDING CAPABILITIES"

echo -e "${GREEN}Start Web Recording:${NC}"
echo -e "${BLUE}$ qestro-pro record web --url https://example.com --browser chrome${NC}"
qestro-pro record web --url https://example.com --browser chrome
echo ""

echo -e "${GREEN}Start Mobile Recording:${NC}"
echo -e "${BLUE}$ qestro-pro record mobile --platform ios --device 'iPhone 15'${NC}"
qestro-pro record mobile --platform ios --device "iPhone 15"
echo ""

echo -e "${GREEN}List All Recordings:${NC}"
echo -e "${BLUE}$ qestro-pro record list${NC}"
qestro-pro record list
pause

# 4. Voice-to-Text Integration
demo_section "4. VOICE-TO-TEXT INTEGRATION"

echo -e "${GREEN}Available Voice Providers:${NC}"
echo -e "${BLUE}$ qestro-pro voice providers${NC}"
qestro-pro voice providers
echo ""

echo -e "${GREEN}Voice Command Patterns:${NC}"
echo -e "${BLUE}$ qestro-pro voice commands${NC}"
qestro-pro voice commands
echo ""

echo -e "${GREEN}Start Voice-Guided Recording:${NC}"
echo -e "${BLUE}$ qestro-pro voice record --platform web --framework playwright${NC}"
qestro-pro voice record --platform web --framework playwright
pause

# 5. API Testing
demo_section "5. API TESTING"

echo -e "${GREEN}Test GitHub API:${NC}"
echo -e "${BLUE}$ qestro-pro api test https://api.github.com/users/octocat --method GET${NC}"
qestro-pro api test https://api.github.com/users/octocat --method GET
echo ""

echo -e "${GREEN}Test Local API:${NC}"
echo -e "${BLUE}$ qestro-pro api test http://localhost:3020/api/health --method GET${NC}"
qestro-pro api test http://localhost:3020/api/health --method GET
pause

# 6. AI-Powered Testing
demo_section "6. AI-POWERED TESTING"

echo -e "${GREEN}Generate AI Tests for Web:${NC}"
echo -e "${BLUE}$ qestro-pro ai generate --type web --target https://example.com${NC}"
qestro-pro ai generate --type web --target https://example.com
echo ""

echo -e "${GREEN}Generate AI Tests for Mobile:${NC}"
echo -e "${BLUE}$ qestro-pro ai generate --type mobile --target com.example.app${NC}"
qestro-pro ai generate --type mobile --target com.example.app
pause

# 7. Data Validation
demo_section "7. DATA VALIDATION"

echo -e "${GREEN}Connect to Database:${NC}"
echo -e "${BLUE}$ qestro-pro data connect --type postgresql --connection 'host=localhost'${NC}"
qestro-pro data connect --type postgresql --connection "host=localhost"
echo ""

echo -e "${GREEN}Validate Data Configuration:${NC}"
echo -e "${BLUE}$ qestro-pro data validate config.json${NC}"
qestro-pro data validate config.json
pause

# Summary
demo_section "DEMO COMPLETE!"

echo -e "${GREEN}✅ You've seen the complete Qestro Professional CLI in action!${NC}"
echo ""
echo -e "${WHITE}Key Features Demonstrated:${NC}"
echo -e "${BLUE}  • Web and Mobile Recording${NC}"
echo -e "${BLUE}  • Voice-to-Text Integration${NC}"
echo -e "${BLUE}  • API Testing${NC}"
echo -e "${BLUE}  • AI-Powered Test Generation${NC}"
echo -e "${BLUE}  • Data Validation${NC}"
echo ""
echo -e "${YELLOW}💡 All commands work from ANY directory${NC}"
echo -e "${YELLOW}💡 No npm or package.json required${NC}"
echo -e "${YELLOW}💡 Professional CLI with formal parameters${NC}"
echo ""
echo -e "${CYAN}🚀 Ready for enterprise deployment!${NC}"
echo ""
echo -e "${WHITE}Documentation: https://qestro.io/docs${NC}"
echo -e "${WHITE}Support: support@qestro.io${NC}"
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"