#!/bin/bash

################################################################################
# Qestro Production Setup Script
#
# This script automates the setup of Qestro for production deployment
# Run this script before deploying to production for the first time
#
# Usage: ./scripts/setup-production.sh
################################################################################

set -e  # Exit on error

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

# Banner
echo "=================================================="
echo "   🚀 Qestro Production Setup"
echo "=================================================="
echo ""

# Check if running from project root
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

log_info "Starting production setup process..."
echo ""

################################################################################
# STEP 1: Prerequisites Check
################################################################################
log_info "Step 1/10: Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi
log_success "Node.js version check passed: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
fi
log_success "npm version: $(npm -v)"

# Check Git
if ! command -v git &> /dev/null; then
    log_warning "Git is not installed. Some features may not work."
else
    log_success "Git version: $(git --version)"
fi

echo ""

################################################################################
# STEP 2: Environment Variables Setup
################################################################################
log_info "Step 2/10: Setting up environment variables..."

if [ ! -f ".env" ]; then
    log_warning ".env file not found. Creating from template..."

    cat > .env << 'EOF'
# Qestro Production Environment Variables
# Generated: $(date)

# ============================================
# CORE CONFIGURATION
# ============================================
NODE_ENV=production
PORT=10000
HOST=0.0.0.0

# ============================================
# DOMAIN CONFIGURATION
# ============================================
FRONTEND_URL=https://qestro.app
API_BASE_URL=https://api.qestro.app
DOMAIN=qestro.app
CORS_ORIGIN=https://qestro.app,https://qestro.io

# ============================================
# DATABASE CONFIGURATION
# ============================================
# Get this from Supabase dashboard: https://app.supabase.com
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
USE_SUPABASE=true
RUN_MIGRATIONS=true
DATABASE_POOL_SIZE=20

# ============================================
# SECURITY & AUTHENTICATION
# ============================================
# Generate with: openssl rand -base64 32
JWT_SECRET=CHANGE_ME_GENERATE_RANDOM_SECRET
JWT_REFRESH_SECRET=CHANGE_ME_GENERATE_RANDOM_SECRET
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# ============================================
# EMAIL CONFIGURATION
# ============================================
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@qestro.app
SUPPORT_EMAIL=support@qestro.app

# ============================================
# PAYMENT INTEGRATION
# ============================================
# Stripe (Primary) - Get from: https://dashboard.stripe.com
STRIPE_API_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TAX_ENABLED=true

# LemonSqueezy (Alternative) - Get from: https://app.lemonsqueezy.com
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_VARIANT_ID_PRO=
LEMONSQUEEZY_VARIANT_ID_ENTERPRISE=

# ============================================
# AI SERVICES
# ============================================
# OpenAI - Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.3

# Hugging Face (Optional) - Get from: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=

# ============================================
# REDIS CONFIGURATION
# ============================================
# Get from Render.com or other Redis provider
REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379

# ============================================
# FILE STORAGE (AWS S3)
# ============================================
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-west-2
AWS_S3_BUCKET=qestro-storage

# ============================================
# FEATURE FLAGS
# ============================================
ENABLE_RECORDING=true
ENABLE_MOBILE_TESTING=true
ENABLE_WEB_TESTING=true
ENABLE_AI_GENERATION=true
ENABLE_PLUGIN_SYSTEM=true
ENABLE_ZERO_SYNC=true

# ============================================
# MONITORING & LOGGING
# ============================================
LOG_LEVEL=info
ENABLE_METRICS=true
SENTRY_DSN=
NEW_RELIC_LICENSE_KEY=

# ============================================
# PERFORMANCE
# ============================================
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=1000
REQUEST_TIMEOUT=30000
BODY_LIMIT=50mb

EOF

    log_success ".env file created. Please update with your actual values!"
    log_warning "IMPORTANT: You MUST update the .env file with real values before deployment"
else
    log_success ".env file already exists"
fi

# Check for critical environment variables
CRITICAL_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
)

MISSING_VARS=()
for var in "${CRITICAL_VARS[@]}"; do
    if ! grep -q "^${var}=" .env 2>/dev/null || grep -q "^${var}=CHANGE_ME" .env 2>/dev/null; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_warning "The following critical variables need to be configured:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
fi

echo ""

################################################################################
# STEP 3: Generate Secrets
################################################################################
log_info "Step 3/10: Generating secure secrets..."

if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)

    echo ""
    log_success "Generated JWT secrets (add these to your .env):"
    echo "JWT_SECRET=$JWT_SECRET"
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
    echo ""
else
    log_warning "OpenSSL not found. Please generate secrets manually."
fi

echo ""

################################################################################
# STEP 4: Install Dependencies
################################################################################
log_info "Step 4/10: Installing dependencies..."

npm install --legacy-peer-deps
log_success "Root dependencies installed"

cd backend
npm install --legacy-peer-deps
log_success "Backend dependencies installed"
cd ..

cd frontend
npm install --legacy-peer-deps
log_success "Frontend dependencies installed"
cd ..

echo ""

################################################################################
# STEP 5: Build Applications
################################################################################
log_info "Step 5/10: Building applications..."

cd backend
npm run build
log_success "Backend built successfully"
cd ..

cd frontend
npm run build
log_success "Frontend built successfully"
cd ..

echo ""

################################################################################
# STEP 6: Database Setup
################################################################################
log_info "Step 6/10: Setting up database..."

if grep -q "DATABASE_URL=postgresql" .env 2>/dev/null; then
    log_info "Running database migrations..."
    cd backend
    npm run db:migrate || log_warning "Database migration failed. Run manually if needed."
    log_success "Database setup complete"
    cd ..
else
    log_warning "DATABASE_URL not configured. Skipping database setup."
fi

echo ""

################################################################################
# STEP 7: Security Audit
################################################################################
log_info "Step 7/10: Running security audit..."

npm audit --audit-level=high || log_warning "Security vulnerabilities found. Review with 'npm audit'"
log_success "Security audit complete"

echo ""

################################################################################
# STEP 8: Type Checking
################################################################################
log_info "Step 8/10: Running type checks..."

cd backend
npm run type-check || log_warning "Backend type check failed"
cd ..

cd frontend
npm run type-check || log_warning "Frontend type check failed"
cd ..

log_success "Type checking complete"

echo ""

################################################################################
# STEP 9: Legal Documents Setup
################################################################################
log_info "Step 9/10: Checking legal documents..."

LEGAL_DOCS=(
    "legal/terms-of-service.md"
    "legal/privacy-policy.md"
    "legal/cookie-policy.md"
)

MISSING_LEGAL=()
for doc in "${LEGAL_DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        MISSING_LEGAL+=("$doc")
    fi
done

if [ ${#MISSING_LEGAL[@]} -gt 0 ]; then
    log_warning "The following legal documents are missing:"
    for doc in "${MISSING_LEGAL[@]}"; do
        echo "  - $doc"
    done
    log_info "Consider using Termly.io or Iubenda.com to generate these documents"
else
    log_success "All legal documents present"
fi

echo ""

################################################################################
# STEP 10: Production Checklist
################################################################################
log_info "Step 10/10: Production readiness checklist..."

echo ""
echo "=================================================="
echo "   📋 PRODUCTION READINESS CHECKLIST"
echo "=================================================="
echo ""

CHECKLIST=(
    "Environment variables configured in .env"
    "Database URL configured (Supabase or PostgreSQL)"
    "JWT secrets generated and set"
    "Stripe API keys configured"
    "Email service configured (SMTP)"
    "Domain names purchased (qestro.app, qestro.io)"
    "DNS records configured"
    "SSL certificates ready (automatic with Render)"
    "Legal documents created (Terms, Privacy, etc.)"
    "Payment webhooks configured"
    "Monitoring setup (Sentry, New Relic, etc.)"
    "Backup strategy implemented"
    "Support email configured"
    "Status page setup (status.qestro.app)"
    "CI/CD pipeline configured"
)

echo "Please verify the following items:"
echo ""
for item in "${CHECKLIST[@]}"; do
    echo "[ ] $item"
done

echo ""
echo "=================================================="
echo "   📚 NEXT STEPS"
echo "=================================================="
echo ""
echo "1. Update .env file with real production values"
echo "2. Configure Stripe products and prices"
echo "3. Set up email templates in your email provider"
echo "4. Create legal documents (use PRODUCTION_READINESS_CHECKLIST.md)"
echo "5. Configure webhooks in Stripe dashboard"
echo "6. Set up monitoring and alerting"
echo "7. Deploy to Render.com using render.yaml"
echo "8. Configure custom domains in Render dashboard"
echo "9. Test payment flow end-to-end"
echo "10. Run final production tests"
echo ""
echo "📖 For detailed instructions, see:"
echo "   - PRODUCTION_READINESS_CHECKLIST.md"
echo "   - DEPLOYMENT.md"
echo ""

log_success "Production setup complete!"
echo ""
echo "⚠️  IMPORTANT: Review and update all configuration files before deploying!"
echo ""
