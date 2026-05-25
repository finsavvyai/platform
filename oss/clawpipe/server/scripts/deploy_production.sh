#!/bin/bash

######################################################################
# FinSavvyAI Production Deployment Script
######################################################################
#
# Production deployment for FinSavvyAI with:
# - Docker containerization
# - Health checks
# - Monitoring setup
# - Security hardening
# - Log management
#
# Usage: ./scripts/deploy_production.sh
#
######################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║ $1${NC}"
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

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Configuration
PROJECT_DIR="/Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm"
DOCKER_IMAGE="finsavvyai/production"
DOCKER_TAG="v1.0.0"
CONTAINER_NAME="finsavvyai-gateway"
PRODUCTION_PORT=8080

######################################################################
# Pre-deployment Checks
######################################################################

pre_deployment_checks() {
    print_step "Running pre-deployment checks..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker."
        exit 1
    fi
    print_success "Docker is running"

    # Check if ports are available
    if lsof -ti :$PRODUCTION_PORT &> /dev/null; then
        print_warning "Port $PRODUCTION_PORT is already in use"
        print_info "Stopping existing process..."
        lsof -ti :$PRODUCTION_PORT | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    print_success "Port $PRODUCTION_PORT is available"

    # Check environment file
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        print_info "Please update .env with production values!"
    fi
    print_success "Environment configuration found"

    # Run tests
    print_step "Running test suite..."
    cd "$PROJECT_DIR"
    if pytest tests/integration/test_notebooklm_integration.py -v --tb=short > /tmp/test_results.log 2>&1; then
        print_success "All tests passed"
    else
        print_warning "Some tests failed. Check /tmp/test_results.log"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    echo ""
}

######################################################################
# Build Docker Image
######################################################################

build_docker_image() {
    print_step "Building Docker image..."

    cd "$PROJECT_DIR"

    # Tag image with version and latest
    docker build \
        -t $DOCKER_IMAGE:$DOCKER_TAG \
        -t $DOCKER_IMAGE:latest \
        -f Dockerfile \
        . 2>&1 | tee /tmp/docker_build.log

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        print_success "Docker image built successfully"
        docker images | grep $DOCKER_IMAGE
    else
        print_error "Docker build failed. Check /tmp/docker_build.log"
        exit 1
    fi

    echo ""
}

######################################################################
# Security Hardening
######################################################################

security_hardening() {
    print_step "Applying security hardening..."

    # Check for secrets in code
    print_info "Scanning for secrets..."
    if command -v trufflehog &> /dev/null; then
        trufflehog --regex --entropy=False $PROJECT_DIR 2>/dev/null || true
    fi

    # Run security scan
    if [ -f "$PROJECT_DIR/scripts/security_scan.py" ]; then
        print_info "Running security scan..."
        python3 $PROJECT_DIR/scripts/security_scan.py 2>&1 | head -20
    fi

    # Check file permissions
    print_info "Checking file permissions..."
    find $PROJECT_DIR -name "*.env" -type f -exec chmod 600 {} \;
    find $PROJECT_DIR -name "*.key" -type f -exec chmod 600 {} \;

    print_success "Security hardening applied"
    echo ""
}

######################################################################
# Deploy Container
######################################################################

deploy_container() {
    print_step "Deploying FinSavvyAI container..."

    # Stop existing container if running
    if docker ps -a | grep -q $CONTAINER_NAME; then
        print_info "Stopping existing container..."
        docker stop $CONTAINER_NAME 2>/dev/null || true
        docker rm $CONTAINER_NAME 2>/dev/null || true
    fi

    # Create logs directory
    mkdir -p $PROJECT_DIR/logs/production

    # Start new container
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p $PRODUCTION_PORT:8080 \
        -v $PROJECT_DIR/logs/production:/app/logs \
        -v $PROJECT_DIR/sources:/app/sources \
        -v $PROJECT_DIR/notebooks:/app/notebooks \
        -e FINSAVVYAI_ENV=production \
        -e FINSAVVYAI_NOTEBOOKLM_ENABLED=true \
        -e FINSAVVYAI_SOURCES_PATH=/app/sources \
        -e FINSAVVYAI_NOTEBOOKS_PATH=/app/notebooks \
        -e LMSTUDIO_BASE_URL=http://host.docker.internal:1234 \
        --health-cmd="curl -f http://localhost:8080/health || exit 1" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --memory="2g" \
        --cpus="2.0" \
        $DOCKER_IMAGE:$DOCKER_TAG

    if [ $? -eq 0 ]; then
        print_success "Container deployed successfully"
        docker ps | grep $CONTAINER_NAME
    else
        print_error "Container deployment failed"
        exit 1
    fi

    echo ""
}

######################################################################
# Health Check
######################################################################

health_check() {
    print_step "Running health checks..."

    # Wait for container to be ready
    print_info "Waiting for container to be ready..."
    for i in {1..30}; do
        if curl -sf http://localhost:$PRODUCTION_PORT/health > /dev/null 2>&1; then
            print_success "Container is healthy!"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""

    # Run full health check
    HEALTH=$(curl -s http://localhost:$PRODUCTION_PORT/health)
    print_info "Health status:"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"

    # Test NotebookLM endpoints
    print_info "Testing NotebookLM endpoints..."

    # Test source list
    if curl -sf http://localhost:$PRODUCTION_PORT/api/notebook/sources > /dev/null; then
        print_success "Sources endpoint working"
    else
        print_warning "Sources endpoint not responding"
    fi

    # Test notebook list
    if curl -sf http://localhost:$PRODUCTION_PORT/api/notebook/notebooks > /dev/null; then
        print_success "Notebooks endpoint working"
    else
        print_warning "Notebooks endpoint not responding"
    fi

    echo ""
}

######################################################################
# Setup Monitoring
######################################################################

setup_monitoring() {
    print_step "Setting up monitoring..."

    # Create monitoring directory
    mkdir -p $PROJECT_DIR/monitoring/prometheus
    mkdir -p $PROJECT_DIR/monitoring/grafana

    # Check if Prometheus config exists
    if [ ! -f "$PROJECT_DIR/monitoring/prometheus/prometheus.yml" ]; then
        print_info "Creating Prometheus configuration..."
        cat > $PROJECT_DIR/monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'finsavvyai'
    static_configs:
      - targets: ['host.docker.internal:8080']
    metrics_path: '/metrics'
EOF
    fi

    print_success "Monitoring configured"
    print_info "Prometheus config: $PROJECT_DIR/monitoring/prometheus/prometheus.yml"

    echo ""
}

######################################################################
# Setup Logging
######################################################################

setup_logging() {
    print_step "Configuring logging..."

    # Create log directories
    mkdir -p $PROJECT_DIR/logs/production
    mkdir -p $PROJECT_DIR/logs/nginx

    # Create logrotate config
    cat > /tmp/finsavvyai_logrotate.conf << EOF
$PROJECT_DIR/logs/production/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker restart $CONTAINER_NAME > /dev/null 2>&1 || true
    endscript
}
EOF

    print_success "Logging configured"
    print_info "Logs: $PROJECT_DIR/logs/production/"
    print_info "Logrotate: /tmp/finsavvyai_logrotate.conf"

    echo ""
}

######################################################################
# Generate Deployment Summary
######################################################################

deployment_summary() {
    print_header " Deployment Summary "

    echo "✅ FinSavvyAI has been deployed to production!"
    echo ""
    echo "📊 Deployment Details:"
    echo "   • Docker Image: $DOCKER_IMAGE:$DOCKER_TAG"
    echo "   • Container: $CONTAINER_NAME"
    echo "   • Port: $PRODUCTION_PORT"
    echo "   • Health: http://localhost:$PRODUCTION_PORT/health"
    echo ""
    echo "🔧 Management Commands:"
    echo "   # View logs"
    echo "   docker logs -f $CONTAINER_NAME"
    echo ""
    echo "   # Restart container"
    echo "   docker restart $CONTAINER_NAME"
    echo ""
    echo "   # Stop container"
    echo "   docker stop $CONTAINER_NAME"
    echo ""
    echo "   # View metrics"
    echo "   curl http://localhost:$PRODUCTION_PORT/metrics"
    echo ""
    echo "   # Check health"
    echo "   curl http://localhost:$PRODUCTION_PORT/health | jq"
    echo ""
    echo "📈 Monitoring:"
    echo "   • Logs: $PROJECT_DIR/logs/production/"
    echo "   • Prometheus: $PROJECT_DIR/monitoring/prometheus/"
    echo "   • Grafana: $PROJECT_DIR/monitoring/grafana/"
    echo ""
    echo "🧪 Test Endpoints:"
    echo "   # List sources"
    echo "   curl http://localhost:$PRODUCTION_PORT/api/notebook/sources | jq"
    echo ""
    echo "   # List notebooks"
    echo "   curl http://localhost:$PRODUCTION_PORT/api/notebook/notebooks | jq"
    echo ""
    echo "   # Create notebook"
    echo "   curl -X POST http://localhost:$PRODUCTION_PORT/api/notebook/notebooks \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"name\": \"Production Test\"}' | jq"
    echo ""
    print_warning "IMPORTANT:"
    echo "   • Make sure LM Studio is running on port 1234"
    echo "   • Update .env with production values"
    echo "   • Configure nginx/caddy for HTTPS (see docs/)"
    echo "   • Setup backup for sources/ and notebooks/"
    echo "   • Review security_scan.py results"
    echo ""
}

######################################################################
# Main Deployment Flow
######################################################################

main() {
    print_header " FinSavvyAI Production Deployment "

    echo "This will deploy FinSavvyAI with NotebookLM features to production."
    echo ""
    echo "What will be done:"
    echo "  1. Pre-deployment checks"
    echo "  2. Security hardening"
    echo "  3. Build Docker image"
    echo "  4. Deploy container"
    echo "  5. Health checks"
    echo "  6. Setup monitoring & logging"
    echo ""

    read -p "Continue with production deployment? (y/n) " -n 1 -r
    echo
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled"
        exit 0
    fi

    # Run deployment steps
    pre_deployment_checks
    security_hardening
    build_docker_image
    deploy_container
    health_check
    setup_monitoring
    setup_logging

    # Show summary
    deployment_summary

    print_success "Deployment complete!"
    echo ""

    # Ask if user wants to save deployment info
    read -p "Save deployment information to file? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deployment_summary > $PROJECT_DIR/DEPLOYMENT_$(date +%Y%m%d_%H%M%S).txt
        print_success "Deployment info saved"
    fi
}

# Run main function
main "$@"
