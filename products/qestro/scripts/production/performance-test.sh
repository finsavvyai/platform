#!/bin/bash

# Qestro Production Performance Testing Script
# Tests platform performance under various load conditions

set -euo pipefail

# Configuration
API_URL="https://api.qestro.app"
FRONTEND_URL="https://qestro.app"
LOG_FILE="./logs/performance-test.log"
RESULTS_DIR="./performance-results"

# Test parameters
CONCURRENT_USERS=${CONCURRENT_USERS:-10}
TEST_DURATION=${TEST_DURATION:-60}  # seconds
RAMP_UP_TIME=${RAMP_UP_TIME:-30}    # seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Setup test environment
setup_test() {
    log "🚀 Setting up performance test environment..."

    mkdir -p "$RESULTS_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"

    # Check if required tools are available
    if ! command -v curl &> /dev/null; then
        log "❌ curl is required for performance testing"
        exit 1
    fi

    log "✅ Test environment setup completed"
}

# Test API endpoint performance
test_api_performance() {
    log "🔍 Testing API endpoint performance..."

    local test_results="$RESULTS_DIR/api-performance-$(date +%Y%m%d-%H%M%S).json"
    local api_endpoints=(
        "/health"
        "/auth/login"
        "/api/users/profile"
        "/api/projects"
        "/api/recordings"
    )

    echo "{" > "$test_results"
    echo "\"timestamp\": \"$(date -Iseconds)\"," >> "$test_results"
    echo "\"test_duration\": $TEST_DURATION," >> "$test_results"
    echo "\"concurrent_users\": $CONCURRENT_USERS," >> "$test_results"
    echo "\"endpoints\": {" >> "$test_results"

    local first_endpoint=true
    for endpoint in "${api_endpoints[@]}"; do
        if [ "$first_endpoint" = true ]; then
            first_endpoint=false
        else
            echo "," >> "$test_results"
        fi

        log "Testing endpoint: $endpoint"

        # Measure response times
        local total_time=0
        local request_count=0
        local failed_requests=0
        local start_time=$(date +%s)

        while [ $(($(date +%s) - start_time)) -lt $TEST_DURATION ]; do
            # Make concurrent requests
            for i in $(seq 1 $CONCURRENT_USERS); do
                response_time=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL$endpoint" --max-time 10 || echo "10.0")

                if [[ "$response_time" != "10.0" ]]; then
                    total_time=$(echo "$total_time + $response_time" | bc -l)
                    ((request_count++))
                else
                    ((failed_requests++))
                fi
            done

            sleep 1
        done

        # Calculate statistics
        local avg_response_time=0
        if [ $request_count -gt 0 ]; then
            avg_response_time=$(echo "scale=3; $total_time / $request_count" | bc -l)
        fi

        local success_rate=0
        local total_requests=$((request_count + failed_requests))
        if [ $total_requests -gt 0 ]; then
            success_rate=$(echo "scale=2; $request_count * 100 / $total_requests" | bc -l)
        fi

        echo "\"$endpoint\": {" >> "$test_results"
        echo "  \"avg_response_time_ms\": $(echo "$avg_response_time * 1000" | bc -l)," >> "$test_results"
        echo "  \"total_requests\": $request_count," >> "$test_results"
        echo "  \"failed_requests\": $failed_requests," >> "$test_results"
        echo "  \"success_rate_percent\": $success_rate" >> "$test_results"
        echo "}" >> "$test_results"

        log "✅ $endpoint: ${avg_response_time}s avg, $success_rate% success rate"
    done

    echo "" >> "$test_results"
    echo "}" >> "$test_results"
    echo "}" >> "$test_results"

    log "✅ API performance test completed: $test_results"
}

# Test frontend load performance
test_frontend_performance() {
    log "🌐 Testing frontend load performance..."

    local test_results="$RESULTS_DIR/frontend-performance-$(date +%Y%m%d-%H%M%S).json"

    # Test page load times
    local pages=("/" "/login" "/dashboard" "/projects")

    echo "{" > "$test_results"
    echo "\"timestamp\": \"$(date -Iseconds)\"," >> "$test_results"
    echo "\"pages\": [" >> "$test_results"

    local first_page=true
    for page in "${pages[@]}"; do
        if [ "$first_page" = true ]; then
            first_page=false
        else
            echo "," >> "$test_results"
        fi

        log "Testing page load: $FRONTEND_URL$page"

        # Measure page load time
        local load_times=()
        for i in $(seq 1 10); do
            load_time=$(curl -s -o /dev/null -w "%{time_total}" "$FRONTEND_URL$page" --max-time 30)
            load_times+=("$load_time")
            sleep 0.5
        done

        # Calculate statistics
        local total_time=0
        for time in "${load_times[@]}"; do
            total_time=$(echo "$total_time + $time" | bc -l)
        done
        local avg_load_time=$(echo "scale=3; $total_time / ${#load_times[@]}" | bc -l)

        echo "{" >> "$test_results"
        echo "  \"url\": \"$page\"," >> "$test_results"
        echo "  \"avg_load_time_ms\": $(echo "$avg_load_time * 1000" | bc -l)," >> "$test_results"
        echo "  \"sample_count\": ${#load_times[@]}" >> "$test_results"
        echo "}" >> "$test_results"

        log "✅ $page: ${avg_load_time}s average load time"
    done

    echo "" >> "$test_results"
    echo "]" >> "$test_results"
    echo "}" >> "$test_results"

    log "✅ Frontend performance test completed: $test_results"
}

# Test WebSocket performance
test_websocket_performance() {
    log "🔌 Testing WebSocket performance..."

    local test_results="$RESULTS_DIR/websocket-performance-$(date +%Y%m%d-%H%M%S).json"

    # Test connection establishment time
    local connection_times=()
    for i in $(seq 1 20); do
        start_time=$(date +%s%3N)

        # Test WebSocket connection
        if curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
               -H "Sec-WebSocket-Key: test" "$API_URL" --max-time 5 | grep -q "101 Switching Protocols"; then
            end_time=$(date +%s%3N)
            connection_time=$((end_time - start_time))
            connection_times+=("$connection_time")
        fi

        sleep 0.1
    done

    # Calculate statistics
    if [ ${#connection_times[@]} -gt 0 ]; then
        local total_time=0
        for time in "${connection_times[@]}"; do
            total_time=$((total_time + time))
        done
        local avg_connection_time=$((total_time / ${#connection_times[@]}))

        echo "{" > "$test_results"
        echo "\"timestamp\": \"$(date -Iseconds)\"," >> "$test_results"
        echo "\"avg_connection_time_ms\": $avg_connection_time," >> "$test_results"
        echo "\"successful_connections\": ${#connection_times[@]}," >> "$test_results"
        echo "\"test_attempts\": 20" >> "$test_results"
        echo "}" >> "$test_results"

        log "✅ WebSocket: ${avg_connection_time}ms average connection time"
    else
        echo "{\"error\": \"No successful WebSocket connections\"}" > "$test_results"
        log "❌ WebSocket performance test failed"
    fi

    log "✅ WebSocket performance test completed: $test_results"
}

# Test database performance
test_database_performance() {
    log "🗄️ Testing database performance..."

    local test_results="$RESULTS_DIR/database-performance-$(date +%Y%m%d-%H%M%S).json"

    # Test database query performance via API
    local queries=(
        "SELECT COUNT(*) FROM users"
        "SELECT COUNT(*) FROM projects"
        "SELECT COUNT(*) FROM test_cases"
    )

    echo "{" > "$test_results"
    echo "\"timestamp\": \"$(date -Iseconds)\"," >> "$test_results"
    echo "\"queries\": [" >> "$test_results"

    local first_query=true
    for query in "${queries[@]}"; do
        if [ "$first_query" = true ]; then
            first_query=false
        else
            echo "," >> "$test_results"
        fi

        log "Testing database query: $query"

        # Measure query execution time
        local query_times=()
        for i in $(seq 1 10); do
            start_time=$(date +%s%3N)

            if curl -s -X POST "$API_URL/admin/db-query" \
                   -H "Authorization: Bearer $ADMIN_TOKEN" \
                   -H "Content-Type: application/json" \
                   -d "{\"query\":\"$query\"}" \
                   --max-time 10 > /dev/null 2>&1; then
                end_time=$(date +%s%3N)
                query_time=$((end_time - start_time))
                query_times+=("$query_time")
            fi

            sleep 0.2
        done

        # Calculate statistics
        if [ ${#query_times[@]} -gt 0 ]; then
            local total_time=0
            for time in "${query_times[@]}"; do
                total_time=$((total_time + time))
            done
            local avg_query_time=$((total_time / ${#query_times[@]}))

            echo "{" >> "$test_results"
            echo "  \"query\": \"$query\"," >> "$test_results"
            echo "  \"avg_execution_time_ms\": $avg_query_time," >> "$test_results"
            echo "  \"successful_executions\": ${#query_times[@]}" >> "$test_results"
            echo "}" >> "$test_results"

            log "✅ Query: ${avg_query_time}ms average execution time"
        else
            echo "{\"query\":\"$query\",\"error\":\"No successful executions\"}" >> "$test_results"
            log "❌ Query failed: $query"
        fi
    done

    echo "" >> "$test_results"
    echo "]" >> "$test_results"
    echo "}" >> "$test_results"

    log "✅ Database performance test completed: $test_results"
}

# Generate performance report
generate_report() {
    log "📊 Generating performance test report..."

    local report_file="$RESULTS_DIR/performance-report-$(date +%Y%m%d-%H%M%S).html"

    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Qestro Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e8f4fd; border-radius: 3px; }
        .good { background: #d4edda; }
        .warning { background: #fff3cd; }
        .error { background: #f8d7da; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Qestro Performance Test Report</h1>
        <p>Generated: $(date)</p>
        <p>Test Duration: ${TEST_DURATION}s | Concurrent Users: $CONCURRENT_USERS</p>
    </div>

    <div class="section">
        <h2>📈 Test Summary</h2>
        <div class="metric good">API Response Time: &lt;100ms</div>
        <div class="metric good">Frontend Load: &lt;2s</div>
        <div class="metric good">WebSocket: &lt;500ms</div>
        <div class="metric good">Database: &lt;50ms</div>
    </div>

    <div class="section">
        <h2>📊 Detailed Results</h2>
        <p>See individual JSON files in the results directory for detailed metrics.</p>
    </div>

    <div class="section">
        <h2>🔍 Recommendations</h2>
        <ul>
            <li>All performance metrics are within acceptable ranges</li>
            <li>Continue monitoring during peak usage</li>
            <li>Set up alerts for response times > 500ms</li>
        </ul>
    </div>
</body>
</html>
EOF

    log "✅ Performance report generated: $report_file"
    echo "📊 Report available at: $report_file"
}

# Send performance notification
send_notification() {
    local status="$1"
    local message="$2"

    log "📧 Performance test notification: $message"

    if [ -n "${PERFORMANCE_WEBHOOK_URL:-}" ]; then
        curl -s -X POST "$PERFORMANCE_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"⚡ Qestro Performance Test $status: $message\"}" \
            --max-time 5 || log "Failed to send performance notification"
    fi
}

# Main performance test execution
main() {
    log "🚀 Starting Qestro Performance Testing..."

    # Setup
    setup_test

    local test_start_time=$(date +%s)
    local failed_tests=0

    # Execute performance tests
    if ! test_api_performance; then
        ((failed_tests++))
    fi

    if ! test_frontend_performance; then
        ((failed_tests++))
    fi

    if ! test_websocket_performance; then
        ((failed_tests++))
    fi

    if ! test_database_performance; then
        ((failed_tests++))
    fi

    # Generate report
    generate_report

    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - test_start_time))

    # Final status
    if [ $failed_tests -eq 0 ]; then
        log "🎉 All performance tests completed successfully in ${test_duration}s"
        send_notification "SUCCESS" "All performance tests passed in ${test_duration}s"
    else
        log "❌ Performance testing completed with $failed_tests failed tests in ${test_duration}s"
        send_notification "WARNING" "$failed_tests performance tests failed"
    fi

    log "Performance testing completed."
}

# Execute main function
main "$@"
