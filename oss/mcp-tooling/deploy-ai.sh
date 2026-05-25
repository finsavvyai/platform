#!/bin/bash

# MCPoverflow AI Integration Deployment Script
# Deploys AI Engine, Go Backend, and supporting services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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

# Check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        log_warning ".env file not found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "Please edit .env file with your configuration"
            exit 1
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_warning "Node.js is not installed. Required for local development."
    fi

    # Check Go
    if ! command -v go &> /dev/null; then
        log_warning "Go is not installed. Required for local development."
    fi

    log_success "All prerequisites met"
}

# Build services
build_services() {
    log_info "Building services..."

    # Build AI Engine
    log_info "Building AI Engine..."
    cd packages/ai-engine
    if [ -f "package.json" ]; then
        npm install
        npm run build
    fi
    cd ../..

    # Build Go API Service
    log_info "Building Go API Service..."
    cd services/api-service
    if [ -f "go.mod" ]; then
        go mod download
        go build -o bin/api-service ./cmd/main.go
    fi
    cd ../..

    log_success "All services built successfully"
}

# Start services
start_services() {
    log_info "Starting services with Docker Compose..."

    docker-compose -f docker-compose.ai.yml up -d

    log_success "Services started successfully"
}

# Stop services
stop_services() {
    log_info "Stopping services..."

    docker-compose -f docker-compose.ai.yml down

    log_success "Services stopped successfully"
}

# Check service health
check_health() {
    log_info "Checking service health..."

    # Wait for services to start
    sleep 5

    # Check AI Engine
    log_info "Checking AI Engine health..."
    if curl -f http://localhost:3001/health &> /dev/null; then
        log_success "AI Engine is healthy"
    else
        log_error "AI Engine is not responding"
        docker-compose -f docker-compose.ai.yml logs ai-engine
    fi

    # Check Go API
    log_info "Checking Go API health..."
    if curl -f http://localhost:8080/health &> /dev/null; then
        log_success "Go API is healthy"
    else
        log_error "Go API is not responding"
        docker-compose -f docker-compose.ai.yml logs api-service
    fi

    # Check PostgreSQL
    log_info "Checking PostgreSQL health..."
    if docker-compose -f docker-compose.ai.yml exec -T postgres pg_isready -U postgres &> /dev/null; then
        log_success "PostgreSQL is healthy"
    else
        log_error "PostgreSQL is not responding"
    fi

    # Check Redis
    log_info "Checking Redis health..."
    if docker-compose -f docker-compose.ai.yml exec -T redis redis-cli ping &> /dev/null; then
        log_success "Redis is healthy"
    else
        log_error "Redis is not responding"
    fi
}

# Show logs
show_logs() {
    docker-compose -f docker-compose.ai.yml logs -f "$@"
}

# Show service status
show_status() {
    log_info "Service Status:"
    docker-compose -f docker-compose.ai.yml ps
    echo ""

    log_info "Service URLs:"
    echo "  AI Engine:     http://localhost:3001"
    echo "  API Service:   http://localhost:8080"
    echo "  Prometheus:    http://localhost:9090"
    echo "  Grafana:       http://localhost:3000 (admin / mcpoverflow_admin)"
    echo ""

    log_info "Health Checks:"
    echo "  AI Engine:     curl http://localhost:3001/health"
    echo "  API Service:   curl http://localhost:8080/health"
}

# Run migrations
run_migrations() {
    log_info "Running database migrations..."

    docker-compose -f docker-compose.ai.yml exec api-service /app/bin/api-service migrate

    log_success "Migrations completed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."

    # Create monitoring directories if they don't exist
    mkdir -p monitoring/prometheus
    mkdir -p monitoring/grafana/provisioning/datasources
    mkdir -p monitoring/grafana/provisioning/dashboards
    mkdir -p monitoring/grafana/dashboards

    # Create Prometheus config
    cat > monitoring/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-service'
    static_configs:
      - targets: ['api-service:8080']
    metrics_path: '/metrics'

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF

    log_success "Monitoring setup completed"
}

# Main menu
show_menu() {
    echo ""
    echo "MCPoverflow AI Integration Deployment"
    echo "======================================"
    echo "1. Deploy (build + start)"
    echo "2. Start services"
    echo "3. Stop services"
    echo "4. Restart services"
    echo "5. Check health"
    echo "6. Show logs"
    echo "7. Show status"
    echo "8. Run migrations"
    echo "9. Setup monitoring"
    echo "0. Exit"
    echo ""
    read -p "Select an option: " choice

    case $choice in
        1)
            check_env_file
            check_prerequisites
            setup_monitoring
            build_services
            start_services
            check_health
            show_status
            ;;
        2)
            start_services
            check_health
            show_status
            ;;
        3)
            stop_services
            ;;
        4)
            stop_services
            start_services
            check_health
            show_status
            ;;
        5)
            check_health
            ;;
        6)
            read -p "Service name (or press Enter for all): " service
            show_logs $service
            ;;
        7)
            show_status
            ;;
        8)
            run_migrations
            ;;
        9)
            setup_monitoring
            ;;
        0)
            exit 0
            ;;
        *)
            log_error "Invalid option"
            show_menu
            ;;
    esac
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    show_menu
else
    case $1 in
        deploy)
            check_env_file
            check_prerequisites
            setup_monitoring
            build_services
            start_services
            check_health
            show_status
            ;;
        start)
            start_services
            check_health
            show_status
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            start_services
            check_health
            show_status
            ;;
        health)
            check_health
            ;;
        logs)
            shift
            show_logs "$@"
            ;;
        status)
            show_status
            ;;
        migrate)
            run_migrations
            ;;
        setup-monitoring)
            setup_monitoring
            ;;
        *)
            echo "Usage: $0 {deploy|start|stop|restart|health|logs|status|migrate|setup-monitoring}"
            exit 1
            ;;
    esac
fi
