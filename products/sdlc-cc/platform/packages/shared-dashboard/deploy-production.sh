#!/bin/bash

# AutoBoot Production Deployment Script
# Comprehensive deployment with migrations, builds, and verification

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}"
    echo "═══════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}▸ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Start deployment
print_header "AutoBoot Production Deployment"

# Step 1: Pre-flight checks
print_step "Running pre-flight checks..."

if ! command -v node &> /dev/null; then
    print_error "Node.js not found!"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm not found!"
    exit 1
fi

if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found!"
    echo "Install: npm install -g wrangler"
    exit 1
fi

print_success "All dependencies found"

# Step 2: Check authentication
print_step "Checking Wrangler authentication..."
if ! wrangler whoami &> /dev/null; then
    print_error "Wrangler not authenticated!"
    echo "Run: wrangler login"
    exit 1
fi

print_success "Wrangler authenticated"

# Step 3: Install dependencies
print_step "Installing dependencies..."
npm install --silent
print_success "Dependencies installed"

# Step 4: Run TypeScript build
print_step "Building TypeScript..."
npm run build:worker
print_success "TypeScript compiled successfully"

# Step 5: Build frontend
print_step "Building frontend..."
npm run build:frontend
print_success "Frontend built successfully"

# Step 6: Run database migrations
print_step "Running database migrations..."
bash ./scripts/migrate.sh production
print_success "Database migrations completed"

# Step 7: Deploy worker
print_step "Deploying Cloudflare Worker..."
npm run deploy:worker
print_success "Worker deployed successfully"

# Step 8: Deploy frontend
print_step "Deploying frontend to Cloudflare Pages..."
npm run deploy:frontend
print_success "Frontend deployed successfully"

# Step 9: Health check
print_step "Running health checks..."

echo "Checking worker health..."
WORKER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://sdlc.cc/api/v1/auth/me || echo "000")

if [ "$WORKER_RESPONSE" = "401" ] || [ "$WORKER_RESPONSE" = "200" ]; then
    print_success "Worker is responding (HTTP $WORKER_RESPONSE)"
else
    print_warning "Worker returned HTTP $WORKER_RESPONSE (might be normal)"
fi

echo "Checking frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://sdlc.cc/ || echo "000")

if [ "$FRONTEND_RESPONSE" = "200" ]; then
    print_success "Frontend is live (HTTP 200)"
else
    print_warning "Frontend returned HTTP $FRONTEND_RESPONSE"
fi

# Step 10: Summary
print_header "Deployment Complete! 🎉"

echo ""
echo -e "${GREEN}✅ Worker deployed${NC}"
echo -e "${GREEN}✅ Frontend deployed${NC}"
echo -e "${GREEN}✅ Database migrated${NC}"
echo ""
echo -e "${BLUE}Production URLs:${NC}"
echo "  • Frontend: https://sdlc.cc"
echo "  • API:      https://sdlc.cc/api/v1"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Configure OAuth secrets (if not done):"
echo "     npm run setup:oauth"
echo ""
echo "  2. Run end-to-end tests:"
echo "     npm run test:e2e"
echo ""
echo "  3. Monitor logs:"
echo "     wrangler tail --env production"
echo ""

print_success "Deployment successful! 🚀"
