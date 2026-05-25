#!/bin/bash

# Domain Availability Checker for Testing Platform Names
# This script checks .com, .io, .dev, and .app domains

echo "🔍 Checking Domain Availability for Testing Platform Names"
echo "=========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check domain availability using whois
check_domain() {
    local domain=$1
    local tld=$2
    local full_domain="${domain}.${tld}"
    
    # Use DNS lookup as a quick check (more reliable than whois for availability)
    if ! nslookup "$full_domain" 8.8.8.8 &>/dev/null; then
        echo -e "${GREEN}✅ ${full_domain} - LIKELY AVAILABLE${NC}"
        return 0
    else
        echo -e "${RED}❌ ${full_domain} - TAKEN${NC}"
        return 1
    fi
}

# Function to check all TLDs for a domain
check_all_tlds() {
    local name=$1
    local clean_name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    
    echo -e "${BLUE}Checking: ${name}${NC}"
    echo "-------------------"
    
    local available=0
    
    for tld in com io dev app co ai tech cloud pro; do
        if check_domain "$clean_name" "$tld"; then
            available=$((available + 1))
        fi
    done
    
    echo ""
    return $available
}

# List of potential names to check
echo "🎯 TOP RECOMMENDATIONS"
echo "====================="
echo ""

# Tech-Forward Names
check_all_tlds "testcraft"
check_all_tlds "testflow"
check_all_tlds "autotest"
check_all_tlds "testgenius"
check_all_tlds "smarttest"
check_all_tlds "testwave"

echo "🚀 ACTION-ORIENTED NAMES"
echo "========================"
echo ""

check_all_tlds "testdrive"
check_all_tlds "testlaunch"
check_all_tlds "testboost"
check_all_tlds "testrocket"
check_all_tlds "testvelocity"

echo "💡 MODERN SAAS NAMES"
echo "===================="
echo ""

check_all_tlds "testura"
check_all_tlds "testopia"
check_all_tlds "testlabs"
check_all_tlds "testcloud"
check_all_tlds "testforge"

echo "🤖 AI-FOCUSED NAMES"
echo "==================="
echo ""

check_all_tlds "aitest"
check_all_tlds "testmind"
check_all_tlds "cognitest"
check_all_tlds "testbrain"
check_all_tlds "intellitest"

echo "🎨 CREATIVE ALTERNATIVES"
echo "========================"
echo ""

check_all_tlds "testify"
check_all_tlds "testpilot"
check_all_tlds "testmaster"
check_all_tlds "testwise"
check_all_tlds "testpro"
check_all_tlds "quicktest"
check_all_tlds "easytest"
check_all_tlds "testmate"
check_all_tlds "testbuddy"
check_all_tlds "testguru"

echo "🌟 UNIQUE COMBINATIONS"
echo "======================"
echo ""

check_all_tlds "testcraft-ai"
check_all_tlds "test-genius"
check_all_tlds "smart-tester"
check_all_tlds "auto-tester"
check_all_tlds "test-studio"
check_all_tlds "test-engine"
check_all_tlds "test-magic"
check_all_tlds "test-wizard"

echo "📊 SUMMARY"
echo "=========="
echo ""
echo "Note: This is a quick DNS check. Please verify availability at your domain registrar."
echo "Recommended registrars:"
echo "  • Namecheap: https://www.namecheap.com"
echo "  • Google Domains: https://domains.google"
echo "  • Cloudflare: https://www.cloudflare.com/products/registrar/"
echo ""
echo "💡 Tip: Consider getting multiple TLDs for brand protection!"
echo ""