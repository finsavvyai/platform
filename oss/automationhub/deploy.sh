#!/bin/bash

#######################################
# UPM.Plus Enterprise Deployment Script
# One-command deployment for production
#######################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE=".env"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║       UPM.Plus - Enterprise Automation Platform              ║"
echo "║                 Deployment Script v1.0                       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Helper functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    log_success "Docker found: $(docker --version)"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    log_success "Docker Compose found"

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    log_success "Docker daemon is running"
}

# Create environment file if not exists
setup_environment() {
    log_info "Setting up environment..."

    if [ ! -f "$ENV_FILE" ]; then
        log_warning "No .env file found. Creating from template..."
        
        # Generate secure secrets
        SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
        MFA_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

        cat > "$ENV_FILE" << EOF
# UPM.Plus Environment Configuration
# Generated on $(date)

# Environment
ENVIRONMENT=production
DEBUG=false

# Security
SECRET_KEY=${SECRET_KEY}
MFA_ENCRYPTION_KEY=${MFA_KEY}

# Database
DATABASE_URL=postgresql+asyncpg://upmplus:upmplus_password@postgres:5432/upmplus
POSTGRES_DB=upmplus
POSTGRES_USER=upmplus
POSTGRES_PASSWORD=upmplus_password

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/1

# ChromaDB
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Frontend
REACT_APP_API_URL=http://localhost:8001/api/v1
REACT_APP_WS_URL=ws://localhost:8001/ws

# Optional: AI Services (add your keys)
# OPENAI_API_KEY=your-openai-key
# ANTHROPIC_API_KEY=your-anthropic-key

# Optional: Stripe (for billing)
# STRIPE_SECRET_KEY=your-stripe-secret-key
# STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Optional: Email (for notifications)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your-smtp-user
# SMTP_PASSWORD=your-smtp-password
# SMTP_FROM=noreply@upm.plus
EOF

        log_success "Created .env file with default configuration"
        log_warning "Please update .env with your production values before deploying!"
    else
        log_success "Using existing .env file"
    fi
}

# Build images
build_images() {
    log_info "Building Docker images..."
    
    docker-compose -f "$COMPOSE_FILE" build --parallel

    log_success "Docker images built successfully"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    docker-compose -f "$COMPOSE_FILE" up -d

    log_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy\|starting"; then
            echo -n "."
            sleep 5
            ((attempt++))
        else
            echo ""
            log_success "All services are healthy"
            return 0
        fi
    done

    echo ""
    log_warning "Some services may not be fully ready. Check with: docker-compose ps"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    sleep 5
    
    docker-compose -f "$COMPOSE_FILE" exec -T backend alembic upgrade head || {
        log_warning "Migration failed or already up to date"
    }

    log_success "Database migrations completed"
}

# Show service status
show_status() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    DEPLOYMENT COMPLETE!                        ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Services:${NC}"
    echo "  • Frontend:    http://localhost:3000"
    echo "  • Backend API: http://localhost:8001"
    echo "  • API Docs:    http://localhost:8001/docs"
    echo "  • Flower:      http://localhost:5555"
    echo "  • Prometheus:  http://localhost:9090"
    echo "  • Grafana:     http://localhost:3001 (admin/admin)"
    echo ""
    echo -e "${YELLOW}Quick Commands:${NC}"
    echo "  • View logs:     docker-compose logs -f"
    echo "  • Stop services: docker-compose down"
    echo "  • Restart:       docker-compose restart"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Open http://localhost:3000 in your browser"
    echo "  2. Register a new admin account"
    echo "  3. Configure your AI service API keys in Settings"
    echo "  4. Create your first workflow!"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

# Main deployment function
deploy() {
    check_prerequisites
    setup_environment
    build_images
    start_services
    wait_for_services
    run_migrations
    show_status
}

# Command handling
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    start)
        log_info "Starting services..."
        docker-compose -f "$COMPOSE_FILE" up -d
        show_status
        ;;
    stop)
        log_info "Stopping services..."
        docker-compose -f "$COMPOSE_FILE" down
        log_success "Services stopped"
        ;;
    restart)
        log_info "Restarting services..."
        docker-compose -f "$COMPOSE_FILE" restart
        log_success "Services restarted"
        ;;
    logs)
        docker-compose -f "$COMPOSE_FILE" logs -f "${@:2}"
        ;;
    status)
        docker-compose -f "$COMPOSE_FILE" ps
        ;;
    clean)
        log_warning "This will remove all containers, volumes, and images!"
        read -p "Are you sure? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            docker-compose -f "$COMPOSE_FILE" down -v --rmi all
            log_success "Cleanup complete"
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|start|stop|restart|logs|status|clean}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment (build + start + migrate)"
        echo "  start   - Start existing containers"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  logs    - View service logs"
        echo "  status  - Show service status"
        echo "  clean   - Remove all containers and volumes"
        exit 1
        ;;
esac

