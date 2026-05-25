#!/bin/bash

# Test the deployed FinTech Suite Worker

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Navigate to workers directory
cd "$(dirname "$0")/.."

log_info "Testing FinTech Suite Worker Deployment..."
echo "========================================"

# Test health endpoint
log_info "Testing health endpoint..."

# Replace with your actual worker subdomain or URL
WORKER_URL="https://finsavvy-ai-suite.your-subdomain.workers.dev"

# First try to get the worker URL from wrangler
log_info "Getting worker URL..."
WORKER_INFO=$(wrangler whoami 2>/dev/null | grep -E "(subdomain|workers\.dev)" || echo "")

if [ -n "$WORKER_INFO" ]; then
    # Extract worker URL from info
    WORKER_URL=$(echo "$WORKER_INFO" | grep -oE 'https://[^)]+\.workers\.dev' | head -1)
    log_success "Found worker URL: $WORKER_URL"
else
    log_warning "Could not auto-detect worker URL. Using default pattern..."
    # Generate likely worker URL based on account and worker name
    WORKER_URL="https://finsavvy-ai-suite.workers.dev"
    log_info "Trying: $WORKER_URL"
fi

# Test health endpoint
log_info "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" "$WORKER_URL/health" -o /tmp/health_response.json 2>/dev/null)
HTTP_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    log_success "✅ Health endpoint working (HTTP $HTTP_CODE)"

    # Parse and display health response
    if [ -f /tmp/health_response.json ]; then
        echo "Health Response:"
        cat /tmp/health_response.json | jq '.' 2>/dev/null || cat /tmp/health_response.json
        echo ""
    fi
else
    log_error "❌ Health endpoint failed (HTTP $HTTP_CODE)"
    if [ -f /tmp/health_response.json ]; then
        echo "Error Response:"
        cat /tmp/health_response.json
    fi
fi

# Test API status endpoint
log_info "Testing API status endpoint..."
API_RESPONSE=$(curl -s -w "%{http_code}" "$WORKER_URL/api/status" -o /tmp/api_response.json 2>/dev/null)
API_HTTP_CODE="${API_RESPONSE: -3}"

if [ "$API_HTTP_CODE" = "200" ]; then
    log_success "✅ API status endpoint working (HTTP $API_HTTP_CODE)"

    # Parse and display API response
    if [ -f /tmp/api_response.json ]; then
        echo "API Status Response:"
        cat /tmp/api_response.json | jq '.' 2>/dev/null || cat /tmp/api_response.json
        echo ""
    fi
else
    log_warning "⚠️  API status endpoint returned HTTP $API_HTTP_CODE"
    if [ -f /tmp/api_response.json ]; then
        echo "Response:"
        cat /tmp/api_response.json
    fi
fi

# Test root endpoint
log_info "Testing root endpoint..."
ROOT_RESPONSE=$(curl -s -w "%{http_code}" "$WORKER_URL/" -o /tmp/root_response.json 2>/dev/null)
ROOT_HTTP_CODE="${ROOT_RESPONSE: -3}"

if [ "$ROOT_HTTP_CODE" = "200" ]; then
    log_success "✅ Root endpoint working (HTTP $ROOT_HTTP_CODE)"

    # Parse and display root response
    if [ -f /tmp/root_response.json ]; then
        echo "Root Response:"
        cat /tmp/root_response.json | jq '.' 2>/dev/null || cat /tmp/root_response.json
        echo ""
    fi
else
    log_warning "⚠️  Root endpoint returned HTTP $ROOT_HTTP_CODE"
fi

# Cleanup
rm -f /tmp/health_response.json /tmp/api_response.json /tmp/root_response.json

# Summary
echo ""
log_info "Deployment Test Summary:"
echo "=========================="
log_info "Worker URL: $WORKER_URL"
log_info "Health Endpoint: $(if [ "$HTTP_CODE" = "200" ]; then echo "✅ Working"; else echo "❌ Failed"; fi)"
log_info "API Status: $(if [ "$API_HTTP_CODE" = "200" ]; then echo "✅ Working"; else echo "⚠️  Issues"; fi)"
log_info "Root Endpoint: $(if [ "$ROOT_HTTP_CODE" = "200" ]; then echo "✅ Working"; else echo "⚠️  Issues"; fi)"

if [ "$HTTP_CODE" = "200" ]; then
    log_success "🎉 Deployment appears to be successful!"
    echo ""
    echo "You can test your worker at:"
    echo "  Health: $WORKER_URL/health"
    echo "  API Status: $WORKER_URL/api/status"
    echo "  Root: $WORKER_URL/"
else
    log_warning "⚠️  Some issues detected. Check the responses above."
    echo ""
    echo "The worker may still be deploying. Try again in a few minutes."
fi