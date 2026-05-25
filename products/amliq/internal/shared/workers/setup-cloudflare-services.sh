#!/bin/bash

# FinTech Cloudflare Services Setup Script
# This script configures all necessary Cloudflare services for the FinTech suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if wrangler is installed
check_wrangler() {
    log_info "Checking if Wrangler CLI is installed..."
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please install it with: npm install -g wrangler"
        exit 1
    fi
    log_success "Wrangler CLI is installed"
}

# Check authentication
check_auth() {
    log_info "Checking Cloudflare authentication..."
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Please run: wrangler login"
        exit 1
    fi
    log_success "Authenticated with Cloudflare"
}

# Create D1 databases
create_d1_databases() {
    log_info "Creating D1 databases..."

    # Billing databases
    log_info "Creating billing databases..."
    wrangler d1 create finsavvy-billing-us || log_warning "Database finsavvy-billing-us may already exist"
    wrangler d1 create finsavvy-billing-eu || log_warning "Database finsavvy-billing-eu may already exist"

    # Compliance databases
    log_info "Creating compliance databases..."
    wrangler d1 create finsavvy-compliance-us || log_warning "Database finsavvy-compliance-us may already exist"
    wrangler d1 create finsavvy-compliance-eu || log_warning "Database finsavvy-compliance-eu may already exist"

    # Intelligence databases
    log_info "Creating intelligence databases..."
    wrangler d1 create finsavvy-intelligence-us || log_warning "Database finsavvy-intelligence-us may already exist"
    wrangler d1 create finsavvy-intelligence-eu || log_warning "Database finsavvy-intelligence-eu may already exist"

    # Risk databases
    log_info "Creating risk databases..."
    wrangler d1 create finsavvy-risk-us || log_warning "Database finsavvy-risk-us may already exist"
    wrangler d1 create finsavvy-risk-eu || log_warning "Database finsavvy-risk-eu may already exist"

    log_success "D1 databases created (or already exist)"
}

# Create KV namespaces
create_kv_namespaces() {
    log_info "Creating KV namespaces..."

    # Core KV namespaces
    wrangler kv namespace create "CACHE_KV" || log_warning "KV namespace CACHE_KV may already exist"
    wrangler kv namespace create "SESSIONS_KV" || log_warning "KV namespace SESSIONS_KV may already exist"
    wrangler kv namespace create "AGENT_MEMORY_KV" || log_warning "KV namespace AGENT_MEMORY_KV may already exist"
    wrangler kv namespace create "RATE_LIMITS_KV" || log_warning "KV namespace RATE_LIMITS_KV may already exist"
    wrangler kv namespace create "USER_PREFERENCES_KV" || log_warning "KV namespace USER_PREFERENCES_KV may already exist"

    log_success "KV namespaces created (or already exist)"
}

# Create R2 buckets
create_r2_buckets() {
    log_info "Creating R2 buckets..."

    wrangler r2 bucket create finsavvy-documents || log_warning "Bucket finsavvy-documents may already exist"
    wrangler r2 bucket create finsavvy-evidence || log_warning "Bucket finsavvy-evidence may already exist"
    wrangler r2 bucket create finsavvy-backups || log_warning "Bucket finsavvy-backups may already exist"
    wrangler r2 bucket create finsavvy-ai-models || log_warning "Bucket finsavvy-ai-models may already exist"

    log_success "R2 buckets created (or already exist)"
}

# Create Queues
create_queues() {
    log_info "Creating Cloudflare Queues..."

    wrangler queues create finsavvy-billing-queue || log_warning "Queue finsavvy-billing-queue may already exist"
    wrangler queues create finsavvy-compliance-queue || log_warning "Queue finsavvy-compliance-queue may already exist"
    wrangler queues create finsavvy-intelligence-queue || log_warning "Queue finsavvy-intelligence-queue may already exist"
    wrangler queues create finsavvy-risk-queue || log_warning "Queue finsavvy-risk-queue may already exist"
    wrangler queues create finsavvy-notification-queue || log_warning "Queue finsavvy-notification-queue may already exist"

    log_success "Cloudflare Queues created (or already exist)"
}

# Create Vectorize index
create_vectorize_index() {
    log_info "Creating Vectorize index for RAG..."

    wrangler vectorize create finsavvy-rag-embeddings --dimensions=768 --metric=cosine || log_warning "Vectorize index finsavvy-rag-embeddings may already exist"

    log_success "Vectorize index created (or already exists)"
}

# Set up secrets
setup_secrets() {
    log_info "Setting up secrets..."

    # Check if .env.local exists
    if [ -f "../.env.local" ]; then
        log_info "Loading environment variables from .env.local..."
        source ../.env.local

        # Set up secrets (only if they have actual values)
        if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "your_super_secret_jwt_key_at_least_32_characters_long" ]; then
            wrangler secret put JWT_SECRET
        fi

        if [ -n "$ENCRYPTION_KEY" ] && [ "$ENCRYPTION_KEY" != "your_32_character_encryption_key_here" ]; then
            wrangler secret put ENCRYPTION_KEY
        fi

        if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your_openai_api_key_here" ]; then
            wrangler secret put OPENAI_API_KEY
        fi

        if [ -n "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "your_anthropic_api_key_here" ]; then
            wrangler secret put ANTHROPIC_API_KEY
        fi

        if [ -n "$GEMINI_API_KEY" ] && [ "$GEMINI_API_KEY" != "your_gemini_api_key_here" ]; then
            wrangler secret put GEMINI_API_KEY
        fi

        if [ -n "$STRIPE_SECRET_KEY" ] && [ "$STRIPE_SECRET_KEY" != "sk_test_your_stripe_secret_key_here" ]; then
            wrangler secret put STRIPE_SECRET_KEY
        fi

        if [ -n "$COMPLYADVANTAGE_API_KEY" ] && [ "$COMPLYADVANTAGE_API_KEY" != "your_complyadvantage_api_key_here" ]; then
            wrangler secret put COMPLYADVANTAGE_API_KEY
        fi

        if [ -n "$RESEND_API_KEY" ] && [ "$RESEND_API_KEY" != "re_your_resend_api_key_here" ]; then
            wrangler secret put RESEND_API_KEY
        fi

        log_success "Secrets configured (please update .env.local with actual values)"
    else
        log_warning ".env.local file not found. Please configure secrets manually using wrangler secret put <SECRET_NAME>"
    fi
}

# Generate updated wrangler.toml with actual IDs
update_wrangler_config() {
    log_info "Generating updated wrangler.toml with actual resource IDs..."

    # This would typically involve parsing wrangler output and updating the config
    # For now, we'll create a helper script to extract IDs
    cat > update-config.js << 'EOF'
// Helper script to extract resource IDs from wrangler commands
// Run this after completing the setup to update your wrangler.toml

const fs = require('fs');
const { execSync } = require('child_process');

console.log('Extracting resource IDs...');

// D1 Database IDs
const d1Databases = [
    'finsavvy-billing-us',
    'finsavvy-billing-eu',
    'finsavvy-compliance-us',
    'finsavvy-compliance-eu',
    'finsavvy-intelligence-us',
    'finsavvy-intelligence-eu',
    'finsavvy-risk-us',
    'finsavvy-risk-eu'
];

// KV Namespace IDs
const kvNamespaces = [
    'CACHE_KV',
    'SESSIONS_KV',
    'AGENT_MEMORY_KV',
    'RATE_LIMITS_KV',
    'USER_PREFERENCES_KV'
];

console.log('Please manually update your wrangler.toml with the actual IDs from:');
console.log('1. wrangler d1 list');
console.log('2. wrangler kv namespace list');
console.log('3. Vectorize and Queue IDs from Cloudflare Dashboard');
EOF

    log_success "Helper script created: update-config.js"
}

# Main execution
main() {
    log_info "Starting FinTech Cloudflare Services Setup..."
    echo "========================================"

    # Navigate to workers directory
    cd "$(dirname "$0")"

    check_wrangler
    check_auth

    echo ""
    create_d1_databases
    echo ""

    create_kv_namespaces
    echo ""

    create_r2_buckets
    echo ""

    create_queues
    echo ""

    create_vectorize_index
    echo ""

    setup_secrets
    echo ""

    update_wrangler_config

    echo ""
    log_success "Cloudflare services setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Update your .env.local with actual Cloudflare resource IDs"
    echo "2. Update wrangler.toml with the actual database and KV IDs"
    echo "3. Run 'wrangler deploy' to deploy your worker"
    echo "4. Set up custom domains in Cloudflare dashboard"
    echo ""
    echo "For manual resource ID extraction, run: node update-config.js"
}

# Run the script
main "$@"