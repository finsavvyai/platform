#!/bin/bash
# =============================================================================
# SDLC.ai Platform - Post-Launch System Health Check
# =============================================================================
# Comprehensive health validation script for production systems
# Run after deployment to verify system health and performance
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${ENVIRONMENT:-production}"
API_BASE_URL="${API_BASE_URL:-https://api.sdlc.cc}"
LOG_FILE="${PROJECT_ROOT}/logs/health-check-$(date +%Y%m%d-%H%M%S).log"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
REPORT_FILE="${PROJECT_ROOT}/reports/health-report-$(date +%Y%m%d-%H%M%S).json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Health check results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0
RESULTS_FILE="/tmp/health_check_results.txt"
> "$RESULTS_FILE"

# Initialize report
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$REPORT_FILE")"

echo "{
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",
  \"environment\": \"$ENVIRONMENT\",
  \"api_base_url\": \"$API_BASE_URL\",
  \"checks\": []
}" > "$REPORT_FILE"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
    RESULTS["$1"]="PASS"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
    RESULTS["$1"]="WARN"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    RESULTS["$1"]="FAIL"
    ((FAILED_CHECKS++))
}

# Helper function to add check to report
add_check_result() {
    local name="$1"
    local status="$2"
    local details="$3"
    local duration="$4"

    jq --arg name "$name" \
       --arg status "$status" \
       --arg details "$details" \
       --arg duration "$duration" \
       '.checks += [{
         "name": $name,
         "status": $status,
         "details": $details,
         "duration_ms": $duration | tonumber,
         "timestamp": (now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ"))
       }]' "$REPORT_FILE" > tmp.$$.json && mv tmp.$$.json "$REPORT_FILE"
}

# Helper function to measure execution time
measure_time() {
    local start_time=$(date +%s%N)
    "$@"
    local end_time=$(date +%s%N)
    echo $(( (end_time - start_time) / 1000000 )) # Return milliseconds
}

# Function to check HTTP endpoint
check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local timeout="${4:-10}"
    local method="${5:-GET}"
    local body="${6:-}"

    log "Checking $name: $method $url"

    local duration
    duration=$(measure_time curl -s -o /dev/null -w "%{http_code}" \
        --max-time "$timeout" \
        -X "$method" \
        ${body:+-d "$body"} \
        -H "Content-Type: application/json" \
        "$url")

    local status_code="${duration: -3}"
    duration="${duration%???}"

    ((TOTAL_CHECKS++))

    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "$name - HTTP $status_code (${duration}ms)"
        add_check_result "$name" "PASS" "HTTP $status_code" "$duration"
        return 0
    else
        log_error "$name - Expected HTTP $expected_status, got $status_code (${duration}ms)"
        add_check_result "$name" "FAIL" "Expected HTTP $expected_status, got $status_code" "$duration"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    log "Checking database connectivity..."

    local duration
    duration=$(measure_time node -e "
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 1,
            connectionTimeoutMillis: 5000
        });

        pool.query('SELECT NOW()')
            .then(result => {
                console.log('PASS:', result.rows[0].now);
                pool.end();
            })
            .catch(err => {
                console.log('FAIL:', err.message);
                process.exit(1);
            });
    ")

    ((TOTAL_CHECKS++))

    if echo "$duration" | grep -q "PASS:"; then
        log_success "Database connectivity - ${duration}ms"
        add_check_result "Database Connectivity" "PASS" "${duration#PASS: }" "${duration%PASS:*}"
        return 0
    else
        log_error "Database connectivity - ${duration}"
        add_check_result "Database Connectivity" "FAIL" "${duration#FAIL: }" "${duration%FAIL:*}"
        return 1
    fi
}

# Function to check cache connectivity
check_cache() {
    log "Checking cache connectivity..."

    local duration
    duration=$(measure_time node -e "
        const redis = require('redis');
        const client = redis.createClient({
            url: process.env.REDIS_URL,
            socket: { connectTimeout: 5000 }
        });

        client.on('error', (err) => {
            console.log('FAIL:', err.message);
            process.exit(1);
        });

        client.connect()
            .then(() => client.ping())
            .then(result => {
                if (result === 'PONG') {
                    console.log('PASS: Cache responding');
                    client.quit();
                } else {
                    console.log('FAIL: Unexpected response');
                    process.exit(1);
                }
            })
            .catch(err => {
                console.log('FAIL:', err.message);
                process.exit(1);
            });
    ")

    ((TOTAL_CHECKS++))

    if echo "$duration" | grep -q "PASS:"; then
        log_success "Cache connectivity - ${duration}ms"
        add_check_result "Cache Connectivity" "PASS" "Cache responding correctly" "${duration%PASS:*}"
        return 0
    else
        log_error "Cache connectivity - ${duration}"
        add_check_result "Cache Connectivity" "FAIL" "${duration#FAIL: }" "${duration%FAIL:*}"
        return 1
    fi
}

# Function to check vector search functionality
check_vector_search() {
    log "Checking vector search functionality..."

    local test_vector="[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]"
    local duration
    duration=$(measure_time curl -s -X POST \
        "${API_BASE_URL}/api/v1/vector/search" \
        -H "Authorization: Bearer ${HEALTH_CHECK_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"vector\": ${test_vector}, \"limit\": 5}")

    ((TOTAL_CHECKS++))

    if echo "$duration" | jq -e '.results | length >= 0' >/dev/null 2>&1; then
        local result_count=$(echo "$duration" | jq '.results | length // 0')
        log_success "Vector search - Found ${result_count} results (${duration% *}ms)"
        add_check_result "Vector Search" "PASS" "Found ${result_count} results" "${duration% *}"
        return 0
    else
        log_error "Vector search - Invalid response"
        add_check_result "Vector Search" "FAIL" "Invalid response format" "${duration% *}"
        return 1
    fi
}

# Function to check AI service integration
check_ai_service() {
    log "Checking AI service integration..."

    local duration
    duration=$(measure_time curl -s -X POST \
        "${API_BASE_URL}/api/v1/ai/completions" \
        -H "Authorization: Bearer ${HEALTH_CHECK_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Say hello"}], "max_tokens": 10}')

    ((TOTAL_CHECKS++))

    if echo "$duration" | jq -e '.choices | length > 0' >/dev/null 2>&1; then
        log_success "AI service - Generated response (${duration% *}ms)"
        add_check_result "AI Service" "PASS" "Successfully generated response" "${duration% *}"
        return 0
    else
        log_error "AI service - Failed to generate response"
        add_check_result "AI Service" "FAIL" "Failed to generate response" "${duration% *}"
        return 1
    fi
}

# Function to check authentication flow
check_authentication() {
    log "Checking authentication flow..."

    # Test login
    local login_response
    local duration
    duration=$(measure_time curl -s -X POST \
        "${API_BASE_URL}/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email": "healthcheck@sdlc.cc", "password": "'${HEALTH_CHECK_PASSWORD}'"}')

    ((TOTAL_CHECKS++))

    if echo "$login_response" | jq -e '.token' >/dev/null 2>&1; then
        local token=$(echo "$login_response" | jq -r '.token')
        log_success "Authentication flow - Login successful (${duration}ms)"
        add_check_result "Authentication" "PASS" "Login successful" "$duration"
        return 0
    else
        log_error "Authentication flow - Login failed"
        add_check_result "Authentication" "FAIL" "Login failed" "$duration"
        return 1
    fi
}

# Function to check document processing
check_document_processing() {
    log "Checking document processing..."

    # Create a test document
    local test_doc=$(mktemp)
    echo "This is a test document for health checking." > "$test_doc"

    local duration
    duration=$(measure_time curl -s -X POST \
        "${API_BASE_URL}/api/v1/documents/upload" \
        -H "Authorization: Bearer ${HEALTH_CHECK_TOKEN}" \
        -F "file=@$test_doc" \
        -F "name=health-check-test.txt")

    rm -f "$test_doc"
    ((TOTAL_CHECKS++))

    if echo "$duration" | jq -e '.id' >/dev/null 2>&1; then
        local doc_id=$(echo "$duration" | jq -r '.id')
        log_success "Document processing - Upload successful (${duration% *}ms)"
        add_check_result "Document Processing" "PASS" "Document uploaded successfully" "${duration% *}"
        return 0
    else
        log_error "Document processing - Upload failed"
        add_check_result "Document Processing" "FAIL" "Failed to upload document" "${duration% *}"
        return 1
    fi
}

# Function to check SSL certificates
check_ssl_certificates() {
    log "Checking SSL certificates..."

    local domain=$(echo "$API_BASE_URL" | sed 's|https://||' | sed 's|/.*||')
    local expiry_date
    local days_until_expiry

    expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
    days_until_expiry=$(( ($(date -d "$expiry_date" +%s) - $(date +%s)) / 86400 ))

    ((TOTAL_CHECKS++))

    if [[ $days_until_expiry -gt 30 ]]; then
        log_success "SSL certificates - Valid for $days_until_expiry days"
        add_check_result "SSL Certificates" "PASS" "Certificate valid for $days_until_expiry days" "0"
        return 0
    elif [[ $days_until_expiry -gt 7 ]]; then
        log_warning "SSL certificates - Expiring in $days_until_expiry days"
        add_check_result "SSL Certificates" "WARN" "Certificate expiring in $days_until_expiry days" "0"
        return 0
    else
        log_error "SSL certificates - Expiring in $days_until_expiry days!"
        add_check_result "SSL Certificates" "FAIL" "Certificate expiring in $days_until_expiry days" "0"
        return 1
    fi
}

# Function to check performance benchmarks
check_performance() {
    log "Running performance benchmarks..."

    local requests=100
    local concurrency=10
    local duration
    local avg_response_time
    local p95_response_time

    # Run load test
    local results=$(mktemp)
    duration=$(measure_time ab -n $requests -c $concurrency -q "${API_BASE_URL}/health" > "$results")

    avg_response_time=$(grep "Time per request:" "$results" | head -1 | awk '{print $4}')
    p95_response_time=$(grep "95%" "$results" | awk '{print $2}')

    rm -f "$results"
    ((TOTAL_CHECKS++))

    # Performance thresholds (in milliseconds)
    local avg_threshold=500
    local p95_threshold=1000

    if (( $(echo "$avg_response_time < $avg_threshold" | bc -l) )) && (( $(echo "$p95_response_time < $p95_threshold" | bc -l) )); then
        log_success "Performance - Avg: ${avg_response_time}ms, p95: ${p95_response_time}ms"
        add_check_result "Performance Benchmarks" "PASS" "Avg: ${avg_response_time}ms, p95: ${p95_response_time}ms" "${duration% *}"
        return 0
    else
        log_warning "Performance - Avg: ${avg_response_time}ms, p95: ${p95_response_time}ms (thresholds: ${avg_threshold}ms/${p95_threshold}ms)"
        add_check_result "Performance Benchmarks" "WARN" "Avg: ${avg_response_time}ms, p95: ${p95_response_time}ms" "${duration% *}"
        return 0
    fi
}

# Function to check security headers
check_security_headers() {
    log "Checking security headers..."

    local headers
    local missing_headers=()

    headers=$(curl -s -I "${API_BASE_URL}")

    # Required security headers
    local required_headers=(
        "strict-transport-security"
        "x-content-type-options"
        "x-frame-options"
        "x-xss-protection"
        "content-security-policy"
    )

    for header in "${required_headers[@]}"; do
        if ! echo "$headers" | grep -qi "$header"; then
            missing_headers+=("$header")
        fi
    done

    ((TOTAL_CHECKS++))

    if [[ ${#missing_headers[@]} -eq 0 ]]; then
        log_success "Security headers - All required headers present"
        add_check_result "Security Headers" "PASS" "All required security headers present" "0"
        return 0
    else
        log_warning "Security headers - Missing: ${missing_headers[*]}"
        add_check_result "Security Headers" "WARN" "Missing headers: ${missing_headers[*]}" "0"
        return 0
    fi
}

# Function to send notification to Slack
send_slack_notification() {
    local status="$1"
    local message="$2"
    local color="$3"

    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "SDLC.ai Health Check - $ENVIRONMENT",
            "title_link": "https://dashboard.sdlc.cc/health",
            "text": "$message",
            "fields": [
                {
                    "title": "Environment",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "Total Checks",
                    "value": "$TOTAL_CHECKS",
                    "short": true
                },
                {
                    "title": "Passed",
                    "value": "$PASSED_CHECKS",
                    "short": true
                },
                {
                    "title": "Failed",
                    "value": "$FAILED_CHECKS",
                    "short": true
                },
                {
                    "title": "Warnings",
                    "value": "$WARNING_CHECKS",
                    "short": true
                },
                {
                    "title": "Report",
                    "value": "<https://dashboard.sdlc.cc/reports/$(basename "$REPORT_FILE")|View Details>",
                    "short": false
                }
            ],
            "footer": "SDLC.ai Platform",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
        curl -s -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK" >/dev/null
    fi
}

# Main execution
main() {
    log "Starting SDLC.ai Platform Health Check"
    log "Environment: $ENVIRONMENT"
    log "API Base URL: $API_BASE_URL"
    log "====================================="

    # Load environment variables
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        source "$PROJECT_ROOT/.env.production"
    fi

    # Run health checks
    check_endpoint "API Health Endpoint" "${API_BASE_URL}/health" 200 10
    check_endpoint "API Status Endpoint" "${API_BASE_URL}/api/v1/status" 200 10

    # Service checks
    check_database
    check_cache
    check_vector_search
    check_ai_service
    check_authentication
    check_document_processing

    # Infrastructure checks
    check_ssl_certificates
    check_performance
    check_security_headers

    # Generate summary
    log "====================================="
    log "Health Check Summary:"
    log "  Total Checks: $TOTAL_CHECKS"
    log "  Passed: $PASSED_CHECKS"
    log "  Failed: $FAILED_CHECKS"
    log "  Warnings: $WARNING_CHECKS"
    log "====================================="

    # Update report with summary
    jq --arg total "$TOTAL_CHECKS" \
       --arg passed "$PASSED_CHECKS" \
       --arg failed "$FAILED_CHECKS" \
       --arg warnings "$WARNING_CHECKS" \
       '. + {
         "total_checks": $total | tonumber,
         "passed_checks": $passed | tonumber,
         "failed_checks": $failed | tonumber,
         "warning_checks": $warnings | tonumber,
         "success_rate": (($passed / $total) * 100 | floor)
       }' "$REPORT_FILE" > tmp.$$.json && mv tmp.$$.json "$REPORT_FILE"

    # Determine overall status
    local overall_status="SUCCESS"
    local notification_color="good"
    local exit_code=0

    if [[ $FAILED_CHECKS -gt 0 ]]; then
        overall_status="FAILURE"
        notification_color="danger"
        exit_code=1
    elif [[ $WARNING_CHECKS -gt 0 ]]; then
        overall_status="WARNING"
        notification_color="warning"
        exit_code=2
    fi

    # Send notification
    local success_rate=$(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))
    local notification_message="Health check completed with status: $overall_status\nSuccess Rate: $success_rate%"

    send_slack_notification "$overall_status" "$notification_message" "$notification_color"

    log "Overall Status: $overall_status"
    log "Report saved to: $REPORT_FILE"
    log "Log saved to: $LOG_FILE"

    exit $exit_code
}

# Execute main function
main "$@"
