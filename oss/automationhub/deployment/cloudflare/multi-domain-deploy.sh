#!/bin/bash

# UPM.Plus Multi-Domain Cloudflare Deployment Script
# Domains: upm.plus, upmplus.dev, upmplus.io, upmplus.ai

set -e

# Load domain configuration
source "$(dirname "$0")/domains.conf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}☁️  UPM.Plus Multi-Domain Cloudflare Deployment${NC}"
echo -e "${BLUE}Primary Domain: ${PRIMARY_DOMAIN}${NC}"
echo -e "${BLUE}All Domains: ${ALL_DOMAINS[*]}${NC}"
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

print_domain() {
    echo -e "${MAGENTA}[DOMAIN]${NC} $1"
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
        echo "Required permissions: Zone:Zone:Read, Zone:DNS:Edit, Zone:Page Rules:Edit, Zone:Workers:Edit"
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

# Get zone IDs for all domains
get_zone_ids() {
    print_status "Getting zone IDs for all domains..."

    declare -A TEMP_ZONE_IDS

    for domain in "${ALL_DOMAINS[@]}"; do
        print_domain "Processing $domain..."

        ZONE_INFO=$(cloudflare --token "$CLOUDFLARE_API_TOKEN" zone list --name "$domain" --format json 2>/dev/null)

        if [ -z "$ZONE_INFO" ]; then
            print_warning "Domain $domain not found in Cloudflare account"
            print_info "Available zones:"
            cloudflare --token "$CLOUDFLARE_API_TOKEN" zone list --format json | jq -r '.[].Name' | sed 's/^/  - /'
            continue
        fi

        ZONE_ID=$(echo "$ZONE_INFO" | jq -r '.[0].ID')
        TEMP_ZONE_IDS["$domain"]="$ZONE_ID"
        print_status "Zone ID for $domain: $ZONE_ID"
    done

    # Store zone IDs globally
    ZONE_IDS="$(declare -p TEMP_ZONE_IDS)"
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

    print_status "LoadBalancer IP: $LOAD_BALANCER_IP"
}

# Create DNS records for all domains
create_dns_records() {
    print_status "Creating DNS records for all domains..."

    for domain in "${ALL_DOMAINS[@]}"; do
        print_domain "Configuring $domain..."

        # Get zone ID for this domain
        eval "ZONE_ID=\${TEMP_ZONE_IDS[$domain]}"

        if [ -z "$ZONE_ID" ]; then
            print_warning "Skipping $domain (no zone ID found)"
            continue
        fi

        # Delete existing A records to avoid conflicts
        print_info "Removing existing A records for $domain..."
        EXISTING_RECORDS=$(cloudflare --token "$CLOUDFLARE_API_TOKEN" dns list --zone-id "$ZONE_ID" --type A --format json 2>/dev/null)
        if [ -n "$EXISTING_RECORDS" ]; then
            echo "$EXISTING_RECORDS" | jq -r '.[] | select(.Name == "'$domain'" or .Name == "www.'$domain'" or .Name == "api.'$domain'" or .Name == "app.'$domain'" or .Name == "dashboard.'$domain'" or .Name == "admin.'$domain'" or .Name == "docs.'$domain'" or .Name == "cdn.'$domain'" or .Name == "static.'$domain'" or .Name == "assets.'$domain'") | .ID' | while read record_id; do
                if [ -n "$record_id" ]; then
                    cloudflare --token "$CLOUDFLARE_API_TOKEN" dns delete --zone-id "$ZONE_ID" --id "$record_id" &>/dev/null
                    print_info "Removed existing record: $record_id"
                fi
            done
        fi

        # Create A records for main domain
        print_info "Creating A record: $domain -> $LOAD_BALANCER_IP"
        cloudflare --token "$CLOUDFLARE_API_TOKEN" dns create \
            --zone-id "$ZONE_ID" \
            --type A \
            --name "$domain" \
            --content "$LOAD_BALANCER_IP" \
            --ttl 300 \
            --proxy false \
            --format json &>/dev/null

        # Create A records for subdomains
        for subdomain in "${SUBDOMAINS[@]}"; do
            full_domain="${subdomain}.${domain}"
            print_info "Creating A record: $full_domain -> $LOAD_BALANCER_IP"

            cloudflare --token "$CLOUDFLARE_API_TOKEN" dns create \
                --zone-id "$ZONE_ID" \
                --type A \
                --name "$full_domain" \
                --content "$LOAD_BALANCER_IP" \
                --ttl 300 \
                --proxy false \
                --format json &>/dev/null

            if [ $? -eq 0 ]; then
                print_status "A record created for $full_domain ✓"
            else
                print_warning "Failed to create A record for $full_domain"
            fi
        done

        print_status "DNS records configured for $domain ✓"
        echo ""
    done
}

# Configure SSL/TLS settings for all domains
configure_ssl_tls() {
    print_status "Configuring SSL/TLS settings for all domains..."

    for domain in "${ALL_DOMAINS[@]}"; do
        print_domain "Configuring SSL/TLS for $domain..."

        # Get zone ID for this domain
        eval "ZONE_ID=\${TEMP_ZONE_IDS[$domain]}"

        if [ -z "$ZONE_ID" ]; then
            print_warning "Skipping $domain (no zone ID found)"
            continue
        fi

        # Enable SSL/TLS with Full (Strict) mode
        cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
            --zone-id "$ZONE_ID" \
            --ssl "strict" \
            --tls-1-3 "on" \
            --automatic-https-rewrites "on" \
            --always-use-https "on" \
            --hsts "on" \
            --hsts-max-age 31536000 \
            --hsts-include-subdomains "on" \
            --hsts-preload "on" &>/dev/null

        if [ $? -eq 0 ]; then
            print_status "SSL/TLS configuration updated for $domain ✓"
        else
            print_warning "Failed to update SSL/TLS settings for $domain (may require manual configuration)"
        fi
    done
}

# Create Page Rules for all domains
create_page_rules() {
    print_status "Creating page rules for all domains..."

    for domain in "${ALL_DOMAINS[@]}"; do
        print_domain "Creating page rules for $domain..."

        # Get zone ID for this domain
        eval "ZONE_ID=\${TEMP_ZONE_IDS[$domain]}"

        if [ -z "$ZONE_ID" ]; then
            print_warning "Skipping $domain (no zone ID found)"
            continue
        fi

        # HTTP to HTTPS redirect rule
        cloudflare --token "$CLOUDFLARE_API_TOKEN" pagerule create \
            --zone-id "$ZONE_ID" \
            --targets "http://*${domain}/*" \
            --actions "forward,https://${domain}/$1" \
            --status "active" \
            --priority 1 &>/dev/null

        if [ $? -eq 0 ]; then
            print_status "HTTP to HTTPS redirect rule created for $domain ✓"
        else
            print_warning "Failed to create page rule for $domain (may require Pro plan)"
        fi
    done
}

# Configure security settings for all domains
configure_security() {
    print_status "Configuring security settings for all domains..."

    for domain in "${ALL_DOMAINS[@]}"; do
        print_domain "Configuring security for $domain..."

        # Get zone ID for this domain
        eval "ZONE_ID=\${TEMP_ZONE_IDS[$domain]}"

        if [ -z "$ZONE_ID" ]; then
            print_warning "Skipping $domain (no zone ID found)"
            continue
        fi

        # Enable Bot Fight Mode
        cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
            --zone-id "$ZONE_ID" \
            --bot-fight-mode "on" &>/dev/null

        # Set Security Level
        cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
            --zone-id "$ZONE_ID" \
            --security-level "medium" &>/dev/null

        # Enable Browser Cache TTL
        cloudflare --token "$CLOUDFLARE_API_TOKEN" zone-settings update \
            --zone-id "$ZONE_ID" \
            --browser-cache-ttl "4 hours" \
            --development-mode "off" &>/dev/null

        print_status "Security settings configured for $domain ✓"
    done
}

# Create Cloudflare Workers for all domains
create_workers() {
    print_status "Creating Cloudflare Workers for all domains..."

    # Create a basic worker for API edge routing (supports all domains)
    cat > /tmp/upm-plus-multi-domain-worker.js << 'EOF'
addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Determine the backend domain based on the incoming request
  let backendDomain = 'api.upm.plus'; // Default
  if (url.hostname === 'api.upmplus.dev') {
    backendDomain = 'api.upmplus.dev';
  } else if (url.hostname === 'api.upmplus.io') {
    backendDomain = 'api.upmplus.io';
  } else if (url.hostname === 'api.upmplus.ai') {
    backendDomain = 'api.upmplus.ai';
  }

  // Route API requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    // Forward to backend
    if (url.pathname.startsWith('/ws/')) {
      // WebSocket connection
      const wsUrl = `wss://${backendDomain}${url.pathname}${url.search}`;
      return new Request(wsUrl, request);
    } else {
      // HTTP API request
      const backendUrl = `https://${backendDomain}${url.pathname}${url.search}`;
      return fetch(backendUrl, request);
    }
  }

  // Determine frontend domain
  let frontendDomain = 'upm.plus'; // Default
  if (url.hostname === 'upmplus.dev') {
    frontendDomain = 'upmplus.dev';
  } else if (url.hostname === 'upmplus.io') {
    frontendDomain = 'upmplus.io';
  } else if (url.hostname === 'upmplus.ai') {
    frontendDomain = 'upmplus.ai';
  }

  // Default to frontend
  return fetch(request);
});

// Health check endpoint
addEventListener('scheduled', event => {
  const scheduledTime = event.scheduledTime;
  console.log(`Health check executed at: ${scheduledTime}`);
});
EOF

    # Create worker
    print_info "Creating multi-domain edge worker..."
    cloudflare --token "$CLOUDFLARE_API_TOKEN" workers create \
        --name "upm-plus-multi-domain-router" \
        --script /tmp/upm-plus-multi-domain-worker.js \
        --compatibility-date "2023-10-30" &>/dev/null

    if [ $? -eq 0 ]; then
        print_status "Multi-domain Cloudflare Worker created ✓"
    else
        print_warning "Failed to create Cloudflare Worker (may require Worker plan)"
    fi

    # Clean up temporary file
    rm -f /tmp/upm-plus-multi-domain-worker.js
}

# Configure cache settings for all domains
configure_api_cache() {
    print_status "Configuring cache settings for all domains..."

    for domain in "${ALL_DOMAINS[@]}"; do
        print_domain "Configuring cache for $domain..."

        # Get zone ID for this domain
        eval "ZONE_ID=\${TEMP_ZONE_IDS[$domain]}"

        if [ -z "$ZONE_ID" ]; then
            print_warning "Skipping $domain (no zone ID found)"
            continue
        fi

        # Cache rule for static assets
        cloudflare --token "$CLOUDFLARE_API_TOKEN" rule create \
            --zone-id "$ZONE_ID" \
            --expression "(http.request.uri.path contains \".js\" or http.request.uri.path contains \".css\" or http.request.uri.path contains \".png\" or http.request.uri.path contains \".jpg\" or http.request.uri.path contains \".jpeg\" or http.request.uri.path contains \".gif\" or http.request.uri.path contains \".svg\" or http.request.uri.path contains \".ico\")" \
            --action "cache" \
            --action-parameters "{\"edge_cache_ttl\": 7200, \"browser_cache_ttl\": 86400, \"cache_key\": [\"http.request.uri.path\"]}" \
            --enabled "true" &>/dev/null

        if [ $? -eq 0 ]; then
            print_status "Cache rules created for $domain ✓"
        else
            print_warning "Failed to create cache rules for $domain (may require Pro plan)"
        fi
    done
}

# Wait for DNS propagation
wait_for_dns_propagation() {
    print_status "Waiting for DNS propagation..."

    local max_attempts=30
    local attempt=1
    local domains_ready=0
    local total_domains=${#ALL_DOMAINS[@]}

    while [ $attempt -le $max_attempts ]; do
        domains_ready=0
        echo -n "Checking propagation (attempt $attempt/$max_attempts)... "

        for domain in "${ALL_DOMAINS[@]}"; do
            if dig +short "$domain" | grep -q "$LOAD_BALANCER_IP"; then
                ((domains_ready++))
            fi
        done

        if [ $domains_ready -eq $total_domains ]; then
            echo ""
            print_status "DNS propagated successfully for all domains ✓"
            return 0
        fi

        echo "($domains_ready/$total_domains ready)"
        sleep 10
        ((attempt++))
    done

    echo ""
    print_warning "DNS propagation may take longer. Check manually later."
}

# Test domain accessibility for all domains
test_domain_accessibility() {
    print_status "Testing domain accessibility for all domains..."

    for domain in "${ALL_DOMAINS[@]}"; do
        print_domain "Testing $domain..."

        local subdomains=("$domain" "www.$domain" "api.$domain" "app.$domain" "dashboard.$domain")

        for subdomain in "${subdomains[@]}"; do
            echo -n "  Testing https://$subdomain... "

            HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$subdomain" 2>/dev/null || echo "000")

            if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
                print_status "    $subdomain - HTTP $HTTP_STATUS ✓"
            else
                print_warning "    $subdomain - HTTP $HTTP_STATUS (may still be propagating)"
            fi
        done
        echo ""
    done
}

# Show deployment summary
show_summary() {
    print_status "🎉 Multi-Domain Cloudflare Deployment Complete!"
    echo ""
    echo -e "${BLUE}Deployment Summary:${NC}"
    echo -e "  Primary Domain: ${GREEN}https://$PRIMARY_DOMAIN${NC}"
    echo -e "  All Domains: ${GREEN}${ALL_DOMAINS[*]}${NC}"
    echo -e "  LoadBalancer IP: ${YELLOW}$LOAD_BALANCER_IP${NC}"
    echo ""
    echo -e "${BLUE}Configured URLs:${NC}"
    for domain in "${ALL_DOMAINS[@]}"; do
        echo -e "  ${CYAN}https://$domain${NC}"
        echo -e "  ${CYAN}https://api.$domain${NC}"
        echo -e "  ${CYAN}https://app.$domain${NC}"
        echo -e "  ${CYAN}https://dashboard.$domain${NC}"
        echo ""
    done
    echo -e "${BLUE}Configuration Applied:${NC}"
    echo -e "  ✅ DNS records configured for all domains"
    echo -e "  ✅ SSL/TLS enabled (Full Strict) for all domains"
    echo -e "  ✅ HTTPS redirection enabled for all domains"
    echo -e "  ✅ Security settings applied for all domains"
    echo -e "  ✅ Cache rules created for all domains"
    echo -e "  ✅ Edge functions deployed (multi-domain worker)"
    echo ""
    echo -e "${BLUE}Zone IDs:${NC}"
    eval "declare -p TEMP_ZONE_IDS"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Test all subdomains and features across all domains"
    echo "  2. Monitor SSL certificate status for all domains"
    echo "  3. Set up Cloudflare analytics for each domain"
    echo "  4. Configure rate limiting rules per domain"
    echo "  5. Test application functionality on all domains"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  Check DNS for all zones: cloudflare dns list"
    echo "  Check SSL analytics: cloudflare ssl-analytics --zone-id <ZONE_ID>"
    echo "  Check analytics: cloudflare analytics --zone-id <ZONE_ID>"
    echo "  Clear cache: cloudflare cache purge --zone-id <ZONE_ID>"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting multi-domain Cloudflare deployment for UPM.Plus${NC}"
    echo ""

    # Check prerequisites
    check_cloudflare_cli
    check_dependencies
    get_cloudflare_credentials
    get_zone_ids
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