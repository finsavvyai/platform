#!/bin/bash
# QuantumBeam Development Environment Startup Script

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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "docker-compose is not installed. Please install it first."
        exit 1
    fi

    # Use docker compose if available, otherwise docker-compose
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi

    print_success "Using $DOCKER_COMPOSE"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    mkdir -p logs
    mkdir -p data/{postgres,redis,influxdb,elasticsearch}
    mkdir -p tmp
    print_success "Directories created"
}

# Pull latest images
pull_images() {
    print_status "Pulling latest Docker images..."
    $DOCKER_COMPOSE pull
    print_success "Images pulled successfully"
}

# Start services
start_services() {
    local services=("$@")

    if [ ${#services[@]} -eq 0 ]; then
        print_status "Starting all services..."
        $DOCKER_COMPOSE up -d
    else
        print_status "Starting services: ${services[*]}"
        $DOCKER_COMPOSE up -d "${services[@]}"
    fi
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."

    # Service health check URLs/commands
    declare -A services=(
        ["postgres"]="pg_isready -h localhost -p 5432 -U postgres"
        ["redis"]="redis-cli ping"
        ["influxdb"]="curl -f http://localhost:8086/health"
        ["elasticsearch"]="curl -f http://localhost:9200/_cluster/health"
    )

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        print_status "Health check attempt $attempt/$max_attempts"

        local all_healthy=true

        for service in "${!services[@]}"; do
            if $DOCKER_COMPOSE ps -q $service > /dev/null 2>&1; then
                if ! eval "${services[$service]}" > /dev/null 2>&1; then
                    print_warning "$service is not ready yet"
                    all_healthy=false
                else
                    print_success "$service is healthy"
                fi
            fi
        done

        if [ "$all_healthy" = true ]; then
            print_success "All services are healthy!"
            break
        fi

        sleep 5
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        print_error "Services did not become healthy within timeout"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."

    # Check if api-service is running
    if $DOCKER_COMPOSE ps -q api-service > /dev/null 2>&1; then
        $DOCKER_COMPOSE exec api-service goose -dir ./migrations postgres "user=postgres password=password dbname=quantumbeam_dev host=postgres port=5432 sslmode=disable" up
        print_success "Database migrations completed"
    else
        print_warning "API service not running, skipping migrations"
    fi
}

# Show service URLs
show_urls() {
    print_status "Service URLs:"
    echo ""
    echo "Main Services:"
    echo "  • API Service:        http://localhost:8080"
    echo "  • API Health:         http://localhost:8082/health"
    echo "  • API Metrics:        http://localhost:9090/metrics"
    echo ""
    echo "Databases:"
    echo "  • PostgreSQL:         localhost:5432"
    echo "  • Redis:              localhost:6379"
    echo "  • InfluxDB:           http://localhost:8086"
    echo "  • Elasticsearch:      http://localhost:9200"
    echo ""
    echo "Management UIs:"
    echo "  • PgAdmin:            http://localhost:5050 (admin@quantumbeam.dev / admin)"
    echo "  • Redis Commander:    http://localhost:8081 (admin / admin)"
    echo "  • Kibana:             http://localhost:5601"
    echo "  • MinIO Console:      http://localhost:9001 (minioadmin / minioadmin123)"
    echo ""
    echo "Monitoring:"
    echo "  • Grafana:            http://localhost:3000 (admin / admin)"
    echo "  • Prometheus:         http://localhost:9091"
    echo "  • Jaeger:             http://localhost:16686"
    echo ""
    echo "Python Services:"
    echo "  • Quantum Service:    http://localhost:8001"
    echo "  • ML Service:         http://localhost:8002"
    echo ""
}

# Show logs
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        $DOCKER_COMPOSE logs -f
    else
        $DOCKER_COMPOSE logs -f "$service"
    fi
}

# Main execution
main() {
    echo "========================================"
    echo "🚀 QuantumBeam Development Environment"
    echo "========================================"
    echo ""

    # Parse command line arguments
    case "${1:-start}" in
        start)
            check_docker
            check_docker_compose
            create_directories

            # Start with core services first
            start_services postgres redis influxdb elasticsearch
            wait_for_services

            # Start remaining services
            start_services
            sleep 10

            # Run migrations
            run_migrations

            # Show URLs
            show_urls

            print_success "Development environment started successfully!"
            ;;
        stop)
            print_status "Stopping all services..."
            $DOCKER_COMPOSE down
            print_success "All services stopped"
            ;;
        restart)
            print_status "Restarting all services..."
            $DOCKER_COMPOSE restart
            wait_for_services
            show_urls
            print_success "Services restarted successfully"
            ;;
        logs)
            show_logs "${2:-}"
            ;;
        status)
            $DOCKER_COMPOSE ps
            ;;
        clean)
            print_warning "This will remove all containers, volumes, and images. Are you sure? (y/N)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                $DOCKER_COMPOSE down -v --rmi all
                docker system prune -f
                print_success "Cleanup completed"
            else
                print_status "Cleanup cancelled"
            fi
            ;;
        migrate)
            run_migrations
            ;;
        urls)
            show_urls
            ;;
        help)
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start     Start the development environment (default)"
            echo "  stop      Stop all services"
            echo "  restart   Restart all services"
            echo "  logs      Show logs (optional: specify service name)"
            echo "  status    Show status of all services"
            echo "  clean     Remove all containers, volumes, and images"
            echo "  migrate   Run database migrations"
            echo "  urls      Show service URLs"
            echo "  help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 start           # Start all services"
            echo "  $0 logs api        # Show API service logs"
            echo "  $0 logs            # Show all logs"
            ;;
        *)
            print_error "Unknown command: $1"
            print_status "Use '$0 help' for available commands"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
