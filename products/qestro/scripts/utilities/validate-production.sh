#!/bin/bash

# Production Environment Validation Script
# Validates all required environment variables and dependencies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔍 Qestro Production Environment Validation${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Function to check required environment variable
check_required_env() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ REQUIRED: $var_name is not set${NC}"
        ((ERRORS++))
        return 1
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
        return 0
    fi
}

# Function to check optional environment variable
check_optional_env() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  OPTIONAL: $var_name is not set${NC}"
        ((WARNINGS++))
        return 1
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
        return 0
    fi
}

echo -e "${BLUE}📋 Checking Core Configuration...${NC}"
check_required_env "NODE_ENV"
check_required_env "PORT"

echo ""
echo -e "${BLUE}🗄️  Checking Database Configuration...${NC}"
if [ "$USE_SUPABASE" = "true" ]; then
    echo -e "${BLUE}Using Supabase...${NC}"
    check_required_env "SUPABASE_URL"
    check_required_env "SUPABASE_ANON_KEY"
    check_required_env "SUPABASE_DB_HOST"
    check_required_env "SUPABASE_DB_PASSWORD"
else
    echo -e "${BLUE}Using Local PostgreSQL...${NC}"
    check_required_env "LOCAL_DB_HOST"
    check_required_env "LOCAL_DB_NAME"
    check_required_env "LOCAL_DB_USER"
    check_required_env "LOCAL_DB_PASSWORD"
fi

echo ""
echo -e "${BLUE}🔐 Checking Security Configuration...${NC}"
check_required_env "JWT_SECRET"
check_optional_env "JWT_EXPIRES_IN"

echo ""
echo -e "${BLUE}📧 Checking Email Configuration...${NC}"
check_optional_env "SMTP_HOST"
check_optional_env "SMTP_USER"
check_optional_env "SMTP_PASSWORD"

echo ""
echo -e "${BLUE}💳 Checking Payment Configuration...${NC}"
check_optional_env "LEMONSQUEEZY_API_KEY"
check_optional_env "LEMONSQUEEZY_STORE_ID"

echo ""
echo -e "${BLUE}🤖 Checking AI Configuration...${NC}"
check_optional_env "OPENAI_API_KEY"

echo ""
echo -e "${BLUE}☁️  Checking Cloud Storage...${NC}"
check_optional_env "AWS_ACCESS_KEY_ID"
check_optional_env "AWS_SECRET_ACCESS_KEY"
check_optional_env "AWS_S3_BUCKET"

echo ""
echo -e "${BLUE}🔗 Checking Redis Configuration...${NC}"
check_optional_env "REDIS_URL"

echo ""
echo -e "${BLUE}🌐 Checking CORS Configuration...${NC}"
check_required_env "FRONTEND_URL"

echo ""
echo -e "${BLUE}📊 Checking Feature Flags...${NC}"
check_optional_env "ENABLE_RECORDING"
check_optional_env "ENABLE_MOBILE_TESTING"
check_optional_env "ENABLE_WEB_TESTING"
check_optional_env "ENABLE_AI_GENERATION"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  📊 Validation Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Environment is ready for production.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warnings found. Review optional configurations.${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS errors found. Fix required configurations before deploying.${NC}"
    echo -e "${YELLOW}⚠️  $WARNINGS warnings found.${NC}"
    exit 1
fi
