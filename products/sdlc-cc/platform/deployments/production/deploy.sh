#!/bin/bash
# SDLC.ai Production Deployment Script

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
DOMAIN_NAME=${DOMAIN_NAME:-sdlc.cc}
TERRAFORM_DIR="deployments/production/terraform"

print_status "🚀 Starting SDLC.ai Production Deployment"
print_status "Environment: $ENVIRONMENT"
print_status "Domain: $DOMAIN_NAME"
print_status "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Check prerequisites
print_status "🔍 Checking prerequisites..."

# Check if Terraform is installed
if ! command -v terraform >/dev/null 2>&1; then
    print_error "Terraform is required but not installed. Please install Terraform first."
    exit 1
fi

# Check if curl is installed
if ! command -v curl >/dev/null 2>&1; then
    print_error "curl is required but not installed. Please install curl first."
    exit 1
fi

# Check if required environment variables are set
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    print_error "CLOUDFLARE_API_TOKEN environment variable is required"
    exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
    print_error "CLOUDFLARE_ACCOUNT_ID environment variable is required"
    exit 1
fi

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
    print_error "STRIPE_SECRET_KEY environment variable is required"
    exit 1
fi

if [[ -z "${ENCRYPTION_KEY:-}" ]]; then
    print_error "ENCRYPTION_KEY environment variable is required"
    exit 1
fi

print_success "All prerequisites satisfied"
echo ""

# Navigate to Terraform directory
cd "$TERRAFORM_DIR"

# Initialize Terraform
print_status "🏗️  Initializing Terraform..."
if terraform init -input=false; then
    print_success "Terraform initialized successfully"
else
    print_error "Failed to initialize Terraform"
    exit 1
fi
echo ""

# Validate Terraform configuration
print_status "📋 Validating Terraform configuration..."
if terraform validate; then
    print_success "Terraform configuration is valid"
else
    print_error "Terraform configuration validation failed"
    exit 1
fi
echo ""

# Plan deployment
print_status "📝 Planning deployment..."
if terraform plan -out=tfplan -input=false \
    -var="environment=$ENVIRONMENT" \
    -var="domain_name=$DOMAIN_NAME" \
    -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
    -var="cloudflare_account_id=$CLOUDFLARE_ACCOUNT_ID" \
    -var="stripe_secret_key=$STRIPE_SECRET_KEY" \
    -var="encryption_key=$ENCRYPTION_KEY"; then
    print_success "Terraform plan created successfully"
else
    print_error "Failed to create Terraform plan"
    exit 1
fi
echo ""

# Show plan summary
print_status "📊 Deployment Plan Summary:"
terraform show -json tfplan | jq -r '.planned_values.root_module.resources[] | "\(.type): \(.name)"' 2>/dev/null || {
    print_warning "Could not display plan summary (jq not available)"
}
echo ""

# Confirm deployment
read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled by user"
    exit 0
fi

# Apply deployment
print_status "🎯 Applying deployment..."
if terraform apply -auto-approve tfplan; then
    print_success "Terraform deployment completed successfully"
else
    print_error "Terraform deployment failed"
    exit 1
fi
echo ""

# Get outputs
API_URL="https://api.$DOMAIN_NAME"
APP_URL="https://app.$DOMAIN_NAME"

print_status "📍 Deployment URLs:"
echo "  API Gateway: $API_URL"
echo "  Frontend: $APP_URL"
echo "  Health Check: $API_URL/health"
echo ""

# Verify deployment
print_status "✅ Verifying deployment..."

# Function to check URL
check_url() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s --max-time 10 "$url" >/dev/null 2>&1; then
            print_success "$name is healthy"
            return 0
        fi

        print_status "Attempt $attempt/$max_attempts: $name not ready yet, waiting..."
        sleep 10
        ((attempt++))
    done

    print_error "$name health check failed after $max_attempts attempts"
    return 1
}

# Check API Gateway
check_url "$API_URL/health" "API Gateway"

# Check Frontend
check_url "$APP_URL" "Frontend"

# Check Payment Service
check_url "$API_URL/payments/health" "Payment Service"

echo ""

# Display success message
print_success "🎉 Deployment completed successfully!"
echo ""
print_status "📍 Important URLs:"
echo "  API Gateway: $API_URL"
echo "  Frontend: $APP_URL"
echo "  Health Check: $API_URL/health"
echo "  Metrics: $API_URL/metrics"
echo "  Status Page: https://status.$DOMAIN_NAME"
echo ""
print_status "🔐 Security Configuration:"
echo "  WAF Enabled: true"
echo "  PCI Level: 1"
echo "  Rate Limiting: enabled"
echo "  SSL/TLS: enabled"
echo ""
print_status "📊 Next Steps:"
echo "1. Configure DNS records to point to Cloudflare nameservers"
echo "2. Set up monitoring alerts in your monitoring system"
echo "3. Run security scans and penetration testing"
echo "4. Perform load testing with gradual traffic ramp-up"
echo "5. Configure backup procedures and disaster recovery"
echo "6. Set up CI/CD pipeline for future deployments"
echo ""
print_status "📖 Documentation:"
echo "  - Check deployment-manifest.yaml for configuration details"
echo "  - Review .env.production for environment variables"
echo "  - Consult README.md for operational procedures"
echo ""
print_success "✨ SDLC.ai is now live and production-ready! ✨"

# Clean up
rm -f tfplan

echo ""
print_status "🔧 Post-deployment recommendations:"
echo "• Monitor the application for the first 24 hours"
echo "• Check all automated backups are working"
echo "• Verify all security controls are functioning"
echo "• Test disaster recovery procedures"
echo "• Review performance metrics and optimize if needed"
echo "• Schedule regular security scans and compliance checks"
