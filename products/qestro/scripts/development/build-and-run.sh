#!/bin/bash

# 🚀 Qestro - Complete Build and Run Script
# Builds and runs the entire Qestro platform: Backend + Desktop App

set -e

# Colors for beautiful output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
DESKTOP_DIR="$PROJECT_ROOT/QestroDesktop"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Default options
BUILD_BACKEND=true
BUILD_DESKTOP=true
BUILD_FRONTEND=false
RUN_BACKEND=true
RUN_DESKTOP=true
RUN_FRONTEND=false
CLEAN_BUILD=false
VERBOSE=false

# Function to print colored output
print_header() {
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}  🚀 $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
}

print_step() {
    echo -e "${YELLOW}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to show usage
show_usage() {
    echo -e "${WHITE}Qestro Build and Run Script${NC}"
    echo ""
    echo -e "${CYAN}Usage:${NC}"
    echo "  $0 [OPTIONS]"
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo "  -h, --help              Show this help message"
    echo "  -c, --clean             Clean build (remove node_modules, build folders)"
    echo "  -v, --verbose           Verbose output"
    echo "  --backend-only          Build and run only backend"
    echo "  --desktop-only          Build and run only desktop app"
    echo "  --frontend-only         Build and run only frontend"
    echo "  --no-backend            Skip backend"
    echo "  --no-desktop            Skip desktop app"
    echo "  --with-frontend         Include frontend in build"
    echo "  --build-only            Build only, don't run"
    echo "  --run-only              Run only, don't build"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  $0                      # Build and run backend + desktop"
    echo "  $0 --clean              # Clean build everything"
    echo "  $0 --backend-only       # Only backend"
    echo "  $0 --desktop-only       # Only desktop app"
    echo "  $0 --with-frontend      # Include web frontend"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -c|--clean)
            CLEAN_BUILD=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --backend-only)
            BUILD_BACKEND=true
            BUILD_DESKTOP=false
            BUILD_FRONTEND=false
            RUN_BACKEND=true
            RUN_DESKTOP=false
            RUN_FRONTEND=false
            shift
            ;;
        --desktop-only)
            BUILD_BACKEND=false
            BUILD_DESKTOP=true
            BUILD_FRONTEND=false
            RUN_BACKEND=false
            RUN_DESKTOP=true
            RUN_FRONTEND=false
            shift
            ;;
        --frontend-only)
            BUILD_BACKEND=false
            BUILD_DESKTOP=false
            BUILD_FRONTEND=true
            RUN_BACKEND=false
            RUN_DESKTOP=false
            RUN_FRONTEND=true
            shift
            ;;
        --no-backend)
            BUILD_BACKEND=false
            RUN_BACKEND=false
            shift
            ;;
        --no-desktop)
            BUILD_DESKTOP=false
            RUN_DESKTOP=false
            shift
            ;;
        --with-frontend)
            BUILD_FRONTEND=true
            RUN_FRONTEND=true
            shift
            ;;
        --build-only)
            RUN_BACKEND=false
            RUN_DESKTOP=false
            RUN_FRONTEND=false
            shift
            ;;
        --run-only)
            BUILD_BACKEND=false
            BUILD_DESKTOP=false
            BUILD_FRONTEND=false
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2)
    print_info "Node.js version: $NODE_VERSION"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install npm"
        exit 1
    fi

    NPM_VERSION=$(npm --version)
    print_info "npm version: $NPM_VERSION"

    # Check Xcode (for desktop app)
    if [ "$BUILD_DESKTOP" = true ] || [ "$RUN_DESKTOP" = true ]; then
        if ! command -v xcodebuild &> /dev/null; then
            print_error "Xcode command line tools not found. Please install Xcode"
            exit 1
        fi

        XCODE_VERSION=$(xcodebuild -version | head -n 1)
        print_info "Xcode: $XCODE_VERSION"
    fi

    # Check PostgreSQL
    if [ "$BUILD_BACKEND" = true ] || [ "$RUN_BACKEND" = true ]; then
        if command -v pg_isready &> /dev/null; then
            if pg_isready -h localhost -p 5432 &> /dev/null; then
                print_success "PostgreSQL is running"
            else
                print_warning "PostgreSQL not running. Backend may have database issues."
            fi
        else
            print_warning "PostgreSQL not found. Backend may have database issues."
        fi
    fi

    print_success "Prerequisites check completed"
}

# Function to clean build artifacts
clean_build() {
    print_step "Cleaning build artifacts..."

    # Clean backend
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        [ -d "node_modules" ] && rm -rf node_modules
        [ -d "dist" ] && rm -rf dist
        [ -d "coverage" ] && rm -rf coverage
        [ -f "server.log" ] && rm -f server.log
        print_info "Backend cleaned"
    fi

    # Clean frontend
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        [ -d "node_modules" ] && rm -rf node_modules
        [ -d "dist" ] && rm -rf dist
        [ -d "build" ] && rm -rf build
        print_info "Frontend cleaned"
    fi

    # Clean desktop app
    if [ -d "$DESKTOP_DIR" ]; then
        cd "$DESKTOP_DIR"
        [ -d "build" ] && rm -rf build
        [ -d "DerivedData" ] && rm -rf DerivedData
        print_info "Desktop app cleaned"
    fi

    # Clean root
    cd "$PROJECT_ROOT"
    [ -f "package-lock.json" ] && rm -f package-lock.json

    print_success "Clean completed"
}

# Function to build backend
build_backend() {
    print_step "Building backend..."

    if [ ! -d "$BACKEND_DIR" ]; then
        print_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi

    cd "$BACKEND_DIR"

    # Install dependencies
    print_info "Installing backend dependencies..."
    if [ "$VERBOSE" = true ]; then
        npm install
    else
        npm install --silent
    fi

    # Build TypeScript
    print_info "Building TypeScript..."
    if [ "$VERBOSE" = true ]; then
        npm run build
    else
        npm run build --silent
    fi

    print_success "Backend build completed"
}

# Function to build frontend
build_frontend() {
    print_step "Building frontend..."

    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi

    cd "$FRONTEND_DIR"

    # Install dependencies
    print_info "Installing frontend dependencies..."
    if [ "$VERBOSE" = true ]; then
        npm install
    else
        npm install --silent
    fi

    # Build for production
    print_info "Building frontend for production..."
    if [ "$VERBOSE" = true ]; then
        npm run build
    else
        npm run build --silent
    fi

    print_success "Frontend build completed"
}

# Function to build desktop app
build_desktop() {
    print_step "Building desktop app..."

    if [ ! -d "$DESKTOP_DIR" ]; then
        print_error "Desktop directory not found: $DESKTOP_DIR"
        exit 1
    fi

    cd "$DESKTOP_DIR"

    # Check if Xcode project exists
    if [ ! -f "QestroDesktop.xcodeproj/project.pbxproj" ]; then
        print_error "Xcode project not found"
        exit 1
    fi

    # Build using xcodebuild
    print_info "Building macOS app..."

    if [ "$VERBOSE" = true ]; then
        xcodebuild \
            -project QestroDesktop.xcodeproj \
            -scheme QestroDesktop \
            -configuration Debug \
            -derivedDataPath build/DerivedData \
            build
    else
        xcodebuild \
            -project QestroDesktop.xcodeproj \
            -scheme QestroDesktop \
            -configuration Debug \
            -derivedDataPath build/DerivedData \
            build > /dev/null 2>&1
    fi

    print_success "Desktop app build completed"
}

# Function to run backend
run_backend() {
    print_step "Starting backend server..."

    cd "$BACKEND_DIR"

    # Check if built
    if [ ! -d "dist" ]; then
        print_warning "Backend not built, building now..."
        build_backend
    fi

    print_info "Backend starting on http://localhost:8000"

    # Start in background
    if [ "$VERBOSE" = true ]; then
        npm run start &
    else
        npm run start > server.log 2>&1 &
    fi

    BACKEND_PID=$!
    echo $BACKEND_PID > .backend.pid

    # Wait a moment for startup
    sleep 3

    # Check if backend is running
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        print_success "Backend server is running (PID: $BACKEND_PID)"
    else
        print_warning "Backend may still be starting up..."
    fi
}

# Function to run frontend
run_frontend() {
    print_step "Starting frontend server..."

    cd "$FRONTEND_DIR"

    print_info "Frontend starting on http://localhost:3000"

    # Start in background
    if [ "$VERBOSE" = true ]; then
        npm run dev &
    else
        npm run dev > frontend.log 2>&1 &
    fi

    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid

    sleep 2
    print_success "Frontend server is running (PID: $FRONTEND_PID)"
}

# Function to run desktop app
run_desktop() {
    print_step "Starting desktop app..."

    cd "$DESKTOP_DIR"

    # Find the built app
    APP_PATH="build/DerivedData/Build/Products/Debug/QestroDesktop.app"

    if [ ! -d "$APP_PATH" ]; then
        print_warning "Desktop app not found, building now..."
        build_desktop
    fi

    if [ -d "$APP_PATH" ]; then
        print_info "Launching QestroDesktop.app"
        open "$APP_PATH"
        sleep 2
        print_success "Desktop app launched"
    else
        print_error "Failed to find desktop app after build"
    fi
}

# Function to show running services
show_status() {
    print_header "Service Status"

    # Backend status
    if [ -f "$BACKEND_DIR/.backend.pid" ]; then
        BACKEND_PID=$(cat "$BACKEND_DIR/.backend.pid")
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            print_success "Backend running (PID: $BACKEND_PID) - http://localhost:8000"
        else
            print_error "Backend process not found"
        fi
    else
        print_info "Backend not started by this script"
    fi

    # Frontend status
    if [ -f "$FRONTEND_DIR/.frontend.pid" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_DIR/.frontend.pid")
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            print_success "Frontend running (PID: $FRONTEND_PID) - http://localhost:3000"
        else
            print_error "Frontend process not found"
        fi
    else
        print_info "Frontend not started by this script"
    fi

    # Desktop app status
    if pgrep -f "QestroDesktop.app" > /dev/null 2>&1; then
        print_success "Desktop app is running"
    else
        print_info "Desktop app not running"
    fi
}

# Function to cleanup on exit
cleanup() {
    print_header "Cleanup"

    # Kill backend if we started it
    if [ -f "$BACKEND_DIR/.backend.pid" ]; then
        BACKEND_PID=$(cat "$BACKEND_DIR/.backend.pid")
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            print_step "Stopping backend (PID: $BACKEND_PID)"
            kill $BACKEND_PID
        fi
        rm -f "$BACKEND_DIR/.backend.pid"
    fi

    # Kill frontend if we started it
    if [ -f "$FRONTEND_DIR/.frontend.pid" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_DIR/.frontend.pid")
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            print_step "Stopping frontend (PID: $FRONTEND_PID)"
            kill $FRONTEND_PID
        fi
        rm -f "$FRONTEND_DIR/.frontend.pid"
    fi

    print_success "Cleanup completed"
}

# Set up cleanup on script exit
trap cleanup EXIT

# Main execution
main() {
    print_header "Qestro Platform - Build and Run"

    print_info "Project root: $PROJECT_ROOT"
    print_info "Build backend: $BUILD_BACKEND"
    print_info "Build desktop: $BUILD_DESKTOP"
    print_info "Build frontend: $BUILD_FRONTEND"
    print_info "Run backend: $RUN_BACKEND"
    print_info "Run desktop: $RUN_DESKTOP"
    print_info "Run frontend: $RUN_FRONTEND"

    echo ""

    # Check prerequisites
    check_prerequisites
    echo ""

    # Clean if requested
    if [ "$CLEAN_BUILD" = true ]; then
        clean_build
        echo ""
    fi

    # Build phase
    if [ "$BUILD_BACKEND" = true ]; then
        build_backend
        echo ""
    fi

    if [ "$BUILD_FRONTEND" = true ]; then
        build_frontend
        echo ""
    fi

    if [ "$BUILD_DESKTOP" = true ]; then
        build_desktop
        echo ""
    fi

    # Run phase
    if [ "$RUN_BACKEND" = true ]; then
        run_backend
        echo ""
    fi

    if [ "$RUN_FRONTEND" = true ]; then
        run_frontend
        echo ""
    fi

    if [ "$RUN_DESKTOP" = true ]; then
        run_desktop
        echo ""
    fi

    # Show status
    show_status
    echo ""

    # Keep running if we started services
    if [ "$RUN_BACKEND" = true ] || [ "$RUN_FRONTEND" = true ]; then
        print_header "Services Running"
        print_info "Press Ctrl+C to stop all services and exit"

        # Wait for interrupt
        while true; do
            sleep 1
        done
    else
        print_header "Build Complete"
        print_success "All builds completed successfully!"
    fi
}

# Run main function
main