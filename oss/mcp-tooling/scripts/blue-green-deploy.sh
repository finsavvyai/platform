#!/bin/bash

# MCPOverflow Blue-Green Deployment Script
# Enables zero-downtime deployments via Cloudflare Workers

set -e

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKERS_DIR="$PROJECT_ROOT/workers"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Check required tools
check_requirements() {
    if ! command -v wrangler &> /dev/null; then
        log_error "wrangler CLI not found. Install with: npm install -g wrangler"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found. Some features may be limited."
    fi
}

# Get current active environment
get_active_env() {
    # Check KV for current blue/green state
    local state=$(wrangler kv:key get "deployment:active" --namespace-id=$(get_kv_namespace) 2>/dev/null || echo "blue")
    echo "${state:-blue}"
}

# Get KV namespace ID from wrangler.toml
get_kv_namespace() {
    grep -A2 'kv_namespaces' "$WORKERS_DIR/wrangler.toml" | grep 'id' | head -1 | cut -d'"' -f2
}

# Deploy to inactive environment
deploy_to_inactive() {
    local active_env=$(get_active_env)
    local target_env="green"
    
    if [ "$active_env" = "green" ]; then
        target_env="blue"
    fi
    
    log_info "Current active environment: $active_env"
    log_info "Deploying to: $target_env"
    
    # Build and deploy
    cd "$WORKERS_DIR"
    npm run build
    
    # Deploy to target environment
    wrangler deploy --env "$target_env"
    
    log_success "Deployed to $target_env environment"
    echo "$target_env"
}

# Run health check against deployed environment
health_check() {
    local env=$1
    local base_url=""
    
    if [ "$env" = "blue" ]; then
        base_url="https://api-blue.mcpoverflow.com"
    else
        base_url="https://api-green.mcpoverflow.com"
    fi
    
    log_info "Running health check against $base_url..."
    
    local response=$(curl -sf "$base_url/api/health" 2>/dev/null || echo "error")
    
    if [ "$response" = "error" ]; then
        log_error "Health check failed for $env environment"
        return 1
    fi
    
    log_success "Health check passed for $env environment"
    return 0
}

# Switch traffic to new environment
switch_traffic() {
    local new_active=$1
    
    log_info "Switching traffic to $new_active..."
    
    # Update KV with new active environment
    wrangler kv:key put "deployment:active" "$new_active" --namespace-id=$(get_kv_namespace)
    
    # Update routes (atomic switch via Cloudflare API)
    # This assumes you have CF_API_TOKEN and CF_ACCOUNT_ID set
    if [ -n "$CF_API_TOKEN" ] && [ -n "$CF_ZONE_ID" ]; then
        log_info "Updating Cloudflare routes..."
        
        # Get worker script name for new environment
        local worker_name="mcpoverflow-worker-$new_active"
        
        # Update route to point to new worker
        curl -sf -X PUT "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/workers/routes" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{
                \"pattern\": \"api.mcpoverflow.com/*\",
                \"script\": \"$worker_name\"
            }" > /dev/null
        
        log_success "Traffic switched to $new_active"
    else
        log_warning "CF_API_TOKEN or CF_ZONE_ID not set. Manual route update required."
    fi
}

# Rollback to previous environment
rollback() {
    local active_env=$(get_active_env)
    local rollback_to="blue"
    
    if [ "$active_env" = "blue" ]; then
        rollback_to="green"
    fi
    
    log_warning "Rolling back from $active_env to $rollback_to..."
    
    switch_traffic "$rollback_to"
    
    log_success "Rollback complete. Active environment: $rollback_to"
}

# Full blue-green deployment
deploy() {
    log_info "Starting blue-green deployment..."
    
    # Step 1: Deploy to inactive environment
    local new_env=$(deploy_to_inactive)
    
    # Step 2: Health check
    sleep 5  # Wait for deployment to propagate
    if ! health_check "$new_env"; then
        log_error "Health check failed. Aborting deployment."
        exit 1
    fi
    
    # Step 3: Switch traffic
    switch_traffic "$new_env"
    
    # Step 4: Verify
    log_info "Verifying deployment..."
    sleep 3
    if ! health_check "$new_env"; then
        log_error "Post-switch health check failed. Consider rollback."
        exit 1
    fi
    
    log_success "Blue-green deployment complete!"
    log_info "Active environment: $new_env"
}

# Show current status
status() {
    local active=$(get_active_env)
    
    echo ""
    echo "=== MCPOverflow Deployment Status ==="
    echo "Active Environment: $active"
    echo ""
    
    echo "Blue Environment:"
    health_check "blue" && echo "  Health: ✓ Healthy" || echo "  Health: ✗ Unhealthy"
    
    echo ""
    echo "Green Environment:"
    health_check "green" && echo "  Health: ✓ Healthy" || echo "  Health: ✗ Unhealthy"
    
    echo ""
}

# Main command handler
main() {
    check_requirements
    
    case "${1:-deploy}" in
        deploy)
            deploy
            ;;
        rollback)
            rollback
            ;;
        status)
            status
            ;;
        health)
            health_check "${2:-$(get_active_env)}"
            ;;
        switch)
            if [ -z "$2" ]; then
                log_error "Usage: $0 switch <blue|green>"
                exit 1
            fi
            switch_traffic "$2"
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|status|health [env]|switch <env>}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy to inactive environment and switch traffic"
            echo "  rollback - Switch back to previous environment"
            echo "  status   - Show current deployment status"
            echo "  health   - Run health check (optionally specify env)"
            echo "  switch   - Manually switch to specific environment"
            exit 1
            ;;
    esac
}

main "$@"
