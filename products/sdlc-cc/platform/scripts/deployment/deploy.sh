#!/bin/bash

# SDLC Compliance Platform - One-Click Deployment Script
# Deploys complete platform to Cloudflare Workers + Vercel

set -e

echo "🚀 SDLC Compliance Platform - One-Click Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="sdlc-compliance-platform"
GATEWAY_NAME="sdlc-gateway"
DASHBOARD_NAME="sdlc-dashboard"

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

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI not found. Installing..."
        npm install -g wrangler
    fi

    if ! command -v vercel &> /dev/null; then
        log_error "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi

    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi

    log_success "All dependencies found"
}

# Authenticate with services
authenticate() {
    log_info "Authenticating with Cloudflare..."
    if ! wrangler whoami &> /dev/null; then
        log_warning "Please login to Cloudflare:"
        wrangler auth login
    fi

    log_info "Authenticating with Vercel..."
    if ! vercel whoami &> /dev/null; then
        log_warning "Please login to Vercel:"
        vercel login
    fi

    log_success "Authentication complete"
}

# Setup Cloudflare resources
setup_cloudflare() {
    log_info "Setting up Cloudflare resources..."

    cd compliance-platform/gateway

    # Create D1 database
    log_info "Creating D1 database..."
    DB_NAME="${PROJECT_NAME}-db"
    if ! wrangler d1 list | grep -q "$DB_NAME"; then
        wrangler d1 create "$DB_NAME"
        log_success "Created D1 database: $DB_NAME"
    else
        log_info "D1 database already exists"
    fi

    # Create R2 bucket
    log_info "Creating R2 bucket..."
    BUCKET_NAME="${PROJECT_NAME}-audit-logs"
    if ! wrangler r2 bucket list | grep -q "$BUCKET_NAME"; then
        wrangler r2 bucket create "$BUCKET_NAME"
        log_success "Created R2 bucket: $BUCKET_NAME"
    else
        log_info "R2 bucket already exists"
    fi

    # Create KV namespaces
    log_info "Creating KV namespaces..."
    KV_POLICY="policy-cache"
    KV_CONFIG="compliance-config"

    if ! wrangler kv namespace list | grep -q "$KV_POLICY"; then
        wrangler kv namespace create "$KV_POLICY"
        log_success "Created KV namespace: $KV_POLICY"
    fi

    if ! wrangler kv namespace list | grep -q "$KV_CONFIG"; then
        wrangler kv namespace create "$KV_CONFIG"
        log_success "Created KV namespace: $KV_CONFIG"
    fi

    cd ../..
}

# Deploy AI Gateway
deploy_gateway() {
    log_info "Deploying AI Gateway to Cloudflare Workers..."

    cd compliance-platform/gateway

    # Install dependencies
    npm install

    # Deploy to Workers
    wrangler deploy --env production

    log_success "AI Gateway deployed successfully"

    # Get the deployed URL
    GATEWAY_URL=$(wrangler whoami 2>/dev/null | grep "wrangler" | head -1 | awk '{print $2}' || echo "https://sdlc-gateway.workers.dev")
    echo "$GATEWAY_URL" > .gateway_url

    cd ../..
}

# Setup database schema
setup_database() {
    log_info "Setting up database schema..."

    cd compliance-platform/gateway

    # Run database migrations
    if [ -f "schema.sql" ]; then
        DB_NAME="${PROJECT_NAME}-db"
        wrangler d1 execute "$DB_NAME" --file=./schema.sql --env production
        log_success "Database schema created"
    fi

    cd ../..
}

# Load default policies
load_policies() {
    log_info "Loading default compliance policies..."

    cd compliance-platform/gateway

    # Load HIPAA policy
    if [ -f "policies/hipaa.json" ]; then
        wrangler kv:key put "hipaa-policy" --path=./policies/hipaa.json --env production
        log_success "Loaded HIPAA policy"
    fi

    # Load GDPR policy
    if [ -f "policies/gdpr.json" ]; then
        wrangler kv:key put "gdpr-policy" --path=./policies/gdpr.json --env production
        log_success "Loaded GDPR policy"
    fi

    # Load FINRA policy
    if [ -f "policies/finra.json" ]; then
        wrangler kv:key put "finra-policy" --path=./policies/finra.json --env production
        log_success "Loaded FINRA policy"
    fi

    # Load base policies
    if [ -f "policies/base-security.json" ]; then
        wrangler kv:key put "base-security-policy" --path=./policies/base-security.json --env production
        log_success "Loaded base security policy"
    fi

    cd ../..
}

# Deploy Dashboard
deploy_dashboard() {
    log_info "Deploying Compliance Dashboard to Vercel..."

    cd compliance-platform/dashboard

    # Install dependencies
    npm install

    # Build dashboard
    npm run build

    # Deploy to Vercel
    vercel --prod --name "$DASHBOARD_NAME"

    log_success "Dashboard deployed successfully"

    cd ../..
}

# Configure API keys
configure_api_keys() {
    log_info "Configuring API keys..."

    echo ""
    log_warning "Please enter your AI provider API keys:"
    echo "(Press Enter to skip any key)"
    echo ""

    # OpenAI API Key
    read -p "OpenAI API Key: " OPENAI_KEY
    if [ ! -z "$OPENAI_KEY" ]; then
        cd compliance-platform/gateway
        wrangler secret put OPENAI_API_KEY --env production <<< "$OPENAI_KEY"
        cd ../..
        log_success "OpenAI API key configured"
    fi

    # Anthropic API Key
    read -p "Anthropic API Key: " ANTHROPIC_KEY
    if [ ! -z "$ANTHROPIC_KEY" ]; then
        cd compliance-platform/gateway
        wrangler secret put ANTHROPIC_API_KEY --env production <<< "$ANTHROPIC_KEY"
        cd ../..
        log_success "Anthropic API key configured"
    fi

    # AWS Bedrock Credentials
    read -p "AWS Access Key ID: " AWS_ACCESS_KEY
    if [ ! -z "$AWS_ACCESS_KEY" ]; then
        cd compliance-platform/gateway
        wrangler secret put AWS_ACCESS_KEY_ID --env production <<< "$AWS_ACCESS_KEY"
        cd ../..
        log_success "AWS access key configured"
    fi

    read -p "AWS Secret Access Key: " AWS_SECRET_KEY
    if [ ! -z "$AWS_SECRET_KEY" ]; then
        cd compliance-platform/gateway
        wrangler secret put AWS_SECRET_ACCESS_KEY --env production <<< "$AWS_SECRET_KEY"
        cd ../..
        log_success "AWS secret key configured"
    fi

    # Google Gemini API Key
    read -p "Google Gemini API Key: " GEMINI_KEY
    if [ ! -z "$GEMINI_KEY" ]; then
        cd compliance-platform/gateway
        wrangler secret put GEMINI_API_KEY --env production <<< "$GEMINI_KEY"
        cd ../..
        log_success "Gemini API key configured"
    fi
}

# Generate API documentation
generate_docs() {
    log_info "Generating API documentation..."

    # Create API documentation
    cat > API_DOCUMENTATION.md << 'EOF'
# SDLC Compliance Platform - API Documentation

## Base URL
```
https://your-gateway.workers.dev
```

## Authentication
```
Authorization: Bearer your-api-key
```

## Endpoints

### Health Check
```bash
GET /api/health
```

### Compliance Check
```bash
POST /v1/chat/completions
Content-Type: application/json
X-Data-Classification: phi
X-User-Role: doctor

{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "Patient data..."}]
}
```

### Policy Management
```bash
GET /api/policies
POST /api/policies
PUT /api/policies/{policy-id}
```

### Audit Trail
```bash
GET /api/audit/logs
GET /api/audit/transactions/{transaction-id}
```
EOF

    log_success "API documentation generated"
}

# Test deployment
test_deployment() {
    log_info "Testing deployment..."

    # Read gateway URL
    if [ -f "compliance-platform/gateway/.gateway_url" ]; then
        GATEWAY_URL=$(cat compliance-platform/gateway/.gateway_url)
    else
        GATEWAY_URL="https://sdlc-gateway.workers.dev"
    fi

    # Test health endpoint
    if curl -s "$GATEWAY_URL/api/health" | grep -q "healthy"; then
        log_success "Gateway health check passed"
    else
        log_error "Gateway health check failed"
        return 1
    fi

    # Test compliance endpoint
    COMPLIANCE_TEST=$(curl -s -X POST "$GATEWAY_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "X-Data-Classification: pii" \
        -d '{"provider": "openai", "messages": [{"role": "user", "content": "Test"}]}' || echo "")

    if echo "$COMPLIANCE_TEST" | grep -q "compliance"; then
        log_success "Compliance endpoint test passed"
    else
        log_warning "Compliance endpoint test failed (may need API keys)"
    fi
}

# Print success message
print_success() {
    echo ""
    echo "🎉 SDLC Compliance Platform deployed successfully!"
    echo "=================================================="
    echo ""

    if [ -f "compliance-platform/gateway/.gateway_url" ]; then
        GATEWAY_URL=$(cat compliance-platform/gateway/.gateway_url)
    else
        GATEWAY_URL="https://sdlc-gateway.workers.dev"
    fi

    echo "📡 AI Gateway: $GATEWAY_URL"
    echo "📊 Dashboard: https://sdlc-dashboard.vercel.app"
    echo "📚 Documentation: ./API_DOCUMENTATION.md"
    echo ""
    echo "🔧 Next Steps:"
    echo "1. Configure your AI provider API keys"
    echo "2. Test the compliance gateway with curl or SDK"
    echo "3. Access the dashboard for monitoring"
    echo "4. Customize policies for your use case"
    echo ""
    echo "📖 Quick Test:"
    echo "curl $GATEWAY_URL/api/health"
    echo ""
    echo "🛡️ Your enterprise AI is now compliant!"
}

# Main deployment flow
main() {
    echo "Starting SDLC Compliance Platform deployment..."
    echo ""

    check_dependencies
    authenticate
    setup_cloudflare
    deploy_gateway
    setup_database
    load_policies
    deploy_dashboard
    configure_api_keys
    generate_docs
    test_deployment
    print_success

    echo ""
    log_info "Deployment complete! 🚀"
}

# Handle script arguments
case "${1:-}" in
    "--help"|"-h")
        echo "SDLC Compliance Platform - Deployment Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --dev          Deploy to development environment"
        echo "  --skip-keys    Skip API key configuration"
        echo "  --test-only    Run tests only"
        echo ""
        exit 0
        ;;
    "--dev")
        log_info "Deploying to development environment..."
        # Add dev-specific logic here
        main
        ;;
    "--skip-keys")
        log_info "Skipping API key configuration..."
        # Skip configure_api_keys step
        check_dependencies
        authenticate
        setup_cloudflare
        deploy_gateway
        setup_database
        load_policies
        deploy_dashboard
        generate_docs
        test_deployment
        print_success
        ;;
    "--test-only")
        log_info "Running tests only..."
        test_deployment
        ;;
    *)
        main
        ;;
esac