#!/bin/bash

# Domain Availability Checker for Unique Brand Names
# Creative, non-existing brands for testing platform

echo "🚀 Checking Domain Availability for Unique Brand Names"
echo "======================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to check domain availability using whois
check_domain() {
    local domain=$1
    local tld=$2
    local full_domain="${domain}.${tld}"
    
    # Use DNS lookup as a quick check
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
    local meaning=$2
    local clean_name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    
    echo -e "${BLUE}🎯 ${name}${NC} ${YELLOW}(${meaning})${NC}"
    echo "-------------------"
    
    local available=0
    
    for tld in com io dev app co ai tech cloud; do
        if check_domain "$clean_name" "$tld"; then
            available=$((available + 1))
        fi
    done
    
    echo ""
    return $available
}

echo "🌟 UNIQUE TECH-SOUNDING BRANDS"
echo "==============================="
echo ""

# Unique tech-sounding names
check_all_tlds "Qestro" "Quality + Maestro fusion"
check_all_tlds "Testara" "Test + Ara (altar/platform)"
check_all_tlds "Zestful" "Zest + Testful"
check_all_tlds "Verixa" "Verify + Axis"
check_all_tlds "Testique" "Test + Unique"
check_all_tlds "Qualix" "Quality + Matrix"
check_all_tlds "Nextest" "Next + Test"
check_all_tlds "Provox" "Prove + Vox (voice)"

echo "🎨 CREATIVE INVENTED NAMES"
echo "=========================="
echo ""

check_all_tlds "Testavio" "Test + Octavio (elegant sound)"
check_all_tlds "Qualiton" "Quality + Automaton"
check_all_tlds "Testronix" "Test + Electronics"
check_all_tlds "Validex" "Valid + Index"
check_all_tlds "Checkly" "Check + Friendly suffix"
check_all_tlds "Testimo" "Test + Ultimo"
check_all_tlds "Provity" "Prove + Activity"
check_all_tlds "Testopia" "Test + Utopia"

echo "🚀 MODERN STARTUP NAMES"
echo "======================="
echo ""

check_all_tlds "Testful" "Full of tests"
check_all_tlds "Testory" "Test + Story"
check_all_tlds "Qualito" "Quality + Auto"
check_all_tlds "Testrix" "Test + Matrix"
check_all_tlds "Validy" "Valid + Handy"
check_all_tlds "Testino" "Test + Bambino (playful)"
check_all_tlds "Proveo" "Prove + Neo"
check_all_tlds "Checkito" "Check + Bonito (nice)"

echo "💡 SHORT & MEMORABLE"
echo "===================="
echo ""

check_all_tlds "Testly" "Simple, friendly"
check_all_tlds "Qesto" "Quest + Test"
check_all_tlds "Vesto" "Verify + Test + Go"
check_all_tlds "Provy" "Prove + Easy"
check_all_tlds "Testa" "Test + Alpha"
check_all_tlds "Qualo" "Quality + Go"
check_all_tlds "Vexo" "Verify + Execute"
check_all_tlds "Zesto" "Zest + Test + Go"

echo "🎯 POWERFUL & PROFESSIONAL"
echo "=========================="
echo ""

check_all_tlds "Veridian" "Verify + Guardian"
check_all_tlds "Qualitas" "Latin for Quality"
check_all_tlds "Testron" "Test + Strong"
check_all_tlds "Validium" "Valid + Premium"
check_all_tlds "Provenix" "Proven + Phoenix"
check_all_tlds "Certix" "Certify + Matrix"
check_all_tlds "Qualixa" "Quality + Hexa"
check_all_tlds "Testrium" "Test + Atrium"

echo "🌈 FRIENDLY & APPROACHABLE"
echo "=========================="
echo ""

check_all_tlds "Testberry" "Test + Berry (fresh)"
check_all_tlds "Qualibee" "Quality + Bee (busy)"
check_all_tlds "Testango" "Test + Tango (dance)"
check_all_tlds "Provello" "Prove + Hello"
check_all_tlds "Checkify" "Check + Simplify"
check_all_tlds "Testello" "Test + Hello"
check_all_tlds "Validoo" "Valid + Bamboo"
check_all_tlds "Qualingo" "Quality + Lingo"

echo "⚡ SPEED & EFFICIENCY FOCUSED"
echo "============================="
echo ""

check_all_tlds "Swiftest" "Swift + Test"
check_all_tlds "Rapidtest" "Rapid + Test"
check_all_tlds "Quickval" "Quick + Validate"
check_all_tlds "Fastprove" "Fast + Prove"
check_all_tlds "Speedtest" "Speed + Test"
check_all_tlds "Rushtest" "Rush + Test"
check_all_tlds "Ziptest" "Zip + Test"
check_all_tlds "Dashtest" "Dash + Test"

echo "🤖 AI-INSPIRED UNIQUE NAMES"
echo "==========================="
echo ""

check_all_tlds "Neurtest" "Neural + Test"
check_all_tlds "Synaptest" "Synapse + Test"
check_all_tlds "Cognixa" "Cognitive + Hexa"
check_all_tlds "Intellix" "Intelligence + Matrix"
check_all_tlds "Braintest" "Brain + Test"
check_all_tlds "Mindprove" "Mind + Prove"
check_all_tlds "Thinqtest" "Think + Test"
check_all_tlds "Smartix" "Smart + Matrix"

echo "📊 SUMMARY & RECOMMENDATIONS"
echo "==========================="
echo ""
echo "Top 5 Unique Brand Recommendations:"
echo "1. ${PURPLE}Qestro${NC} - Professional, unique, tech-sounding"
echo "2. ${PURPLE}Testara${NC} - Elegant, memorable, brandable"
echo "3. ${PURPLE}Verixa${NC} - Strong, professional, implies verification"
echo "4. ${PURPLE}Testavio${NC} - Sophisticated, unique, SaaS-friendly"
echo "5. ${PURPLE}Qualix${NC} - Quality-focused, tech-forward"
echo ""
echo "Note: These are DNS checks. Verify at registrar before deciding."
echo ""
echo "💡 Brand Selection Tips:"
echo "• Easy to pronounce and spell"
echo "• No trademark conflicts"
echo "• Works globally (no bad meanings in other languages)"
echo "• Memorable and distinctive"
echo "• Available social media handles"
echo ""