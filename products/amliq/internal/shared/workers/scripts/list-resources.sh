#!/bin/bash

# Resource Listing Script
# Lists all Cloudflare resources configured for the FinTech suite

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Navigate to workers directory
cd "$(dirname "$0")/.."

log_info "Listing Cloudflare resources for FinTech suite..."
echo "=================================="

# D1 Databases
echo ""
log_info "📊 D1 Databases:"
wrangler d1 list 2>/dev/null || echo "No D1 databases found or not authenticated"

# KV Namespaces
echo ""
log_info "🗂️  KV Namespaces:"
wrangler kv namespace list 2>/dev/null || echo "No KV namespaces found or not authenticated"

# R2 Buckets
echo ""
log_info "📦 R2 Buckets:"
wrangler r2 bucket list 2>/dev/null || echo "No R2 buckets found or not authenticated"

# Queues
echo ""
log_info "📬 Cloudflare Queues:"
wrangler queues list 2>/dev/null || echo "No queues found or not authenticated"

# Workers
echo ""
log_info "⚡ Workers:"
wrangler deployments list 2>/dev/null || echo "No workers deployed or not authenticated"

# Vectorize Indexes
echo ""
log_info "🧮 Vectorize Indexes:"
echo "Vectorize indexes must be checked in Cloudflare Dashboard:"
echo "https://dash.cloudflare.com/vectorize"

echo ""
log_success "Resource listing completed!"
echo ""
echo "📝 Next steps:"
echo "1. Update wrangler.toml with actual resource IDs"
echo "2. Configure secrets with: ./scripts/setup-secrets.sh"
echo "3. Deploy with: ./scripts/deploy.sh"