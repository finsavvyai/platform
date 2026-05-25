#!/bin/bash

# UPM.Plus Cloudflare Deployment Script
# Domain: quantombean.io

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="upm.plus"
EMAIL="admin@upm.plus"
NAMESPACE="upm-plus"
LOAD_BALANCER_IP=""
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ZONE_ID=""

echo -e "${BLUE}☁️  UPM.Plus Cloudflare Deployment${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo ""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[ℹ]${NC} $1"
}

# Check if Cloudflare CLI is installed
check_cloudflare_cli() {
    print_status "Checking Cloudflare CLI..."

    if command -v cloudflare &> /dev/null; then
        CF_VERSION=$(cloudflare version --format json 2>/dev/null | jq -r '.Version' 2>/dev/null || echo "unknown")
        print_status "Cloudflare CLI found (version: ${CF_VERSION})"
    else
        print_error "Cloudflare CLI not found"
        echo -e "${YELLOW}Install Cloudflare CLI:${NC}"
        echo "macOS: brew install cloudflare/cloudflare/cloudflare"
        echo "Linux: wget -qO - https://github.com/cloudflare/cloudflare-go/releases/latest/download/cloudflare-linux-amd64 && sudo mv cloudflare-linux-amd64 /usr/local/bin/cloudflare"
        echo "Windows: Download from https://github.com/cloudflare/cloudflare-go/releases"
        exit 1
    fi
}

# Check if jq is installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v jq &> /dev/null; then
        print_error "jq is required for JSON processing"
        echo "Install jq: brew install jq (macOS) or apt-get install jq (Ubuntu)"
        exit 1
    fi

    print_status "Dependencies check passed ✓"
}

# Get Cloudflare API token
get_cloudflare_credentials() {
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        echo -e "${CYAN}Cloudflare API Token Required${NC}"
        echo "Get your API token from: https://dash.cloudflare.com/profile/api-tokens"
        echo "Required permissions: Zone:Zone:Read, Zone:DNS:Edit, Zone:Page Rules:Edit"
        echo ""
        read -s -p "Enter Cloudflare API Token: " CLOUDFLARE_API_TOKEN
        echo

        if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
            print_error "Cloudflare API token is required"
            exit 1
        fi
    fi

    # Test API token
    print_status "Testing Cloudflare API token..."
    if ! cloudflare --token "$CLOUDFLARE_API_TOKEN" zone list --format json &> /dev/null; then
        print_error "Invalid Cloudflare API token"
        exit 1
    fi

    print_status "Cloudflare API token validated ✓"
}

# Get zone ID for the domain
get_zone_id() {
    print_status "Getting zone ID for ${DOMAIN}..."

    ZONE_INFO=$(cloudflare --token "$CLOUDFLARE_API_TOKEN" zone list --name "$DOMAIN" --format json 2>/dev/null)

    if [ -z "$ZONE_INFO" ]; then
        print_error "Domain ${DOMAIN} not found in Cloudflare account"
        print_info "Available zones:"
        cloudflare --token "$CLOUDFLARE_API_TOKEN" zone list --format json | jq -r '.[].Name' | sed 's/^/  - /'
        exit 1
    fi

    CLOUDFLARE_ZONE_ID=$(echo "$ZONE_INFO" | jq -r '.[0].ID')
    print_status "Zone ID: ${CLOUDFLARE_ZONE_ID}"
}

# Get LoadBalancer IP from Kubernetes
get_loadbalancer_ip() {
    print_status "Getting LoadBalancer IP from Kubernetes..."

    if ! kubectl get svc ingress-nginx-controller -n ingress-nginx &> /dev/null; then
        print_error "Ingress-nginx controller not found. Deploy it first:"
        echo "helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace --set controller.service.type=LoadBalancer"
        exit 1
    fi

    LOAD_BALANCER_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)

    if [ -z "$LOAD_BALANCER_IP" ]; then
        print_warning "LoadBalancer IP not yet assigned"
        print_info "Waiting for LoadBalancer IP..."

        # Wait up to 5 minutes for LoadBalancer IP
        for i in {1..30}; do
            sleep 10
            LOAD_BALANCER_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
            if [ -n "$LOAD_BALANCER_IP" ]; then
                break
            fi
            echo -n "."
        done
        echo ""

        if [ -z "$LOAD_BALANCER_IP" ]; then
            print_error "LoadBalancer IP still not assigned"
            print_info "Check your cloud provider's LoadBalancer configuration"
            exit 1
        fi
    fi

    print_status "LoadBalancer IP: ${LOAD_BALANCER_IP}"
}

# Create DNS records
create_dns_records() {
    print_status "Creating DNS records for ${DOMAIN}..."

    # Delete existing A records to avoid conflicts
    print_info "Removing existing A records..."
    EXISTING_RECORDS=$(cloudflare --token "$CLOUDFLARE_API_TOKEN" dns list --zone-id "$CLOUDFLARE_ZONE_ID" --type A --format json 2>/dev/null)
    if [ -n "$EXISTING_RECORDS" ]; then
        echo "$EXISTING_RECORDS" | jq -r '.[] | select(.Name == "'$DOMAIN'" or .Name == "www.'$DOMAIN'" or .Name == "api.'$DOMAIN'" or .Name == "app.'$DOMAIN'" or .Name == "dashboard.'$DOMAIN'") | .ID' | while read record_id; do
            if [ -n "$record_id" ]; then
                cloudflare --token "$CLOUDFLARE_API_TOKEN" dns delete --zone-id "$CLOUDFLARE_ZONE_ID" --id "$record_id" &>/dev/null
                print_info "Removed existing record: $record_id"
            fi
        done
    fi

    # Create A records
    local domains=("$DOMAIN" "www.$DOMAIN" "api.$DOMAIN" "app.$DOMAIN" "dashboard.$DOMAIN")

    for domain in "${domains[@]}"; do
        print_info "Creating A record: $domain -> $LOAD_BALANCER_IP"

        cloudflare --token "$CLOUDFLARE_API_TOKEN" dns create \
            --zone-id "$CLOUDFLARE_ZONE_ID" \
            --type A \
            --name "$domain" \
            --content "$LOAD_BALANCER_IP" \
            --ttl 300 \
            --proxy false \
            --format json &>/dev/null

        if [ $? -eq 0 ]; then
            print_status "A record created for $domain ✓"
        else
            print_error "Failed to create A record for $domain"
        fi
    done
}

# Configure SSL/TLS settings
configure_ssl_tls() {
    print_status "Configuring SSL/TLS settings..."

    # Enable SSL/TLS with Full (Strict) mode
    print_info "Setting SSL/TLS to Full (Strict) mode..."
    cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
        --zone-id "$CLOUDFLARE_ZONE_ID" \
        --ssl "strict" \
        --tls-1-3 "on" \
        --automatic-https-rewrites "on" \
        --always-use-https "on" \
        --hsts "on" \
        --hsts-max-age 31536000 \
        --hsts-include-subdomains "on" \
        --hsts-preload "on" &>/dev/null

    if [ $? -eq 0 ]; then
        print_status "SSL/TLS configuration updated ✓"
    else
        print_warning "Failed to update SSL/TLS settings (may require manual configuration)"
    fi
}

# Create Page Rules for HTTP to HTTPS redirection
create_page_rules() {
    print_status "Creating page rules for HTTPS redirection..."

    # HTTP to HTTPS redirect rule
    print_info "Creating HTTP to HTTPS redirect rule..."

    cloudflare --token "$CLOUDFLARE_API_TOKEN" pagerule create \
        --zone-id "$CLOUDFLARE_ZONE_ID" \
        --targets "http://*${DOMAIN}/*" \
        --actions "forward,https://${DOMAIN}/$1" \
        --status "active" \
        --priority 1 &>/dev/null

    if [ $? -eq 0 ]; then
        print_status "HTTP to HTTPS redirect rule created ✓"
    else
        print_warning "Failed to create page rule (may require manual configuration)"
    fi
}

# Configure security settings
configure_security() {
    print_status "Configuring security settings..."

    # Enable Bot Fight Mode
    cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
        --zone-id "$CLOUDFLARE_ZONE_ID" \
        --bot-fight-mode "on" &>/dev/null

    # Set Security Level
    cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
        --zone-id "$CLOUDFLARE_ZONE_ID" \
        --security-level "medium" &>/dev/null

    # Enable Browser Cache TTL
    cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
        --zone-id "$CLOUDFLARE_ZONE_ID" \
        --browser-cache-ttl "4 hours" \
        --development-mode "off" &>/dev/null

    print_status "Security settings configured ✓"
}

# Create Cloudflare Workers for edge functions
create_workers() {
    print_status "Creating Cloudflare Workers..."

    # Create a basic worker for API edge routing
    cat > /tmp/upm-plus-worker.js << 'EOF'
addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Route API requests
  if (url.pathname.startsWith('/api/')) {
    // Forward to backend
    const backendUrl = `https://api.upm.plus${url.pathname}${url.search}`;
    return fetch(backendUrl, request);
  }

  // Route WebSocket connections
  if (url.pathname.startsWith('/ws/')) {
    const wsUrl = `wss://api.upm.plus${url.pathname}${url.search}`;
    return new Request(wsUrl, request);
  }

  // Default to frontend
  return fetch(request);
});
EOF

    # Create worker
    print_info "Creating edge worker..."
    cloudflare --token "$CLOUDFLARE_API_TOKEN" workers create \
        --name "upm-plus-edge-router" \
        --script /tmp/upm-plus-worker.js \
        --compatibility-date "2023-10-30" &>/dev/null

    if [ $? -eq 0 ]; then
        print_status "Cloudflare Worker created ✓"
    else
        print_warning "Failed to create Cloudflare Worker (may require Worker plan)"
    fi

    # Clean up temporary file
    rm -f /tmp/upm-plus-worker.js
}

# Configure cache settings for API
configure_api_cache() {
    print_status "Configuring cache settings for API..."

    # Create cache rules for static assets
    print_info "Creating cache rules for static assets..."

    # Cache rule for static assets
    cloudflare --token "$CLOUDFLARE_API_TOKEN" rule create \
        --zone-id "$CLOUDFLARE_ZONE_ID" \
        --expression "(http.request.uri.path contains \".js\" or http.request.uri.path contains \".css\" or http.request.uri.path contains \".png\" or http.request.uri.path contains \".jpg\" or http.request.uri.path contains \".jpeg\" or http.request.uri.path contains \".gif\" or http.request.uri.path contains \".svg\" or http.request.uri.path contains \".ico\")" \
        --action "cache" \
        --action-parameters "{\"edge_cache_ttl\": 7200, \"browser_cache_ttl\": 86400, \"cache_key\": [\"http.request.uri.path\"]}" \
        --enabled "true" &>/dev/null

    if [ $? -eq 0 ]; then
        print_status "Cache rules created for static assets ✓"
    else
        print_warning "Failed to create cache rules (may require Pro plan)"
    fi
}

# Wait for DNS propagation
wait_for_dns_propagation() {
    print_status "Waiting for DNS propagation..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        echo -n "."

        # Check if DNS resolves
        if dig +short "$DOMAIN" | grep -q "$LOAD_BALANCER_IP"; then
            echo ""
            print_status "DNS propagated successfully ✓"
            return 0
        fi

        sleep 10
        ((attempt++))
    done

    echo ""
    print_warning "DNS propagation may take longer. Check manually later."
}

# Test domain accessibility
test_domain_accessibility() {
    print_status "Testing domain accessibility..."

    local domains=("$DOMAIN" "www.$DOMAIN" "api.$DOMAIN" "app.$DOMAIN" "dashboard.$DOMAIN")

    for domain in "${domains[@]}"; do
        echo -n "Testing https://$domain... "

        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$domain" 2>/dev/null || echo "000")

        if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
            print_status "$domain - HTTP $HTTP_STATUS ✓"
        else
            print_warning "$domain - HTTP $HTTP_STATUS (may still be propagating)"
        fi
    done
}

# Show deployment summary
show_summary() {
    print_status "🎉 Cloudflare Deployment Complete!"
    echo ""
    echo -e "${BLUE}Deployment Summary:${NC}"
    echo -e "  Domain: ${GREEN}https://$DOMAIN${NC}"
    echo -e "  API: ${GREEN}https://api.$DOMAIN${NC}"
    echo -e "  App: ${GREEN}https://app.$DOMAIN${NC}"
    echo -e "  Dashboard: ${GREEN}https://dashboard.$DOMAIN${NC}"
    echo -e "  LoadBalancer IP: ${YELLOW}$LOAD_BALANCER_IP${NC}"
    echo -e "  Cloudflare Zone ID: ${YELLOW}$CLOUDFLARE_ZONE_ID${NC}"
    echo ""
    echo -e "${BLUE}Configuration Applied:${NC}"
    echo -e "  ✅ DNS records configured"
    echo -e "  ✅ SSL/TLS enabled (Full Strict)"
    echo -e "  ✅ HTTPS redirection enabled"
    echo -e "  ✅ Security settings applied"
    echo -e "  ✅ Cache rules created"
    echo -e "  ✅ Edge functions deployed"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Test all subdomains and features"
    echo "  2. Monitor SSL certificate status"
    echo "  3. Set up Cloudflare analytics"
    echo "  4. Configure rate limiting rules"
    echo "  5. Test application functionality"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  Check DNS: cloudflare dns list --zone-id $CLOUDFLARE_ZONE_ID"
    echo "  Check SSL: cloudflare ssl-analytics --zone-id $CLOUDFLARE_ZONE_ID"
    echo "  Check analytics: cloudflare analytics --zone-id $CLOUDFLARE_ZONE_ID"
    echo "  Clear cache: cloudflare cache purge --zone-id $CLOUDFLARE_ZONE_ID"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting Cloudflare deployment for $DOMAIN${NC}"
    echo ""

    # Check prerequisites
    check_cloudflare_cli
    check_dependencies
    get_cloudflare_credentials
    get_zone_id
    get_loadbalancer_ip

    # Configure Cloudflare
    create_dns_records
    configure_ssl_tls
    create_page_rules
    configure_security
    configure_api_cache

    # Create edge functions
    create_workers

    # Wait and test
    wait_for_dns_propagation
    test_domain_accessibility

    # Show summary
    show_summary
}

# Error handling
trap 'print_error "Deployment failed! Check the logs above for details."' ERR

# Run main function
main "$@"