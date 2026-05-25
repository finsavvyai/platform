#!/bin/bash

# QueryFlux Database Adapter Test Runner
# This script runs comprehensive tests for all database adapters

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed or not in PATH"
        exit 1
    fi
    print_success "docker-compose is available"
}

# Start test database containers
start_databases() {
    print_status "Starting test database containers..."

    # Stop any existing containers
    docker-compose -f docker-compose.test.yml -p queryflux-test down -v > /dev/null 2>&1 || true

    # Start containers
    if docker-compose -f docker-compose.test.yml -p queryflux-test up -d; then
        print_success "Database containers started"
    else
        print_error "Failed to start database containers"
        exit 1
    fi

    # Wait for containers to be healthy
    print_status "Waiting for containers to be healthy..."
    sleep 30

    # Check if containers are running
    running_containers=$(docker-compose -f docker-compose.test.yml -p queryflux-test ps -q | wc -l)
    if [ "$running_containers" -eq 0 ]; then
        print_error "No containers are running"
        exit 1
    fi

    print_success "$running_containers containers are running"
}

# Stop test database containers
stop_databases() {
    print_status "Stopping test database containers..."
    docker-compose -f docker-compose.test.yml -p queryflux-test down -v
    print_success "Database containers stopped"
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."

    cd tests/integration

    # Set environment variables for testing
    export POSTGRES_HOST=localhost
    export POSTGRES_PORT=5432
    export POSTGRES_USER=testuser
    export POSTGRES_PASSWORD=testpass
    export POSTGRES_DATABASE=queryflux_test

    export MYSQL_HOST=localhost
    export MYSQL_PORT=3306
    export MYSQL_USER=testuser
    export MYSQL_PASSWORD=testpass
    export MYSQL_DATABASE=queryflux_test

    export MONGODB_HOST=localhost
    export MONGODB_PORT=27017
    export MONGODB_USERNAME=testuser
    export MONGODB_PASSWORD=testpass
    export MONGODB_DATABASE=queryflux_test

    export REDIS_HOST=localhost
    export REDIS_PORT=6379
    export REDIS_PASSWORD=

    # Run tests
    if go test -v -tags=integration ./...; then
        print_success "Integration tests passed"
    else
        print_error "Integration tests failed"
        return 1
    fi

    cd ../..
}

# Run performance tests
run_performance_tests() {
    print_status "Running performance tests..."

    cd tests/integration

    # Run performance tests
    if go test -v -tags=integration -run=TestAdapterPerformance ./...; then
        print_success "Performance tests passed"
    else
        print_warning "Performance tests failed (this might be expected in CI environments)"
        return 0
    fi

    cd ../..
}

# Run Docker compose tests
run_docker_tests() {
    print_status "Running Docker compose tests..."

    cd tests/integration

    # Run Docker-specific tests
    if go test -v -tags=integration -run=TestDockerCompose ./...; then
        print_success "Docker compose tests passed"
    else
        print_error "Docker compose tests failed"
        return 1
    fi

    cd ../..
}

# Check test coverage
check_coverage() {
    print_status "Running tests with coverage..."

    cd tests/integration

    # Run tests with coverage
    if go test -v -tags=integration -coverprofile=coverage.out ./...; then
        print_success "Tests completed with coverage"

        # Show coverage summary
        if command -v go &> /dev/null; then
            go tool cover -func=coverage.out
        fi
    else
        print_error "Tests with coverage failed"
        return 1
    fi

    cd ../..
}

# Show container status
show_container_status() {
    print_status "Container Status:"
    docker-compose -f docker-compose.test.yml -p queryflux-test ps

    print_status "Container Logs (last 10 lines each):"
    for container in queryflux-postgres-test queryflux-mysql-test queryflux-mongodb-test queryflux-redis-test; do
        if docker ps --filter "name=$container" --quiet | grep -q .; then
            echo -e "\n${BLUE}$container:${NC}"
            docker logs --tail 10 "$container" 2>&1 | tail -10
        fi
    done
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    stop_databases
}

# Set up trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    echo -e "${BLUE}=================================================="
    echo "QueryFlux Database Adapter Test Runner"
    echo "==================================================${NC}"

    # Parse command line arguments
    SKIP_DOCKER=false
    SKIP_PERFORMANCE=false
    SKIP_COVERAGE=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-docker)
                SKIP_DOCKER=true
                shift
                ;;
            --skip-performance)
                SKIP_PERFORMANCE=true
                shift
                ;;
            --skip-coverage)
                SKIP_COVERAGE=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-docker      Skip Docker container management"
                echo "  --skip-performance Skip performance tests"
                echo "  --skip-coverage    Skip coverage report"
                echo "  --help, -h         Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Check dependencies
    check_docker
    check_docker_compose

    # Start containers unless skipped
    if [ "$SKIP_DOCKER" = false ]; then
        start_databases
    fi

    # Run tests
    test_failed=false

    # Run integration tests
    if ! run_integration_tests; then
        test_failed=true
    fi

    # Run Docker tests
    if [ "$SKIP_DOCKER" = false ]; then
        if ! run_docker_tests; then
            test_failed=true
        fi
    fi

    # Run performance tests
    if [ "$SKIP_PERFORMANCE" = false ]; then
        if ! run_performance_tests; then
            print_warning "Performance tests failed (non-critical)"
        fi
    fi

    # Check coverage
    if [ "$SKIP_COVERAGE" = false ]; then
        if ! check_coverage; then
            test_failed=true
        fi
    fi

    # Show container status if tests failed
    if [ "$test_failed" = true ]; then
        print_error "Some tests failed. Showing container status:"
        show_container_status
        exit 1
    fi

    print_success "All tests passed successfully!"
}

# Run main function
main "$@"