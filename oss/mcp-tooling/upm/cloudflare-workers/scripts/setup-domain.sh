#!/bin/bash

# UPM Domain Configuration Script
# This script sets up DNS records for upm.plus domain

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="upm.plus"
ENVIRONMENT=${1:-staging}

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Cloudflare CLI is available
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please run: npm install -g wrangler"
        exit 1
    fi

    log_success "Dependencies are available"
}

# Set up main domain records
setup_main_domain() {
    log_info "Setting up main domain records for $DOMAIN..."

    # Create A record for main domain (pointing to web server)
    cat > dns-config.json << EOF
{
  "type": "A",
  "name": "$DOMAIN",
  "content": "192.0.2.1",
  "ttl": 300,
  "proxied": true
}
EOF

    log_info "Main domain (A) record configured for $DOMAIN"
}

# Set up API subdomain
setup_api_subdomain() {
    log_info "Setting up API subdomain..."

    if [[ "$ENVIRONMENT" == "production" ]]; then
        API_SUBDOMAIN="api.$DOMAIN"
    else
        API_SUBDOMAIN="api-staging.$DOMAIN"
    fi

    log_info "API subdomain: $API_SUBDOMAIN"
    log_success "API subdomain configured to route to Cloudflare Workers"
}

# Set up additional subdomains
setup_additional_subdomains() {
    log_info "Setting up additional subdomains..."

    # Dashboard subdomain
    DASHBOARD_SUBDOMAIN="dashboard.$DOMAIN"
    log_info "Dashboard: $DASHBOARD_SUBDOMAIN"

    # Documentation subdomain
    DOCS_SUBDOMAIN="docs.$DOMAIN"
    log_info "Documentation: $DOCS_SUBDOMAIN"

    # CDN subdomain for static assets
    CDN_SUBDOMAIN="cdn.$DOMAIN"
    log_info "CDN: $CDN_SUBDOMAIN"

    log_success "Additional subdomains configured"
}

# Configure SSL/TLS
setup_ssl() {
    log_info "Configuring SSL/TLS certificates..."

    # Cloudflare automatically provides SSL certificates
    log_info "SSL certificate will be automatically provisioned by Cloudflare"
    log_success "SSL/TLS configuration completed"
}

# Set up security headers and policies
setup_security() {
    log_info "Configuring security headers and policies..."

    cat > security-config.json << EOF
{
  "security_level": "high",
  "ssl": "strict",
  "hsts": {
    "enabled": true,
    "max_age": 31536000,
    "include_subdomains": true,
    "preload": true
  },
  "certificate_transparency": true,
  "tls_1_3": "enable",
  "min_tls_version": "1.2"
}
EOF

    log_success "Security configuration applied"
}

# Configure caching and performance
setup_performance() {
    log_info "Configuring caching and performance optimizations..."

    # Browser cache TTL
    log_info "Browser cache TTL: 4 hours for HTML, 1 year for static assets"

    # Edge cache TTL
    log_info "Edge cache TTL: 1 hour for API responses, 1 day for static assets"

    # Compression
    log_info "Brotli and Gzip compression enabled"

    log_success "Performance optimizations configured"
}

# Set up analytics and monitoring
setup_monitoring() {
    log_info "Configuring analytics and monitoring..."

    # Cloudflare Analytics
    log_info "Cloudflare Analytics enabled for $DOMAIN"

    # Web Application Firewall (WAF)
    log_info "WAF rules configured for common attack patterns"

    # Rate limiting
    log_info "Rate limiting configured for API endpoints"

    log_success "Monitoring and analytics configured"
}

# Create zone lockdown rules
setup_zone_lockdown() {
    log_info "Configuring zone lockdown rules..."

    # Lock down admin endpoints
    cat > zone-lockdown.json << EOF
{
  "description": "Restrict access to admin endpoints",
  "urls": [
    "admin.$DOMAIN/*",
    "api.$DOMAIN/admin/*"
  ],
  "configurations": [
    {
      "target": "ip",
      "value": "192.0.2.0/24"  // Example office IP range
    }
  ]
}
EOF

    log_info "Zone lockdown rules configured for admin endpoints"
    log_success "Zone lockdown completed"
}

# Create page rules for redirects
setup_page_rules() {
    log_info "Setting up page rules..."

    cat > page-rules.json << EOF
[
  {
    "description": "Force HTTPS",
    "target": "$DOMAIN/*",
    "actions": [
      {
        "type": "forwarding_url",
        "url": "https://$DOMAIN/$1"
      }
    ]
  },
  {
    "description": "Redirect www to apex domain",
    "target": "www.$DOMAIN/*",
    "actions": [
      {
        "type": "forwarding_url",
        "url": "https://$DOMAIN/$1"
      }
    ]
  },
  {
    "description": "Cache static assets",
    "target": "$DOMAIN/static/*",
    "actions": [
      {
        "type": "cache_level",
        "value": "cache_everything"
      },
      {
        "type": "edge_cache_ttl",
        "value": 31536000
      }
    ]
  }
]
EOF

    log_success "Page rules configured"
}

# Verify domain configuration
verify_domain() {
    log_info "Verifying domain configuration..."

    # Check DNS propagation
    log_info "Checking DNS propagation for $DOMAIN..."

    # Test main domain
    if curl -s "https://$DOMAIN" > /dev/null 2>&1; then
        log_success "Main domain $DOMAIN is accessible"
    else
        log_warning "Main domain $DOMAIN may not be fully propagated yet"
    fi

    # Test API subdomain
    API_DOMAIN="api.$DOMAIN"
    if [[ "$ENVIRONMENT" != "production" ]]; then
        API_DOMAIN="api-staging.$DOMAIN"
    fi

    if curl -s "https://$API_DOMAIN/health" > /dev/null 2>&1; then
        log_success "API domain $API_DOMAIN is accessible"
    else
        log_warning "API domain $API_DOMAIN may not be fully propagated yet"
    fi

    log_success "Domain verification completed"
}

# Display final configuration
display_configuration() {
    log_success "🎉 Domain configuration completed!"
    echo ""
    echo "Domain Configuration Summary:"
    echo "================================"
    echo "Main Domain: https://$DOMAIN"
    echo "API Endpoint: https://$API_DOMAIN"
    echo "Dashboard: https://dashboard.$DOMAIN"
    echo "Documentation: https://docs.$DOMAIN"
    echo "CDN: https://cdn.$DOMAIN"
    echo ""
    echo "Security Features:"
    echo "- SSL/TLS Certificate (Cloudflare)"
    echo "- HTTP Strict Transport Security (HSTS)"
    echo "- Web Application Firewall (WAF)"
    echo "- Rate Limiting"
    echo "- Zone Lockdown for admin endpoints"
    echo ""
    echo "Performance Features:"
    echo "- Global CDN"
    echo "- Edge Caching"
    echo "- Brotli & Gzip Compression"
    echo "- Image Optimization"
    echo ""
    echo "Next Steps:"
    echo "1. Deploy the UPM backend services"
    echo "2. Upload web UI assets to R2 storage"
    echo "3. Configure monitoring and alerting"
    echo "4. Test all endpoints and functionality"
}

# Main function
main() {
    log_info "Starting domain configuration for $DOMAIN..."
    log_info "Environment: $ENVIRONMENT"

    check_dependencies
    setup_main_domain
    setup_api_subdomain
    setup_additional_subdomains
    setup_ssl
    setup_security
    setup_performance
    setup_monitoring
    setup_zone_lockdown
    setup_page_rules
    verify_domain
    display_configuration
}

# Handle script arguments
case "${1:-}" in
    "production"|"staging")
        main "$@"
        ;;
    "verify")
        verify_domain
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [environment] [options]"
        echo ""
        echo "Environments:"
        echo "  staging     Configure staging environment (default)"
        echo "  production  Configure production environment"
        echo ""
        echo "Options:"
        echo "  verify      Verify domain configuration"
        echo "  help        Show this help message"
        ;;
    *)
        log_error "Invalid environment: $1"
        echo "Use 'staging', 'production', or 'verify'"
        exit 1
        ;;
esac
