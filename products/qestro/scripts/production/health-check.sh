#!/bin/bash

# Qestro Production Health Check Script
# Monitors all platform services and reports status

set -euo pipefail

# Configuration
LOG_FILE="./logs/health-check.log"
WEBHOOK_URL="${HEALTH_CHECK_WEBHOOK_URL:-}"
FRONTEND_URL="https://qestro.app"
API_URL="https://api.qestro.app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Health check functions
check_frontend() {
    log "Checking frontend health..."

    response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" --max-time 10)

    if [ "$response" = "200" ]; then
        log "✅ Frontend: HEALTHY (HTTP $response)"
        return 0
    else
        log "❌ Frontend: UNHEALTHY (HTTP $response)"
        return 1
    fi
}

check_api() {
    log "Checking API health..."

    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" --max-time 10)

    if [ "$response" = "200" ]; then
        log "✅ API: HEALTHY (HTTP $response)"
        return 0
    else
        log "❌ API: UNHEALTHY (HTTP $response)"
        return 1
    fi
}

check_database() {
    log "Checking database connectivity..."

    # Check D1 database via API
    response=$(curl -s -X POST "$API_URL/health/db" -H "Content-Type: application/json" --max-time 10)

    if echo "$response" | grep -q "healthy"; then
        log "✅ Database: HEALTHY"
        return 0
    else
        log "❌ Database: UNHEALTHY - $response"
        return 1
    fi
}

check_websocket() {
    log "Checking WebSocket connectivity..."

    # Test WebSocket connection
    response=$(curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" "$API_URL" --max-time 10)

    if echo "$response" | grep -q "101 Switching Protocols"; then
        log "✅ WebSocket: HEALTHY"
        return 0
    else
        log "❌ WebSocket: UNHEALTHY"
        return 1
    fi
}

check_auth_system() {
    log "Checking authentication system..."

    # Test admin login
    response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@qestro.app","password":"admin123"}' \
        --max-time 10)

    if echo "$response" | grep -q "token"; then
        log "✅ Authentication: HEALTHY"
        return 0
    else
        log "❌ Authentication: UNHEALTHY - $response"
        return 1
    fi
}

send_alert() {
    local message="$1"
    local severity="${2:-warning}"

    log "🚨 ALERT: $message"

    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 Qestro Health Alert: $message\",\"severity\":\"$severity\"}" \
            --max-time 5 || log "Failed to send webhook alert"
    fi
}

# Main health check execution
main() {
    log "🚀 Starting Qestro Health Check..."

    # Create logs directory
    mkdir -p "$(dirname "$LOG_FILE")"

    local failed_checks=0

    # Run all health checks
    if ! check_frontend; then
        ((failed_checks++))
    fi

    if ! check_api; then
        ((failed_checks++))
    fi

    if ! check_database; then
        ((failed_checks++))
    fi

    if ! check_websocket; then
        ((failed_checks++))
    fi

    if ! check_auth_system; then
        ((failed_checks++))
    fi

    # Overall status
    if [ $failed_checks -eq 0 ]; then
        log "🎉 All systems healthy!"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ALL_SYSTEMS_HEALTHY" >> /tmp/qestro-health-status
    else
        log "❌ $failed_checks system(s) unhealthy"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - SYSTEMS_UNHEALTHY: $failed_checks" >> /tmp/qestro-health-status
        send_alert "$failed_checks Qestro system(s) are unhealthy" "critical"
    fi

    log "Health check completed."
}

# Execute main function
main "$@"
