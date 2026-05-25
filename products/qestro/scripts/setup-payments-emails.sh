#!/bin/bash

# Payment and Email Setup Script for qestro Platform
# This script helps configure Lemon Squeezy and SendGrid integrations

set -e

echo "🚀 qestro Payment & Email Setup Script"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "\n${BLUE}📋 Step $1: $2${NC}"
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

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
    else
        print_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# Check prerequisites
print_step "1" "Checking prerequisites"
check_command "node"
check_command "npm"
echo -e "${BLUE}Node.js version: ${NC}$(node --version)"
echo -e "${BLUE}npm version: ${NC}$(npm --version)"

# Install required dependencies
print_step "2" "Installing required dependencies"
echo "Installing Node.js packages..."

# Backend dependencies
echo "📦 Installing backend dependencies..."
cd backend

# Check if dependencies are already installed
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "Backend dependencies already installed"
fi

# Install specific packages for payments and emails
echo "Installing payment and email packages..."
npm install axios node-fetch @types/node-fetch @lemonsqueezy/lemonsqueezy.js

cd ..

# Frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend

# Install Lemon Squeezy frontend library
npm install @lemonsqueezy/lemonsqueezy.js

cd ..

print_success "Dependencies installed successfully"

# Create environment file templates
print_step "3" "Creating environment configuration files"

# Backend environment file
BACKEND_ENV_FILE="backend/.env"
if [ ! -f "$BACKEND_ENV_FILE" ]; then
    echo "Creating backend environment file..."
    cat > "$BACKEND_ENV_FILE" << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/qestro
USE_SUPABASE=true

# Lemon Squeezy Configuration
LEMONSQUEEZY_API_KEY=lmsq_sk_your_api_key_here
LEMONSQUEEZY_STORE_ID=your_store_id_here
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret_here

# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@qestro.io
SENDGRID_FROM_NAME=qestro
SENDGRID_REPLY_TO_EMAIL=support@qestro.io

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

# Application Configuration
NODE_ENV=development
PORT=8000
FRONTEND_URL=https://qestro.app

# API Keys for AI Services
OPENAI_API_KEY=your_openai_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
EOF
    print_success "Backend environment file created"
else
    print_warning "Backend environment file already exists"
fi

# Frontend environment file
FRONTEND_ENV_FILE="frontend/.env"
if [ ! -f "$FRONTEND_ENV_FILE" ]; then
    echo "Creating frontend environment file..."
    cat > "$FRONTEND_ENV_FILE" << 'EOF'
# Lemon Squeezy Frontend Configuration
VITE_LEMONSQUEEZY_STORE_ID=your_store_id_here
VITE_LEMONSQUEEZY_FREE_VARIANT_ID=
VITE_LEMONSQUEEZY_PRO_VARIANT_ID=qs-qestro-professional-monthly
VITE_LEMONSQUEEZY_ENTERPRISE_VARIANT_ID=qs-qestro-enterprise-monthly
VITE_LEMONSQUEEZY_EARLY_ACCESS_VARIANT_ID=qs-qestro-early-access-lifetime

# API Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# Application Configuration
VITE_APP_NAME=qestro
VITE_APP_DESCRIPTION=AI-Powered Test Automation Platform
EOF
    print_success "Frontend environment file created"
else
    print_warning "Frontend environment file already exists"
fi

# Create database migration scripts
print_step "4" "Creating database migrations"

MIGRATION_DIR="backend/migrations"
mkdir -p "$MIGRATION_DIR"

# Users table
cat > "$MIGRATION_DIR/001_create_users.sql" << 'EOF'
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'free',
    access_level VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(subscription_tier);
EOF

# Subscriptions table
cat > "$MIGRATION_DIR/002_create_subscriptions.sql" << 'EOF'
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    subscription_id VARCHAR(255) UNIQUE NOT NULL,
    user_email VARCHAR(255) NOT NULL REFERENCES users(email),
    customer_name VARCHAR(255),
    subscription_tier VARCHAR(50) NOT NULL,
    variant_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMP,
    payment_status VARCHAR(50) DEFAULT 'pending',
    last_payment_at TIMESTAMP,
    last_payment_failed_at TIMESTAMP,
    limits JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON user_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_id ON user_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON user_subscriptions(status);
EOF

# Orders table
cat > "$MIGRATION_DIR/003_create_orders.sql" << 'EOF'
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    user_email VARCHAR(255) NOT NULL REFERENCES users(email),
    customer_name VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    subscription_tier VARCHAR(50),
    variant_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(user_email);
CREATE INDEX IF NOT EXISTS idx_orders_id ON orders(order_id);
EOF

# Conversion events table
cat > "$MIGRATION_DIR/004_create_conversion_events.sql" << 'EOF'
CREATE TABLE IF NOT EXISTS conversion_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversion_events_email ON conversion_events(email);
CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(event_type);
EOF

print_success "Database migrations created"

# Create test scripts
print_step "5" "Creating test scripts"

TEST_DIR="backend/test"
mkdir -p "$TEST_DIR"

# Email test script
cat > "$TEST_DIR/test-email.js" << 'EOF'
const { SendGridService } = require('../src/services/SendGridService');

async function testEmail() {
  const emailService = new SendGridService({
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
    fromName: 'qestro'
  });

  try {
    const result = await emailService.testConfiguration('test@example.com');
    console.log('Email test result:', result);
  } catch (error) {
    console.error('Email test failed:', error);
  }
}

testEmail();
EOF

# Lemon Squeezy test script
cat > "$TEST_DIR/test-lemonsqueezy.js" << 'EOF'
const { LemonSqueezyService } = require('../src/services/LemonSqueezyService');

async function testLemonSqueezy() {
  const lemonSqueezy = new LemonSqueezyService();

  try {
    // Test getting products
    const products = await lemonSqueezy.getProducts();
    console.log('Products:', products);

    // Test webhook verification
    const payload = '{"test": "data"}';
    const signature = 'test_signature';
    const isValid = lemonSqueezy.verifyWebhookSignature(payload, signature);
    console.log('Webhook signature test:', isValid);
  } catch (error) {
    console.error('Lemon Squeezy test failed:', error);
  }
}

testLemonSqueezy();
EOF

print_success "Test scripts created"

# Create deployment scripts
print_step "6" "Creating deployment scripts"

DEPLOY_DIR="scripts"
mkdir -p "$DEPLOY_DIR"

# Production deployment script
cat > "$DEPLOY_DIR/deploy-payments.sh" << 'EOF'
#!/bin/bash

echo "🚀 Deploying qestro Payment & Email Services"
echo "=========================================="

# Build backend
echo "📦 Building backend..."
cd backend
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Test services
echo "🧪 Testing services..."
node test/test-email.js
node test/test-lemonsqueezy.js

echo "✅ Deployment completed!"
EOF

chmod +x "$DEPLOY_DIR/deploy-payments.sh"

print_success "Deployment script created"

# Create configuration validation script
print_step "7" "Creating configuration validation"

cat > "$DEPLOY_DIR/validate-config.js" << 'EOF'
const fs = require('fs');
require('dotenv').config();

console.log('🔍 Validating qestro Configuration');
console.log('==================================');

const requiredEnvVars = [
  'LEMONSQUEEZY_API_KEY',
  'LEMONSQUEEZY_STORE_ID',
  'LEMONSQUEEZY_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'DATABASE_URL'
];

const optionalEnvVars = [
  'OPENAI_API_KEY',
  'HUGGINGFACE_API_KEY'
];

let allValid = true;

// Check required variables
console.log('\n📋 Required Environment Variables:');
requiredEnvVars.forEach(variable => {
  const value = process.env[variable];
  if (value && value !== 'your_api_key_here' && value !== 'your_store_id_here') {
    console.log(`✅ ${variable}: ✓`);
  } else {
    console.log(`❌ ${variable}: ✗ (not configured)`);
    allValid = false;
  }
});

// Check optional variables
console.log('\n📋 Optional Environment Variables:');
optionalEnvVars.forEach(variable => {
  const value = process.env[variable];
  if (value && value !== 'your_openai_api_key_here') {
    console.log(`✅ ${variable}: ✓`);
  } else {
    console.log(`⚠️  ${variable}: - (optional)`);
  }
});

// Check file existence
console.log('\n📁 Required Files:');
const requiredFiles = [
  'backend/.env',
  'frontend/.env'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: ✓`);
  } else {
    console.log(`❌ ${file}: ✗ (not found)`);
    allValid = false;
  }
});

// Final result
console.log('\n🎯 Validation Result:');
if (allValid) {
  console.log('✅ All required configurations are valid!');
  console.log('\n🚀 You can now start the application:');
  console.log('   cd backend && npm start');
  console.log('   cd frontend && npm run dev');
} else {
  console.log('❌ Some configurations are missing.');
  console.log('\n📝 Please configure the missing items above.');
  console.log('\n📚 See the integration guide for detailed instructions:');
  console.log('   https://github.com/your-repo/qestro/blob/main/LEMONSQUEEZY_AND_SENDGRID_INTEGRATION.md');
}
EOF

print_success "Configuration validation script created"

# Final instructions
print_step "8" "Setup completed successfully!"

echo -e "\n${GREEN}🎉 Setup completed successfully!${NC}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo "1. 📝 Configure your Lemon Squeezy account and products"
echo "2. 📧 Configure your SendGrid account and email templates"
echo "3. 🔑 Update environment variables with your API keys"
echo "4. 🗄️ Run database migrations"
echo "5. 🧪 Test the integrations"
echo "6. 🚀 Deploy to production"

echo -e "\n${YELLOW}⚠️  Important Notes:${NC}"
echo "- Replace placeholder values in .env files with your actual API keys"
echo "- Create products in Lemon Squeezy with 'qs-' prefix"
echo "- Set up email templates in SendGrid dashboard"
echo "- Configure webhooks in Lemon Squeezy dashboard"

echo -e "\n${BLUE}📚 Resources:${NC}"
echo "- Integration Guide: ./LEMONSQUEEZY_AND_SENDGRID_INTEGRATION.md"
echo "- Configuration Validation: npm run validate-config"
echo "- Test Services: cd backend && node test/test-email.js"

echo -e "\n${GREEN}✅ Ready to enable payments and emails for qestro!${NC}"