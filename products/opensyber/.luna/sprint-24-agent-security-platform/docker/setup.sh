#!/bin/bash
# OpenSyber Docker Setup Script

set -e

echo "🐳 OpenSyber Docker Setup"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   https://www.docker.com/products/docker-desktop/"
    exit 1
fi

echo "✅ Docker found: $(docker --version)"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm not found. Installing..."
    npm install -g pnpm@10.6.2
fi

echo "✅ pnpm found: $(pnpm --version)"
echo ""

# Navigate to docker directory
DOCKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DOCKER_DIR"

echo "📦 Setting up mock API..."
if [ ! -d "node_modules" ]; then
    npm init -y > /dev/null 2>&1
    npm install express cors > /dev/null 2>&1
    echo "✅ Mock API dependencies installed"
else
    echo "✅ Mock API already set up"
fi
echo ""

# Check for .env.local
ENV_FILE="$DOCKER_DIR/../../.env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  No .env.local file found."
    echo ""
    echo "Creating .env.local with default values..."
    cat > "$ENV_FILE" << 'ENVEOF'
# OpenSyber Environment Configuration
# Copy this file to .env.local and fill in your actual values

# Clerk Authentication
# Get these from: https://dashboard.clerk.com/
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
CLERK_SECRET_KEY=sk_test_placeholder
CLERK_WEBHOOK_SECRET=whsec_placeholder

# Resend API (for emails)
RESEND_API_KEY=re_placeholder

# LemonSqueezy (for payments)
LEMONSQUEEZY_API_KEY=placeholder
LEMONSQUEEZY_WEBHOOK_SECRET=placeholder
LEMONSQUEEZY_STORE_ID=placeholder
OPENSYBER_LS_PRODUCT_ID=placeholder
OPENSYBER_LS_VARIANT_PERSONAL=placeholder
OPENSYBER_LS_VARIANT_PRO=placeholder
OPENSYBER_LS_VARIANT_TEAM=placeholder

# Hetzner (for agent runtime)
HETZNER_API_TOKEN=placeholder

# Encryption Key (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=replace-with-32-character-random-key

# Environment
ENVIRONMENT=development
NODE_ENV=development
ENVEOF
    echo "✅ Created .env.local at project root"
    echo ""
    echo "⚠️  Please edit .env.local and add your actual API keys!"
else
    echo "✅ .env.local found"
fi
echo ""

echo "🏗️  Building Docker images..."
cd "$DOCKER_DIR/../.."
docker-compose -f .luna/sprint-24-agent-security-platform/docker/docker-compose.yml build > /dev/null 2>&1
echo "✅ Docker images built"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Quick start:"
echo "  cd .luna/sprint-24-agent-security-platform/docker"
echo "  make dev"
echo ""
echo "Services will be available at:"
echo "  • OpenSyber Web:  http://localhost:3000"
echo "  • TokenForge:     http://localhost:3001"
echo "  • Mock API:       http://localhost:8787"
echo ""
echo "For more information, see QUICKSTART.md"
echo ""
