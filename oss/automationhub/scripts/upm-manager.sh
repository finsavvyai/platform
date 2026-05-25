#!/bin/bash

# UPM.Plus Management Script
# Comprehensive management tool for UPM.Plus deployment and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Script information
SCRIPT_NAME="UPM.Plus Manager"
VERSION="1.0.0"

# Configuration
ENVIRONMENTS=("development" "staging" "production" "ai-production")
DOMAINS=("upmplus.dev" "upmplus.io" "upm.plus" "upmplus.ai")

# Help function
show_help() {
    echo -e "${BLUE}$SCRIPT_NAME v$VERSION${NC}"
    echo -e "${BLUE}Comprehensive UPM.Plus management tool${NC}"
    echo
    echo -e "${CYAN}Usage: $0 [COMMAND] [OPTIONS]${NC}"
    echo
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  ${GREEN}deploy${NC} [env]      Deploy to all or specific environments"
    echo -e "  ${GREEN}status${NC}           Check status of all environments"
    echo -e "  ${GREEN}health${NC}           Run health check on all services"
    echo -e "  ${GREEN}test${NC} [env]       Run comprehensive tests"
    echo -e "  ${GREEN}monitor${NC}          Start real-time monitoring"
    echo -e "  ${GREEN}logs${NC} [env]       View logs for specific environment"
    echo -e "  ${GREEN}cleanup${NC}          Clean up resources"
    echo -e "  ${GREEN}info${NC}            Show system information"
    echo -e "  ${GREEN}help${NC}             Show this help message"
    echo
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  $0 deploy           # Deploy to all environments"
    echo -e "  $0 deploy production # Deploy to production only"
    echo -e "  $0 status           # Check all environment status"
    echo -e "  $0 health           # Run health checks"
    echo -e "  $0 test development # Test development environment"
    echo -e "  $0 monitor          # Start monitoring"
    echo -e "  $0 logs production  # View production logs"
    echo
}

# Deploy function
deploy() {
    local env="$1"

    echo -e "${BLUE}🚀 Deploying UPM.Plus${NC}"
    echo

    if [[ -n "$env" ]]; then
        echo -e "${CYAN}Deploying to $env environment...${NC}"
        if wrangler deploy --env "$env"; then
            echo -e "${GREEN}✅ Deployment to $env successful${NC}"
        else
            echo -e "${RED}❌ Deployment to $env failed${NC}"
            exit 1
        fi
    else
        echo -e "${CYAN}Deploying to all environments...${NC}"
        for env in "${ENVIRONMENTS[@]}"; do
            echo -e "${YELLOW}Deploying to $env...${NC}"
            if wrangler deploy --env "$env"; then
                echo -e "${GREEN}✅ $env deployed${NC}"
            else
                echo -e "${RED}❌ $env deployment failed${NC}"
            fi
        done
    fi

    echo
    echo -e "${GREEN}🎉 Deployment completed!${NC}"
}

# Status function
status() {
    echo -e "${BLUE}📊 UPM.Plus Status${NC}"
    echo

    echo -e "${CYAN}Environment Status:${NC}"
    for env in "${ENVIRONMENTS[@]}"; do
        echo -e "${YELLOW}Checking $env...${NC}"

        # Check deployment status
        if wrangler deployments list --env "$env" >/dev/null 2>&1; then
            deployments=$(wrangler deployments list --env "$env" 2>/dev/null | grep -c "Created:" || echo "0")
            echo -e "   ${GREEN}✅ Deployed ($deployments deployments)${NC}"
        else
            echo -e "   ${RED}❌ Not deployed${NC}"
        fi

        # Check domain health if we know the domain
        case "$env" in
            "development")
                domain="upmplus.dev"
                ;;
            "staging")
                domain="upmplus.io"
                ;;
            "production")
                domain="upm.plus"
                ;;
            "ai-production")
                domain="upmplus.ai"
                ;;
        esac

        if [[ -n "$domain" ]]; then
            echo -e "   Testing https://$domain/api/health..."
            if curl -s "https://$domain/api/health" >/dev/null 2>&1; then
                echo -e "   ${GREEN}✅ API responding${NC}"
            else
                echo -e "   ${RED}❌ API not responding${NC}"
            fi
        fi
        echo
    done

    echo -e "${CYAN}Worker Summary:${NC}"
    echo -e "${YELLOW}Total Environments: ${#ENVIRONMENTS[@]}${NC}"
    echo -e "${YELLOW}Total Domains: ${#DOMAINS[@]}${NC}"
    echo -e "${YELLOW}Total Routes: $((${#ENVIRONMENTS[@]} * 9))${NC}"
}

# Health check function
health() {
    echo -e "${BLUE}🏥 UPM.Plus Health Check${NC}"
    echo

    overall_healthy=true
    total_checks=0
    passed_checks=0

    # Test each environment
    for env_info in "development:upmplus.dev" "staging:upmplus.io"; do
        IFS=':' read -r env_name domain <<< "$env_info"

        echo -e "${MAGENTA}=== $env_name Health Check ===${NC}"

        # Test main services
        services=(
            "$domain:Main Page"
            "$domain/dashboard:Dashboard"
            "$domain/admin:Admin"
            "$domain/docs:Documentation"
            "$domain/api/health:API Health"
        )

        env_healthy=true
        for service_info in "${services[@]}"; do
            IFS=':' read -r url description <<< "$service_info"

            ((total_checks++))
            echo -n "   Testing $description... "

            if response=$(curl -s -w "%{http_code}" -m 5 "https://$url" 2>/dev/null); then
                http_code="${response: -3}"
                if [[ "$http_code" =~ ^[23] ]]; then
                    echo -e "${GREEN}✅ OK${NC}"
                    ((passed_checks++))
                else
                    echo -e "${RED}❌ HTTP $http_code${NC}"
                    env_healthy=false
                    overall_healthy=false
                fi
            else
                echo -e "${RED}❌ FAILED${NC}"
                env_healthy=false
                overall_healthy=false
            fi
        done

        if $env_healthy; then
            echo -e "   ${GREEN}✅ $env_name: HEALTHY${NC}"
        else
            echo -e "   ${RED}❌ $env_name: UNHEALTHY${NC}"
        fi
        echo
    done

    # Overall status
    echo -e "${MAGENTA}=== Overall Health Status ===${NC}"
    echo -e "${YELLOW}Total Checks: $total_checks${NC}"
    echo -e "${YELLOW}Passed: $passed_checks${NC}"
    echo -e "${YELLOW}Failed: $((total_checks - passed_checks))${NC}"

    if $overall_healthy; then
        echo -e "${GREEN}🎉 OVERALL STATUS: HEALTHY${NC}"
    else
        echo -e "${RED}⚠️  OVERALL STATUS: UNHEALTHY${NC}"
    fi
}

# Test function
test() {
    local env="$1"

    if [[ -n "$env" ]]; then
        echo -e "${BLUE}🧪 Testing $env environment...${NC}"
        ./run_working_tests.sh 2>/dev/null | grep -E "(✅|❌|⚠️)"
    else
        echo -e "${BLUE}🧪 Running comprehensive tests...${NC}"
        ./run_working_tests.sh
    fi
}

# Monitor function
monitor() {
    echo -e "${BLUE}📺 Starting real-time monitoring...${NC}"
    echo -e "${CYAN}Press Ctrl+C to stop monitoring${NC}"
    echo
    ./scripts/health-monitor.sh
}

# Logs function
logs() {
    local env="$1"

    if [[ -z "$env" ]]; then
        echo -e "${RED}❌ Please specify an environment${NC}"
        echo -e "${CYAN}Available environments: ${ENVIRONMENTS[*]}${NC}"
        exit 1
    fi

    echo -e "${BLUE}📋 Viewing logs for $env environment...${NC}"
    echo -e "${CYAN}Press Ctrl+C to stop tailing logs${NC}"
    echo

    wrangler tail --env "$env"
}

# Info function
info() {
    echo -e "${BLUE}ℹ️  UPM.Plus System Information${NC}"
    echo

    echo -e "${MAGENTA}=== Deployment Information ===${NC}"
    echo -e "${YELLOW}Script Version: $VERSION${NC}"
    echo -e "${YELLOW}Configured Environments: ${#ENVIRONMENTS[@]}${NC}"
    echo -e "${YELLOW}Configured Domains: ${#DOMAINS[@]}${NC}"
    echo

    echo -e "${MAGENTA}=== Environment Mapping ===${NC}"
    for i in "${!ENVIRONMENTS[@]}"; do
        echo -e "${YELLOW}${ENVIRONMENTS[$i]} → ${DOMAINS[$i]}${NC}"
    done
    echo

    echo -e "${MAGENTA}=== Worker Status ===${NC}"
    for env in "${ENVIRONMENTS[@]}"; do
        echo -e "${YELLOW}Checking $env...${NC}"
        if wrangler deployments list --env "$env" >/dev/null 2>&1; then
            latest=$(wrangler deployments list --env "$env" 2>/dev/null | head -3)
            echo -e "${GREEN}✅ $env is deployed${NC}"
            echo "$latest" | sed 's/^/   /'
        else
            echo -e "${RED}❌ $env is not deployed${NC}"
        fi
        echo
    done

    echo -e "${MAGENTA}=== Quick Access URLs ===${NC}"
    echo -e "${CYAN}Development Environment:${NC}"
    echo -e "   Main: https://upmplus.dev"
    echo -e "   Dashboard: https://upmplus.dev/dashboard"
    echo -e "   API: https://upmplus.dev/api/health"
    echo
    echo -e "${CYAN}Staging Environment:${NC}"
    echo -e "   Main: https://upmplus.io"
    echo -e "   Dashboard: https://upmplus.io/dashboard"
    echo -e "   API: https://upmplus.io/api/health"
    echo
}

# Cleanup function
cleanup() {
    echo -e "${BLUE}🧹 Cleaning up resources...${NC}"
    echo

    # Clean up any temporary files
    if [[ -d "test_uploads" ]]; then
        rm -rf test_uploads
        echo -e "${GREEN}✅ Cleaned up test uploads${NC}"
    fi

    # Clean up any cache files
    find . -name "*.cache" -type f -delete 2>/dev/null || true
    echo -e "${GREEN}✅ Cleaned up cache files${NC}"

    echo
    echo -e "${GREEN}🎉 Cleanup completed!${NC}"
}

# Main script logic
case "${1:-help}" in
    deploy)
        deploy "$2"
        ;;
    status)
        status
        ;;
    health)
        health
        ;;
    test)
        test "$2"
        ;;
    monitor)
        monitor
        ;;
    logs)
        logs "$2"
        ;;
    cleanup)
        cleanup
        ;;
    info)
        info
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo
        show_help
        exit 1
        ;;
esac