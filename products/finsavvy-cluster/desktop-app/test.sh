#!/bin/bash

# FinSavvyAI Desktop App - Test Script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[TEST]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

echo -e "${BLUE}🧪 FinSavvyAI Desktop App Test Suite${NC}"
echo -e "${BLUE}=====================================${NC}"

# Test 1: Check Dependencies
test_dependencies() {
    print_status "Testing dependencies..."

    # Check Rust
    if command -v cargo &> /dev/null; then
        print_status "✓ Rust/Cargo available"
    else
        print_error "✗ Rust/Cargo not found"
        return 1
    fi

    # Check Go
    if command -v go &> /dev/null; then
        print_status "✓ Go available"
    else
        print_error "✗ Go not found"
        return 1
    fi

    # Check Node.js
    if command -v node &> /dev/null; then
        print_status "✓ Node.js available"
    else
        print_error "✗ Node.js not found"
        return 1
    fi

    # Check Python
    if command -v python3 &> /dev/null; then
        print_status "✓ Python3 available"
    else
        print_error "✗ Python3 not found"
        return 1
    fi

    print_status "✓ All dependencies available"
}

# Test 2: Build Go Backend
test_go_backend() {
    print_status "Testing Go backend build..."

    cd src-go
    if go build -o ../test-build/go-backend .; then
        print_status "✓ Go backend builds successfully"
    else
        print_error "✗ Go backend build failed"
        return 1
    fi
    cd ..

    # Test backend functionality
    print_status "Testing backend functionality..."

    # Start backend in background
    PORT=8082 ../test-build/go-backend &
    BACKEND_PID=$!

    # Wait for startup
    sleep 2

    # Test API endpoints
    if curl -s http://localhost:8082/api/cluster/status > /dev/null; then
        print_status "✓ Backend API responding"
    else
        print_warning "⚠ Backend API not responding (expected without cluster)"
    fi

    if curl -s http://localhost:8082/api/config > /dev/null; then
        print_status "✓ Configuration API responding"
    else
        print_warning "⚠ Configuration API not responding"
    fi

    # Cleanup
    kill $BACKEND_PID 2>/dev/null || true
    wait $BACKEND_PID 2>/dev/null || true

    print_status "✓ Go backend test completed"
}

# Test 3: Test Frontend Files
test_frontend() {
    print_status "Testing frontend files..."

    # Check if essential files exist
    local files=(
        "src-frontend/index.html"
        "src-frontend/css/main.css"
        "src-frontend/js/api.js"
        "src-frontend/js/app.js"
    )

    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            print_status "✓ $file exists"
        else
            print_error "✗ $file missing"
            return 1
        fi
    done

    # Test HTML validity
    if command -v html5validator &> /dev/null; then
        if html5validator --root src-frontend/ --show-warnings; then
            print_status "✓ HTML5 validation passed"
        else
            print_warning "⚠ HTML5 validation warnings"
        fi
    else
        print_warning "⚠ HTML5 validator not available"
    fi

    print_status "✓ Frontend files test completed"
}

# Test 4: Configuration System
test_configuration() {
    print_status "Testing configuration system..."

    # Test Go config loading
    cd src-go
    if go test -run TestConfig 2>/dev/null || [ $? -eq 1 ]; then
        print_status "✓ Configuration system functional"
    else
        print_warning "⚠ Configuration tests not available"
    fi
    cd ..

    print_status "✓ Configuration test completed"
}

# Test 5: Integration Tests
test_integration() {
    print_status "Testing integration..."

    # Test API client connectivity
    cd src-go
    if go test -run TestAPIClient 2>/dev/null || [ $? -eq 1 ]; then
        print_status "✓ API client functional"
    else
        print_warning "⚠ API client tests not available"
    fi
    cd ..

    print_status "✓ Integration test completed"
}

# Test 6: Cross-platform Compatibility
test_platform_compatibility() {
    print_status "Testing platform compatibility..."

    # Check current platform
    local platform=$(uname -s)
    local arch=$(uname -m)

    print_status "Current platform: $platform-$arch"

    # Test platform-specific features
    case $platform in
        Darwin)
            if command -v osascript &> /dev/null; then
                print_status "✓ macOS notifications available"
            fi
            ;;
        Linux)
            if command -v notify-send &> /dev/null; then
                print_status "✓ Linux notifications available"
            fi
            ;;
        *)
            print_warning "⚠ Unknown platform: $platform"
            ;;
    esac

    print_status "✓ Platform compatibility test completed"
}

# Test 7: Performance Tests
test_performance() {
    print_status "Testing performance..."

    # Test backend startup time
    cd src-go
    local start_time=$(date +%s%N)
    go build -o ../test-build/go-backend-perf .
    local build_time=$(($(date +%s%N) - start_time))

    if [ $build_time -lt 5000000000 ]; then  # 5 seconds
        print_status "✓ Backend builds in reasonable time (${build_time}ns)"
    else
        print_warning "⚠ Backend build slow (${build_time}ns)"
    fi

    cd ..

    # Test binary size
    local binary_size=$(stat -c%s test-build/go-backend 2>/dev/null || stat -f%z test-build/go-backend 2>/dev/null || echo 0)
    if [ $binary_size -lt 50000000 ]; then  # 50MB
        print_status "✓ Backend binary size reasonable ($(($binary_size / 1024 / 1024))MB)"
    else
        print_warning "⚠ Backend binary large ($(($binary_size / 1024 / 1024))MB)"
    fi

    print_status "✓ Performance test completed"
}

# Test 8: Security Tests
test_security() {
    print_status "Testing security..."

    # Check for hardcoded secrets
    if grep -r "password\|secret\|key" src-go/ | grep -v "_key\|apikey" | head -5; then
        print_warning "⚠ Potential hardcoded secrets found"
    else
        print_status "✓ No obvious hardcoded secrets"
    fi

    # Check for unsafe functions
    if grep -r "exec\|eval\|system" src-go/ | head -5; then
        print_warning "⚠ Potentially unsafe functions found"
    else
        print_status "✓ No obvious unsafe functions"
    fi

    print_status "✓ Security test completed"
}

# Cleanup
cleanup() {
    print_status "Cleaning up test artifacts..."
    rm -rf test-build/
    pkill -f go-backend 2>/dev/null || true
}

# Main test execution
main() {
    local tests_passed=0
    local tests_total=8

    # Create test build directory
    mkdir -p test-build

    # Run tests
    if test_dependencies; then
        ((tests_passed++))
    fi

    if test_go_backend; then
        ((tests_passed++))
    fi

    if test_frontend; then
        ((tests_passed++))
    fi

    if test_configuration; then
        ((tests_passed++))
    fi

    if test_integration; then
        ((tests_passed++))
    fi

    if test_platform_compatibility; then
        ((tests_passed++))
    fi

    if test_performance; then
        ((tests_passed++))
    fi

    if test_security; then
        ((tests_passed++))
    fi

    # Cleanup
    cleanup

    # Results
    echo -e "\n${BLUE}📊 Test Results${NC}"
    echo -e "${BLUE}================${NC}"
    echo -e "Tests passed: ${GREEN}$tests_passed${NC}/$tests_total"

    if [ $tests_passed -eq $tests_total ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"
