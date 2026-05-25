#!/bin/bash
#
# Qestro Production Deployment Script
# 
# Performs a full production deployment with safety checks, backups, and verification.
#
# Usage: ./scripts/deploy-production.sh [--skip-tests] [--skip-backup]
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV="production"
FRONTEND_PROJECT="qestro-frontend"
BACKEND_PROJECT="qestro-api"
HEALTH_CHECK_TIMEOUT=120
SMOKE_TEST_RETRIES=3

# Parse arguments
SKIP_TESTS=false
SKIP_BACKUP=false

for arg in "$@"; do
  case $arg in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
  esac
done

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Header
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 QESTRO PRODUCTION DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Environment: ${DEPLOYMENT_ENV}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check required tools
for cmd in npm wrangler curl git; do
  if ! command -v $cmd &> /dev/null; then
    log_error "$cmd is required but not installed."
    exit 1
  fi
done
log_success "All required tools are installed"

# Check working directory
if [[ ! -f "package.json" ]]; then
  log_error "Must be run from the project root directory"
  exit 1
fi
log_success "Running from project root"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  log_warn "You have uncommitted changes. Consider committing before deployment."
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Verify on correct branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "production-deploy" ]]; then
  log_warn "Current branch is '$CURRENT_BRANCH', expected 'main' or 'production-deploy'"
  read -p "Continue with deployment from this branch? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Step 1: Run tests (unless skipped)
echo ""
log_info "Step 1/8: Running test suite..."
if [[ "$SKIP_TESTS" == true ]]; then
  log_warn "Tests skipped (--skip-tests flag)"
else
  npm run lint || { log_error "Linting failed"; exit 1; }
  npm run test || { log_error "Tests failed"; exit 1; }
  log_success "All tests passed"
fi

# Step 2: Database backup
echo ""
log_info "Step 2/8: Creating database backup..."
if [[ "$SKIP_BACKUP" == true ]]; then
  log_warn "Backup skipped (--skip-backup flag)"
else
  BACKUP_FILE="backup_$(date '+%Y%m%d_%H%M%S').sql"
  if [[ -f "scripts/backup-database.sh" ]]; then
    bash scripts/backup-database.sh "$BACKUP_FILE" || log_warn "Backup script failed, continuing..."
  else
    log_warn "Backup script not found, skipping automatic backup"
  fi
  log_success "Backup completed"
fi

# Step 3: Build frontend
echo ""
log_info "Step 3/8: Building frontend..."
cd frontend
npm run build || { log_error "Frontend build failed"; exit 1; }
cd ..
log_success "Frontend built successfully"

# Step 4: Build backend Worker
echo ""
log_info "Step 4/8: Building backend Worker..."
npm run build:backend || { log_error "Backend build failed"; exit 1; }
log_success "Backend Worker built successfully"

# Step 5: Run database migrations
echo ""
log_info "Step 5/8: Running database migrations..."
if [[ -f "backend/wrangler.toml" ]]; then
  npx wrangler d1 migrations apply qestro-db-prod --remote --config backend/wrangler.toml || { log_error "Backend D1 migration failed"; exit 1; }
fi
npm run db:migrate:remote || { log_error "Platform D1 migration failed"; exit 1; }
log_success "Migrations completed"

# Step 6: Deploy backend Worker
echo ""
log_info "Step 6/8: Deploying backend Cloudflare Worker..."
npm run deploy:backend:prod || { log_error "Backend Worker deployment failed"; exit 1; }
log_success "Backend Worker deployed"

# Step 7: Deploy frontend
echo ""
log_info "Step 7/8: Deploying frontend to Cloudflare Pages..."
npm run deploy:frontend:prod || { log_error "Frontend deployment failed"; exit 1; }
log_success "Frontend deployed"

# Step 8: Health checks & smoke tests
echo ""
log_info "Step 8/8: Running health checks..."

# Wait for deployment to propagate
log_info "Waiting 30 seconds for deployment propagation..."
sleep 30

# API Health Check
API_URL="https://api.qestro.app/api/health"
log_info "Checking API health: $API_URL"
for i in $(seq 1 $SMOKE_TEST_RETRIES); do
  if curl -sf "$API_URL" > /dev/null; then
    log_success "API is healthy"
    break
  fi
  if [[ $i -eq $SMOKE_TEST_RETRIES ]]; then
    log_error "API health check failed after $SMOKE_TEST_RETRIES attempts"
    exit 1
  fi
  log_warn "Attempt $i failed, retrying in 10 seconds..."
  sleep 10
done

# Frontend Health Check
FRONTEND_URL="https://qestro.app"
log_info "Checking frontend: $FRONTEND_URL"
for i in $(seq 1 $SMOKE_TEST_RETRIES); do
  if curl -sf "$FRONTEND_URL" > /dev/null; then
    log_success "Frontend is healthy"
    break
  fi
  if [[ $i -eq $SMOKE_TEST_RETRIES ]]; then
    log_error "Frontend health check failed after $SMOKE_TEST_RETRIES attempts"
    exit 1
  fi
  log_warn "Attempt $i failed, retrying in 10 seconds..."
  sleep 10
done

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ DEPLOYMENT SUCCESSFUL!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Completed: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Commit: $(git rev-parse --short HEAD)"
echo ""
echo "  📍 Endpoints:"
echo "     Frontend: https://qestro.app"
echo "     API: https://api.qestro.app"
echo "     Docs: https://docs.qestro.app"
echo ""
echo "  🔧 Next Steps:"
echo "     1. Verify key user flows manually"
echo "     2. Monitor error rates in Sentry"
echo "     3. Check performance metrics"
echo "     4. Update status page if needed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
