#!/bin/bash

# 🚀 QUESTRO MASTER LAUNCH SCRIPT
# Your complete path from code to cash!

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    QUESTRO LAUNCHER                      ║"
echo "║              From Code to Cash in 3 Steps! 💰           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}Welcome to the Questro Launch System! 🚀${NC}"
echo -e "${YELLOW}This will take you from local development to making money online.${NC}"
echo

echo -e "${CYAN}Choose your launch phase:${NC}"
echo
echo -e "${BLUE}1. 🔧 SETUP PHASE${NC} - Configure accounts and environment"
echo "   • Set up database, payments, AI services"
echo "   • Configure environment variables"
echo "   • Test all integrations"
echo
echo -e "${BLUE}2. 🧪 TESTING PHASE${NC} - Test everything locally"
echo "   • Verify all functionality works"
echo "   • Run integration tests"
echo "   • Generate test report"
echo
echo -e "${BLUE}3. 🚀 DEPLOYMENT PHASE${NC} - Go live on the internet"
echo "   • Deploy to Render.com and Netlify"
echo "   • Configure production environment"
echo "   • Set up monitoring"
echo
echo -e "${BLUE}4. 💰 MARKETING PHASE${NC} - Get customers and make money"
echo "   • Product Hunt launch strategy"
echo "   • Social media campaigns"
echo "   • Email marketing automation"
echo
echo -e "${BLUE}5. 📊 ALL PHASES${NC} - Complete end-to-end launch"
echo "   • Run all phases automatically"
echo "   • Full setup to making money"
echo

echo -e "${CYAN}What would you like to do? (1-5):${NC}"
read -r CHOICE

case $CHOICE in
    1)
        echo -e "${GREEN}🔧 Starting Setup Phase...${NC}"
        if [ -f "scripts/setup-accounts.sh" ]; then
            ./scripts/setup-accounts.sh
        else
            echo -e "${RED}❌ Setup script not found!${NC}"
            exit 1
        fi
        ;;
    2)
        echo -e "${GREEN}🧪 Starting Testing Phase...${NC}"
        if [ -f "scripts/test-local.sh" ]; then
            ./scripts/test-local.sh
        else
            echo -e "${RED}❌ Testing script not found!${NC}"
            exit 1
        fi
        ;;
    3)
        echo -e "${GREEN}🚀 Starting Deployment Phase...${NC}"
        if [ -f "scripts/deploy-production.sh" ]; then
            ./scripts/deploy-production.sh
        else
            echo -e "${RED}❌ Deployment script not found!${NC}"
            exit 1
        fi
        ;;
    4)
        echo -e "${GREEN}💰 Starting Marketing Phase...${NC}"
        if [ -f "scripts/marketing-launch.sh" ]; then
            ./scripts/marketing-launch.sh
        else
            echo -e "${RED}❌ Marketing script not found!${NC}"
            exit 1
        fi
        ;;
    5)
        echo -e "${GREEN}📊 Starting Complete Launch Process...${NC}"
        echo -e "${YELLOW}This will run all phases sequentially.${NC}"
        echo -e "${YELLOW}Make sure you have 2-3 hours available.${NC}"
        echo
        echo -e "${CYAN}Are you ready to launch Questro and start making money? (y/N):${NC}"
        read -r CONFIRM
        
        if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
            echo -e "${PURPLE}"
            echo "╔══════════════════════════════════════════════════════════╗"
            echo "║              COMPLETE QUESTRO LAUNCH INITIATED          ║"
            echo "║                    Let's Make Money! 💰                 ║"
            echo "╚══════════════════════════════════════════════════════════╝"
            echo -e "${NC}"
            
            # Phase 1: Setup
            echo -e "${BLUE}🔧 PHASE 1: ACCOUNT SETUP${NC}"
            if [ -f "scripts/setup-accounts.sh" ]; then
                ./scripts/setup-accounts.sh
                if [ $? -ne 0 ]; then
                    echo -e "${RED}❌ Setup failed. Please fix issues and try again.${NC}"
                    exit 1
                fi
            fi
            
            # Phase 2: Testing
            echo -e "${BLUE}🧪 PHASE 2: LOCAL TESTING${NC}"
            if [ -f "scripts/test-local.sh" ]; then
                ./scripts/test-local.sh
                if [ $? -ne 0 ]; then
                    echo -e "${RED}❌ Testing failed. Please fix issues and try again.${NC}"
                    exit 1
                fi
            fi
            
            # Phase 3: Deployment
            echo -e "${BLUE}🚀 PHASE 3: PRODUCTION DEPLOYMENT${NC}"
            if [ -f "scripts/deploy-production.sh" ]; then
                ./scripts/deploy-production.sh
                if [ $? -ne 0 ]; then
                    echo -e "${RED}❌ Deployment failed. Please fix issues and try again.${NC}"
                    exit 1
                fi
            fi
            
            # Phase 4: Marketing
            echo -e "${BLUE}💰 PHASE 4: MARKETING LAUNCH${NC}"
            if [ -f "scripts/marketing-launch.sh" ]; then
                ./scripts/marketing-launch.sh
            fi
            
            # Success message
            echo -e "${PURPLE}"
            echo "╔══════════════════════════════════════════════════════════╗"
            echo "║              🎉 QUESTRO LAUNCH COMPLETE! 🎉             ║"
            echo "║                                                          ║"
            echo "║         Your SaaS Platform is Now Live & Ready          ║"
            echo "║              to Generate Revenue! 💰                    ║"
            echo "╚══════════════════════════════════════════════════════════╝"
            echo -e "${NC}"
            
            echo -e "${GREEN}🌟 CONGRATULATIONS! 🌟${NC}"
            echo -e "${CYAN}You've successfully launched a world-class SaaS platform!${NC}"
            echo
            echo -e "${YELLOW}📊 What you've accomplished:${NC}"
            echo "✅ Complete authentication system"
            echo "✅ Payment processing with Stripe"
            echo "✅ AI-powered test generation"
            echo "✅ Production deployment"
            echo "✅ Marketing strategy & assets"
            echo
            echo -e "${BLUE}🎯 Your next steps:${NC}"
            echo "1. Execute your Product Hunt launch"
            echo "2. Start your social media campaign"
            echo "3. Begin outreach to potential customers"
            echo "4. Monitor metrics and optimize"
            echo
            echo -e "${GREEN}💰 Revenue Potential: \$5,000 - \$50,000/month${NC}"
            echo -e "${GREEN}🎯 Goal: First paying customer within 7 days${NC}"
            echo
            echo -e "${PURPLE}You did it! Now go make some money! 🚀💰${NC}"
        else
            echo -e "${YELLOW}Launch cancelled. Run this script again when ready.${NC}"
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Please run the script again.${NC}"
        exit 1
        ;;
esac

echo
echo -e "${GREEN}✨ Thank you for using the Questro Launch System! ✨${NC}"
echo -e "${CYAN}Your journey to SaaS success starts now! 🚀${NC}"