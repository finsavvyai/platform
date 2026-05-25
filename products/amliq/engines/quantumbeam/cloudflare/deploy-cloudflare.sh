#!/bin/bash

# ============================================================================
# QuantumBeam Cloudflare Deployment Script
# ============================================================================
# Deploys both the API (Workers) and website (Pages) to Cloudflare
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

print_header "QuantumBeam Cloudflare Deployment"

print_step "Checking prerequisites..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found"
    echo "Install with: npm install -g wrangler"
    exit 1
fi
print_success "Wrangler CLI installed"

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    print_warning "Not logged in to Cloudflare"
    print_step "Logging in..."
    wrangler login
fi
print_success "Cloudflare authentication verified"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js not found"
    exit 1
fi
print_success "Node.js installed: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm not found"
    exit 1
fi
print_success "npm installed: $(npm --version)"

echo ""

# ============================================================================
# Configuration
# ============================================================================

print_header "Deployment Configuration"

# Get Cloudflare account ID
ACCOUNT_ID=$(wrangler whoami 2>/dev/null | grep "Account ID" | cut -d':' -f2 | tr -d ' ')

if [ -z "$ACCOUNT_ID" ]; then
    print_warning "Could not detect account ID automatically"
    read -p "Enter your Cloudflare Account ID: " ACCOUNT_ID
fi

print_success "Account ID: $ACCOUNT_ID"

# Ask for deployment options
echo ""
echo "What would you like to deploy?"
echo "  1) API only (Cloudflare Workers)"
echo "  2) Website only (Cloudflare Pages)"
echo "  3) Both API and Website (recommended)"
echo ""
read -p "Enter your choice (1-3): " DEPLOY_CHOICE

# ============================================================================
# Deploy API (Cloudflare Workers)
# ============================================================================

deploy_api() {
    print_header "Deploying API to Cloudflare Workers"

    cd "$(dirname "$0")/.."

    print_step "Creating D1 database..."

    # Check if database exists
    DB_EXISTS=$(wrangler d1 list 2>/dev/null | grep "quantumbeam-db" || echo "")

    if [ -z "$DB_EXISTS" ]; then
        print_step "Creating new D1 database: quantumbeam-db"
        wrangler d1 create quantumbeam-db

        # Get database ID
        DB_ID=$(wrangler d1 list | grep "quantumbeam-db" | awk '{print $2}')
        print_success "Database created: $DB_ID"

        # Initialize database schema
        print_step "Initializing database schema..."
        wrangler d1 execute quantumbeam-db --file=database/schemas/001_initial_schema.sql 2>/dev/null || \
            print_warning "Schema initialization failed (may already exist)"
    else
        print_success "D1 database already exists"
    fi

    print_step "Creating KV namespaces..."

    # Create KV namespace for cache
    KV_EXISTS=$(wrangler kv:namespace list 2>/dev/null | grep "quantumbeam-cache" || echo "")
    if [ -z "$KV_EXISTS" ]; then
        print_step "Creating KV namespace: quantumbeam-cache"
        wrangler kv:namespace create "quantumbeam-cache"
        wrangler kv:namespace create "quantumbeam-cache" --preview
    else
        print_success "KV namespace already exists"
    fi

    print_step "Creating R2 bucket..."

    # Create R2 bucket
    wrangler r2 bucket create quantumbeam-files 2>/dev/null || \
        print_success "R2 bucket already exists"

    print_step "Setting secrets..."

    # Check if secrets need to be set
    echo ""
    echo "The following secrets need to be configured:"
    echo "  - JWT_SECRET"
    echo "  - API_KEY_ENCRYPTION_KEY"
    echo "  - POSTGRES_PASSWORD (if using external DB)"
    echo "  - IBM_QUANTUM_TOKEN (optional)"
    echo "  - OPENAI_API_KEY (optional)"
    echo ""
    read -p "Would you like to set secrets now? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Setting JWT_SECRET..."
        read -s -p "Enter JWT_SECRET (64 chars): " JWT_SECRET
        echo "$JWT_SECRET" | wrangler secret put JWT_SECRET

        print_step "Setting API_KEY_ENCRYPTION_KEY..."
        read -s -p "Enter API_KEY_ENCRYPTION_KEY (32 chars): " API_KEY
        echo "$API_KEY" | wrangler secret put API_KEY_ENCRYPTION_KEY

        print_success "Secrets configured"
    else
        print_warning "Secrets not configured. Set them later with: wrangler secret put SECRET_NAME"
    fi

    print_step "Deploying Worker to Cloudflare..."

    # Deploy the worker
    wrangler deploy cloudflare/worker.js --compatibility-date 2024-01-01

    if [ $? -eq 0 ]; then
        print_success "API deployed successfully!"

        # Get worker URL
        WORKER_URL=$(wrangler deployments list 2>/dev/null | grep "quantumbeam" | head -1 | awk '{print $NF}' || echo "https://quantumbeam.workers.dev")

        echo ""
        echo -e "${GREEN}API deployed at: $WORKER_URL${NC}"
        echo ""
        echo "Test with:"
        echo "  curl $WORKER_URL/health"
        echo ""
    else
        print_error "Deployment failed"
        return 1
    fi
}

# ============================================================================
# Deploy Website (Cloudflare Pages)
# ============================================================================

deploy_website() {
    print_header "Deploying Website to Cloudflare Pages"

    cd "$(dirname "$0")/../web/marketing"

    print_step "Installing dependencies..."
    npm install
    print_success "Dependencies installed"

    print_step "Building Next.js application..."
    npm run build

    if [ $? -ne 0 ]; then
        print_error "Build failed"
        return 1
    fi
    print_success "Build completed"

    print_step "Deploying to Cloudflare Pages..."

    # Deploy to Cloudflare Pages
    npx wrangler pages deploy out --project-name=quantumbeam-website

    if [ $? -eq 0 ]; then
        print_success "Website deployed successfully!"

        echo ""
        echo -e "${GREEN}Website deployed at: https://quantumbeam-website.pages.dev${NC}"
        echo ""
        echo "Configure custom domain in Cloudflare dashboard:"
        echo "  https://dash.cloudflare.com > Pages > quantumbeam-website > Custom domains"
        echo ""
    else
        print_error "Deployment failed"
        return 1
    fi

    cd ../..
}

# ============================================================================
# Execute Deployment
# ============================================================================

case $DEPLOY_CHOICE in
    1)
        deploy_api
        ;;
    2)
        deploy_website
        ;;
    3)
        deploy_api
        echo ""
        deploy_website
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# ============================================================================
# Post-Deployment Steps
# ============================================================================

print_header "Deployment Complete!"

echo -e "${GREEN}✓ QuantumBeam deployed to Cloudflare${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure custom domains:"
echo "   - Go to Cloudflare dashboard"
echo "   - Add your domains (e.g., api.quantumbeam.io, quantumbeam.io)"
echo "   - Update DNS records"
echo ""
echo "2. Set up monitoring:"
echo "   - Enable Cloudflare Analytics"
echo "   - Configure Web Analytics on Pages"
echo "   - Set up alerts in Workers dashboard"
echo ""
echo "3. Configure caching:"
echo "   - Review Page Rules for caching"
echo "   - Set up Cache Reserve if needed"
echo "   - Configure Argo Smart Routing (optional)"
echo ""
echo "4. Security settings:"
echo "   - Enable WAF rules"
echo "   - Configure rate limiting"
echo "   - Set up DDoS protection"
echo ""
echo "Documentation: https://developers.cloudflare.com/workers/"
echo ""

print_success "Deployment script completed!"
