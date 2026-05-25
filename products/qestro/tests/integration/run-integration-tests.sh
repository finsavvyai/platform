#!/bin/bash

# Qestro SaaS Platform - Integration Test Runner
# This script sets up the test environment and runs all integration tests

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/tests/integration"
TEST_CONFIG_FILE="$PROJECT_ROOT/backend/.env.test"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"
COVERAGE_DIR="$TEST_RESULTS_DIR/coverage"

# Parse command line arguments
VERBOSE=false
COVERAGE=false
WATCH=false
TEST_PATTERN=""
SKIP_SETUP=false
CLEANUP=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --watch|-w)
            WATCH=true
            shift
            ;;
        --pattern|-p)
            TEST_PATTERN="$2"
            shift 2
            ;;
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --help|-h)
            cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --verbose, -v           Enable verbose output
    --coverage, -c         Generate coverage report
    --watch, -w            Run tests in watch mode
    --pattern, -p PATTERN  Run tests matching pattern
    --skip-setup          Skip test environment setup
    --no-cleanup          Don't clean up test data after tests
    --help, -h            Show this help message

EXAMPLES:
    $0                     Run all integration tests
    $0 --verbose           Run with verbose output
    $0 --coverage          Run with coverage reporting
    $0 --pattern auth      Run auth-related tests only
    $0 --watch             Run tests in watch mode
EOF
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Setup function
setup_test_environment() {
    log_info "Setting up test environment..."

    # Create test configuration file
    log_info "Creating test configuration..."
    cat > "$TEST_CONFIG_FILE" << EOF
# Test Environment Configuration
NODE_ENV=test
PORT=8000
WS_PORT=8001

# Database Configuration
DATABASE_URL=postgresql://test:test@localhost:5432/qestro_test
USE_SUPABASE=false

# Redis Configuration
REDIS_URL=redis://localhost:6379/1

# JWT Configuration
JWT_SECRET=test-jwt-secret-key-for-testing-only
JWT_REFRESH_SECRET=test-refresh-secret-key-for-testing-only
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Email Configuration (disable in tests)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
EMAIL_FROM=test@qestro.io

# External Services (disable in tests)
STRIPE_API_KEY=test_stripe_key
LEMONSQUEEZY_API_KEY=test_lemonsqueezy_key
OPENAI_API_KEY=test_openai_key
HUGGINGFACE_API_KEY=test_huggingface_key

# Monitoring (disable in tests)
SENTRY_DSN=
LOG_LEVEL=error

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_EMAIL_VERIFICATION=false
ENABLE_MULTI_TENANT=true
ENABLE_ANALYTICS=true

# Test-specific settings
BYPASS_AUTH=false
MOCK_EXTERNAL_APIS=true
SKIP_EMAIL_SENDING=true
EOF

    # Check if required services are running
    log_info "Checking required services..."

    # Check PostgreSQL
    if ! pg_isready -h localhost -p 5432 -U test >/dev/null 2>&1; then
        log_error "PostgreSQL is not running or not accessible"
        log_info "Please start PostgreSQL and create test database:"
        log_info "  createdb -U test qestro_test"
        exit 1
    fi

    # Check Redis
    if ! redis-cli -n 1 ping >/dev/null 2>&1; then
        log_error "Redis is not running or not accessible"
        log_info "Please start Redis server"
        exit 1
    fi

    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$COVERAGE_DIR"

    # Setup database schema
    log_info "Setting up database schema..."
    cd "$PROJECT_ROOT/backend"

    # Run database migrations
    if [[ -f "migrations/001_complete_schema.sql" ]]; then
        PGPASSWORD=test psql -h localhost -U test -d qestro_test -f migrations/001_complete_schema.sql
    else
        log_warning "Database schema file not found, tests may fail"
    fi

    # Install dependencies
    log_info "Installing dependencies..."
    cd "$PROJECT_ROOT"
    npm ci

    # Build backend
    log_info "Building backend..."
    cd backend
    npm run build

    log_success "Test environment setup completed"
}

# Cleanup function
cleanup_test_environment() {
    if [[ "$CLEANUP" == true ]]; then
        log_info "Cleaning up test environment..."

        # Stop backend server if running
        if pgrep -f "node.*backend.*8000" > /dev/null; then
            log_info "Stopping backend server..."
            pkill -f "node.*backend.*8000" || true
            sleep 2
        fi

        # Clean up test database (optional)
        # PGPASSWORD=test psql -h localhost -U test -d qestro_test -c "
        #     DROP SCHEMA public CASCADE;
        #     CREATE SCHEMA public;
        #     GRANT ALL ON SCHEMA public TO test;
        # " || log_warning "Database cleanup failed"

        # Remove test configuration
        if [[ -f "$TEST_CONFIG_FILE" ]]; then
            rm "$TEST_CONFIG_FILE"
        fi

        log_success "Test environment cleanup completed"
    fi
}

# Start backend server
start_backend_server() {
    log_info "Starting backend server..."

    cd "$PROJECT_ROOT/backend"

    # Start server in background
    NODE_ENV=test node dist/server.js > "$TEST_RESULTS_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!

    # Save PID for cleanup
    echo "$BACKEND_PID" > "$TEST_RESULTS_DIR/backend.pid"

    # Wait for server to start
    local timeout=30
    local count=0

    while [[ $count -lt $timeout ]]; do
        if curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
            log_success "Backend server started successfully"
            return 0
        fi

        sleep 1
        count=$((count + 1))
    done

    log_error "Backend server failed to start within $timeout seconds"
    if [[ -f "$TEST_RESULTS_DIR/backend.log" ]]; then
        log_error "Backend logs:"
        cat "$TEST_RESULTS_DIR/backend.log"
    fi
    return 1
}

# Stop backend server
stop_backend_server() {
    if [[ -f "$TEST_RESULTS_DIR/backend.pid" ]]; then
        local PID=$(cat "$TEST_RESULTS_DIR/backend.pid")
        if kill -0 "$PID" 2>/dev/null; then
            log_info "Stopping backend server (PID: $PID)..."
            kill "$PID" || true
            sleep 2

            # Force kill if still running
            if kill -0 "$PID" 2>/dev/null; then
                kill -9 "$PID" || true
            fi
        fi
        rm "$TEST_RESULTS_DIR/backend.pid"
    fi
}

# Run tests
run_tests() {
    log_info "Running integration tests..."

    local jest_args=(
        "--config=$TEST_DIR/jest.config.js"
        "--testEnvironment=node"
        "--detectOpenHandles"
        "--forceExit"
    )

    if [[ "$VERBOSE" == true ]]; then
        jest_args+=("--verbose")
    fi

    if [[ "$COVERAGE" == true ]]; then
        jest_args+=("--coverage")
        jest_args+=("--coverageDirectory=$COVERAGE_DIR")
        jest_args+=("--collectCoverageFrom=backend/src/**/*.{ts,js}")
        jest_args+=("--collectCoverageFrom=frontend/src/**/*.{ts,tsx}")
        jest_args+=("--coverageReporters=text,lcov,html")
    fi

    if [[ "$WATCH" == true ]]; then
        jest_args+=("--watch")
    fi

    if [[ -n "$TEST_PATTERN" ]]; then
        jest_args+=("--testNamePattern=$TEST_PATTERN")
    fi

    # Set environment variables for tests
    export NODE_ENV=test
    export TEST_API_URL=http://localhost:8000
    export TEST_WS_URL=ws://localhost:8001
    export TEST_DATABASE_URL=postgresql://test:test@localhost:5432/qestro_test
    export TEST_REDIS_URL=redis://localhost:6379/1

    # Run tests
    cd "$PROJECT_ROOT"

    if npx jest "${jest_args[@]}" "$TEST_DIR"; then
        log_success "All integration tests passed!"

        # Show coverage summary if coverage was enabled
        if [[ "$COVERAGE" == true && -f "$COVERAGE_DIR/lcov.info" ]]; then
            log_info "Coverage report generated at: $COVERAGE_DIR"

            # Show coverage summary
            if command -v nyc >/dev/null 2>&1; then
                npx nyc report --reporter=text --reporter=text-summary --reporter=html --report-dir="$COVERAGE_DIR"
            fi
        fi

        return 0
    else
        log_error "Some integration tests failed"

        # Show test logs if available
        if [[ -f "$TEST_RESULTS_DIR/backend.log" ]]; then
            log_info "Backend server logs:"
            cat "$TEST_RESULTS_DIR/backend.log"
        fi

        return 1
    fi
}

# Main execution
main() {
    log_info "Qestro Integration Test Runner"
    log_info "==============================="

    # Setup cleanup trap
    trap cleanup_test_environment EXIT

    # Setup test environment
    if [[ "$SKIP_SETUP" != true ]]; then
        setup_test_environment
    fi

    # Start backend server
    if ! start_backend_server; then
        exit 1
    fi

    # Ensure backend is stopped when script exits
    trap stop_backend_server EXIT

    # Run tests
    local test_result=0
    if ! run_tests; then
        test_result=1
    fi

    # Show results summary
    log_info "Test Results Summary"
    log_info "===================="

    if [[ $test_result -eq 0 ]]; then
        log_success "All integration tests completed successfully! 🎉"
    else
        log_error "Integration tests failed! ❌"
    fi

    # Show test artifacts location
    if [[ -d "$TEST_RESULTS_DIR" ]]; then
        log_info "Test artifacts: $TEST_RESULTS_DIR"
        if [[ "$COVERAGE" == true && -d "$COVERAGE_DIR" ]]; then
            log_info "Coverage report: $COVERAGE_DIR/index.html"
        fi
    fi

    exit $test_result
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    # Check required commands
    for cmd in node npm curl psql redis-cli; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and try again"
        exit 1
    fi
}

# Run main function
check_dependencies
main
