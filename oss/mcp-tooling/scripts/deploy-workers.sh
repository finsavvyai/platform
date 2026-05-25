#!/bin/bash
# MCPOverflow Cloudflare Deployment Script
# Usage: ./deploy-cloudflare.sh [environment]

set -e

ENVIRONMENT=${1:-staging}
WORKERS_DIR="$(dirname "$0")/../workers"

echo "🚀 MCPOverflow Cloudflare Deployment"
echo "Environment: $ENVIRONMENT"
echo "=================================="

cd "$WORKERS_DIR"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare..."
    wrangler login
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if D1 database exists
echo "🗄️ Checking D1 database..."
DB_NAME="mcpoverflow-$ENVIRONMENT"
if [ "$ENVIRONMENT" = "production" ]; then
    DB_NAME="mcpoverflow-production"
elif [ "$ENVIRONMENT" = "staging" ]; then
    DB_NAME="mcpoverflow-staging"
else
    DB_NAME="mcpoverflow"
fi

# Try to list databases and check if ours exists
if ! wrangler d1 list 2>/dev/null | grep -q "$DB_NAME"; then
    echo "Creating D1 database: $DB_NAME"
    wrangler d1 create "$DB_NAME"
    echo ""
    echo "⚠️  IMPORTANT: Update wrangler.toml with the database_id above!"
    echo "   Then run this script again."
    exit 0
fi

# Run migrations
echo "📋 Running D1 migrations..."
if [ "$ENVIRONMENT" = "development" ]; then
    wrangler d1 execute "$DB_NAME" --local --file=./db/schema.sql
else
    wrangler d1 execute "$DB_NAME" --file=./db/schema.sql
fi

# Type check
echo "✅ Type checking..."
npm run typecheck

# Deploy
echo "🚀 Deploying to Cloudflare..."
if [ "$ENVIRONMENT" = "production" ]; then
    wrangler deploy --env production
elif [ "$ENVIRONMENT" = "staging" ]; then
    wrangler deploy --env staging
else
    wrangler deploy
fi

echo ""
echo "✨ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure Cloudflare Access application"
echo "2. Set secrets: wrangler secret put CF_ACCESS_TEAM_DOMAIN"
echo "3. Set secrets: wrangler secret put CF_ACCESS_AUD"
echo ""
