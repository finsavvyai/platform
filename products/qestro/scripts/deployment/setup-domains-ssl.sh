#!/bin/bash

# Domain and SSL Setup Configuration
# Configures custom domains and SSL certificates for Questro production deployment

set -e

echo "🔐 Setting up domains and SSL configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Domain configuration
DOMAINS=(
    "qestro.app"
    "api.qestro.app"
    "app.qestro.app"
    "qestro.io"
    "www.qestro.io"
)

# Create Nginx configuration for custom domains
setup_nginx_config() {
    log_info "Creating Nginx configuration for custom domains..."

    mkdir -p config/nginx

    cat > config/nginx/qestro.app.conf << 'EOF'
# Nginx configuration for qestro.app
server {
    listen 80;
    server_name qestro.app www.qestro.app;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name qestro.app www.qestro.app;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/qestro.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qestro.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Frontend application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }
}
EOF

    cat > config/nginx/api.qestro.app.conf << 'EOF'
# Nginx configuration for api.qestro.app
server {
    listen 80;
    server_name api.qestro.app;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.qestro.app;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.qestro.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.qestro.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers for API
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # API backend
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;

        # CORS headers
        add_header Access-Control-Allow-Origin "https://qestro.app" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, Keep-Alive, X-Requested-With, If-Modified-Since" always;
        add_header Access-Control-Allow-Credentials true always;

        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://qestro.app";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, Keep-Alive, X-Requested-With, If-Modified-Since";
            add_header Access-Control-Allow-Credentials true;
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }

    # WebSocket endpoint
    location /ws {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

    cat > config/nginx/qestro.io.conf << 'EOF'
# Nginx configuration for qestro.io (marketing site)
server {
    listen 80;
    server_name qestro.io www.qestro.io;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name qestro.io www.qestro.io;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/qestro.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qestro.io/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Marketing site
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Static asset caching (more aggressive for marketing site)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|pdf|zip)$ {
        expires 2y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }
}
EOF

    log_success "Nginx configuration files created"
}

# SSL certificate setup with Let's Encrypt
setup_ssl_certificates() {
    log_info "Setting up SSL certificate management..."

    mkdir -p scripts/ssl

    cat > scripts/ssl/setup-letsencrypt.sh << 'EOF'
#!/bin/bash

# Let's Encrypt SSL Certificate Setup
# Automatically obtains and renews SSL certificates

set -e

DOMAINS=(
    "qestro.app"
    "api.qestro.app"
    "app.qestro.app"
    "qestro.io"
    "www.qestro.io"
)

EMAIL="admin@qestro.app"

# Install Certbot if not present
install_certbot() {
    if ! command -v certbot &> /dev/null; then
        echo "Installing Certbot..."
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    fi
}

# Obtain SSL certificates
obtain_certificates() {
    echo "Obtaining SSL certificates..."

    for domain in "${DOMAINS[@]}"; do
        echo "Setting up certificate for $domain..."

        if [ "$domain" = "api.qestro.app" ]; then
            sudo certbot --nginx -d "$domain" \
                --non-interactive \
                --agree-tos \
                --email "$EMAIL" \
                --redirect \
                --hsts \
                --uir \
                --staple-ocsp \
                --must-staple
        else
            sudo certbot --nginx -d "$domain" \
                --non-interactive \
                --agree-tos \
                --email "$EMAIL" \
                --redirect \
                --hsts \
                --uir \
                --staple-ocsp
        fi
    done
}

# Setup auto-renewal
setup_auto_renewal() {
    echo "Setting up automatic certificate renewal..."

    # Add renewal cron job
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -

    # Test renewal
    sudo certbot renew --dry-run
}

# Verify installation
verify_installation() {
    echo "Verifying SSL installation..."

    for domain in "${DOMAINS[@]}"; do
        echo "Testing $domain..."

        # Check certificate expiry
        echo | timeout 5 openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | \
            openssl x509 -noout -dates

        # Check SSL configuration
        curl -I "https://$domain" 2>/dev/null | head -1
    done
}

main() {
    echo "🔐 Setting up Let's Encrypt SSL certificates..."

    install_certbot
    obtain_certificates
    setup_auto_renewal
    verify_installation

    echo "✅ SSL certificates setup completed successfully!"
}

main "$@"
EOF

    chmod +x scripts/ssl/setup-letsencrypt.sh

    # Create SSL monitoring script
    cat > scripts/ssl/monitor-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Monitoring
# Monitors SSL certificate expiry and sends alerts

set -e

DOMAINS=(
    "qestro.app"
    "api.qestro.app"
    "app.qestro.app"
    "qestro.io"
    "www.qestro.io"
)

WARNING_DAYS=30
CRITICAL_DAYS=7
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Send Slack notification
send_slack_alert() {
    local message="$1"
    local color="${2:-#ff0000}"

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\", \"color\": \"$color\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Check certificate expiry
check_certificate() {
    local domain="$1"
    local expiry_date

    echo "Checking $domain..."

    # Get certificate expiry date
    expiry_date=$(echo | timeout 10 openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | \
        openssl x509 -noout -enddate | cut -d= -f2)

    if [ -z "$expiry_date" ]; then
        echo -e "${RED}❌ Failed to get certificate for $domain${NC}"
        send_slack_alert "❌ SSL Certificate Error: Failed to retrieve certificate for $domain" "#ff0000"
        return 1
    fi

    # Convert to epoch time
    expiry_epoch=$(date -d "$expiry_date" +%s)
    current_epoch=$(date +%s)
    days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))

    echo "Certificate for $domain expires in $days_until_expiry days ($expiry_date)"

    if [ $days_until_expiry -le $CRITICAL_DAYS ]; then
        echo -e "${RED}🚨 CRITICAL: Certificate for $domain expires in $days_until_expiry days!${NC}"
        send_slack_alert "🚨 CRITICAL: SSL certificate for $domain expires in $days_until_expiry days!" "#ff0000"
        return 2
    elif [ $days_until_expiry -le $WARNING_DAYS ]; then
        echo -e "${YELLOW}⚠️ WARNING: Certificate for $domain expires in $days_until_expiry days${NC}"
        send_slack_alert "⚠️ WARNING: SSL certificate for $domain expires in $days_until_expiry days" "#ffff00"
        return 1
    else
        echo -e "${GREEN}✅ Certificate for $domain is valid ($days_until_expiry days remaining)${NC}"
        return 0
    fi
}

# Main monitoring function
main() {
    echo "🔍 Monitoring SSL certificates..."

    local critical_count=0
    local warning_count=0

    for domain in "${DOMAINS[@]}"; do
        check_certificate "$domain"
        case $? in
            2) ((critical_count++)) ;;
            1) ((warning_count++)) ;;
        esac
    done

    echo ""
    echo "SSL Certificate Monitoring Summary:"
    echo "  Critical certificates: $critical_count"
    echo "  Warning certificates: $warning_count"

    if [ $critical_count -gt 0 ]; then
        exit 2
    elif [ $warning_count -gt 0 ]; then
        exit 1
    else
        echo -e "${GREEN}✅ All SSL certificates are valid${NC}"
        exit 0
    fi
}

main "$@"
EOF

    chmod +x scripts/ssl/monitor-ssl.sh

    log_success "SSL certificate management scripts created"
}

# Create DNS configuration templates
setup_dns_templates() {
    log_info "Creating DNS configuration templates..."

    mkdir -p config/dns

    cat > config/dns/dns-records.json << 'EOF'
{
  "domains": {
    "qestro.app": {
      "type": "A",
      "records": [
        {
          "name": "@",
          "value": "RENDER_APP_IP",
          "ttl": 3600
        },
        {
          "name": "www",
          "value": "RENDER_APP_IP",
          "ttl": 3600
        },
        {
          "name": "app",
          "value": "RENDER_APP_IP",
          "ttl": 3600
        }
      ]
    },
    "api.qestro.app": {
      "type": "A",
      "records": [
        {
          "name": "@",
          "value": "RENDER_API_IP",
          "ttl": 3600
        }
      ]
    },
    "qestro.io": {
      "type": "A",
      "records": [
        {
          "name": "@",
          "value": "RENDER_MARKETING_IP",
          "ttl": 3600
        },
        {
          "name": "www",
          "value": "RENDER_MARKETING_IP",
          "ttl": 3600
        }
      ]
    }
  },
  "mx_records": {
    "qestro.app": [
      {
        "name": "@",
        "value": "aspmx.l.google.com",
        "priority": 10,
        "ttl": 3600
      },
      {
        "name": "@",
        "value": "alt1.aspmx.l.google.com",
        "priority": 20,
        "ttl": 3600
      }
    ]
  },
  "txt_records": {
    "qestro.app": [
      {
        "name": "@",
        "value": "v=spf1 include:_spf.google.com ~all",
        "ttl": 3600
      },
      {
        "name": "_dmarc",
        "value": "v=DMARC1; p=quarantine; rua=mailto:dmarc@qestro.app; ruf=mailto:dmarc@qestro.app; pct=100; adkim=s; aspf=s",
        "ttl": 3600
      }
    ]
  }
}
EOF

    cat > config/dns/cloudflare-template.json << 'EOF'
{
  "zones": {
    "qestro.app": {
      "dns_records": [
        {
          "type": "A",
          "name": "@",
          "content": "RENDER_APP_IP",
          "ttl": 3600,
          "proxied": true
        },
        {
          "type": "A",
          "name": "www",
          "content": "RENDER_APP_IP",
          "ttl": 3600,
          "proxied": true
        },
        {
          "type": "A",
          "name": "app",
          "content": "RENDER_APP_IP",
          "ttl": 3600,
          "proxied": true
        },
        {
          "type": "A",
          "name": "api",
          "content": "RENDER_API_IP",
          "ttl": 3600,
          "proxied": false
        }
      ],
      "page_rules": [
        {
          "targets": [
            {
              "target": "url",
              "constraint": {
                "operator": "matches",
                "value": "*.qestro.app/*"
              }
            }
          ],
          "actions": [
            {
              "id": "always_use_https",
              "value": "on"
            },
            {
              "id": "cache_level",
              "value": "cache_everything"
            }
          ]
        }
      ]
    }
  }
}
EOF

    log_success "DNS configuration templates created"
}

# Create domain verification script
create_domain_verification() {
    log_info "Creating domain verification scripts..."

    mkdir -p scripts/domains

    cat > scripts/domains/verify-domains.sh << 'EOF'
#!/bin/bash

# Domain Verification Script
# Verifies domain configuration and SSL setup

set -e

DOMAINS=(
    "qestro.app"
    "api.qestro.app"
    "app.qestro.app"
    "qestro.io"
    "www.qestro.io"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check DNS resolution
check_dns_resolution() {
    local domain="$1"

    log_info "Checking DNS resolution for $domain..."

    if nslookup "$domain" >/dev/null 2>&1; then
        local ip=$(nslookup "$domain" | grep -A1 "Name:" | tail -1 | awk '{print $2}')
        log_success "DNS resolution successful: $domain -> $ip"
        return 0
    else
        log_error "DNS resolution failed for $domain"
        return 1
    fi
}

# Check HTTP/HTTPS connectivity
check_connectivity() {
    local domain="$1"

    log_info "Checking connectivity to $domain..."

    # Check HTTP (should redirect to HTTPS)
    if curl -I -L --max-time 10 "http://$domain" >/dev/null 2>&1; then
        log_success "HTTP connectivity to $domain successful"
    else
        log_warning "HTTP connectivity to $domain failed"
    fi

    # Check HTTPS
    if curl -I -L --max-time 10 "https://$domain" >/dev/null 2>&1; then
        log_success "HTTPS connectivity to $domain successful"
        return 0
    else
        log_error "HTTPS connectivity to $domain failed"
        return 1
    fi
}

# Check SSL certificate
check_ssl_certificate() {
    local domain="$1"

    log_info "Checking SSL certificate for $domain..."

    # Get certificate details
    local cert_info=$(echo | timeout 10 openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -dates -issuer -subject)

    if [ -n "$cert_info" ]; then
        log_success "SSL certificate valid for $domain:"
        echo "$cert_info" | sed 's/^/    /'
        return 0
    else
        log_error "SSL certificate check failed for $domain"
        return 1
    fi
}

# Check security headers
check_security_headers() {
    local domain="$1"

    log_info "Checking security headers for $domain..."

    local headers=$(curl -I -L --max-time 10 "https://$domain" 2>/dev/null)

    local required_headers=(
        "strict-transport-security"
        "x-frame-options"
        "x-content-type-options"
        "referrer-policy"
    )

    local missing_headers=0

    for header in "${required_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            log_success "Security header present: $header"
        else
            log_warning "Missing security header: $header"
            ((missing_headers++))
        fi
    done

    if [ $missing_headers -eq 0 ]; then
        log_success "All required security headers present for $domain"
        return 0
    else
        log_warning "$missing_headers security headers missing for $domain"
        return 1
    fi
}

# Main verification function
main() {
    echo "🔍 Verifying domain configuration and SSL setup..."

    local total_checks=0
    local passed_checks=0

    for domain in "${DOMAINS[@]}"; do
        echo ""
        log_info "Verifying $domain..."

        ((total_checks++))
        if check_dns_resolution "$domain"; then
            ((passed_checks++))
        fi

        ((total_checks++))
        if check_connectivity "$domain"; then
            ((passed_checks++))
        fi

        ((total_checks++))
        if check_ssl_certificate "$domain"; then
            ((passed_checks++))
        fi

        ((total_checks++))
        if check_security_headers "$domain"; then
            ((passed_checks++))
        fi
    done

    echo ""
    log_info "Domain Verification Summary:"
    echo "  Total checks: $total_checks"
    echo "  Passed checks: $passed_checks"
    echo "  Success rate: $(( passed_checks * 100 / total_checks ))%"

    if [ $passed_checks -eq $total_checks ]; then
        log_success "🎉 All domain verifications passed successfully!"
        exit 0
    else
        log_warning "⚠️ Some domain verifications failed. Please review the output above."
        exit 1
    fi
}

main "$@"
EOF

    chmod +x scripts/domains/verify-domains.sh

    log_success "Domain verification scripts created"
}

# Main execution
main() {
    echo "🌐 Setting up domain and SSL configuration..."

    setup_nginx_config
    setup_ssl_certificates
    setup_dns_templates
    create_domain_verification

    echo ""
    log_success "🎉 Domain and SSL configuration completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "1. Update DNS records to point to your Render services"
    echo "2. Run './scripts/ssl/setup-letsencrypt.sh' to obtain SSL certificates"
    echo "3. Run './scripts/domains/verify-domains.sh' to verify configuration"
    echo "4. Set up SSL monitoring with './scripts/ssl/monitor-ssl.sh'"
    echo ""
    log_info "Configuration files created:"
    echo "- config/nginx/ - Nginx configuration files"
    echo "- scripts/ssl/ - SSL certificate management"
    echo "- config/dns/ - DNS configuration templates"
    echo "- scripts/domains/ - Domain verification scripts"
}

# Handle script interruption
trap 'log_error "Script interrupted. Please review partial changes."' INT TERM

# Run main function
main "$@"