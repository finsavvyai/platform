#!/bin/bash
# Prerequisites Check Script for SDLC.ai Production Deployment

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_status "🔍 Checking prerequisites for SDLC.ai Production Deployment"
echo ""

# Check required tools
tools=("terraform" "curl" "git" "jq")
all_tools_ok=true

for tool in "${tools[@]}"; do
    if command -v "$tool" >/dev/null 2>&1; then
        version=$("$tool" --version 2>/dev/null | head -n1 || echo "unknown")
        print_success "$tool installed ($version)"
    else
        print_error "$tool not found"
        all_tools_ok=false
    fi
done

if ! $all_tools_ok; then
    echo ""
    print_error "Please install missing tools before proceeding"
    exit 1
fi

echo ""

# Check required environment variables
env_vars=(
    "CLOUDFLARE_API_TOKEN"
    "CLOUDFLARE_ACCOUNT_ID"
    "STRIPE_SECRET_KEY"
    "ENCRYPTION_KEY"
)

all_vars_ok=true

for var in "${env_vars[@]}"; do
    if [[ -n "${!var:-}" ]]; then
        # Mask sensitive values in output
        if [[ "$var" == *"KEY" || "$var" == *"TOKEN" ]]; then
            value="${!var:0:4}...${!var: -4}"
        else
            value="${!var}"
        fi
        print_success "$var is set ($value)"
    else
        print_error "$var is not set"
        all_vars_ok=false
    fi
done

if ! $all_vars_ok; then
    echo ""
    print_error "Please set missing environment variables:"
    echo "  export CLOUDFLARE_API_TOKEN=your_api_token"
    echo "  export CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "  export STRIPE_SECRET_KEY=your_stripe_secret_key"
    echo "  export ENCRYPTION_KEY=your_encryption_key_at_least_32_chars"
    echo ""
    exit 1
fi

echo ""

# Check Terraform configuration
print_status "📋 Checking Terraform configuration..."

if [[ -f "terraform/main.tf" ]]; then
    print_success "Terraform main configuration found"
else
    print_error "Terraform main.tf not found"
    exit 1
fi

if [[ -f "terraform/variables.tf" ]]; then
    print_success "Terraform variables configuration found"
else
    print_error "Terraform variables.tf not found"
    exit 1
fi

if terraform fmt -check -recursive terraform >/dev/null 2>&1; then
    print_success "Terraform files are properly formatted"
else
    print_warning "Terraform files need formatting"
fi

echo ""

# Check encryption key length
if [[ ${#ENCRYPTION_KEY} -lt 32 ]]; then
    print_error "ENCRYPTION_KEY must be at least 32 characters long (current: ${#ENCRYPTION_KEY})"
    exit 1
else
    print_success "ENCRYPTION_KEY length is sufficient (${#ENCRYPTION_KEY} characters)"
fi

echo ""

# Check git status (should be clean for production)
print_status "📦 Checking git status..."
if git rev-parse --git-dir >/dev/null 2>&1; then
    if [[ -n $(git status --porcelain) ]]; then
        print_warning "Git working directory is not clean"
        print_status "Uncommitted changes may affect deployment"
    else
        print_success "Git working directory is clean"
    fi

    current_branch=$(git branch --show-current)
    print_status "Current branch: $current_branch"

    if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        print_warning "Not on main/master branch ($current_branch)"
    fi
else
    print_warning "Not in a git repository"
fi

echo ""

# Check domain availability (basic DNS check)
print_status "🌐 Checking domain configuration..."
if command -v dig >/dev/null 2>&1; then
    if dig +short "${DOMAIN_NAME:-sdlc.ai}" >/dev/null 2>&1; then
        print_success "Domain ${DOMAIN_NAME:-sdlc.ai} resolves"
    else
        print_warning "Domain ${DOMAIN_NAME:-sdlc.ai} does not resolve (DNS not configured yet)"
    fi
else
    print_warning "dig command not available, skipping DNS check"
fi

echo ""

# Summary
print_success "✅ All prerequisites satisfied!"
echo ""
print_status "Ready to run production deployment:"
echo "  ./deploy.sh"
echo ""
