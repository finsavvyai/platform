#!/bin/bash

# Luna RAG Cloudflare Workers Deployment Script
# Deploys to Cloudflare using Wrangler

set -e

echo "🌙 Deploying Luna RAG to Cloudflare Workers..."

# Colors for output
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

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Installing now..."
    npm install -g wrangler
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    print_warning "You are not logged in to Cloudflare. Please run:"
    echo "wrangler auth login"
    echo ""
    read -p "Press Enter after you've logged in to continue..."
fi

# Install dependencies
print_status "Installing dependencies..."
npm install

# Create D1 database if it doesn't exist
print_status "Setting up D1 database..."
if ! wrangler d1 list | grep -q "luna-rag-db"; then
    print_status "Creating new D1 database..."
    wrangler d1 create luna-rag-db
    echo ""
    print_warning "Please update the database_id in wrangler.toml with the ID shown above"
    read -p "Press Enter after updating wrangler.toml..."
fi

# Create KV namespace if it doesn't exist
print_status "Setting up KV storage..."
if ! wrangler kv:namespace list | grep -q "luna-rag-cache"; then
    print_status "Creating new KV namespace..."
    wrangler kv:namespace create "luna-rag-cache"
    wrangler kv:namespace create "luna-rag-cache" --preview
    echo ""
    print_warning "Please update the KV namespace IDs in wrangler.toml with the IDs shown above"
    read -p "Press Enter after updating wrangler.toml..."
fi

# Set required secrets
print_status "Checking required secrets..."
SECRETS=(
    "LEMONSQUEEZY_API_KEY"
    "LEMONSQUEEZY_WEBHOOK_SECRET"
    "JWT_SECRET"
    "SENDGRID_API_KEY"
    "EMAIL_FROM"
    "EMAIL_SUPPORT"
)

for secret in "${SECRETS[@]}"; do
    if ! wrangler secret list | grep -q "$secret"; then
        print_warning "Secret $secret is not set. Please set it with:"
        echo "wrangler secret put $secret"
    fi
done

# Run database migrations
print_status "Running database migrations..."
wrangler d1 migrations apply luna-rag-db

# Deploy to Cloudflare
print_status "Deploying to Cloudflare Workers..."
wrangler deploy

# Test the deployment
print_status "Testing deployment..."
WORKER_URL=$(wrangler whoami --format json | jq -r '.api_url' 2>/dev/null || echo "")
if [ -n "$WORKER_URL" ]; then
    echo "Testing health endpoint..."
    curl -s "$WORKER_URL/health" | jq .

    echo ""
    print_success "Deployment successful!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Copy the Worker URL from above"
    echo "2. Update your Claude Code plugin configuration"
    echo "3. Test the RAG query endpoint"
    echo "4. Configure LemonSqueezy webhooks to: ${WORKER_URL}/webhook"
    echo ""
    echo "🎯 Your Luna RAG backend is now live on Cloudflare Workers!"
else
    print_warning "Could not determine worker URL. Please check the deployment output above."
fi

echo ""
print_success "Cloudflare Workers deployment complete! 🌙"

# Show useful commands
echo ""
echo "🔧 Useful Commands:"
echo "wrangler dev              # Run locally"
echo "wrangler tail             # View logs"
echo "wrangler secret put NAME  # Set secret"
echo "wrangler d1 migrations apply luna-rag-db  # Run migrations"