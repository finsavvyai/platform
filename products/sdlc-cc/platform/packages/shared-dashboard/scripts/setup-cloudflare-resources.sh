#!/bin/bash

set -e

echo "🚀 Setting up Cloudflare Resources for Unified Dashboard"
echo "========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Login check
print_info "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    print_warning "Not logged in to Cloudflare. Please login..."
    wrangler login
else
    print_success "Already authenticated with Cloudflare"
fi

echo ""
print_info "Creating Cloudflare resources..."
echo ""

# ============================================
# 1. Create D1 Databases
# ============================================
echo "📦 Step 1: Creating D1 Databases"
echo "--------------------------------"

# Production Database
print_info "Creating production D1 database..."
PROD_DB_OUTPUT=$(wrangler d1 create unified-dashboard-prod 2>&1 || echo "EXISTS")

if [[ $PROD_DB_OUTPUT == *"EXISTS"* ]] || [[ $PROD_DB_OUTPUT == *"already exists"* ]]; then
    print_warning "Production database already exists"
    # List databases to get ID
    PROD_DB_ID=$(wrangler d1 list | grep "unified-dashboard-prod" | awk '{print $2}')
else
    PROD_DB_ID=$(echo "$PROD_DB_OUTPUT" | grep "database_id" | awk -F'"' '{print $4}')
    print_success "Production database created"
fi

echo "   Database ID: $PROD_DB_ID"

# Staging Database
print_info "Creating staging D1 database..."
STAGING_DB_OUTPUT=$(wrangler d1 create unified-dashboard-staging 2>&1 || echo "EXISTS")

if [[ $STAGING_DB_OUTPUT == *"EXISTS"* ]] || [[ $STAGING_DB_OUTPUT == *"already exists"* ]]; then
    print_warning "Staging database already exists"
    STAGING_DB_ID=$(wrangler d1 list | grep "unified-dashboard-staging" | awk '{print $2}')
else
    STAGING_DB_ID=$(echo "$STAGING_DB_OUTPUT" | grep "database_id" | awk -F'"' '{print $4}')
    print_success "Staging database created"
fi

echo "   Database ID: $STAGING_DB_ID"

# Development Database
print_info "Creating development D1 database..."
DEV_DB_OUTPUT=$(wrangler d1 create unified-dashboard-dev 2>&1 || echo "EXISTS")

if [[ $DEV_DB_OUTPUT == *"EXISTS"* ]] || [[ $DEV_DB_OUTPUT == *"already exists"* ]]; then
    print_warning "Development database already exists"
    DEV_DB_ID=$(wrangler d1 list | grep "unified-dashboard-dev" | awk '{print $2}')
else
    DEV_DB_ID=$(echo "$DEV_DB_OUTPUT" | grep "database_id" | awk -F'"' '{print $4}')
    print_success "Development database created"
fi

echo "   Database ID: $DEV_DB_ID"
echo ""

# ============================================
# 2. Create KV Namespaces
# ============================================
echo "🗄️  Step 2: Creating KV Namespaces"
echo "--------------------------------"

# Production KV
print_info "Creating production KV namespace..."
PROD_KV_OUTPUT=$(wrangler kv:namespace create "DASHBOARD_CACHE" 2>&1 || echo "EXISTS")

if [[ $PROD_KV_OUTPUT == *"EXISTS"* ]] || [[ $PROD_KV_OUTPUT == *"already exists"* ]]; then
    print_warning "Production KV namespace already exists"
    PROD_KV_ID=$(wrangler kv:namespace list | grep "DASHBOARD_CACHE" | grep -v "preview" | awk '{print $2}')
else
    PROD_KV_ID=$(echo "$PROD_KV_OUTPUT" | grep "id = " | awk -F'"' '{print $2}')
    print_success "Production KV namespace created"
fi

echo "   KV Namespace ID: $PROD_KV_ID"

# Production KV Preview
print_info "Creating production KV namespace (preview)..."
PROD_KV_PREVIEW_OUTPUT=$(wrangler kv:namespace create "DASHBOARD_CACHE" --preview 2>&1 || echo "EXISTS")

if [[ $PROD_KV_PREVIEW_OUTPUT == *"EXISTS"* ]] || [[ $PROD_KV_PREVIEW_OUTPUT == *"already exists"* ]]; then
    print_warning "Production KV preview namespace already exists"
    PROD_KV_PREVIEW_ID=$(wrangler kv:namespace list | grep "DASHBOARD_CACHE" | grep "preview" | awk '{print $2}')
else
    PROD_KV_PREVIEW_ID=$(echo "$PROD_KV_PREVIEW_OUTPUT" | grep "id = " | awk -F'"' '{print $2}')
    print_success "Production KV preview namespace created"
fi

echo "   KV Preview ID: $PROD_KV_PREVIEW_ID"
echo ""

# ============================================
# 3. Create R2 Buckets
# ============================================
echo "📦 Step 3: Creating R2 Buckets"
echo "--------------------------------"

print_info "Creating R2 bucket for dashboard assets..."
R2_OUTPUT=$(wrangler r2 bucket create unified-dashboard-assets 2>&1 || echo "EXISTS")

if [[ $R2_OUTPUT == *"EXISTS"* ]] || [[ $R2_OUTPUT == *"already exists"* ]]; then
    print_warning "R2 bucket already exists"
else
    print_success "R2 bucket created: unified-dashboard-assets"
fi

echo ""

# ============================================
# 4. Generate Resource Configuration
# ============================================
echo "📝 Step 4: Generating Configuration"
echo "--------------------------------"

# Create a temporary file with the resource IDs
cat > .cloudflare-resources.json << EOF
{
  "databases": {
    "production": {
      "id": "$PROD_DB_ID",
      "name": "unified-dashboard-prod"
    },
    "staging": {
      "id": "$STAGING_DB_ID",
      "name": "unified-dashboard-staging"
    },
    "development": {
      "id": "$DEV_DB_ID",
      "name": "unified-dashboard-dev"
    }
  },
  "kv": {
    "production": {
      "id": "$PROD_KV_ID",
      "preview_id": "$PROD_KV_PREVIEW_ID"
    }
  },
  "r2": {
    "bucket": "unified-dashboard-assets"
  },
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

print_success "Resource configuration saved to .cloudflare-resources.json"

# ============================================
# 5. Update wrangler.toml
# ============================================
echo ""
echo "📝 Step 5: Updating wrangler.toml"
echo "--------------------------------"

# Backup original wrangler.toml
cp wrangler.toml wrangler.toml.backup
print_info "Created backup: wrangler.toml.backup"

# Create updated wrangler.toml
cat > wrangler.toml << EOF
name = "unified-dashboard-api"
main = "src/worker/index.ts"
compatibility_date = "2024-12-01"
node_compat = true

[observability]
enabled = true

# Production Environment
[env.production]
name = "unified-dashboard-api-prod"
routes = [
  { pattern = "dashboard.finsavvyai.com/*", zone_name = "finsavvyai.com" },
  { pattern = "api.dashboard.finsavvyai.com/*", zone_name = "finsavvyai.com" }
]

[[env.production.d1_databases]]
binding = "DASHBOARD_DB"
database_name = "unified-dashboard-prod"
database_id = "$PROD_DB_ID"

[[env.production.kv_namespaces]]
binding = "DASHBOARD_CACHE"
id = "$PROD_KV_ID"

[[env.production.r2_buckets]]
binding = "DASHBOARD_ASSETS"
bucket_name = "unified-dashboard-assets"

[[env.production.analytics_engine_datasets]]
binding = "DASHBOARD_ANALYTICS"

[[env.production.durable_objects.bindings]]
name = "DASHBOARD_REALTIME"
class_name = "DashboardRealtime"
script_name = "unified-dashboard-api-prod"

[env.production.vars]
ENVIRONMENT = "production"
API_VERSION = "v1"
ENABLE_ANALYTICS = "true"
ENABLE_CACHING = "true"
CACHE_TTL = "300"
RATE_LIMIT_PER_MINUTE = "120"
CORS_ALLOWED_ORIGINS = "https://dashboard.finsavvyai.com,https://app.finsavvyai.com"

# Staging Environment
[env.staging]
name = "unified-dashboard-api-staging"

[[env.staging.d1_databases]]
binding = "DASHBOARD_DB"
database_name = "unified-dashboard-staging"
database_id = "$STAGING_DB_ID"

[[env.staging.kv_namespaces]]
binding = "DASHBOARD_CACHE"
id = "$PROD_KV_ID"

[[env.staging.r2_buckets]]
binding = "DASHBOARD_ASSETS"
bucket_name = "unified-dashboard-assets"

[[env.staging.analytics_engine_datasets]]
binding = "DASHBOARD_ANALYTICS"

[[env.staging.durable_objects.bindings]]
name = "DASHBOARD_REALTIME"
class_name = "DashboardRealtime"
script_name = "unified-dashboard-api-staging"

[env.staging.vars]
ENVIRONMENT = "staging"
API_VERSION = "v1"
ENABLE_ANALYTICS = "true"
ENABLE_CACHING = "true"
CACHE_TTL = "60"
RATE_LIMIT_PER_MINUTE = "60"

# Development Environment
[env.development]
name = "unified-dashboard-api-dev"

[[env.development.d1_databases]]
binding = "DASHBOARD_DB"
database_name = "unified-dashboard-dev"
database_id = "$DEV_DB_ID"

[[env.development.kv_namespaces]]
binding = "DASHBOARD_CACHE"
id = "$PROD_KV_ID"
preview_id = "$PROD_KV_PREVIEW_ID"

[[env.development.r2_buckets]]
binding = "DASHBOARD_ASSETS"
bucket_name = "unified-dashboard-assets"

[[env.development.analytics_engine_datasets]]
binding = "DASHBOARD_ANALYTICS"

[[env.development.durable_objects.bindings]]
name = "DASHBOARD_REALTIME"
class_name = "DashboardRealtime"
script_name = "unified-dashboard-api-dev"

[env.development.vars]
ENVIRONMENT = "development"
API_VERSION = "v1"
ENABLE_ANALYTICS = "false"
ENABLE_CACHING = "true"
CACHE_TTL = "30"
RATE_LIMIT_PER_MINUTE = "1000"

# Service bindings to all products
[[services]]
binding = "PIPEWARDEN"
service = "pipewarden-api-gateway"
environment = "production"

[[services]]
binding = "QUANTUMBEAM"
service = "quantumbeam-worker"
environment = "production"

[[services]]
binding = "MCPOVERFLOW"
service = "mcpoverflow-main"
environment = "production"

[[services]]
binding = "QESTRO"
service = "questro-platform-worker"
environment = "production"

[[services]]
binding = "SDLC"
service = "sdlc-gateway-worker"
environment = "production"

[[services]]
binding = "QUERYFLUX"
service = "queryflux-main"
environment = "production"

[[services]]
binding = "UPM"
service = "upm-worker"
environment = "production"

[[services]]
binding = "YALLABYE"
service = "yallabye-worker"
environment = "production"

# Durable Object Migrations
[[migrations]]
tag = "v1"
new_classes = ["DashboardRealtime"]

# Static Assets
[site]
bucket = "./public"

# Build Configuration
[build]
command = "npm run build:worker"
cwd = "."
watch_dirs = ["src"]

[build.upload]
format = "modules"
dir = "dist"
main = "./index.js"
EOF

print_success "wrangler.toml updated with real resource IDs"

# ============================================
# Summary
# ============================================
echo ""
echo "========================================================="
echo "✅ Cloudflare Resources Setup Complete!"
echo "========================================================="
echo ""
echo "📊 Resources Created:"
echo ""
echo "  D1 Databases:"
echo "    • Production:  $PROD_DB_ID"
echo "    • Staging:     $STAGING_DB_ID"
echo "    • Development: $DEV_DB_ID"
echo ""
echo "  KV Namespaces:"
echo "    • Production:  $PROD_KV_ID"
echo "    • Preview:     $PROD_KV_PREVIEW_ID"
echo ""
echo "  R2 Buckets:"
echo "    • unified-dashboard-assets"
echo ""
echo "📝 Files Updated:"
echo "  • wrangler.toml (backup: wrangler.toml.backup)"
echo "  • .cloudflare-resources.json (resource IDs)"
echo ""
echo "🔒 Next Steps:"
echo ""
echo "  1. Set production secrets:"
echo "     wrangler secret put JWT_SECRET --env=production"
echo ""
echo "  2. Run database migrations:"
echo "     ./scripts/migrate.sh production"
echo ""
echo "  3. Deploy to development:"
echo "     npm run deploy:worker -- --env=development"
echo ""
echo "  4. Test deployment:"
echo "     npm run test:smoke"
echo ""
print_success "Setup complete! 🎉"
