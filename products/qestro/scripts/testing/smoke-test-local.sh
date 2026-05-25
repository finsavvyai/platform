#!/bin/bash

# Local Development Smoke Test
# Quick validation that frontend and backend are working locally

set -e

echo "💨 Running Local Development Smoke Test..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
FRONTEND_URL="http://localhost:3000"
API_URL="http://localhost:8000"

# Check if services are running
check_services() {
    log_info "Checking local services..."

    local frontend_running=false
    local api_running=false

    # Check frontend
    if curl -s -f "$FRONTEND_URL" >/dev/null 2>&1; then
        log_success "Frontend is running at $FRONTEND_URL"
        frontend_running=true
    else
        log_error "Frontend is not running at $FRONTEND_URL"
        echo "  Start with: cd frontend && npm run dev"
    fi

    # Check API
    if curl -s -f "$API_URL/api/health" >/dev/null 2>&1; then
        log_success "API is running at $API_URL"
        api_running=true
    else
        log_error "API is not running at $API_URL"
        echo "  Start with: cd backend && npm run dev"
    fi

    if [ "$frontend_running" = true ] && [ "$api_running" = true ]; then
        return 0
    else
        return 1
    fi
}

# Test basic API functionality
test_api_functionality() {
    log_info "Testing API functionality..."

    # Test health endpoint
    if curl -s "$API_URL/api/health" | grep -q "status"; then
        log_success "API health check working"
    else
        log_error "API health check failed"
    fi

    # Test CORS headers
    if curl -s -I "$API_URL/api/health" | grep -qi "access-control"; then
        log_success "CORS headers configured"
    else
        log_warning "CORS headers may not be configured"
    fi
}

# Test frontend build
test_frontend_build() {
    log_info "Testing frontend build process..."

    if [ -f "frontend/package.json" ]; then
        cd frontend

        # Check if dependencies are installed
        if [ ! -d "node_modules" ]; then
            log_info "Installing frontend dependencies..."
            npm install
        fi

        # Test build
        if npm run build; then
            log_success "Frontend builds successfully"
        else
            log_error "Frontend build failed"
        fi

        cd ..
    fi
}

# Main execution
main() {
    echo "🔥 Qestro - Local Development Smoke Test"
    echo "========================================"
    echo ""

    if check_services; then
        test_api_functionality
        test_frontend_build
        echo ""
        log_success "🎉 Local development environment is ready!"
        echo ""
        echo "Next steps:"
        echo "  Frontend: $FRONTEND_URL"
        echo "  API: $API_URL"
        echo "  API Health: $API_URL/api/health"
        echo ""
    else
        echo ""
        log_error "❌ Local services are not running properly"
        echo ""
        echo "To start the development environment:"
        echo "  1. Terminal 1: cd backend && npm run dev"
        echo "  2. Terminal 2: cd frontend && npm run dev"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"