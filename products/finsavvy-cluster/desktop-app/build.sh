#!/bin/bash

# FinSavvyAI Desktop App - Cross-Platform Build Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="finsavvyai"
VERSION="1.0.0"
BUILD_DIR="build"
DIST_DIR="dist"

echo -e "${BLUE}🚀 FinSavvyAI Desktop App Build Script${NC}"
echo -e "${BLUE}======================================${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."

    # Check Rust/Cargo
    if ! command -v cargo &> /dev/null; then
        print_error "Rust/Cargo is not installed"
        print_status "Please install Rust from https://rustup.rs/"
        exit 1
    fi

    # Check Go
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed"
        print_status "Please install Go from https://golang.org/"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        print_status "Please install Node.js from https://nodejs.org/"
        exit 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi

    print_status "All dependencies are available ✓"
}

# Function to setup build environment
setup_environment() {
    print_status "Setting up build environment..."

    # Clean previous builds
    rm -rf $BUILD_DIR $DIST_DIR
    mkdir -p $BUILD_DIR $DIST_DIR

    # Install Node.js dependencies
    print_status "Installing Node.js dependencies..."
    npm install

    # Install Tauri CLI
    if ! command -v cargo-tauri &> /dev/null; then
        print_status "Installing Tauri CLI..."
        cargo install tauri-cli
    fi

    # Build Go backend
    print_status "Building Go backend..."
    cd src-go
    go mod tidy
    go build -o ../$BUILD_DIR/go-backend main.go
    cd ..

    print_status "Build environment setup complete ✓"
}

# Function to build for specific platform
build_platform() {
    local platform=$1
    local arch=$2

    print_status "Building for $platform-$arch..."

    case $platform in
        "macos")
            if [ $arch = "universal" ]; then
                # Build for Apple Silicon and Intel
                cargo tauri build --target aarch64-apple-darwin
                cargo tauri build --target x86_64-apple-darwin

                # Create universal binary
                print_status "Creating universal macOS binary..."
                lipo -create \
                    $DIST_DIR/macos/aarch64-apple-darwin/release/bundle/macos/$APP_NAME.app \
                    $DIST_DIR/macos/x86_64-apple-darwin/release/bundle/macos/$APP_NAME.app \
                    -output $DIST_DIR/macos/universal/$APP_NAME.app
            else
                cargo tauri build --target $arch-apple-darwin
            fi
            ;;
        "windows")
            cargo tauri build --target $arch-pc-windows-msvc
            ;;
        "linux")
            cargo tauri build --target $arch-unknown-linux-gnu
            ;;
    esac

    print_status "Build for $platform-$arch complete ✓"
}

# Function to create installers
create_installers() {
    print_status "Creating installers..."

    # Create ZIP archives for distribution
    cd $DIST_DIR

    # macOS
    if [ -d "macos" ]; then
        print_status "Creating macOS distribution..."
        cd macos
        zip -r "../../$BUILD_DIR/$APP_NAME-$VERSION-macos.zip" ./*
        cd ..
    fi

    # Windows
    if [ -d "windows" ]; then
        print_status "Creating Windows distribution..."
        cd windows
        zip -r "../../$BUILD_DIR/$APP_NAME-$VERSION-windows.zip" ./*
        cd ..
    fi

    # Linux
    if [ -d "linux" ]; then
        print_status "Creating Linux distribution..."
        cd linux
        tar -czf "../../$BUILD_DIR/$APP_NAME-$VERSION-linux.tar.gz" ./*
        cd ..
    fi

    cd ..
    print_status "Installers created ✓"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."

    # Test Go backend
    cd src-go
    go test ./...
    cd ..

    # Test frontend (if tests exist)
    if [ -f "package.json" ] && grep -q "test" package.json; then
        npm test
    fi

    print_status "All tests passed ✓"
}

# Function to build for development
build_dev() {
    print_status "Building for development..."

    # Start Go backend in background
    cd src-go
    go run main.go &
    GO_PID=$!
    cd ..

    # Wait for backend to start
    sleep 3

    # Start Tauri development server
    print_status "Starting Tauri development server..."
    npm run tauri dev

    # Cleanup
    kill $GO_PID 2>/dev/null || true
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  dev         Build and run for development"
    echo "  build       Build for production"
    echo "  test        Run tests"
    echo "  clean       Clean build artifacts"
    echo "  help        Show this help message"
    echo ""
    echo "Build options:"
    echo "  --platform  Target platform (all, macos, windows, linux)"
    echo "  --arch      Target architecture (all, x86_64, aarch64, universal)"
    echo ""
    echo "Examples:"
    echo "  $0 dev                              # Development build"
    echo "  $0 build                            # Production build for current platform"
    echo "  $0 build --platform all            # Build for all platforms"
    echo "  $0 build --platform macos --arch universal  # Universal macOS build"
}

# Main script logic
main() {
    local command=${1:-"help"}
    local platform="current"
    local arch="current"

    # Parse arguments
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --platform)
                platform="$2"
                shift 2
                ;;
            --arch)
                arch="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Execute command
    case $command in
        "dev")
            check_dependencies
            setup_environment
            build_dev
            ;;
        "build")
            check_dependencies
            setup_environment
            run_tests

            if [ "$platform" = "all" ]; then
                build_platform "macos" "universal"
                build_platform "windows" "x86_64"
                build_platform "linux" "x86_64"
            else
                build_platform "$platform" "$arch"
            fi

            create_installers

            print_status "Build complete! Artifacts are in the $BUILD_DIR directory."
            ;;
        "test")
            check_dependencies
            run_tests
            ;;
        "clean")
            print_status "Cleaning build artifacts..."
            rm -rf $BUILD_DIR $DIST_DIR
            cargo clean
            print_status "Clean complete ✓"
            ;;
        "help"|*)
            show_usage
            ;;
    esac
}

# Run main function with all arguments
main "$@"
