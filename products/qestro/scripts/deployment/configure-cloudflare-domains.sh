#!/bin/bash

# Cloudflare Domain Configuration Script
# Configures qestro.app and api.qestro.app with proper DNS records and SSL

set -e

echo "🌐 Configuring Cloudflare domains for Qestro..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Domain configuration
MAIN_DOMAIN="qestro.app"
API_DOMAIN="api.qestro.app"
RECORD_TYPE="A"

# Temporary IPs (these should be updated with actual service IPs)
# For now, we'll use placeholder IPs that need to be updated
MAIN_APP_IP="192.168.1.100"  # Update with actual app server IP
API_SERVER_IP="192.168.1.101" # Update with actual API server IP

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if wrangler is authenticated
check_auth() {
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Run: wrangler login"
        exit 1
    fi
    log_success "Authenticated with Cloudflare"
}

# Get zone ID for domain
get_zone_id() {
    local domain="$1"

    log_info "Getting zone ID for $domain..."

    # Get the base domain for zone lookup
    local base_domain=$(echo "$domain" | awk -F. '{print $(NF-1)"."$NF}')

    # Try to get zone ID from Cloudflare API
    local zone_id=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$base_domain" \
        -H "Authorization: Bearer $(wrangler whoami 2>/dev/null | grep -o 'OAuth Token' || echo '')" \
        -H "Content-Type: application/json" | \
        jq -r '.result[0].id' 2>/dev/null || echo "")

    if [ -z "$zone_id" ] || [ "$zone_id" = "null" ]; then
        log_error "Could not find zone ID for $base_domain. Make sure the domain is added to Cloudflare."
        return 1
    fi

    echo "$zone_id"
}

# Create or update DNS record
manage_dns_record() {
    local zone_id="$1"
    local domain="$2"
    local ip="$3"
    local record_name="$4"

    log_info "Managing DNS record for $domain..."

    # Check if record already exists
    local existing_record=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records?name=$domain&type=A" \
        -H "Authorization: Bearer CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json")

    local record_id=$(echo "$existing_record" | jq -r '.result[0].id' 2>/dev/null || echo "")

    if [ -n "$record_id" ] && [ "$record_id" != "null" ]; then
        log_info "Updating existing DNS record..."
        curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records/$record_id" \
            -H "Authorization: Bearer CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"A\",\"name\":\"$record_name\",\"content\":\"$ip\",\"ttl\":3600,\"proxied\":true}" | \
            jq -r '.success' | grep -q true
    else
        log_info "Creating new DNS record..."
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records" \
            -H "Authorization: Bearer CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"A\",\"name\":\"$record_name\",\"content\":\"$ip\",\"ttl\":3600,\"proxied\":true}" | \
            jq -r '.success' | grep -q true
    fi

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log_success "DNS record configured for $domain -> $ip"
    else
        log_error "Failed to configure DNS record for $domain"
        return 1
    fi
}

# Create Page Rules for redirect and security
create_page_rules() {
    local zone_id="$1"

    log_info "Creating page rules for $MAIN_DOMAIN..."

    # Rule 1: Always use HTTPS
    local rule1='{
        "targets": [
            {
                "target": "url",
                "constraint": {
                    "operator": "matches",
                    "value": "'$MAIN_DOMAIN'/*"
                }
            }
        ],
        "actions": [
            {
                "id": "always_use_https",
                "value": "on"
            }
        ],
        "status": "active"
    }'

    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/pagerules" \
        -H "Authorization: Bearer CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "$rule1" > /dev/null

    log_success "Page rules created"
}

# Verify domain configuration
verify_domain() {
    local domain="$1"

    log_info "Verifying domain configuration for $domain..."

    # Wait a moment for DNS propagation
    sleep 5

    # Check DNS resolution
    if nslookup "$domain" >/dev/null 2>&1; then
        log_success "DNS resolution working for $domain"
    else
        log_warning "DNS resolution not yet working for $domain (may need time to propagate)"
    fi

    # Check HTTPS connectivity
    if curl -I -k --max-time 10 "https://$domain" >/dev/null 2>&1; then
        log_success "HTTPS connectivity working for $domain"
    else
        log_warning "HTTPS connectivity not yet working for $domain (service may not be deployed yet)"
    fi
}

# Main configuration function
configure_domains() {
    log_info "Starting domain configuration..."

    # Note: This script needs a Cloudflare API token with Zone:Edit permissions
    # The token should be set as an environment variable: CLOUDFLARE_API_TOKEN

    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        log_error "CLOUDFLARE_API_TOKEN environment variable not set"
        log_info "Please set your Cloudflare API token:"
        log_info "export CLOUDFLARE_API_TOKEN=your_api_token_here"
        exit 1
    fi

    # Get zone ID for the main domain
    local zone_id=$(get_zone_id "$MAIN_DOMAIN")
    if [ $? -ne 0 ]; then
        exit 1
    fi

    log_success "Zone ID: $zone_id"

    # Configure main domain
    manage_dns_record "$zone_id" "$MAIN_DOMAIN" "$MAIN_APP_IP" "$MAIN_DOMAIN"
    manage_dns_record "$zone_id" "www.$MAIN_DOMAIN" "$MAIN_APP_IP" "www.$MAIN_DOMAIN"

    # Configure API domain
    manage_dns_record "$zone_id" "$API_DOMAIN" "$API_SERVER_IP" "api.$MAIN_DOMAIN"

    # Create page rules
    create_page_rules "$zone_id"

    # Verify configurations
    echo ""
    log_info "Verifying domain configurations..."
    verify_domain "$MAIN_DOMAIN"
    verify_domain "$API_DOMAIN"

    log_success "Domain configuration completed!"
}

# Show manual setup instructions
show_manual_instructions() {
    echo ""
    log_warning "⚠️  Manual Setup Required"
    echo ""
    echo "This script configured DNS records, but you need to:"
    echo ""
    echo "1. UPDATE THE IP ADDRESSES in this script with your actual server IPs:"
    echo "   - MAIN_APP_IP: Your frontend application server IP"
    echo "   - API_SERVER_IP: Your API server IP"
    echo ""
    echo "2. Set up Cloudflare API token:"
    echo "   export CLOUDFLARE_API_TOKEN=your_api_token_here"
    echo ""
    echo "3. Ensure your domains are added to your Cloudflare account:"
    echo "   - qestro.app"
    echo "   - api.qestro.app (as a subdomain of qestro.app)"
    echo ""
    echo "4. Update your application configuration:"
    echo "   - Frontend should point to: https://qestro.app"
    echo "   - API should point to: https://api.qestro.app"
    echo ""
    echo "5. Configure SSL certificates (automatically handled by Cloudflare)"
    echo ""
    echo "After making these changes, run:"
    echo "  ./scripts/deployment/configure-cloudflare-domains.sh"
    echo ""
}

# Main execution
main() {
    echo "🌐 Qestro - Cloudflare Domain Configuration"
    echo "=========================================="
    echo ""

    check_auth

    # Check if this is a dry run or actual configuration
    if [ "$1" = "--dry-run" ]; then
        log_info "Dry run mode - showing what would be configured:"
        echo ""
        echo "Domain: $MAIN_DOMAIN"
        echo "  - A record: $MAIN_DOMAIN -> $MAIN_APP_IP"
        echo "  - A record: www.$MAIN_DOMAIN -> $MAIN_APP_IP"
        echo ""
        echo "Domain: $API_DOMAIN"
        echo "  - A record: $API_DOMAIN -> $API_SERVER_IP"
        echo ""
        echo "Page rules: Always use HTTPS"
        echo ""
        show_manual_instructions
    else
        if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run    Show what would be configured without making changes"
            echo "  --help       Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  CLOUDFLARE_API_TOKEN  Your Cloudflare API token"
            echo ""
            exit 0
        else
            configure_domains
        fi
    fi
}

# Run main function
main "$@"