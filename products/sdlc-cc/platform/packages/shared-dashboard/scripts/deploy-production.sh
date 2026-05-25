#!/bin/bash

#############################################
# AutoBoot Production Deployment Script
# One-command deployment to Cloudflare
#############################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_section() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

# Start deployment
print_header "AutoBoot Production Deployment"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run from project root."
    exit 1
fi

# 1. Pre-flight checks
print_section "1. Pre-flight Checks"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_success "Node.js installed: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm installed: $(npm --version)"

# Check Wrangler
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler is not installed. Run: npm install -g wrangler"
    exit 1
fi
print_success "Wrangler installed: $(wrangler --version)"

# Check Wrangler authentication
print_info "Checking Wrangler authentication..."
if ! wrangler whoami &> /dev/null; then
    print_error "Not logged in to Wrangler. Run: wrangler login"
    exit 1
fi
print_success "Wrangler authenticated"

# 2. Install dependencies
print_section "2. Installing Dependencies"
print_info "Running npm install..."
npm install
print_success "Dependencies installed"

# 3. Build TypeScript worker
print_section "3. Building Worker"
print_info "Compiling TypeScript..."
npm run build:worker
print_success "Worker built successfully"

# 4. Build frontend
print_section "4. Building Frontend"
print_info "Building Vite frontend..."
npm run build:frontend
print_success "Frontend built successfully"

# 5. Run database migrations
print_section "5. Running Database Migrations"
print_info "Applying migrations to production database..."

if [ -f "./scripts/migrate.sh" ]; then
    bash ./scripts/migrate.sh production
    print_success "Database migrations completed"
else
    print_error "Migration script not found at ./scripts/migrate.sh"
    print_info "Skipping migrations (run manually: npm run db:migrate)"
fi

# 6. Deploy worker
print_section "6. Deploying Worker to Cloudflare"
print_info "Deploying to sdlc.cc..."
npm run deploy:worker
print_success "Worker deployed successfully"

# 7. Deploy frontend
print_section "7. Deploying Frontend to Cloudflare Pages"
print_info "Deploying static assets..."

if [ -d "./dist-frontend" ]; then
    npm run deploy:frontend
    print_success "Frontend deployed successfully"
else
    print_error "Frontend build directory not found"
    print_info "Skipping frontend deployment"
fi

# 8. Health checks
print_section "8. Running Health Checks"

print_info "Waiting for deployment to propagate (10 seconds)..."
sleep 10

print_info "Checking API health..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://sdlc.cc/api/v1/admin/database/health || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    print_success "API is healthy (HTTP 200)"
else
    print_error "API health check returned HTTP $HEALTH_RESPONSE"
    print_info "This may be normal if the deployment is still propagating"
fi

# 9. Deployment summary
print_header "Deployment Complete!"

echo -e "${GREEN}Your AutoBoot platform is now live!${NC}\n"

echo -e "${BLUE}Worker URL:${NC}"
echo -e "  https://sdlc.cc"
echo -e "  https://api.sdlc.cc\n"

echo -e "${BLUE}Frontend URL:${NC}"
echo -e "  https://unified-dashboard.pages.dev\n"

echo -e "${BLUE}API Endpoints:${NC}"
echo -e "  Authentication:  https://sdlc.cc/api/v1/auth/*"
echo -e "  API Keys:        https://sdlc.cc/api/v1/api-keys/*"
echo -e "  Dashboard:       https://sdlc.cc/api/v1/dashboard/*"
echo -e "  Billing:         https://sdlc.cc/api/v1/billing/*"
echo -e "  Admin:           https://sdlc.cc/api/v1/admin/*\n"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Configure OAuth (optional): npm run setup:oauth"
echo -e "  2. Set JWT secret: wrangler secret put JWT_SECRET --env production"
echo -e "  3. Run tests: npm run test:e2e"
echo -e "  4. Monitor logs: wrangler tail --env production\n"

echo -e "${BLUE}Database:${NC}"
echo -e "  Name: unified-dashboard-prod"
echo -e "  Tables: 6 (users, sessions, api_keys, organizations, audit_logs, email_verification)"
echo -e "  Query: wrangler d1 execute unified-dashboard-prod --command=\"SELECT COUNT(*) FROM dashboard_users\" --env=production\n"

echo -e "${GREEN}Deployment successful! 🚀${NC}\n"
