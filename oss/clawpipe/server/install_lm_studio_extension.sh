#!/bin/bash

######################################################################
# FinSavvyAI Extension - LM Studio Installation Script
######################################################################
#
# This script automates the installation of FinSavvyAI as an
# LM Studio extension and ensures the gateway is running.
#
# Usage: ./install_lm_studio_extension.sh
#
######################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
PROJECT_DIR="/Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm"
EXTENSION_DIR="$PROJECT_DIR/lmstudio-extension"
GATEWAY_PID_FILE="$PROJECT_DIR/.gateway.pid"

######################################################################
# Helper Functions
######################################################################

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║$1${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

######################################################################
# Installation Steps
######################################################################

check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check if we're in the right directory
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi
    print_success "Project directory found"

    # Check if LM Studio is running
    if check_command "lsof"; then
        if lsof -ti :1234 &> /dev/null; then
            print_success "LM Studio is running (port 1234)"
        else
            print_warning "LM Studio doesn't appear to be running"
            print_info "Please make sure LM Studio is open with the server enabled"
            read -p "Continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi

    # Check Python
    if check_command "python3"; then
        print_success "Python 3 is installed"
    else
        print_error "Python 3 is required but not found"
        exit 1
    fi

    # Check curl
    if check_command "curl"; then
        print_success "curl is installed"
    else
        print_error "curl is required but not found"
        exit 1
    fi

    echo ""
}

verify_gateway() {
    print_step "Checking FinSavvyAI Gateway..."

    # Check if gateway is already running
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        print_success "Gateway is already running on port 8080"

        # Test health
        HEALTH=$(curl -s http://localhost:8080/health)
        if echo "$HEALTH" | grep -q '"status": "healthy"'; then
            print_success "Gateway is healthy"
        else
            print_warning "Gateway may not be healthy"
        fi

        # Check LM Studio connection
        if echo "$HEALTH" | grep -q '"lmstudio": true'; then
            print_success "LM Studio provider is connected"
        else
            print_warning "LM Studio provider may not be connected"
        fi

        echo ""
        return 0
    fi

    # Gateway not running, offer to start it
    print_warning "Gateway is not running"
    echo ""
    print_info "The FinSavvyAI Gateway needs to be running for the extension to work."
    echo ""
    read -p "Start the gateway now? (y/n) " -n 1 -r
    echo
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Starting FinSavvyAI Gateway..."

        cd "$PROJECT_DIR"

        # Create logs directory
        mkdir -p logs

        # Start gateway in background
        export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
        export FINSAVVYAI_SOURCES_PATH=./sources
        export FINSAVVYAI_NOTEBOOKS_PATH=./notebooks
        export LMSTUDIO_BASE_URL=http://localhost:1234

        mkdir -p sources notebooks

        nohup python3 -m src.api.gateway > logs/gateway.log 2>&1 &
        GATEWAY_PID=$!
        echo $GATEWAY_PID > "$GATEWAY_PID_FILE"

        print_info "Gateway PID: $GATEWAY_PID"
        print_info "Logs: $PROJECT_DIR/logs/gateway.log"

        # Wait for gateway to start
        print_info "Waiting for gateway to start..."
        for i in {1..30}; do
            if curl -s http://localhost:8080/health > /dev/null 2>&1; then
                print_success "Gateway started successfully!"
                echo ""
                return 0
            fi
            sleep 1
            echo -n "."
        done

        echo ""
        print_error "Gateway failed to start"
        print_info "Check logs: tail -f $PROJECT_DIR/logs/gateway.log"
        exit 1
    else
        print_error "Gateway is required for the extension to work"
        exit 1
    fi

    echo ""
}

verify_extension() {
    print_step "Verifying extension files..."

    if [ ! -d "$EXTENSION_DIR" ]; then
        print_error "Extension directory not found: $EXTENSION_DIR"
        exit 1
    fi

    # Check required files
    REQUIRED_FILES=("extension.json" "index.js" "README.md")
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$EXTENSION_DIR/$file" ]; then
            print_success "Found: $file"
        else
            print_error "Missing: $file"
            exit 1
        fi
    done

    echo ""
}

test_gateway_api() {
    print_step "Testing Gateway API..."

    # Test health endpoint
    print_info "Testing health endpoint..."
    HEALTH=$(curl -s http://localhost:8080/health)
    if echo "$HEALTH" | grep -q '"status": "healthy"'; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
        exit 1
    fi

    # Test source upload
    print_info "Testing document upload..."
    UPLOAD_RESULT=$(curl -s -X POST http://localhost:8080/api/notebook/sources/import \
        -H "Content-Type: application/json" \
        -d '{"filename": "test_install.txt", "file_type": "text", "content": "Installation test"}')

    if echo "$UPLOAD_RESULT" | grep -q '"source_id"'; then
        print_success "Document upload works"
        SOURCE_ID=$(echo "$UPLOAD_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('source_id', 'error'))" 2>/dev/null)
        print_info "Source ID: $SOURCE_ID"
    else
        print_warning "Document upload test failed"
    fi

    # Test list sources
    print_info "Testing source listing..."
    SOURCES=$(curl -s http://localhost:8080/api/notebook/sources)
    SOURCE_COUNT=$(echo "$SOURCES" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('sources', [])))" 2>/dev/null || echo "0")
    print_success "Found $SOURCE_COUNT source(s)"

    # Test notebook creation
    print_info "Testing notebook creation..."
    NB_RESULT=$(curl -s -X POST http://localhost:8080/api/notebook/notebooks \
        -H "Content-Type: application/json" \
        -d '{"name": "Install Test Notebook"}')

    if echo "$NB_RESULT" | grep -q '"id"'; then
        print_success "Notebook creation works"
    else
        print_warning "Notebook creation test failed"
    fi

    echo ""
}

print_installation_instructions() {
    print_header " Installation Instructions "

    echo "The FinSavvyAI extension has been verified and the gateway is running!"
    echo ""
    echo "To install the extension in LM Studio:"
    echo ""
    echo -e "${GREEN}1.${NC} Open LM Studio"
    echo -e "${GREEN}2.${NC} Click the Extensions icon (🧩 puzzle piece) in the left sidebar"
    echo -e "${GREEN}3.${NC} Click \"Install from Local Folder\""
    echo -e "${GREEN}4.${NC} Navigate to:"
    echo "       $EXTENSION_DIR"
    echo -e "${GREEN}5.${NC} Select the folder and click \"Open\""
    echo -e "${GREEN}6.${NC} Click \"Install\""
    echo -e "${GREEN}7.${NC} Enable the extension (toggle ON)"
    echo -e "${GREEN}8.${NC} A new \"📚 NotebookLM\" panel will appear!"
    echo ""

    print_info "After installation, you can:"
    echo "  • Upload documents via the sidebar panel"
    echo "  • Create and manage notebooks"
    echo "  • Use chat commands: /upload, /sources, /notebook"
    echo ""

    echo "Gateway Status:"
    echo -e "  • URL: ${BLUE}http://localhost:8080${NC}"
    echo -e "  • Health: ${GREEN}Running${NC}"
    echo -e "  • Logs: ${BLUE}$PROJECT_DIR/logs/gateway.log${NC}"
    echo ""

    echo "Quick Test Commands:"
    echo "  # Check health"
    echo "  curl http://localhost:8080/health | jq"
    echo ""
    echo "  # List sources"
    echo "  curl http://localhost:8080/api/notebook/sources | jq"
    echo ""
    echo "  # Create notebook"
    echo "  curl -X POST http://localhost:8080/api/notebook/notebooks \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"name\": \"My Notebook\"}' | jq"
    echo ""

    print_info "For complete documentation, see:"
    echo "  • docs/LM_STUDIO_EXTENSION_INSTALL.md"
    echo "  • docs/TESTING_GUIDE.md"
    echo "  • docs/NOTEBOOKLM_QUICKSTART.md"
    echo ""
}

print_troubleshooting() {
    echo "Troubleshooting:"
    echo ""
    echo "If the extension doesn't appear:"
    echo "  1. Make sure LM Studio is restarted after installation"
    echo "  2. Check the extension is enabled (toggle ON)"
    echo "  3. View LM Studio console: View → Toggle Developer Tools"
    echo ""
    echo "If uploads fail:"
    echo "  1. Check gateway is running: curl http://localhost:8080/health"
    echo "  2. Check gateway logs: tail -f $PROJECT_DIR/logs/gateway.log"
    echo "  3. Restart the gateway (see below)"
    echo ""
    echo "To restart the gateway:"
    echo "  # Stop existing gateway"
    echo "  kill \$(cat $GATEWAY_PID_FILE)"
    echo ""
    echo "  # Start new gateway"
    echo "  cd $PROJECT_DIR"
    echo "  export FINSAVVYAI_NOTEBOOKLM_ENABLED=true"
    echo "  python3 -m src.api.gateway"
    echo ""
}

######################################################################
# Main Installation Flow
######################################################################

main() {
    clear

    print_header " FinSavvyAI Extension - LM Studio Installer "

    echo "This script will:"
    echo "  1. Check prerequisites (LM Studio, Python, etc.)"
    echo "  2. Verify the FinSavvyAI Gateway is running"
    echo "  3. Test the Gateway API"
    echo "  4. Provide installation instructions"
    echo ""

    read -p "Continue? (y/n) " -n 1 -r
    echo
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi

    # Run installation steps
    check_prerequisites
    verify_gateway
    verify_extension
    test_gateway_api

    # Print instructions
    print_installation_instructions
    print_troubleshooting

    print_success "Installation preparation complete!"
    echo ""

    print_info "Next: Follow the installation instructions above to install"
    print_info "      the extension in LM Studio."
    echo ""
}

# Run main function
main "$@"
