#!/bin/bash

# 🔍 Environment Variables Validation Script
# Checks if all required environment variables are properly configured

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}╔══════════════════════════════════════════════════════════╗"
echo -e "║           ENVIRONMENT VARIABLES VALIDATION               ║"
echo -e "╚══════════════════════════════════════════════════════════╝${NC}"
echo

# Load environment file
ENV_FILE="backend/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}❌ Production environment file not found: $ENV_FILE${NC}"
    echo -e "${YELLOW}💡 Run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Checking production environment configuration...${NC}"
echo

# Source the env file for validation
set -a
source "$ENV_FILE" 2>/dev/null
set +a

ERRORS=0
WARNINGS=0

# Function to check if variable exists and is not a placeholder
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    local is_required=${2:-true}
    local description=$3
    
    if [[ -z "$var_value" ]]; then
        if [[ "$is_required" == "true" ]]; then
            echo -e "${RED}❌ $var_name is missing${NC}"
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠️  $var_name is optional but not set${NC}"
            ((WARNINGS++))
        fi
    elif [[ "$var_value" == *"REPLACE_WITH"* ]] || [[ "$var_value" == *"your_"* ]] || [[ "$var_value" == *"PLACEHOLDER"* ]]; then
        echo -e "${RED}❌ $var_name contains placeholder value: $var_value${NC}"
        if [[ -n "$description" ]]; then
            echo -e "   💡 $description"
        fi
        ((ERRORS++))
    else
        echo -e "${GREEN}✅ $var_name is configured${NC}"
    fi
}

echo -e "${CYAN}🗄️ Database Configuration:${NC}"
check_var "DATABASE_URL" true "Get from Supabase project settings"
check_var "USE_SUPABASE" true

echo
echo -e "${CYAN}🔑 Authentication:${NC}"
check_var "JWT_SECRET" true "Generate with: openssl rand -base64 32"
check_var "JWT_REFRESH_SECRET" true "Generate with: openssl rand -base64 32"

echo  
echo -e "${CYAN}🌐 Domain Configuration:${NC}"
check_var "FRONTEND_URL" true
check_var "CORS_ORIGIN" true
check_var "DOMAIN" true

echo
echo -e "${CYAN}📧 Email Configuration:${NC}"
check_var "EMAIL_PROVIDER" true
if [[ "$EMAIL_PROVIDER" == "smtp" ]]; then
    check_var "SMTP_USER" true "Your Gmail address or SMTP username"
    check_var "SMTP_PASS" true "Gmail app password or SMTP password"
elif [[ "$EMAIL_PROVIDER" == "sendgrid" ]]; then
    check_var "SENDGRID_API_KEY" true "Get from SendGrid dashboard"
fi
check_var "FROM_EMAIL" true
check_var "SUPPORT_EMAIL" true

echo
echo -e "${CYAN}🍋 Payment Configuration:${NC}"
check_var "LEMONSQUEEZY_API_KEY" true "Get from LemonSqueezy API settings"
check_var "LEMONSQUEEZY_STORE_ID" true "Your store ID from LemonSqueezy"
check_var "LEMONSQUEEZY_WEBHOOK_SECRET" true "Create a random string for webhooks"
check_var "LEMONSQUEEZY_VARIANT_ID_PRO" true "Pro plan variant ID from LemonSqueezy"
check_var "LEMONSQUEEZY_VARIANT_ID_ENTERPRISE" true "Enterprise plan variant ID from LemonSqueezy"

echo
echo -e "${CYAN}🧠 AI Configuration:${NC}"
check_var "OPENAI_API_KEY" true "Get from OpenAI platform"
check_var "OPENAI_MODEL" true
check_var "OPENAI_MAX_TOKENS" false
check_var "OPENAI_TEMPERATURE" false

echo
echo -e "${CYAN}⚙️ Server Configuration:${NC}"
check_var "NODE_ENV" true
check_var "PORT" true
check_var "LOG_LEVEL" false

echo
echo -e "${CYAN}🚀 Feature Flags:${NC}"
check_var "ENABLE_RECORDING" false
check_var "ENABLE_MOBILE_TESTING" false
check_var "ENABLE_WEB_TESTING" false
check_var "ENABLE_AI_GENERATION" false

echo
echo -e "${PURPLE}📊 VALIDATION SUMMARY${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}✅ All required environment variables are properly configured!${NC}"
    if [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  $WARNINGS optional variables not set (this is OK)${NC}"
    fi
    echo
    echo -e "${GREEN}🚀 Ready for production deployment!${NC}"
    echo
    echo -e "${CYAN}Next steps:${NC}"
    echo "1. Purchase questro.io domain"
    echo "2. Run: ./scripts/deploy-questro-io.sh"
    echo "3. Start your marketing campaign"
else
    echo -e "${RED}❌ $ERRORS environment variables need to be fixed${NC}"
    if [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warnings (optional)${NC}"
    fi
    echo
    echo -e "${YELLOW}📖 Check the setup guide:${NC}"
    echo "   cat ENVIRONMENT_SETUP_GUIDE.md"
    echo
    echo -e "${BLUE}🔧 Quick fixes:${NC}"
    echo "• Generate JWT secrets: openssl rand -base64 32"
    echo "• Set up Supabase database at: https://supabase.com"
    echo "• Configure OpenAI API at: https://platform.openai.com"
    echo "• Set up LemonSqueezy at: https://lemonsqueezy.com"
fi

echo
echo -e "${PURPLE}Environment validation complete!${NC}"

# Exit with error code if there are errors
if [[ $ERRORS -gt 0 ]]; then
    exit 1
else
    exit 0
fi