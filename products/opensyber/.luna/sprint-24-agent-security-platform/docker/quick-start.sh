#!/bin/bash
# OpenSyber Docker Quick Start Script
# This script sets up and starts the OpenSyber development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    print_header "Checking Prerequisites"

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed"

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        echo "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose is installed"
}

# Check if .env file exists
check_env() {
    print_header "Environment Configuration"

    if [ ! -f .env ]; then
        print_info "Creating .env file with defaults..."
        cat > .env << EOF
# Clerk Authentication (replace with your actual keys)
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx

# LemonSqueezy Payments (replace with your actual keys)
LEMONSQUEEZY_API_KEY=your_api_key
LEMONSQUEEZY_WEBHOOK_SECRET=whsec_xxxxx
LEMONSQUEEZY_STORE_ID=your_store_id
OPENSYBER_LS_PRODUCT_ID=your_product_id
OPENSYBER_LS_VARIANT_PERSONAL=variant_id
OPENSYBER_LS_VARIANT_PRO=variant_id
OPENSYBER_LS_VARIANT_TEAM=variant_id

# Hetzner Cloud (replace with your actual token)
HETZNER_API_TOKEN=your_hetzner_token

# Security (generate a secure key)
ENCRYPTION_KEY=your_encryption_key_generate_with_openssl

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_TOKENFORGE_API_URL=http://localhost:8788
EOF
        print_success "Created .env file with defaults"
        print_info "Please update .env with your actual credentials"
    else
        print_success ".env file already exists"
    fi
}

# Create necessary directories
create_directories() {
    print_header "Creating Directories"

    mkdir -p .luna/sprint-24-agent-security-platform/docker
    print_success "Created Docker configuration directory"
}

# Build and start services
start_services() {
    print_header "Starting Services"

    print_info "Building Docker images (this may take a few minutes)..."
    docker-compose -f .luna/sprint-24-agent-security-platform/docker/docker-compose.dev.yml build

    print_info "Starting services..."
    docker-compose -f .luna/sprint-24-agent-security-platform/docker/docker-compose.dev.yml up -d

    print_success "Services started successfully"
}

# Wait for services to be healthy
wait_for_services() {
    print_header "Waiting for Services"

    print_info "Waiting for services to be healthy (max 60 seconds)..."

    for i in {1..60}; do
        if curl -s http://localhost:8787/health > /dev/null 2>&1; then
            print_success "OpenSyber API is healthy"
            break
        fi
        if [ $i -eq 60 ]; then
            print_error "Services did not become healthy in time"
            print_info "Check logs with: make dev-logs"
            exit 1
        fi
        sleep 1
    done

    sleep 5
    print_success "All services are running"
}

# Display service information
display_info() {
    print_header "Services Are Running!"

    echo -e "${GREEN}OpenSyber Development Environment${NC}\n"
    echo "Services:"
    echo -e "  ${YELLOW}•${NC} OpenSyber Web:  ${BLUE}http://localhost:3000${NC}"
    echo -e "  ${YELLOW}•${NC} OpenSyber API:  ${BLUE}http://localhost:8787${NC}"
    echo -e "  ${YELLOW}•${NC} TokenForge Web: ${BLUE}http://localhost:3001${NC}"
    echo -e "  ${YELLOW}•${NC} TokenForge API: ${BLUE}http://localhost:8788${NC}"
    echo -e "  ${YELLOW}•${NC} PostgreSQL:      ${BLUE}localhost:5432${NC}"
    echo -e "  ${YELLOW}•${NC} Redis:          ${BLUE}localhost:6379${NC}"

    echo -e "\nUseful Commands:"
    echo -e "  ${YELLOW}•${NC} View logs:       ${BLUE}make dev-logs${NC}"
    echo -e "  ${YELLOW}•${NC} Stop services:   ${BLUE}make dev-stop${NC}"
    echo -e "  ${YELLOW}•${NC} Restart:         ${BLUE}make dev-restart${NC}"
    echo -e "  ${YELLOW}•${NC} Open API shell:  ${BLUE}make shell-api${NC}"
    echo -e "  ${YELLOW}•${NC} Open DB shell:   ${BLUE}make db-shell${NC}"
    echo -e "  ${YELLOW}•${NC} Run tests:       ${BLUE}make test${NC}"

    echo -e "\nDocumentation:"
    echo -e "  ${BLUE}.luna/sprint-24-agent-security-platform/docker/README.md${NC}"

    echo -e "\n${GREEN}Happy coding! 🚀${NC}\n"
}

# Main execution
main() {
    print_header "OpenSyber Docker Setup"

    check_docker
    check_env
    create_directories
    start_services
    wait_for_services
    display_info
}

# Run main function
main
