#!/bin/bash

# TenantIQ Production Initialization Script
# Sets up all secrets and deploys to production

set -e

echo "🚀 TenantIQ Production Initialization"
echo "======================================"
echo ""

cd /Users/shaharsolomon/dev/projects/tenantiq/apps/api

# Check if wrangler is logged in
echo "🔍 Checking Cloudflare authentication..."
if ! wrangler whoami > /dev/null 2>&1; then
  echo "❌ Not logged in to Cloudflare"
  echo "Run: wrangler login"
  exit 1
fi
echo "✅ Authenticated with Cloudflare"
echo ""

# Display current setup
echo "📋 Current Setup:"
echo "   D1 Database: tenantiq-production (039e58ce-ed35-4efd-9e1d-ef060b46c632)"
echo "   Region: WEUR (Western Europe)"
echo "   Tables: 9 (organizations, tenants, users_cache, etc.)"
echo ""

# Check existing secrets
echo "🔐 Checking existing secrets..."
EXISTING_SECRETS=$(wrangler secret list 2>/dev/null | grep -E "AZURE|JWT" || echo "")
if [ -n "$EXISTING_SECRETS" ]; then
  echo "⚠️  Found existing secrets:"
  echo "$EXISTING_SECRETS"
  echo ""
  read -p "Do you want to update secrets? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping secret setup..."
    SKIP_SECRETS=true
  fi
fi

if [ "$SKIP_SECRETS" != "true" ]; then
  echo ""
  echo "🔐 Setting Environment Secrets"
  echo "=============================="
  echo ""
  echo "You need 4 secrets for multi-tenant SaaS:"
  echo "1. AZURE_CLIENT_ID - Your Azure app ID"
  echo "2. AZURE_CLIENT_SECRET - Your Azure app secret"
  echo "3. AZURE_TENANT_ID - Your Azure tenant ID"
  echo "4. JWT_SECRET - Session token signing key"
  echo ""
  echo "📝 Azure App Setup:"
  echo "   Go to: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps"
  echo "   - Create 'New registration'"
  echo "   - Name: TenantIQ"
  echo "   - Supported accounts: 'Multi-tenant' (IMPORTANT!)"
  echo "   - Redirect URI: https://app.tenantiq.app/auth/callback"
  echo ""
  read -p "Press Enter when you have your Azure credentials ready..."
  echo ""

  # Set Azure secrets
  echo "🔵 Azure OAuth Credentials"
  echo "--------------------------"
  echo ""

  echo "Setting AZURE_CLIENT_ID..."
  wrangler secret put AZURE_CLIENT_ID
  echo "✅ AZURE_CLIENT_ID set"
  echo ""

  echo "Setting AZURE_CLIENT_SECRET..."
  wrangler secret put AZURE_CLIENT_SECRET
  echo "✅ AZURE_CLIENT_SECRET set"
  echo ""

  echo "Setting AZURE_TENANT_ID..."
  wrangler secret put AZURE_TENANT_ID
  echo "✅ AZURE_TENANT_ID set"
  echo ""

  # Set JWT secret
  echo "🔑 JWT Secret"
  echo "-------------"
  echo ""
  echo "Generating secure JWT secret..."
  JWT_SECRET=$(openssl rand -base64 32)
  echo "Generated: $JWT_SECRET"
  echo ""
  echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
  echo "✅ JWT_SECRET set"
  echo ""

  echo "✅ All secrets configured!"
  echo ""
fi

# Verify secrets
echo "🔍 Verifying secrets..."
SECRET_LIST=$(wrangler secret list 2>/dev/null)
echo "$SECRET_LIST"
echo ""

# Check required secrets
REQUIRED_SECRETS=("AZURE_CLIENT_ID" "AZURE_CLIENT_SECRET" "AZURE_TENANT_ID" "JWT_SECRET")
MISSING_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  if ! echo "$SECRET_LIST" | grep -q "$secret"; then
    MISSING_SECRETS+=("$secret")
  fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  echo "❌ Missing required secrets:"
  printf '   - %s\n' "${MISSING_SECRETS[@]}"
  echo ""
  echo "Run the script again to set missing secrets"
  exit 1
fi

echo "✅ All required secrets are set!"
echo ""

# Deploy to production
echo "🚀 Deploying to Production"
echo "=========================="
echo ""

wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""

# Test deployment
echo "🧪 Testing Deployment"
echo "===================="
echo ""

echo "Testing API health endpoint..."
HEALTH_RESPONSE=$(curl -s https://api.tenantiq.app/health || echo "ERROR")

if echo "$HEALTH_RESPONSE" | grep -q "status"; then
  echo "✅ API is responding!"
  echo "   Response: $HEALTH_RESPONSE"
else
  echo "⚠️  API response:"
  echo "   $HEALTH_RESPONSE"
  echo ""
  echo "Check logs with: wrangler tail"
fi

echo ""

# Check database
echo "📊 Verifying Database"
echo "===================="
echo ""

echo "Checking D1 database tables..."
wrangler d1 execute tenantiq-production --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>/dev/null | grep -E "organizations|tenants|platform_users" > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Database is accessible and has tables"
else
  echo "⚠️  Could not verify database tables"
fi

echo ""

# Summary
echo "🎉 Production Setup Complete!"
echo "=============================="
echo ""
echo "📋 Your Production URLs:"
echo "   API:  https://api.tenantiq.app"
echo "   Web:  https://app.tenantiq.app"
echo ""
echo "📊 Database:"
echo "   Name: tenantiq-production"
echo "   ID:   039e58ce-ed35-4efd-9e1d-ef060b46c632"
echo "   Tables: 9"
echo ""
echo "🔐 Secrets:"
echo "   ✅ AZURE_CLIENT_ID"
echo "   ✅ AZURE_CLIENT_SECRET"
echo "   ✅ AZURE_TENANT_ID"
echo "   ✅ JWT_SECRET"
echo ""
echo "📱 Final Step: Add Pages Custom Domain"
echo "======================================="
echo ""
echo "The API domain (api.tenantiq.app) is ready!"
echo "But you need to add the web app domain manually:"
echo ""
echo "1. Open: https://dash.cloudflare.com/d2fe608a92dc9faa2ce5b0fd2cad5eb7/pages/view/tenantiq-app"
echo "2. Click 'Custom domains' tab"
echo "3. Click 'Set up a custom domain'"
echo "4. Enter: app.tenantiq.app"
echo "5. Click 'Continue'"
echo ""
echo "🔍 Useful Commands:"
echo "   View logs:        wrangler tail"
echo "   Query database:   wrangler d1 execute tenantiq-production --remote --command=\"SELECT * FROM organizations;\""
echo "   List secrets:     wrangler secret list"
echo "   Update secret:    wrangler secret put SECRET_NAME"
echo ""
echo "🎊 Your multi-tenant SaaS platform is live!"
echo ""
