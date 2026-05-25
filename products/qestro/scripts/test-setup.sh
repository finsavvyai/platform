#!/bin/bash
# test-setup.sh
# One-command setup for E2E testing

set -e  # Exit on error

echo "🚀 Questro E2E Test Setup"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check Node.js version
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ required. Current: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm $(npm -v) detected"

# Install dependencies if needed
echo ""
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Installing..."
    npm install
    print_success "Dependencies installed"
else
    print_success "Dependencies already installed"
fi

# Install Playwright browsers
echo ""
echo "🌐 Checking Playwright browsers..."
if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    print_warning "Playwright browsers not installed. Installing..."
    npx playwright install
    print_success "Playwright browsers installed"
else
    print_success "Playwright browsers already installed"
fi

# Create test results directory
echo ""
echo "📁 Setting up test directories..."
mkdir -p test-results/screenshots
mkdir -p playwright-report
print_success "Test directories created"

# Check if frontend is running
echo ""
echo "🔍 Checking if application is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Application is running at http://localhost:3000"
    APP_RUNNING=true
else
    print_warning "Application is NOT running at http://localhost:3000"
    echo ""
    echo "   To start the application, run:"
    echo "   npm run dev:frontend"
    echo ""
    APP_RUNNING=false
fi

# Summary
echo ""
echo "✨ Setup Complete!"
echo "=================="
echo ""

if [ "$APP_RUNNING" = true ]; then
    echo "🎉 You're ready to run tests!"
    echo ""
    echo "Quick commands:"
    echo "  npm run test:e2e              - Run all E2E tests"
    echo "  npm run test:e2e:ui           - Run with interactive UI"
    echo "  npm run test:e2e:headed       - Run with visible browser"
    echo "  npm run test:e2e:report       - View last test report"
    echo ""

    read -p "Do you want to run the tests now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "🧪 Running E2E tests..."
        npm run test:e2e
    fi
else
    echo "⚠️  Start your application first:"
    echo ""
    echo "  1. Open a new terminal"
    echo "  2. Run: npm run dev:frontend"
    echo "  3. Wait for app to start"
    echo "  4. Run: npm run test:e2e"
    echo ""
fi
