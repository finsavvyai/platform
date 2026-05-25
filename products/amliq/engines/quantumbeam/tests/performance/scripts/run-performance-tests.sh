#!/bin/bash

# QuantumBeam Performance Testing Script
# This script runs various performance tests against the QuantumBeam application

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$(dirname "$(dirname "$SCRIPT_DIR")")" && pwd)"
REPORTS_DIR="$PROJECT_ROOT/reports/performance"
CONFIG_DIR="$PROJECT_ROOT/tests/performance"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

# Default values
ENVIRONMENT="development"
TEST_TYPE="smoke"
TARGET_URL="http://localhost:8080"
CONCURRENT_USERS=10
TEST_DURATION="5m"
ENABLE_PROFILING=false
ENABLE_VERBOSE_LOGGING=false
OUTPUT_FORMAT="json"
DRY_RUN=false
SKIP_BUILD=false
SKIP_INFRA_CHECK=false

# Usage information
usage() {
    cat << EOF
QuantumBeam Performance Testing Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (development, staging, production) [default: development]
    -t, --test-type TYPE             Test type (smoke, load, stress, spike, endurance, capacity, volume, all) [default: smoke]
    -u, --url URL                    Target URL [default: http://localhost:8080]
    -c, --concurrent-users NUM       Number of concurrent users [default: 10]
    -d, --duration DURATION          Test duration (e.g., 5m, 1h) [default: 5m]
    --enable-profiling               Enable runtime profiling [default: false]
    --verbose                        Enable verbose logging [default: false]
    -f, --format FORMAT              Output format (json, csv, html) [default: json]
    --reports-dir DIRECTORY          Reports directory [default: ./reports/performance]
    --skip-build                     Skip application build [default: false]
    --skip-infra-check              Skip infrastructure health check [default: false]
    --dry-run                        Perform a dry run without executing tests
    -h, --help                       Show this help message

EXAMPLES:
    # Run smoke test against development environment
    $0 -e development -t smoke

    # Run load test with 50 users for 10 minutes
    $0 -e staging -t load -c 50 -d 10m -u https://staging.quantumbeam.io

    # Run stress test with profiling enabled
    $0 -e production -t stress -c 200 -d 30m --enable-profiling --verbose

    # Run all test types
    $0 -e staging -t all

    # Dry run to see what would be executed
    $0 --dry-run -e staging -t load

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--test-type)
                TEST_TYPE="$2"
                shift 2
                ;;
            -u|--url)
                TARGET_URL="$2"
                shift 2
                ;;
            -c|--concurrent-users)
                CONCURRENT_USERS="$2"
                shift 2
                ;;
            -d|--duration)
                TEST_DURATION="$2"
                shift 2
                ;;
            --enable-profiling)
                ENABLE_PROFILING=true
                shift
                ;;
            --verbose)
                ENABLE_VERBOSE_LOGGING=true
                shift
                ;;
            -f|--format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            --reports-dir)
                REPORTS_DIR="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-infra-check)
                SKIP_INFRA_CHECK=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."

    # Check if required tools are installed
    local required_tools=("go" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done

    # Check if we're in the project root
    if [[ ! -f "$PROJECT_ROOT/go.mod" ]]; then
        log_error "Script must be run from project root directory"
        exit 1
    fi

    # Check environment validity
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be one of: development, staging, production"
        exit 1
    fi

    # Check test type validity
    if [[ ! "$TEST_TYPE" =~ ^(smoke|load|stress|spike|endurance|capacity|volume|all)$ ]]; then
        log_error "Invalid test type: $TEST_TYPE. Must be one of: smoke, load, stress, spike, endurance, capacity, volume, all"
        exit 1
    fi

    # Check output format validity
    if [[ ! "$OUTPUT_FORMAT" =~ ^(json|csv|html)$ ]]; then
        log_error "Invalid output format: $OUTPUT_FORMAT. Must be one of: json, csv, html"
        exit 1
    fi

    # Create reports directory
    if [[ ! -d "$REPORTS_DIR" ]]; then
        mkdir -p "$REPORTS_DIR"
    fi

    log_success "Prerequisites validation completed"
}

# Check application health
check_application_health() {
    if [[ "$SKIP_INFRA_CHECK" == true ]]; then
        log_warning "Skipping infrastructure health check"
        return 0
    fi

    log "Checking application health at $TARGET_URL..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s --max-time 10 "$TARGET_URL/health" > /dev/null; then
            log_success "Application is healthy"
            return 0
        fi

        log_warning "Health check failed (attempt $attempt/$max_attempts), retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done

    log_error "Application health check failed after $max_attempts attempts"
    return 1
}

# Build application
build_application() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_warning "Skipping application build"
        return 0
    fi

    log "Building application..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would build application"
        return 0
    fi

    cd "$PROJECT_ROOT"

    # Build the application
    if ! go build -o bin/quantumbeam ./cmd/api-server; then
        log_error "Failed to build application"
        exit 1
    fi

    log_success "Application built successfully"
}

# Generate test configuration
generate_test_config() {
    local test_name="$1"
    local config_file="$REPORTS_DIR/config_${test_name}.yaml"

    log "Generating test configuration for $test_name..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would generate configuration at $config_file"
        echo "$config_file"
        return 0
    fi

    cat > "$config_file" << EOF
# Performance test configuration for $test_name
# Generated on $(date)

# General settings
concurrent_users: $CONCURRENT_USERS
test_duration: $TEST_DURATION
ramp_up_period: 30s
cool_down_period: 30s

# Request settings
requests_per_second: $((CONCURRENT_USERS * 10))
timeout: 30s
retry_attempts: 3

# Load patterns
enable_spike_load: false
spike_multiplier: 2.0
spike_duration: 2m

# Resource monitoring
enable_profiling: $ENABLE_PROFILING
memory_profile_interval: 30s
cpu_profile_interval: 30s

# Output settings
enable_verbose_logging: $ENABLE_VERBOSE_LOGGING
output_format: "$OUTPUT_FORMAT"
report_directory: "$REPORTS_DIR"

# Database settings
enable_db_monitoring: true
db_metrics_interval: 10s

# Cache settings
enable_cache_monitoring: true
cache_metrics_interval: 10s

# Target configuration
target_url: "$TARGET_URL"
environment: "$ENVIRONMENT"

EOF

    echo "$config_file"
}

# Run performance test
run_performance_test() {
    local test_name="$1"
    local config_file="$2"

    log "Running performance test: $test_name"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run performance test with config $config_file"
        return 0
    fi

    cd "$PROJECT_ROOT"

    # Set environment variables
    export TARGET_URL="$TARGET_URL"
    export ENVIRONMENT="$ENVIRONMENT"
    export REPORTS_DIR="$REPORTS_DIR"

    # Run the test
    local test_output="$REPORTS_DIR/${test_name}_output.log"
    local start_time=$(date +%s)

    if go test -v ./tests/performance -run "TestPerformanceSuite" \
        -timeout=2h \
        -args="-config=$config_file" \
        > "$test_output" 2>&1; then

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log_success "Performance test completed successfully in ${duration}s"
        log "Test output saved to: $test_output"

        # Generate summary report
        generate_summary_report "$test_name" "$config_file" "$test_output" "$duration"
    else
        log_error "Performance test failed"
        log "Check test output: $test_output"
        return 1
    fi
}

# Generate summary report
generate_summary_report() {
    local test_name="$1"
    local config_file="$2"
    local test_output="$3"
    local duration="$4"

    log "Generating summary report for $test_name..."

    local summary_file="$REPORTS_DIR/${test_name}_summary.json"

    # Extract key metrics from test output (simplified)
    local total_requests=0
    local success_rate=0.0
    local avg_response_time=0

    if [[ -f "$test_output" ]]; then
        # Extract metrics (this would be more sophisticated in a real implementation)
        total_requests=$(grep -o "Total requests: [0-9]*" "$test_output" | head -1 | grep -o "[0-9]*" || echo "0")
        success_rate=$(grep -o "Success rate: [0-9.]*%" "$test_output" | head -1 | grep -o "[0-9.]*" || echo "0.0")
        avg_response_time=$(grep -o "Average response time: [0-9]*ms" "$test_output" | head -1 | grep -o "[0-9]*" || echo "0")
    fi

    # Create summary report
    cat > "$summary_file" << EOF
{
    "test_name": "$test_name",
    "environment": "$ENVIRONMENT",
    "target_url": "$TARGET_URL",
    "start_time": "$(date -Iseconds)",
    "duration_seconds": $duration,
    "configuration": {
        "concurrent_users": $CONCURRENT_USERS,
        "test_duration": "$TEST_DURATION",
        "enable_profiling": $ENABLE_PROFILING
    },
    "results": {
        "total_requests": $total_requests,
        "success_rate": $success_rate,
        "average_response_time_ms": $avg_response_time,
        "status": "completed"
    },
    "artifacts": {
        "config_file": "$config_file",
        "test_output": "$test_output",
        "report_directory": "$REPORTS_DIR"
    }
}
EOF

    log_success "Summary report generated: $summary_file"
}

# Run all test types
run_all_tests() {
    local test_types=("smoke" "load" "stress" "spike" "endurance" "capacity" "volume")
    local results=()

    log "Running all performance test types..."

    for test_type in "${test_types[@]}"; do
        log "Running test type: $test_type"

        # Adjust parameters for different test types
        case $test_type in
            "smoke")
                export CONCURRENT_USERS=2
                export TEST_DURATION="2m"
                ;;
            "load")
                export CONCURRENT_USERS=20
                export TEST_DURATION="10m"
                ;;
            "stress")
                export CONCURRENT_USERS=100
                export TEST_DURATION="15m"
                export ENABLE_PROFILING=true
                ;;
            "spike")
                export CONCURRENT_USERS=50
                export TEST_DURATION="8m"
                ;;
            "endurance")
                export CONCURRENT_USERS=10
                export TEST_DURATION="30m"
                ;;
            "capacity")
                export CONCURRENT_USERS=200
                export TEST_DURATION="20m"
                ;;
            "volume")
                export CONCURRENT_USERS=5
                export TEST_DURATION="15m"
                ;;
        esac

        # Run the test
        local config_file=$(generate_test_config "$test_type")
        if run_performance_test "$test_type" "$config_file"; then
            results+=("$test_type: SUCCESS")
        else
            results+=("$test_type: FAILED")
        fi

        # Cool down between tests
        if [[ "$DRY_RUN" == false ]]; then
            log "Cooling down for 2 minutes before next test..."
            sleep 120
        fi
    done

    # Generate combined report
    generate_combined_report "${results[@]}"
}

# Generate combined report for all tests
generate_combined_report() {
    local results=("$@")

    log "Generating combined report for all tests..."

    local combined_file="$REPORTS_DIR/all_tests_summary.json"

    cat > "$combined_file" << EOF
{
    "test_suite": "all_performance_tests",
    "environment": "$ENVIRONMENT",
    "target_url": "$TARGET_URL",
    "start_time": "$(date -Iseconds)",
    "test_results": [
EOF

    # Add results
    for i in "${!results[@]}"; do
        local result="${results[$i]}"
        echo "        {\"test\": \"$result\"}" >> "$combined_file"

        if [[ $i -lt $((${#results[@]} - 1)) ]]; then
            echo "," >> "$combined_file"
        fi
    done

    cat >> "$combined_file" << EOF
    ],
    "summary": {
        "total_tests": ${#results[@]},
        "successful_tests": $(printf '%s\n' "${results[@]}" | grep -c "SUCCESS" || echo "0"),
        "failed_tests": $(printf '%s\n' "${results[@]}" | grep -c "FAILED" || echo "0"),
        "status": "completed"
    },
    "artifacts": {
        "report_directory": "$REPORTS_DIR"
    }
}
EOF

    log_success "Combined report generated: $combined_file"
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    # Add any cleanup logic here
}

# Main execution
main() {
    parse_args "$@"

    log "Starting QuantumBeam performance testing"
    log "Environment: $ENVIRONMENT"
    log "Test type: $TEST_TYPE"
    log "Target URL: $TARGET_URL"
    log "Concurrent users: $CONCURRENT_USERS"
    log "Test duration: $TEST_DURATION"

    # Set up cleanup trap
    trap cleanup EXIT

    # Validate prerequisites
    validate_prerequisites

    # Check application health
    check_application_health

    # Build application
    build_application

    # Generate timestamp for this test run
    local timestamp=$(date +%Y%m%d_%H%M%S)
    REPORTS_DIR="$REPORTS_DIR/$timestamp"
    mkdir -p "$REPORTS_DIR"

    log "Reports will be saved to: $REPORTS_DIR"

    # Run tests based on type
    case $TEST_TYPE in
        "all")
            run_all_tests
            ;;
        *)
            # Generate configuration
            local config_file=$(generate_test_config "$TEST_TYPE")

            # Run performance test
            if run_performance_test "$TEST_TYPE" "$config_file"; then
                log_success "Performance testing completed successfully!"
            else
                log_error "Performance testing failed!"
                exit 1
            fi
            ;;
    esac

    log "Performance testing completed!"
    log "Reports available in: $REPORTS_DIR"
}

# Run main function with all arguments
main "$@"