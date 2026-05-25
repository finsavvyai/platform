#!/bin/bash

# UPM.Plus Health Monitoring Script
# Monitors all environments and services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏥 UPM.Plus Health Monitor${NC}"
echo -e "${BLUE}Real-time monitoring of all environments${NC}"
echo

# Configuration
ENVIRONMENTS=(
    "development:upmplus.dev"
    "staging:upmplus.io"
    "production:upm.plus"
    "ai-production:upmplus.ai"
)

SERVICES=(
    "/:Main Page"
    "/dashboard:Dashboard"
    "/admin:Admin"
    "/docs:Documentation"
    "/cdn:CDN"
    "/app:Application"
    "/api/health:API Health"
    "/api/agents:API Agents"
    "/api/analytics:API Analytics"
)

# Function to check a single service
check_service() {
    local url="$1"
    local description="$2"
    local timeout="${3:-10}"

    if response=$(curl -s -w "%{http_code}" -m "$timeout" "$url" 2>/dev/null); then
        http_code="${response: -3}"
        response_body="${response%???}"

        if [[ "$http_code" =~ ^[23] ]]; then
            if [[ "$description" == *"API"* ]]; then
                if echo "$response_body" | grep -q "healthy\|browser-agent\|total_agents"; then
                    echo -e "   ${GREEN}✅ ${description}: HTTP $http_code${NC}"
                    return 0
                else
                    echo -e "   ${YELLOW}⚠️  ${description}: HTTP $http_code (API response unexpected)${NC}"
                    return 1
                fi
            else
                if echo "$response_body" | grep -q "UPM.Plus"; then
                    echo -e "   ${GREEN}✅ ${description}: HTTP $http_code${NC}"
                    return 0
                else
                    echo -e "   ${YELLOW}⚠️  ${description}: HTTP $http_code (content check failed)${NC}"
                    return 1
                fi
            fi
        else
            echo -e "   ${RED}❌ ${description}: HTTP $http_code${NC}"
            return 1
        fi
    else
        echo -e "   ${RED}❌ ${description}: Connection failed${NC}"
        return 1
    fi
}

# Function to get environment-specific info
get_environment_info() {
    local domain="$1"
    local health_url="https://$domain/api/health"

    if health_data=$(curl -s "$health_url" 2>/dev/null); then
        environment=$(echo "$health_data" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)
        status=$(echo "$health_data" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        timestamp=$(echo "$health_data" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)

        echo -e "   ${CYAN}Environment: $environment${NC}"
        echo -e "   ${CYAN}Status: $status${NC}"
        echo -e "   ${CYAN}Last Check: $timestamp${NC}"
    else
        echo -e "   ${RED}Environment info unavailable${NC}"
    fi
}

# Main monitoring loop
while true; do
    clear
    echo -e "${BLUE}🏥 UPM.Plus Health Monitor${NC}"
    echo -e "${BLUE}Real-time monitoring - $(date)${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop${NC}"
    echo

    overall_success=true

    for env_info in "${ENVIRONMENTS[@]}"; do
        IFS=':' read -r env_name domain <<< "$env_info"

        echo -e "${MAGENTA}=== $env_name Environment ($domain) ===${NC}"

        # Get environment info
        get_environment_info "$domain"
        echo

        # Check services
        env_success=true
        service_count=0
        success_count=0

        for service_info in "${SERVICES[@]}"; do
            IFS=':' read -r path description <<< "$service_info"
            url="https://$domain$path"

            if check_service "$url" "$description"; then
                ((success_count++))
            else
                env_success=false
                overall_success=false
            fi
            ((service_count++))
        done

        # Environment summary
        if $env_success; then
            echo -e "   ${GREEN}✅ Environment Status: ALL OPERATIONAL ($success_count/$service_count)${NC}"
        else
            echo -e "   ${RED}❌ Environment Status: ISSUES DETECTED ($success_count/$service_count)${NC}"
        fi
        echo
    done

    # Overall status
    if $overall_success; then
        echo -e "${GREEN}🎉 OVERALL STATUS: ALL SYSTEMS OPERATIONAL${NC}"
    else
        echo -e "${RED}⚠️  OVERALL STATUS: ISSUES DETECTED${NC}"
    fi

    echo
    echo -e "${CYAN}Next check in 30 seconds... (Press Ctrl+C to stop)${NC}"
    echo

    # Wait 30 seconds before next check
    sleep 30
done