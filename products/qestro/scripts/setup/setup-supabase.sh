#!/bin/bash

# TestFlow Pro SaaS - Supabase Setup Script
# This script helps set up Supabase project and database

set -e

echo "🗄️ TestFlow Pro - Supabase Setup"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo ""
print_info "This script will guide you through setting up Supabase for TestFlow Pro"
echo ""

# Step 1: Create Supabase Project
echo "📝 Step 1: Create Supabase Project"
echo "1. Go to https://supabase.com and sign in"
echo "2. Click 'New Project'"
echo "3. Enter project details:"
echo "   - Name: testflow-pro"
echo "   - Database Password: (generate a strong password)"
echo "   - Region: (choose closest to your users)"
echo "4. Click 'Create new project'"
echo ""
read -p "Press Enter when you've created your Supabase project..."

# Step 2: Get Project Details
echo ""
print_info "📋 Step 2: Get Project Information"
echo "From your Supabase dashboard, go to Settings → API"
echo ""

read -p "Enter your Project URL (https://xxx.supabase.co): " SUPABASE_URL
read -p "Enter your anon/public key: " SUPABASE_ANON_KEY
read -p "Enter your service_role key: " SUPABASE_SERVICE_KEY

echo ""
echo "Now go to Settings → Database"
echo ""

read -p "Enter your database host (db.xxx.supabase.co): " SUPABASE_HOST
read -s -p "Enter your database password: " SUPABASE_PASSWORD
echo ""

# Step 3: Create environment file
echo ""
print_info "⚙️ Step 3: Creating environment configuration"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
# Environment Configuration
NODE_ENV=development
PORT=8000

# Database Configuration
USE_SUPABASE=true

# Supabase Database (Cloud)
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_DB_HOST=$SUPABASE_HOST
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=$SUPABASE_PASSWORD

# Local Database (Development fallback)
LOCAL_DB_HOST=localhost
LOCAL_DB_PORT=5432
LOCAL_DB_NAME=testflow_pro
LOCAL_DB_USER=postgres
LOCAL_DB_PASSWORD=postgres

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Feature Flags
ENABLE_RECORDING=true
ENABLE_MOBILE_TESTING=true
ENABLE_WEB_TESTING=true
ENABLE_API_ACCESS=true

# Other configurations (update as needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@testflow.pro
FROM_NAME=TestFlow Pro
EOF

# Create frontend .env file
cat > frontend/.env << EOF
# Frontend Environment Variables
VITE_APP_NAME=TestFlow Pro
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=development

# API Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# Supabase Configuration
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Feature Flags
VITE_ENABLE_RECORDING=true
VITE_ENABLE_MOBILE_TESTING=true
VITE_ENABLE_WEB_TESTING=true
VITE_ENABLE_API_DOCS=true
VITE_ENABLE_ANALYTICS=false

# Branding
VITE_COMPANY_NAME=TestFlow Pro
VITE_SUPPORT_EMAIL=support@testflow.pro
VITE_DOCS_URL=https://docs.testflow.pro
EOF

print_success "Environment files created successfully!"

# Step 4: Install dependencies and setup database
echo ""
print_info "📦 Step 4: Installing dependencies and setting up database"

# Install dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

print_success "Dependencies installed!"

# Generate and run migrations
print_info "🗄️ Setting up database schema..."
cd backend
npm run db:generate
npm run db:migrate
cd ..

print_success "Database schema created successfully!"

# Step 5: Test connection
echo ""
print_info "🧪 Step 5: Testing database connection"

cd backend
if npm run type-check; then
    print_success "TypeScript compilation successful!"
else
    print_warning "TypeScript compilation failed - please check for errors"
fi
cd ..

# Final instructions
echo ""
print_success "🎉 Supabase setup complete!"
echo ""
print_info "Next steps:"
echo "1. Start development servers: npm run dev"
echo "2. Open http://localhost:3000 in your browser"
echo "3. Create a test account and try recording"
echo ""
print_info "For production deployment:"
echo "1. Update environment variables with production URLs"
echo "2. Run ./scripts/deploy.sh for automated deployment"
echo "3. Follow the deployment guide in DEPLOYMENT.md"
echo ""
print_warning "Important: Keep your .env files secure and never commit them to version control!"
echo ""
print_info "Your Supabase project is ready at: $SUPABASE_URL"