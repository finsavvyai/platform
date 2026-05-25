#!/bin/bash

# QuantumBeam Deployment Testing and Validation Suite
# Comprehensive testing for all deployment types and environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEST_RESULTS_DIR="${PROJECT_ROOT}/test-results/deployment"
REPORTS_DIR="${PROJECT_ROOT}/reports/deployment"
CONFIG_DIR="${PROJECT_ROOT}/infrastructure/config"

# Ensure directories exist
mkdir -p "$TEST_RESULTS_DIR"
mkdir -p "$REPORTS_DIR"

# Global variables
ENVIRONMENT=""
DEPLOYMENT_TYPE=""
NAMESPACE="quantumbeam"
SERVICE_NAME="quantumbeam"
TEST_TIMEOUT="1800"
VERBOSE=false
PARALLEL_TESTS=4
DRY_RUN=false

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
WARNINGS=0

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[✓] $1${NC}"
    ((PASSED_TESTS++))
}

warning() {
    echo -e "${YELLOW}[!] $1${NC}"
    ((WARNINGS++))
}

error() {
    echo -e "${RED}[✗] $1${NC}"
    ((FAILED_TESTS++))
}

info() {
    echo -e "${CYAN}[ℹ] $1${NC}"
}

skip() {
    echo -e "${YELLOW}[-] $1${NC}"
    ((SKIPPED_TESTS++))
}

header() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  QuantumBeam Deployment Testing & Validation Suite           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Show usage
show_usage() {
    cat << EOF
QuantumBeam Deployment Testing & Validation Suite

USAGE:
    $(basename "$0") [ENVIRONMENT] [DEPLOYMENT_TYPE] [OPTIONS]

ENVIRONMENTS:
    development         Development environment
    staging             Staging environment
    production          Production environment

DEPLOYMENT_TYPES:
    blue-green          Blue-green deployment
    canary              Canary deployment
    rolling             Rolling update
    all                 Test all deployment types

OPTIONS:
    --namespace NS      Kubernetes namespace (default: quantumbeam)
    --service-name NAME Service name (default: quantumbeam)
    --timeout SEC       Test timeout in seconds (default: 1800)
    --parallel N        Number of parallel tests (default: 4)
    --verbose           Verbose logging
    --dry-run           Dry run (don't execute actual tests)
    --skip-tests TESTS  Comma-separated list of tests to skip
    --only-tests TESTS  Comma-separated list of tests to run only
    --output-dir DIR    Output directory for reports
    --format FORMAT     Report format (json, xml, junit, html)
    --help, -h          Show this help message

TEST CATEGORIES:
    • Pre-deployment - Infrastructure and configuration validation
    • Health checks - Service and application health verification
    • Performance - Load and stress testing
    • Security - Security scanning and vulnerability assessment
    • Integration - End-to-end integration testing
    • Rollback - Rollback capability verification
    • Post-deployment - Post-deployment validation and monitoring

EXAMPLES:
    # Test blue-green deployment for staging
    $(basename "$0") staging blue-green

    # Test all deployment types for production
    $(basename "$0") production all --verbose

    # Run specific tests with custom timeout
    $(basename "$0") staging blue-green --timeout 3600 --only-tests "health_check,performance"

    # Generate HTML report
    $(basename "$0) production all --format html --output-dir ./reports"

DEPENDENCIES:
    • kubectl >= 1.25
    • helm >= 3.10
    • curl
    • jq
    • httpie (optional)
    • ab (Apache Bench)
    • wrk (load testing)
    • nmap (port scanning)

EOF
}

# Parse command line arguments
parse_args() {
    ENVIRONMENT=""
    DEPLOYMENT_TYPE=""
    SKIP_TESTS=""
    ONLY_TESTS=""
    OUTPUT_FORMAT="json"

    while [[ $# -gt 0 ]]; do
        case $1 in
            development|staging|production)
                if [[ -z "$ENVIRONMENT" ]]; then
                    ENVIRONMENT="$1"
                else
                    error "Multiple environments specified"
                    exit 1
                fi
                shift
                ;;
            blue-green|canary|rolling|all)
                DEPLOYMENT_TYPE="$1"
                shift
                ;;
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --service-name)
                SERVICE_NAME="$2"
                shift 2
                ;;
            --timeout)
                TEST_TIMEOUT="$2"
                shift 2
                ;;
            --parallel)
                PARALLEL_TESTS="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS="$2"
                shift 2
                ;;
            --only-tests)
                ONLY_TESTS="$2"
                shift 2
                ;;
            --output-dir)
                REPORTS_DIR="$2"
                mkdir -p "$REPORTS_DIR"
                shift 2
                ;;
            --format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown argument: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    if [[ -z "$ENVIRONMENT" ]]; then
        error "Environment is required"
        show_usage
        exit 1
    fi

    if [[ -z "$DEPLOYMENT_TYPE" ]]; then
        error "Deployment type is required"
        show_usage
        exit 1
    fi

    # Ensure output directory exists
    mkdir -p "$REPORTS_DIR"
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating test prerequisites..."

    local missing_tools=()

    # Check required tools
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi

    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi

    # Check optional tools
    local optional_tools=()
    if ! command -v helm &> /dev/null; then
        optional_tools+=("helm")
    fi

    if ! command -v ab &> /dev/null; then
        optional_tools+=("ab")
    fi

    if ! command -v wrk &> /dev/null; then
        optional_tools+=("wrk")
    fi

    if ! command -v nmap &> /dev/null; then
        optional_tools+=("nmap")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        error "Please install missing tools before running tests"
        exit 1
    fi

    if [[ ${#optional_tools[@]} -gt 0 ]]; then
        warning "Optional tools not found: ${optional_tools[*]}"
        info "Some tests may be skipped. Install optional tools for full coverage."
    fi

    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
        exit 1
    fi

    success "Prerequisites validated"
}

# Initialize test results
initialize_test_results() {
    local test_results_file="$TEST_RESULTS_DIR/deployment-test-results-${ENVIRONMENT}-${DEPLOYMENT_TYPE}-$(date +%Y%m%d-%H%M%S).json"

    cat > "$test_results_file" << EOF
{
  "test_suite": "deployment_validation",
  "environment": "$ENVIRONMENT",
  "deployment_type": "$DEPLOYMENT_TYPE",
  "timestamp": "$(date -Iseconds)",
  "namespace": "$NAMESPACE",
  "service_name": "$SERVICE_NAME",
  "total_tests": 0,
  "passed_tests": 0,
  "failed_tests": 0,
  "skipped_tests": 0,
  "warnings": 0,
  "tests": []
}
EOF

    echo "$test_results_file"
}

# Add test result to JSON
add_test_result() {
    local test_results_file="$1"
    local test_name="$2"
    local category="$3"
    local status="$4"
    local message="$5"
    local details="$6"

    ((TOTAL_TESTS++))

    local temp_file=$(mktemp)
    jq --arg name "$test_name" \
       --arg category "$category" \
       --arg status "$status" \
       --arg message "$message" \
       --arg details "$details" \
       --arg timestamp "$(date -Iseconds)" \
       '.tests += [{
         "name": $name,
         "category": $category,
         "status": $status,
         "message": $message,
         "details": $details,
         "timestamp": $timestamp
       }] | .total_tests += 1' "$test_results_file" > "$temp_file" && mv "$temp_file" "$test_results_file"

    # Update counters
    case "$status" in
        "passed")
            jq '.passed_tests += 1' "$test_results_file" > "$temp_file" && mv "$temp_file" "$test_results_file"
            ;;
        "failed")
            jq '.failed_tests += 1' "$test_results_file" > "$temp_file" && mv "$temp_file" "$test_results_file"
            ;;
        "skipped")
            jq '.skipped_tests += 1' "$test_results_file" > "$temp_file" && mv "$temp_file" "$test_results_file"
            ;;
        "warning")
            jq '.warnings += 1' "$test_results_file" > "$temp_file" && mv "$temp_file" "$test_results_file"
            ;;
    esac
}

# Check if test should run
should_run_test() {
    local test_name="$1"

    if [[ -n "$ONLY_TESTS" ]]; then
        if [[ ",$ONLY_TESTS," == *",$test_name,"* ]]; then
            return 0
        else
            return 1
        fi
    fi

    if [[ -n "$SKIP_TESTS" ]]; then
        if [[ ",$SKIP_TESTS," == *",$test_name,"* ]]; then
            return 1
        else
            return 0
        fi
    fi

    return 0
}

# Pre-deployment tests
run_pre_deployment_tests() {
    log "Running pre-deployment validation tests..."

    local test_results_file="$1"

    # Test 1: Configuration validation
    if should_run_test "config_validation"; then
        log "Testing configuration validation..."
        if [[ -f "$CONFIG_DIR/environments/$ENVIRONMENT.yaml" ]]; then
            success "Configuration file found for $ENVIRONMENT"
            add_test_result "$test_results_file" "config_validation" "pre_deployment" "passed" "Configuration file exists" "Found configuration at $CONFIG_DIR/environments/$ENVIRONMENT.yaml"
        else
            error "Configuration file not found"
            add_test_result "$test_results_file" "config_validation" "pre_deployment" "failed" "Configuration file missing" "Expected file at $CONFIG_DIR/environments/$ENVIRONMENT.yaml"
        fi
    else
        skip "Skipping configuration validation"
        add_test_result "$test_results_file" "config_validation" "pre_deployment" "skipped" "Test skipped" "Excluded by --skip-tests or --only-tests"
    fi

    # Test 2: Resource availability check
    if should_run_test "resource_availability"; then
        log "Checking resource availability..."

        # Check node availability
        local ready_nodes=$(kubectl get nodes --no-headers -l "!node-role.kubernetes.io/master" | grep "Ready" | wc -l)
        if [[ "$ready_nodes" -ge 2 ]]; then
            success "Sufficient worker nodes available: $ready_nodes"
            add_test_result "$test_results_file" "resource_availability" "pre_deployment" "passed" "Sufficient resources" "Found $ready_nodes ready worker nodes"
        else
            warning "Low worker node count: $ready_nodes"
            add_test_result "$test_results_file" "resource_availability" "pre_deployment" "warning" "Low resources" "Only $ready_nodes ready worker nodes found"
        fi

        # Check resource quotas
        local quota=$(kubectl get resourcequota -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
        if [[ "$quota" -gt 0 ]]; then
            success "Resource quotas configured: $quota"
            add_test_result "$test_results_file" "resource_quotas" "pre_deployment" "passed" "Quotas configured" "Found $quota resource quotas"
        else
            info "No resource quotas configured"
            add_test_result "$test_results_file" "resource_quotas" "pre_deployment" "skipped" "No quotas" "No resource quotas found in namespace"
        fi
    fi

    # Test 3: Security policy validation
    if should_run_test "security_policies"; then
        log "Validating security policies..."

        local pod_security_policies=$(kubectl get podsecuritypolicy --no-headers 2>/dev/null | wc -l || echo "0")
        if [[ "$pod_security_policies" -gt 0 ]]; then
            success "Pod security policies configured: $pod_security_policies"
            add_test_result "$test_results_file" "security_policies" "pre_deployment" "passed" "Policies configured" "Found $pod_security_policies pod security policies"
        else
            info "No pod security policies configured"
            add_test_result "$test_results_file" "security_policies" "pre_deployment" "skipped" "No policies" "No pod security policies found"
        fi

        # Check network policies
        local network_policies=$(kubectl get networkpolicy -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
        if [[ "$network_policies" -gt 0 ]]; then
            success "Network policies configured: $network_policies"
            add_test_result "$test_results_file" "network_policies" "pre_deployment" "passed" "Network policies configured" "Found $network_policies network policies"
        else
            warning "No network policies configured"
            add_test_result "$test_results_file" "network_policies" "pre_deployment" "warning" "No network policies" "No network policies found in namespace"
        fi
    fi
}

# Health check tests
run_health_check_tests() {
    log "Running health check tests..."

    local test_results_file="$1"

    # Test 1: Service endpoint availability
    if should_run_test "service_endpoints"; then
        log "Testing service endpoint availability..."

        local service_endpoints=$(kubectl get svc -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | wc -l || echo "0")
        if [[ "$service_endpoints" -gt 0 ]]; then
            success "Service endpoints found: $service_endpoints"
            add_test_result "$test_results_file" "service_endpoints" "health_check" "passed" "Endpoints available" "Found $service_endpoints service endpoints"

            # Test endpoint connectivity
            local service_name=$(kubectl get svc -n "$NAMESPACE" -l app="$SERVICE_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
            if [[ -n "$service_name" ]]; then
                local service_ip=$(kubectl get svc "$service_name" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
                if [[ -n "$service_ip" && "$service_ip" != "None" ]]; then
                    log "Testing connectivity to service: $service_name ($service_ip)"

                    if timeout 10 curl -f -s "http://$service_name.$NAMESPACE.svc.cluster.local/health" > /dev/null 2>&1; then
                        success "Service health endpoint accessible"
                        add_test_result "$test_results_file" "service_health" "health_check" "passed" "Health endpoint accessible" "Service responds to health checks"
                    else
                        warning "Service health endpoint not accessible"
                        add_test_result "$test_results_file" "service_health" "health_check" "warning" "Health endpoint issue" "Service not responding to health checks"
                    fi
                else
                    warning "Service cluster IP not available"
                    add_test_result "$test_results_file" "service_health" "health_check" "skipped" "No cluster IP" "Service cluster IP not available"
                fi
            fi
        else
            error "No service endpoints found"
            add_test_result "$test_results_file" "service_endpoints" "health_check" "failed" "No endpoints" "No service endpoints found for $SERVICE_NAME"
        fi
    fi

    # Test 2: Pod health status
    if should_run_test "pod_health"; then
        log "Testing pod health status..."

        local total_pods=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | wc -l || echo "0")
        local running_pods=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l || echo "0")
        local ready_pods=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | awk '{print $2}' | cut -d'/' -f1 | paste -sd+ | bc 2>/dev/null || echo "0")

        if [[ "$total_pods" -gt 0 ]]; then
            if [[ "$running_pods" -eq "$total_pods" && "$ready_pods" -eq "$total_pods" ]]; then
                success "All pods healthy: $ready_pods/$total_pods ready"
                add_test_result "$test_results_file" "pod_health" "health_check" "passed" "Pods healthy" "All $total_pods pods are running and ready"
            else
                warning "Some pods unhealthy: $ready_pods/$total_pods ready"
                add_test_result "$test_results_file" "pod_health" "health_check" "warning" "Pods unhealthy" "$ready_pods/$total_pods pods are ready"
            fi
        else
            error "No pods found"
            add_test_result "$test_results_file" "pod_health" "health_check" "failed" "No pods" "No pods found for $SERVICE_NAME"
        fi
    fi

    # Test 3: Readiness and liveness probes
    if should_run_test "health_probes"; then
        log "Testing health probe configuration..."

        local deployment=$(kubectl get deployment -n "$NAMESPACE" -l app="$SERVICE_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [[ -n "$deployment" ]]; then
            local readiness_probe=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].readinessProbe}' 2>/dev/null || echo "")
            local liveness_probe=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}' 2>/dev/null || echo "")

            if [[ -n "$readiness_probe" && "$readiness_probe" != "null" ]]; then
                success "Readiness probe configured"
                add_test_result "$test_results_file" "readiness_probe" "health_check" "passed" "Probe configured" "Readiness probe is configured"
            else
                warning "Readiness probe not configured"
                add_test_result "$test_results_file" "readiness_probe" "health_check" "warning" "Probe missing" "Readiness probe is not configured"
            fi

            if [[ -n "$liveness_probe" && "$liveness_probe" != "null" ]]; then
                success "Liveness probe configured"
                add_test_result "$test_results_file" "liveness_probe" "health_check" "passed" "Probe configured" "Liveness probe is configured"
            else
                warning "Liveness probe not configured"
                add_test_result "$test_results_file" "liveness_probe" "health_check" "warning" "Probe missing" "Liveness probe is not configured"
            fi
        else
            skip "No deployment found for probe testing"
            add_test_result "$test_results_file" "health_probes" "health_check" "skipped" "No deployment" "No deployment found for $SERVICE_NAME"
        fi
    fi
}

# Performance tests
run_performance_tests() {
    log "Running performance tests..."

    local test_results_file="$1"

    # Test 1: Load testing with Apache Bench
    if command -v ab &> /dev/null && should_run_test "load_test"; then
        log "Running load test with Apache Bench..."

        local service_url=$(get_service_url)
        if [[ -n "$service_url" ]]; then
            log "Testing load against: $service_url"

            # Run a basic load test
            local ab_output_file="$TEST_RESULTS_DIR/load-test-output-$(date +%Y%m%d-%H%M%S).txt"
            if timeout 60 ab -n 100 -c 10 "$service_url/" > "$ab_output_file" 2>&1; then
                local requests_per_sec=$(grep "Requests per second" "$ab_output_file" | awk '{print $4}' || echo "0")
                local failed_requests=$(grep "Failed requests" "$ab_output_file" | awk '{print $3}' || echo "0")

                if [[ "$failed_requests" -eq 0 ]]; then
                    success "Load test passed: $requests_per_sec req/sec"
                    add_test_result "$test_results_file" "load_test" "performance" "passed" "Load test successful" "$requests_per_sec requests/second, 0 failed requests"
                else
                    warning "Load test with failures: $failed_requests failed"
                    add_test_result "$test_results_file" "load_test" "performance" "warning" "Load test issues" "$requests_per_sec requests/second, $failed_requests failed requests"
                fi
            else
                error "Load test failed"
                add_test_result "$test_results_file" "load_test" "performance" "failed" "Load test failed" "Apache Bench could not complete the test"
            fi
        else
            skip "Cannot perform load test - no service URL available"
            add_test_result "$test_results_file" "load_test" "performance" "skipped" "No service URL" "Service URL not available for load testing"
        fi
    else
        skip "Skipping load test - Apache Bench not available or excluded"
        add_test_result "$test_results_file" "load_test" "performance" "skipped" "Tool not available" "Apache Bench not installed"
    fi

    # Test 2: Response time testing
    if should_run_test "response_time"; then
        log "Testing response times..."

        local service_url=$(get_service_url)
        if [[ -n "$service_url" ]]; then
            local response_times=()
            local failed_requests=0

            # Run 10 requests and measure response times
            for i in {1..10}; do
                local start_time=$(date +%s%N)
                if timeout 10 curl -f -s "$service_url/" > /dev/null 2>&1; then
                    local end_time=$(date +%s%N)
                    local response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
                    response_times+=("$response_time")
                else
                    ((failed_requests++))
                fi
            done

            if [[ ${#response_times[@]} -gt 0 ]]; then
                # Calculate average response time
                local total_time=0
                for time in "${response_times[@]}"; do
                    total_time=$((total_time + time))
                done
                local avg_response_time=$((total_time / ${#response_times[@]}))

                if [[ "$avg_response_time" -lt 1000 ]]; then  # Less than 1 second
                    success "Response time acceptable: ${avg_response_time}ms avg"
                    add_test_result "$test_results_file" "response_time" "performance" "passed" "Response time good" "Average response time: ${avg_response_time}ms"
                elif [[ "$avg_response_time" -lt 3000 ]]; then  # Less than 3 seconds
                    warning "Response time slow: ${avg_response_time}ms avg"
                    add_test_result "$test_results_file" "response_time" "performance" "warning" "Response time slow" "Average response time: ${avg_response_time}ms"
                else
                    error "Response time too slow: ${avg_response_time}ms avg"
                    add_test_result "$test_results_file" "response_time" "performance" "failed" "Response time too slow" "Average response time: ${avg_response_time}ms"
                fi
            else
                error "All requests failed"
                add_test_result "$test_results_file" "response_time" "performance" "failed" "All requests failed" "Could not complete any successful requests"
            fi
        else
            skip "Cannot test response time - no service URL available"
            add_test_result "$test_results_file" "response_time" "performance" "skipped" "No service URL" "Service URL not available for response time testing"
        fi
    fi
}

# Security tests
run_security_tests() {
    log "Running security tests..."

    local test_results_file="$1"

    # Test 1: SSL/TLS configuration
    if should_run_test "ssl_config"; then
        log "Testing SSL/TLS configuration..."

        local service_url=$(get_service_url)
        if [[ "$service_url" == https://* ]]; then
            if timeout 10 curl -f -s "$service_url/" > /dev/null 2>&1; then
                success "SSL/TLS working properly"
                add_test_result "$test_results_file" "ssl_config" "security" "passed" "SSL working" "HTTPS endpoint accessible and functional"
            else
                error "SSL/TLS configuration issue"
                add_test_result "$test_results_file" "ssl_config" "security" "failed" "SSL issue" "HTTPS endpoint not accessible"
            fi
        else
            info "HTTP endpoint - SSL/TLS not applicable"
            add_test_result "$test_results_file" "ssl_config" "security" "skipped" "HTTP only" "Service uses HTTP, SSL/TLS not applicable"
        fi
    fi

    # Test 2: Security headers
    if should_run_test "security_headers"; then
        log "Testing security headers..."

        local service_url=$(get_service_url)
        if [[ -n "$service_url" ]]; then
            local headers_file="$TEST_RESULTS_DIR/security-headers-$(date +%Y%m%d-%H%M%S).txt"
            if timeout 10 curl -I -s "$service_url/" > "$headers_file" 2>&1; then
                local security_headers_found=0

                # Check for important security headers
                local headers=("x-frame-options" "x-content-type-options" "x-xss-protection" "strict-transport-security" "content-security-policy")

                for header in "${headers[@]}"; do
                    if grep -qi "$header" "$headers_file"; then
                        ((security_headers_found++))
                    fi
                done

                if [[ "$security_headers_found" -ge 3 ]]; then
                    success "Security headers configured: $security_headers_found/5"
                    add_test_result "$test_results_file" "security_headers" "security" "passed" "Headers configured" "Found $security_headers_found security headers"
                elif [[ "$security_headers_found" -ge 1 ]]; then
                    warning "Some security headers missing: $security_headers_found/5"
                    add_test_result "$test_results_file" "security_headers" "security" "warning" "Headers incomplete" "Found only $security_headers_found security headers"
                else
                    error "Security headers not configured"
                    add_test_result "$test_results_file" "security_headers" "security" "failed" "No headers" "No security headers found"
                fi
            else
                warning "Could not retrieve security headers"
                add_test_result "$test_results_file" "security_headers" "security" "warning" "Headers not accessible" "Could not retrieve response headers"
            fi
        else
            skip "Cannot test security headers - no service URL available"
            add_test_result "$test_results_file" "security_headers" "security" "skipped" "No service URL" "Service URL not available for header testing"
        fi
    fi
}

# Integration tests
run_integration_tests() {
    log "Running integration tests..."

    local test_results_file="$1"

    # Test 1: API endpoint functionality
    if should_run_test "api_endpoints"; then
        log "Testing API endpoints..."

        local service_url=$(get_service_url)
        if [[ -n "$service_url" ]]; then
            local endpoints=("/health" "/ready" "/api/v1/status")
            local passed_endpoints=0
            local total_endpoints=${#endpoints[@]}

            for endpoint in "${endpoints[@]}"; do
                if timeout 10 curl -f -s "$service_url$endpoint" > /dev/null 2>&1; then
                    ((passed_endpoints++))
                    log "✓ $endpoint"
                else
                    log "✗ $endpoint"
                fi
            done

            if [[ "$passed_endpoints" -eq "$total_endpoints" ]]; then
                success "All API endpoints working: $passed_endpoints/$total_endpoints"
                add_test_result "$test_results_file" "api_endpoints" "integration" "passed" "API endpoints working" "All $total_endpoints API endpoints are accessible"
            elif [[ "$passed_endpoints" -gt 0 ]]; then
                warning "Some API endpoints failing: $passed_endpoints/$total_endpoints"
                add_test_result "$test_results_file" "api_endpoints" "integration" "warning" "API endpoints partial" "$passed_endpoints/$total_endpoints API endpoints are accessible"
            else
                error "All API endpoints failing"
                add_test_result "$test_results_file" "api_endpoints" "integration" "failed" "API endpoints failing" "No API endpoints are accessible"
            fi
        else
            skip "Cannot test API endpoints - no service URL available"
            add_test_result "$test_results_file" "api_endpoints" "integration" "skipped" "No service URL" "Service URL not available for API testing"
        fi
    fi

    # Test 2: Database connectivity
    if should_run_test "database_connectivity"; then
        log "Testing database connectivity..."

        # Check if database pods are running
        local db_pods=$(kubectl get pods -n "$NAMESPACE" -l app=postgres --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l || echo "0")
        if [[ "$db_pods" -gt 0 ]]; then
            success "Database pods running: $db_pods"
            add_test_result "$test_results_file" "database_connectivity" "integration" "passed" "Database running" "Found $db_pods running database pods"
        else
            warning "No running database pods found"
            add_test_result "$test_results_file" "database_connectivity" "integration" "warning" "Database issue" "No running database pods found"
        fi
    fi
}

# Rollback tests
run_rollback_tests() {
    log "Running rollback capability tests..."

    local test_results_file="$1"

    # Test 1: Deployment rollback capability
    if should_run_test "rollback_capability"; then
        log "Testing deployment rollback capability..."

        local deployment=$(kubectl get deployment -n "$NAMESPACE" -l app="$SERVICE_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [[ -n "$deployment" ]]; then
            # Check if there are previous revisions
            local revisions=$(kubectl rollout history deployment "$deployment" -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
            if [[ "$revisions" -gt 1 ]]; then
                success "Rollback capability available: $revisions revisions"
                add_test_result "$test_results_file" "rollback_capability" "rollback" "passed" "Rollback available" "Found $revisions deployment revisions available for rollback"
            else
                warning "Limited rollback capability: only $revisions revision"
                add_test_result "$test_results_file" "rollback_capability" "rollback" "warning" "Limited rollback" "Only $revisions deployment revision available"
            fi
        else
            skip "No deployment found for rollback testing"
            add_test_result "$test_results_file" "rollback_capability" "rollback" "skipped" "No deployment" "No deployment found for rollback testing"
        fi
    fi

    # Test 2: Blue-green switch capability
    if [[ "$DEPLOYMENT_TYPE" == "blue-green" ]] && should_run_test "blue_green_switch"; then
        log "Testing blue-green switch capability..."

        local blue_service=$(kubectl get svc -n "$NAMESPACE" -l app="$SERVICE_NAME",color=blue --no-headers 2>/dev/null | wc -l || echo "0")
        local green_service=$(kubectl get svc -n "$NAMESPACE" -l app="$SERVICE_NAME",color=green --no-headers 2>/dev/null | wc -l || echo "0")

        if [[ "$blue_service" -gt 0 && "$green_service" -gt 0 ]]; then
            success "Blue-green services available"
            add_test_result "$test_results_file" "blue_green_switch" "rollback" "passed" "Services available" "Both blue and green services are available for switching"
        else
            warning "Blue-green services incomplete: blue=$blue_service, green=$green_service"
            add_test_result "$test_results_file" "blue_green_switch" "rollback" "warning" "Services incomplete" "Blue or green service missing"
        fi
    fi
}

# Post-deployment tests
run_post_deployment_tests() {
    log "Running post-deployment validation tests..."

    local test_results_file="$1"

    # Test 1: Monitoring configuration
    if should_run_test "monitoring_config"; then
        log "Testing monitoring configuration..."

        # Check if Prometheus is configured
        local servicemonitor=$(kubectl get servicemonitor -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | wc -l || echo "0")
        if [[ "$servicemonitor" -gt 0 ]]; then
            success "ServiceMonitor configured: $servicemonitor"
            add_test_result "$test_results_file" "monitoring_config" "post_deployment" "passed" "Monitoring configured" "Found $servicemonitor ServiceMonitor"
        else
            warning "No ServiceMonitor found"
            add_test_result "$test_results_file" "monitoring_config" "post_deployment" "warning" "Monitoring missing" "No ServiceMonitor configured"
        fi

        # Check metrics endpoint
        local service_url=$(get_service_url)
        if [[ -n "$service_url" ]]; then
            if timeout 10 curl -f -s "$service_url/metrics" > /dev/null 2>&1; then
                success "Metrics endpoint accessible"
                add_test_result "$test_results_file" "metrics_endpoint" "post_deployment" "passed" "Metrics available" "Prometheus metrics endpoint is accessible"
            else
                warning "Metrics endpoint not accessible"
                add_test_result "$test_results_file" "metrics_endpoint" "post_deployment" "warning" "Metrics issue" "Prometheus metrics endpoint not accessible"
            fi
        fi
    fi

    # Test 2: Logging configuration
    if should_run_test "logging_config"; then
        log "Testing logging configuration..."

        # Check recent logs
        local recent_logs=$(kubectl logs -n "$NAMESPACE" -l app="$SERVICE_NAME" --tail=10 2>/dev/null | wc -l || echo "0")
        if [[ "$recent_logs" -gt 0 ]]; then
            success "Recent logs available: $recent_logs lines"
            add_test_result "$test_results_file" "logging_config" "post_deployment" "passed" "Logging working" "Found $recent_logs lines of recent logs"
        else
            warning "No recent logs found"
            add_test_result "$test_results_file" "logging_config" "post_deployment" "warning" "Logging issue" "No recent logs found"
        fi
    fi
}

# Get service URL
get_service_url() {
    local service=$(kubectl get svc -n "$NAMESPACE" -l app="$SERVICE_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [[ -n "$service" ]]; then
        local service_type=$(kubectl get svc "$service" -n "$NAMESPACE" -o jsonpath='{.spec.type}' 2>/dev/null || echo "")
        local service_port=$(kubectl get svc "$service" -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="http")].port}' 2>/dev/null || echo "80")

        if [[ "$service_type" == "LoadBalancer" ]]; then
            local service_host=$(kubectl get svc "$service" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
            if [[ -z "$service_host" ]]; then
                service_host=$(kubectl get svc "$service" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
            fi

            if [[ -n "$service_host" ]]; then
                echo "http://$service_host:$service_port"
            fi
        else
            echo "http://$service.$NAMESPACE.svc.cluster.local:$service_port"
        fi
    fi
}

# Generate comprehensive report
generate_report() {
    local test_results_file="$1"
    local report_file="$REPORTS_DIR/deployment-validation-report-${ENVIRONMENT}-${DEPLOYMENT_TYPE}-$(date +%Y%m%d-%H%M%S).$OUTPUT_FORMAT"

    log "Generating deployment validation report..."

    case "$OUTPUT_FORMAT" in
        "json")
            cp "$test_results_file" "$report_file"
            ;;
        "html")
            generate_html_report "$test_results_file" "$report_file"
            ;;
        "junit")
            generate_junit_report "$test_results_file" "$report_file"
            ;;
        *)
            error "Unsupported output format: $OUTPUT_FORMAT"
            return 1
            ;;
    esac

    success "Report generated: $report_file"

    # Display summary
    echo
    echo "=== Test Summary ==="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Skipped: $SKIPPED_TESTS"
    echo "Warnings: $WARNINGS"
    echo
}

# Generate HTML report
generate_html_report() {
    local test_results_file="$1"
    local report_file="$2"

    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>QuantumBeam Deployment Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .test-category { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { background-color: #d4edda; border-color: #c3e6cb; }
        .warning { background-color: #fff3cd; border-color: #ffeaa7; }
        .failed { background-color: #f8d7da; border-color: #f5c6cb; }
        .skipped { background-color: #e2e3e5; border-color: #d6d8db; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .timestamp { color: #666; font-size: 0.9em; }
        .status-passed { color: #28a745; font-weight: bold; }
        .status-failed { color: #dc3545; font-weight: bold; }
        .status-warning { color: #ffc107; font-weight: bold; }
        .status-skipped { color: #6c757d; font-style: italic; }
    </style>
</head>
<body>
    <div class="header">
        <h1>QuantumBeam Deployment Validation Report</h1>
        <p>Environment: <strong>$ENVIRONMENT</strong></p>
        <p>Deployment Type: <strong>$DEPLOYMENT_TYPE</strong></p>
        <p>Generated: <strong>$(date)</strong></p>
    </div>

    <div class="summary">
        <h2>Test Summary</h2>
        <table>
            <tr><th>Metric</th><th>Count</th></tr>
            <tr><td>Total Tests</td><td>$TOTAL_TESTS</td></tr>
            <tr><td>Passed</td><td>$PASSED_TESTS</td></tr>
            <tr><td>Failed</td><td>$FAILED_TESTS</td></tr>
            <tr><td>Skipped</td><td>$SKIPPED_TESTS</td></tr>
            <tr><td>Warnings</td><td>$WARNINGS</td></tr>
        </table>
    </div>

EOF

    # Group tests by category
    local categories=("pre_deployment" "health_check" "performance" "security" "integration" "rollback" "post_deployment")

    for category in "${categories[@]}"; do
        cat >> "$report_file" << EOF
    <div class="test-category">
        <h2>${category^} Tests</h2>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Status</th>
                <th>Message</th>
                <th>Details</th>
                <th>Timestamp</th>
            </tr>
EOF

        jq -r --arg cat "$category" '.tests[] | select(.category == $cat) | "<tr><td>\(.name)</td><td class=\"status-\(.status)\">\(.status)</td><td>\(.message)</td><td>\(.details)</td><td class=\"timestamp\">\(.timestamp)</td></tr>" "$test_results_file" >> "$report_file" 2>/dev/null || echo "<tr><td colspan=\"5\">No tests found for category</td></tr>" >> "$report_file"

        cat >> "$report_file" << EOF
        </table>
    </div>
EOF
    done

    cat >> "$report_file" << EOF
    <div class="test-category">
        <p class="timestamp">Report generated by QuantumBeam Deployment Validation Suite</p>
    </div>
</body>
</html>
EOF
}

# Generate JUnit XML report
generate_junit_report() {
    local test_results_file="$1"
    local report_file="$2"

    cat > "$report_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="QuantumBeam Deployment Validation" environment="$ENVIRONMENT" deployment_type="$DEPLOYMENT_TYPE" tests="$TOTAL_TESTS" failures="$FAILED_TESTS" skipped="$SKIPPED_TESTS" timestamp="$(date -Iseconds)">
EOF

    jq -r '.tests[] | "<testcase classname=\"\(.category)\" name=\"\(.name)\" time=\"0.0\"><\(.status) message=\"\(.message | gsub("\""; "&quot;")\"/></testcase>"' "$test_results_file" >> "$report_file" 2>/dev/null

    cat >> "$report_file" << EOF
</testsuite>
EOF
}

# Main function
main() {
    header

    # Parse arguments
    parse_args "$@"

    # Validate prerequisites
    validate_prerequisites

    # Initialize test results
    local test_results_file=$(initialize_test_results)

    # Record start time
    local start_time=$(date +%s)

    # Run tests based on deployment type
    if [[ "$DRY_RUN" == "false" ]]; then
        log "Starting deployment validation tests for $ENVIRONMENT ($DEPLOYMENT_TYPE)"

        # Run all test categories
        run_pre_deployment_tests "$test_results_file"
        run_health_check_tests "$test_results_file"
        run_performance_tests "$test_results_file"
        run_security_tests "$test_results_file"
        run_integration_tests "$test_results_file"
        run_rollback_tests "$test_results_file"
        run_post_deployment_tests "$test_results_file"
    else
        log "DRY RUN: Would run deployment validation tests for $ENVIRONMENT ($DEPLOYMENT_TYPE)"
        success "Dry run completed"
    fi

    # Update final counters in test results
    local temp_file=$(mktemp)
    jq --arg total "$TOTAL_TESTS" --arg passed "$PASSED_TESTS" --arg failed "$FAILED_TESTS" --arg skipped "$SKIPPED_TESTS" --arg warnings "$WARNINGS" \
       '.total_tests = ($total | tonumber) | .passed_tests = ($passed | tonumber) | .failed_tests = ($failed | tonumber) | .skipped_tests = ($skipped | tonumber) | .warnings = ($warnings | tonumber)' \
       "$test_results_file" > "$temp_file" && mv "$temp_file" "$test_results_file"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Generate report
    generate_report "$test_results_file"

    success "Deployment validation completed in ${duration}s"

    # Exit with appropriate code
    if [[ "$FAILED_TESTS" -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

# Execute main function
main "$@"