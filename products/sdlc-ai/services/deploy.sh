#!/bin/bash

# LAM System Deployment Script
# Deploys the integrated LAM system to Cloudflare Workers

set -e

echo "🚀 LAM System Deployment Script"
echo "================================"

# Configuration
WORKER_NAME="sdlc-lam-system"
ENVIRONMENT=${1:-"development"}
REGION=${2:-"us-east-1"}

echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Please run:"
    echo "wrangler auth login"
    exit 1
fi

echo "✅ Authenticated to Cloudflare"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run tests first
echo "🧪 Running integration tests..."
if node test-lam-system.js; then
    echo "✅ All tests passed!"
else
    echo "❌ Tests failed. Please fix issues before deploying."
    exit 1
fi

echo ""

# Validate wrangler configuration
echo "🔍 Validating wrangler configuration..."
if wrangler validate; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration validation failed"
    exit 1
fi

echo ""

# Set up required secrets (interactive)
echo "🔑 Setting up secrets..."
echo "Note: You'll be prompted for API keys. Press Enter to skip if already set."

# Check and set secrets
echo "Checking OpenAI API key..."
if ! wrangler secret list | grep -q "OPENAI_API_KEY"; then
    echo "Setting OpenAI API key (press Enter to skip):"
    read -s OPENAI_KEY
    if [ ! -z "$OPENAI_KEY" ]; then
        echo "$OPENAI_KEY" | wrangler secret put OPENAI_API_KEY
    fi
fi

echo "Checking Anthropic API key..."
if ! wrangler secret list | grep -q "ANTHROPIC_API_KEY"; then
    echo "Setting Anthropic API key (press Enter to skip):"
    read -s ANTHROPIC_KEY
    if [ ! -z "$ANTHROPIC_KEY" ]; then
        echo "$ANTHROPIC_KEY" | wrangler secret put ANTHROPIC_API_KEY
    fi
fi

echo ""

# Create KV namespaces if they don't exist
echo "📚 Setting up KV namespaces..."

KV_NAMESPACES=("LAM_KNOWLEDGE_BASE" "LAM_PATTERNS" "LAM_METRICS")

for ns in "${KV_NAMESPACES[@]}"; do
    echo "Checking KV namespace: $ns"
    if ! wrangler kv:namespace list | grep -q "$ns"; then
        echo "Creating KV namespace: $ns"
        wrangler kv:namespace create "$ns"
    else
        echo "✅ KV namespace $ns already exists"
    fi
done

echo ""

# Create D1 database if it doesn't exist
echo "🗄️ Setting up D1 database..."
DB_NAME="sdlc-lam-database"

if ! wrangler d1 list | grep -q "$DB_NAME"; then
    echo "Creating D1 database: $DB_NAME"
    wrangler d1 create "$DB_NAME"
else
    echo "✅ D1 database $DB_NAME already exists"
fi

echo ""

# Deploy to Cloudflare Workers
echo "🚀 Deploying to Cloudflare Workers..."

if [ "$ENVIRONMENT" = "production" ]; then
    echo "Deploying to PRODUCTION..."
    wrangler deploy --env production
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "Deploying to STAGING..."
    wrangler deploy --env staging
else
    echo "Deploying to DEVELOPMENT..."
    wrangler deploy
fi

echo ""

# Verify deployment
echo "✅ Deployment successful!"
echo ""

# Get worker URL
WORKER_URL=$(wrangler whoami 2>/dev/null | grep -A 5 "Workers" | grep -E "https://.*\.workers\.dev" | head -1 || echo "")
if [ ! -z "$WORKER_URL" ]; then
    echo "🌐 Worker URL: $WORKER_URL"
    echo ""
    echo "🧪 Testing deployed worker..."

    # Test health endpoint
    HEALTH_URL="$WORKER_URL/api/v1/health"
    if curl -s "$HEALTH_URL" | grep -q "status.*ok"; then
        echo "✅ Health check passed!"
    else
        echo "⚠️ Health check failed. Please verify the deployment."
    fi

    echo ""
    echo "📊 You can test the LAM system with:"
    echo "curl -X POST $WORKER_URL/api/v1/lam/process \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"request\":{\"type\":\"compliance_check\",\"data\":{\"text\":\"test\"}},\"context\":{\"userId\":\"test\"}}'"
else
    echo "⚠️ Could not determine worker URL. Please check the Cloudflare dashboard."
fi

echo ""
echo "🎉 LAM System deployment complete!"
echo ""
echo "Next steps:"
echo "1. Monitor the worker in the Cloudflare dashboard"
echo "2. Test the API endpoints"
echo "3. Configure your applications to use the LAM system"
echo "4. Monitor the feedback loop and learning cycles"
echo ""
echo "For more information, see the Cloudflare Workers dashboard:"