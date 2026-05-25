#!/bin/bash

# SSL Setup Script for MCPOverflow Multi-Domain Configuration
# This script sets up Let's Encrypt certificates for all domains

set -e

# Configuration
EMAIL="admin@mcpoverflow.com"
NGINX_CONTAINER="mcpoverflow-nginx"
CERTBOT_CONTAINER="mcpoverflow-certbot"

# Domains to secure
DOMAINS=(
    "mcpoverflow.com"
    "www.mcpoverflow.com"
    "app.mcpoverflow.io"
    "mcpoverflow.ai"
    "mcpoverflow.dev"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root or with sudo"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker first."
fi

# Create necessary directories
log "Creating SSL directories..."
mkdir -p nginx/ssl/certs nginx/ssl/private nginx/certbot-webroot
chmod 755 nginx/ssl
chmod 700 nginx/ssl/private

# Create temporary Nginx config for certificate generation
log "Creating temporary Nginx configuration..."
cat > nginx/nginx-temp.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name _;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 200 'OK';
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Start temporary Nginx for domain validation
log "Starting temporary Nginx for certificate validation..."
docker run -d \
    --name nginx-temp \
    -p 80:80 \
    -v $(pwd)/nginx/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/nginx/certbot-webroot:/var/www/certbot:ro \
    nginx:alpine

# Wait for Nginx to start
sleep 5

# Function to obtain certificate for a domain
obtain_certificate() {
    local domain=$1

    log "Obtaining certificate for $domain..."

    docker run --rm \
        -v $(pwd)/nginx/ssl:/etc/letsencrypt \
        -v $(pwd)/nginx/certbot-webroot:/var/www/certbot \
        certbot/certbot:latest \
        certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $domain \
        --force-renewal || {
            warn "Failed to obtain certificate for $domain"
            return 1
        }

    log "Certificate obtained for $domain"
    return 0
}

# Obtain certificates for all domains
SUCCESS_COUNT=0
TOTAL_COUNT=${#DOMAINS[@]}

for domain in "${DOMAINS[@]}"; do
    if obtain_certificate "$domain"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    fi
done

# Stop temporary Nginx
log "Stopping temporary Nginx..."
docker stop nginx-temp
docker rm nginx-temp

# Clean up temporary config
rm nginx/nginx-temp.conf

# Create certificate chains
log "Creating certificate chains..."
for domain in "${DOMAINS[@]}"; do
    if [ -f "nginx/ssl/live/$domain/fullchain.pem" ] && [ -f "nginx/ssl/live/$domain/privkey.pem" ]; then
        # Create individual certificates
        cp nginx/ssl/live/$domain/fullchain.pem nginx/ssl/certs/$domain.crt
        cp nginx/ssl/live/$domain/privkey.pem nginx/ssl/private/$domain.key

        # Create certificate chain for Nginx
        cat nginx/ssl/live/$domain/fullchain.pem > nginx/ssl/certs/$domain-chain.crt

        log "Certificate chain created for $domain"
    else
        warn "Certificate files not found for $domain"
    fi
done

# Set proper permissions
log "Setting proper permissions..."
chmod 644 nginx/ssl/certs/*.crt
chmod 644 nginx/ssl/certs/*-chain.crt
chmod 600 nginx/ssl/private/*.key

# Create renewal script
log "Creating certificate renewal script..."
cat > scripts/renew-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Renewal Script
# This script renews all Let's Encrypt certificates

set -e

EMAIL="admin@mcpoverflow.com"
NGINX_CONTAINER="mcpoverflow-nginx"

# Domains to renew
DOMAINS=(
    "mcpoverflow.com"
    "www.mcpoverflow.com"
    "app.mcpoverflow.io"
    "mcpoverflow.ai"
    "mcpoverflow.dev"
)

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting SSL certificate renewal..."

# Renew certificates
docker run --rm \
    -v $(pwd)/nginx/ssl:/etc/letsencrypt \
    -v $(pwd)/nginx/certbot-webroot:/var/www/certbot \
    certbot/certbot:latest \
    renew --webroot --webroot-path=/var/www/certbot

# Create certificate chains
for domain in "${DOMAINS[@]}"; do
    if [ -f "nginx/ssl/live/$domain/fullchain.pem" ] && [ -f "nginx/ssl/live/$domain/privkey.pem" ]; then
        cp nginx/ssl/live/$domain/fullchain.pem nginx/ssl/certs/$domain.crt
        cp nginx/ssl/live/$domain/privkey.pem nginx/ssl/private/$domain.key
        cat nginx/ssl/live/$domain/fullchain.pem > nginx/ssl/certs/$domain-chain.crt
        log "Updated certificate chain for $domain"
    fi
done

# Set proper permissions
chmod 644 nginx/ssl/certs/*.crt
chmod 600 nginx/ssl/private/*.key

# Reload Nginx
if docker ps | grep -q $NGINX_CONTAINER; then
    docker exec $NGINX_CONTAINER nginx -s reload
    log "Nginx reloaded successfully"
fi

log "SSL certificate renewal completed"
EOF

chmod +x scripts/renew-ssl.sh

# Create cron job for automatic renewal
log "Setting up automatic renewal..."
(crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/scripts/renew-ssl.sh >> $(pwd)/logs/ssl-renewal.log 2>&1") | crontab -

# Summary
log "SSL setup completed!"
log "Certificates obtained: $SUCCESS_COUNT/$TOTAL_COUNT"
log "Certificates are stored in: $(pwd)/nginx/ssl/"
log "Automatic renewal is scheduled for 2:00 AM daily"

if [ $SUCCESS_COUNT -eq $TOTAL_COUNT ]; then
    log "All certificates obtained successfully!"
    log "You can now start the full stack with: docker-compose -f docker-compose.domains.yml up -d"
else
    warn "Some certificates failed to obtain. Please check the logs above."
    warn "You may need to configure DNS records or try again later."
fi

# Next steps
log ""
log "Next steps:"
log "1. Ensure DNS records point to this server for all domains"
log "2. Update your domain registrar with the correct IP addresses"
log "3. Test the certificates by visiting: https://mcpoverflow.com"
log "4. Monitor certificate renewals in: $(pwd)/logs/ssl-renewal.log"
log ""
log "Certificates will be automatically renewed 30 days before expiration."