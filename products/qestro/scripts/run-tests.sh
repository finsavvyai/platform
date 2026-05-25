#!/bin/bash

# Questro Test Runner Script
# Runs all tests across backend, frontend, and agent with coverage reporting

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install dependencies if needed
install_dependencies() {
    local dir=$1
    if [ -f "$dir/package.json" ]; then
        print_status "Installing dependencies in $dir..."
        cd "$dir"
        npm install
        cd - > /dev/null
    fi
}

# Function to run backend tests
run_backend_tests() {
    print_status "Running backend tests..."
    cd backend
    
    # Install dependencies if needed
    install_dependencies "."
    
    # Run tests with coverage
    if npm run test:coverage; then
        print_success "Backend tests passed"
    else
        print_error "Backend tests failed"
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to run frontend tests
run_frontend_tests() {
    print_status "Running frontend tests..."
    cd frontend
    
    # Install dependencies if needed
    install_dependencies "."
    
    # Run tests with coverage
    if npm run test:coverage; then
        print_success "Frontend tests passed"
    else
        print_error "Frontend tests failed"
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to run agent tests
run_agent_tests() {
    print_status "Running agent tests..."
    cd agent
    
    # Install dependencies if needed
    install_dependencies "."
    
    # Run tests with coverage
    if npm run test:coverage; then
        print_success "Agent tests passed"
    else
        print_error "Agent tests failed"
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to run E2E tests
run_e2e_tests() {
    print_status "Running E2E tests..."
    
    # Check if Playwright is available
    if command_exists npx; then
        if npx playwright test --help > /dev/null 2>&1; then
            if npx playwright test; then
                print_success "E2E tests passed"
            else
                print_error "E2E tests failed"
                exit 1
            fi
        else
            print_warning "Playwright not found, skipping E2E tests"
        fi
    else
        print_warning "npx not available, skipping E2E tests"
    fi
}

# Function to generate coverage report
generate_coverage_report() {
    print_status "Generating coverage report..."
    
    # Create coverage directory
    mkdir -p coverage
    
    # Combine coverage reports if they exist
    if [ -f "backend/coverage/coverage-final.json" ] && [ -f "frontend/coverage/coverage-final.json" ]; then
        print_status "Combining coverage reports..."
        
        # Use nyc to merge coverage reports
        if command_exists npx; then
            npx nyc merge backend/coverage frontend/coverage coverage/combined.json
            npx nyc report --reporter=html --reporter=text --reporter=lcov --report-dir=coverage
        else
            print_warning "nyc not available, coverage reports not merged"
        fi
    fi
    
    print_success "Coverage report generated in coverage/"
}

# Function to run specific test suite
run_specific_tests() {
    local suite=$1
    
    case $suite in
        "backend")
            run_backend_tests
            ;;
        "frontend")
            run_frontend_tests
            ;;
        "agent")
            run_agent_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        *)
            print_error "Unknown test suite: $suite"
            print_status "Available suites: backend, frontend, agent, e2e"
            exit 1
            ;;
    esac
}

# Function to run tests in watch mode
run_watch_tests() {
    local suite=$1
    
    print_status "Running tests in watch mode for $suite..."
    
    case $suite in
        "backend")
            cd backend && npm run test:watch
            ;;
        "frontend")
            cd frontend && npm run test:watch
            ;;
        "agent")
            cd agent && npm run test:watch
            ;;
        *)
            print_error "Watch mode not supported for: $suite"
            exit 1
            ;;
    esac
}

# Function to run performance tests
run_performance_tests() {
    print_status "Running performance tests..."
    
    # Check if k6 is available
    if command_exists k6; then
        if [ -f "tests/performance/load-test.js" ]; then
            k6 run tests/performance/load-test.js
        else
            print_warning "Performance test file not found"
        fi
    else
        print_warning "k6 not installed, skipping performance tests"
        print_status "Install k6: https://k6.io/docs/getting-started/installation/"
    fi
}

# Function to run security tests
run_security_tests() {
    print_status "Running security tests..."
    
    # Check if OWASP ZAP is available
    if command_exists zap-baseline; then
        if [ -f "tests/security/security-scan.js" ]; then
            zap-baseline -t http://localhost:3000 -c tests/security/security-scan.js
        else
            print_warning "Security test configuration not found"
        fi
    else
        print_warning "OWASP ZAP not installed, skipping security tests"
    fi
}

# Function to show help
show_help() {
    echo "Questro Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS] [SUITE]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -w, --watch         Run tests in watch mode"
    echo "  -p, --performance   Run performance tests"
    echo "  -s, --security      Run security tests"
    echo "  -c, --coverage      Generate coverage report"
    echo "  -a, --all           Run all tests (default)"
    echo ""
    echo "Suites:"
    echo "  backend             Run backend tests only"
    echo "  frontend            Run frontend tests only"
    echo "  agent               Run agent tests only"
    echo "  e2e                 Run E2E tests only"
    echo ""
    echo "Examples:"
    echo "  $0                  Run all tests"
    echo "  $0 backend          Run backend tests only"
    echo "  $0 -w frontend      Run frontend tests in watch mode"
    echo "  $0 -p               Run performance tests"
    echo "  $0 -s               Run security tests"
    echo "  $0 -c               Generate coverage report"
}

# Main script logic
main() {
    local watch_mode=false
    local performance_tests=false
    local security_tests=false
    local coverage_report=false
    local run_all=true
    local specific_suite=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -w|--watch)
                watch_mode=true
                shift
                ;;
            -p|--performance)
                performance_tests=true
                run_all=false
                shift
                ;;
            -s|--security)
                security_tests=true
                run_all=false
                shift
                ;;
            -c|--coverage)
                coverage_report=true
                run_all=false
                shift
                ;;
            -a|--all)
                run_all=true
                shift
                ;;
            backend|frontend|agent|e2e)
                specific_suite=$1
                run_all=false
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Check if we're in the project root
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    print_status "Starting Questro test suite..."
    
    # Run specific tests based on options
    if [ "$performance_tests" = true ]; then
        run_performance_tests
    elif [ "$security_tests" = true ]; then
        run_security_tests
    elif [ "$coverage_report" = true ]; then
        generate_coverage_report
    elif [ "$watch_mode" = true ] && [ -n "$specific_suite" ]; then
        run_watch_tests "$specific_suite"
    elif [ -n "$specific_suite" ]; then
        run_specific_tests "$specific_suite"
    elif [ "$run_all" = true ]; then
        # Run all tests
        run_backend_tests
        run_frontend_tests
        run_agent_tests
        run_e2e_tests
        generate_coverage_report
    fi
    
    print_success "All tests completed successfully!"
}

# Run main function with all arguments
main "$@"











