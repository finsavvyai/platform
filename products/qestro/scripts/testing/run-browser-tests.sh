#!/bin/bash

# 🌐 Questro Browser Testing Script
echo "🎯 Starting Questro Enterprise Testing System Browser Tests"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Check if backend is running
check_backend() {
    print_status "🔍 Checking if backend is running..." $BLUE
    
    if curl -s http://localhost:8000/health > /dev/null; then
        print_status "✅ Backend is running on http://localhost:8000" $GREEN
        return 0
    else
        print_status "❌ Backend is not running" $RED
        return 1
    fi
}

# Check if frontend is running
check_frontend() {
    print_status "🔍 Checking if frontend is running..." $BLUE
    
    if curl -s http://localhost:3000 > /dev/null; then
        print_status "✅ Frontend is running on http://localhost:3000" $GREEN
        return 0
    else
        print_status "❌ Frontend is not running" $RED
        return 1
    fi
}

# Start backend if not running
start_backend() {
    print_status "🚀 Starting backend server..." $YELLOW
    cd backend
    npm run dev &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    sleep 5
    
    if check_backend; then
        print_status "✅ Backend started successfully (PID: $BACKEND_PID)" $GREEN
    else
        print_status "❌ Failed to start backend" $RED
        exit 1
    fi
}

# Start frontend if not running
start_frontend() {
    print_status "🚀 Starting frontend server..." $YELLOW
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    # Wait for frontend to start
    sleep 5
    
    if check_frontend; then
        print_status "✅ Frontend started successfully (PID: $FRONTEND_PID)" $GREEN
    else
        print_status "❌ Failed to start frontend" $RED
        exit 1
    fi
}

# Run unit tests
run_unit_tests() {
    print_status "🧪 Running unit tests..." $BLUE
    cd backend
    npm test -- --testPathPattern="(web-recording|mobile-recording|api-types|cloud-testing|enhanced-web|schema-validation)" --verbose
    TEST_RESULT=$?
    cd ..
    
    if [ $TEST_RESULT -eq 0 ]; then
        print_status "✅ All unit tests passed!" $GREEN
    else
        print_status "❌ Some unit tests failed" $RED
    fi
    
    return $TEST_RESULT
}

# Open browser test page
open_test_page() {
    print_status "🌐 Opening browser test page..." $BLUE
    
    # Create a simple test URL
    TEST_URL="file://$(pwd)/test-page.html"
    
    # Try to open in default browser
    if command -v open > /dev/null; then
        # macOS
        open "$TEST_URL"
    elif command -v xdg-open > /dev/null; then
        # Linux
        xdg-open "$TEST_URL"
    elif command -v start > /dev/null; then
        # Windows
        start "$TEST_URL"
    else
        print_status "📋 Please open this URL in your browser: $TEST_URL" $YELLOW
    fi
    
    print_status "✅ Browser test page should be opening..." $GREEN
}

# Main execution
main() {
    print_status "🎯 Questro Enterprise Testing System - Browser Test Runner" $BLUE
    echo ""
    
    # Check current status
    BACKEND_RUNNING=false
    FRONTEND_RUNNING=false
    
    if check_backend; then
        BACKEND_RUNNING=true
    fi
    
    if check_frontend; then
        FRONTEND_RUNNING=true
    fi
    
    # Start services if needed
    if [ "$BACKEND_RUNNING" = false ]; then
        start_backend
    fi
    
    if [ "$FRONTEND_RUNNING" = false ]; then
        start_frontend
    fi
    
    echo ""
    print_status "📋 System Status:" $BLUE
    print_status "   Backend: http://localhost:8000" $GREEN
    print_status "   Frontend: http://localhost:3000" $GREEN
    print_status "   Test Page: file://$(pwd)/test-page.html" $GREEN
    echo ""
    
    # Run tests
    print_status "🧪 Running automated tests..." $BLUE
    if run_unit_tests; then
        print_status "✅ All automated tests passed!" $GREEN
    else
        print_status "⚠️  Some automated tests failed, but you can still test manually" $YELLOW
    fi
    
    echo ""
    print_status "🌐 Opening browser test page for manual testing..." $BLUE
    open_test_page
    
    echo ""
    print_status "🎉 Browser testing setup complete!" $GREEN
    print_status "📋 Next steps:" $BLUE
    print_status "   1. Use the browser test page to test features manually" $YELLOW
    print_status "   2. Open http://localhost:3000 to test the full application" $YELLOW
    print_status "   3. Check browser console for detailed logs" $YELLOW
    print_status "   4. Monitor backend logs for API calls" $YELLOW
    echo ""
    
    # Keep script running
    print_status "🔄 Press Ctrl+C to stop all services and exit" $BLUE
    
    # Trap Ctrl+C to cleanup
    trap cleanup INT
    
    # Wait indefinitely
    while true; do
        sleep 1
    done
}

# Cleanup function
cleanup() {
    echo ""
    print_status "🛑 Stopping services..." $YELLOW
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        print_status "✅ Backend stopped" $GREEN
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        print_status "✅ Frontend stopped" $GREEN
    fi
    
    print_status "👋 Browser testing session ended" $BLUE
    exit 0
}

# Run main function
main