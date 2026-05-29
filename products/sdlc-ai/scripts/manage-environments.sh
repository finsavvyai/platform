#!/bin/bash

# SDLC Platform Environment Management Script
# Provides comprehensive environment orchestration for development, staging, and production

set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILES="$PROJECT_ROOT/docker-compose*.yml"
ENV_FILE="$PROJECT_ROOT/.env"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_info() {
    echo -e "${CYAN}ℹ️${NC} $1"
}

# Help function
show_help() {
    cat << EOF
SDLC Platform Environment Management Script

USAGE:
    $0 [COMMAND] [ENVIRONMENT] [OPTIONS]

COMMANDS:
    start           Start the specified environment
    stop            Stop the specified environment
    restart         Restart the specified environment
    status          Show status of all environments
    logs            Show logs for the specified environment
    clean           Clean up resources for the specified environment
    backup          Create backups for the specified environment
    restore         Restore from backup for the specified environment
    test            Run tests against the specified environment
    deploy          Deploy to the specified environment
    scale           Scale services in the specified environment
    migrate         Run database migrations
    monitor         Start monitoring for the specified environment

ENVIRONMENTS:
    dev             Development environment
    staging         Staging environment
    prod            Production environment

OPTIONS:
    --service       Specify a specific service (e.g., --service postgres)
    --follow        Follow logs in real-time
    --force         Force action without confirmation
    --backup-file   Specify backup file for restore
    --scale-count   Number of replicas for scaling
    --dry-run       Show what would be done without executing

EXAMPLES:
    $0 start dev
    $0 logs staging --follow
    $0 backup prod
    $0 restore staging --backup-file backup_20231201_120000.sql
    $0 scale prod --service api --scale-count 3
    $0 test staging --service pipeline
    $0 deploy prod --force

EOF
}

# Validate environment
validate_environment() {
    local env="$1"
    case "$env" in
        dev|development)
            echo "dev"
            ;;
        staging)
            echo "staging"
            ;;
        prod|production)
            echo "prod"
            ;;
        *)
            log_error "Invalid environment: $env"
            log_info "Valid environments: dev, staging, prod"
            exit 1
            ;;
    esac
}

# Get compose file for environment
get_compose_file() {
    local env="$1"
    case "$env" in
        dev)
            echo "$PROJECT_ROOT/docker-compose.yml"
            ;;
        staging)
            echo "$PROJECT_ROOT/docker-compose.staging.yml"
            ;;
        prod)
            echo "$PROJECT_ROOT/docker-compose.prod.yml"
            ;;
    esac
}

# Get environment file
get_env_file() {
    local env="$1"
    case "$env" in
        dev)
            echo "$PROJECT_ROOT/.env"
            ;;
        staging)
            echo "$PROJECT_ROOT/.env.staging"
            ;;
        prod)
            echo "$PROJECT_ROOT/.env.prod"
            ;;
    esac
}

# Check if environment is running
is_environment_running() {
    local env="$1"
    local compose_file
    compose_file=$(get_compose_file "$env")

    if [[ -f "$compose_file" ]]; then
        cd "$PROJECT_ROOT"
        docker compose -f "$compose_file" ps --format json | jq -r '.[] | select(.State == "running") | .Service' | wc -l | grep -q "^0$"
        return $((!$?))
    fi
    return 1
}

# Start environment
start_environment() {
    local env="$1"
    local compose_file
    local env_file

    compose_file=$(get_compose_file "$env")
    env_file=$(get_env_file "$env")

    log "Starting $env environment..."

    if [[ ! -f "$compose_file" ]]; then
        log_error "Compose file not found: $compose_file"
        return 1
    fi

    if [[ ! -f "$env_file" ]]; then
        log_warning "Environment file not found: $env_file"
        log_info "Creating example environment file..."
        cp "$env_file.example" "$env_file" 2>/dev/null || true
    fi

    cd "$PROJECT_ROOT"

    # Load environment variables
    if [[ -f "$env_file" ]]; then
        set -a
        source "$env_file"
        set +a
    fi

    # Start services
    docker compose -f "$compose_file" --env-file "$env_file" up -d

    # Wait for health checks
    log "Waiting for services to be healthy..."
    sleep 10

    # Show status
    show_status "$env"

    log_success "$env environment started successfully"
}

# Stop environment
stop_environment() {
    local env="$1"
    local compose_file

    compose_file=$(get_compose_file "$env")

    log "Stopping $env environment..."

    if [[ ! -f "$compose_file" ]]; then
        log_error "Compose file not found: $compose_file"
        return 1
    fi

    cd "$PROJECT_ROOT"
    docker compose -f "$compose_file" down

    log_success "$env environment stopped successfully"
}

# Restart environment
restart_environment() {
    local env="$1"
    log "Restarting $env environment..."

    stop_environment "$env"
    sleep 5
    start_environment "$env"
}

# Show environment status
show_status() {
    local env="${1:-all}"

    if [[ "$env" == "all" ]]; then
        log "Status of all environments:"
        echo
        for e in dev staging prod; do
            echo -e "${PURPLE}=== $e Environment ===${NC}"
            show_single_status "$e"
            echo
        done
    else
        echo -e "${PURPLE}=== $env Environment Status ===${NC}"
        show_single_status "$env"
    fi
}

# Show single environment status
show_single_status() {
    local env="$1"
    local compose_file

    compose_file=$(get_compose_file "$env")

    if [[ -f "$compose_file" ]]; then
        cd "$PROJECT_ROOT"
        docker compose -f "$compose_file" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" || log_warning "No services found for $env"
    else
        log_warning "Compose file not found for $env environment"
    fi
}

# Show logs
show_logs() {
    local env="$1"
    local follow="${2:-false}"
    local service="$3"

    local compose_file
    compose_file=$(get_compose_file "$env")

    if [[ ! -f "$compose_file" ]]; then
        log_error "Compose file not found: $compose_file"
        return 1
    fi

    cd "$PROJECT_ROOT"

    local log_args=""
    if [[ "$follow" == "true" ]]; then
        log_args="-f"
    fi

    if [[ -n "$service" ]]; then
        docker compose -f "$compose_file" logs $log_args "$service"
    else
        docker compose -f "$compose_file" logs $log_args
    fi
}

# Clean environment
clean_environment() {
    local env="$1"
    local force="${2:-false}"

    if [[ "$force" != "true" ]]; then
        echo -n "This will remove all containers, networks, and volumes for $env environment. Are you sure? [y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log_info "Clean operation cancelled"
            return 0
        fi
    fi

    local compose_file
    compose_file=$(get_compose_file "$env")

    if [[ ! -f "$compose_file" ]]; then
        log_error "Compose file not found: $compose_file"
        return 1
    fi

    cd "$PROJECT_ROOT"
    docker compose -f "$compose_file" down -v --remove-orphans

    # Remove unused images and networks
    docker system prune -f

    log_success "$env environment cleaned successfully"
}

# Create backup
create_backup() {
    local env="$1"
    local backup_dir="$PROJECT_ROOT/backups"
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")

    log "Creating backup for $env environment..."

    mkdir -p "$backup_dir"

    # Backup PostgreSQL
    local postgres_container="sdlc-postgres-$env"
    if docker ps --format "{{.Names}}" | grep -q "^$postgres_container$"; then
        log "Backing up PostgreSQL..."
        docker exec "$postgres_container" pg_dump -U postgres sdlc_platform > "$backup_dir/postgres_${env}_${timestamp}.sql"
        log_success "PostgreSQL backup created: postgres_${env}_${timestamp}.sql"
    fi

    # Backup Redis (if needed)
    local redis_container="sdlc-redis-$env"
    if docker ps --format "{{.Names}}" | grep -q "^$redis_container$"; then
        log "Backing up Redis..."
        docker exec "$redis_container" redis-cli BGSAVE
        sleep 5
        docker cp "$redis_container:/data/dump.rdb" "$backup_dir/redis_${env}_${timestamp}.rdb"
        log_success "Redis backup created: redis_${env}_${timestamp}.rdb"
    fi

    # Backup MinIO data (if needed)
    local minio_container="sdlc-minio-$env"
    if docker ps --format "{{.Names}}" | grep -q "^$minio_container$"; then
        log "Backing up MinIO configuration..."
        docker exec "$minio_container" tar -czf - /data/.minio.sys > "$backup_dir/minio_config_${env}_${timestamp}.tar.gz"
        log_success "MinIO configuration backup created: minio_config_${env}_${timestamp}.tar.gz"
    fi

    # Create environment file backup
    local env_file
    env_file=$(get_env_file "$env")
    if [[ -f "$env_file" ]]; then
        cp "$env_file" "$backup_dir/env_${env}_${timestamp}"
        log_success "Environment file backup created: env_${env}_${timestamp}"
    fi

    log_success "Backup completed for $env environment"
}

# Restore from backup
restore_backup() {
    local env="$1"
    local backup_file="$2"

    if [[ -z "$backup_file" ]]; then
        log_error "Backup file must be specified with --backup-file"
        return 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    log "Restoring $env environment from backup: $backup_file"

    case "$backup_file" in
        *.sql)
            local postgres_container="sdlc-postgres-$env"
            if docker ps --format "{{.Names}}" | grep -q "^$postgres_container$"; then
                log "Restoring PostgreSQL..."
                docker exec -i "$postgres_container" psql -U postgres -d sdlc_platform < "$backup_file"
                log_success "PostgreSQL restored successfully"
            else
                log_error "PostgreSQL container not found for $env environment"
                return 1
            fi
            ;;
        *.rdb)
            local redis_container="sdlc-redis-$env"
            if docker ps --format "{{.Names}}" | grep -q "^$redis_container$"; then
                log "Restoring Redis..."
                docker cp "$backup_file" "$redis_container:/data/dump.rdb"
                docker restart "$redis_container"
                log_success "Redis restored successfully"
            else
                log_error "Redis container not found for $env environment"
                return 1
            fi
            ;;
        *)
            log_error "Unsupported backup file format: $backup_file"
            return 1
            ;;
    esac

    log_success "Restore completed for $env environment"
}

# Run tests
run_tests() {
    local env="$1"
    local service="$2"

    log "Running tests against $env environment..."

    # Health check tests
    local compose_file
    compose_file=$(get_compose_file "$env")

    cd "$PROJECT_ROOT"

    # Test basic connectivity
    if [[ -n "$service" ]]; then
        docker compose -f "$compose_file" exec "$service" curl -f http://localhost:8080/health || {
            log_error "Health check failed for $service"
            return 1
        }
        log_success "Health check passed for $service"
    else
        # Test all services
        docker compose -f "$compose_file" ps --format json | jq -r '.[] | .Service' | while read -r svc; do
            if docker compose -f "$compose_file" exec -T "$svc" curl -f http://localhost:8080/health >/dev/null 2>&1; then
                log_success "Health check passed for $svc"
            else
                log_warning "Health check failed for $svc (may not have health endpoint)"
            fi
        done
    fi

    log_success "Tests completed for $env environment"
}

# Scale services
scale_services() {
    local env="$1"
    local service="$2"
    local count="$3"

    if [[ -z "$service" || -z "$count" ]]; then
        log_error "Service and count must be specified"
        return 1
    fi

    local compose_file
    compose_file=$(get_compose_file "$env")

    cd "$PROJECT_ROOT"
    docker compose -f "$compose_file" up -d --scale "$service=$count"

    log_success "Scaled $service to $count instances in $env environment"
}

# Deploy to environment
deploy_to_environment() {
    local env="$1"
    local force="${2:-false}"

    log "Deploying to $env environment..."

    # Run pre-deployment checks
    if [[ "$env" == "prod" && "$force" != "true" ]]; then
        echo -n "This is a PRODUCTION deployment. Are you sure? [y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled"
            return 0
        fi
    fi

    # Build and deploy
    local compose_file
    compose_file=$(get_compose_file "$env")
    local env_file
    env_file=$(get_env_file "$env")

    cd "$PROJECT_ROOT"

    # Pull latest images
    docker compose -f "$compose_file" pull

    # Start with new images
    docker compose -f "$compose_file" --env-file "$env_file" up -d --force-recreate

    # Wait for health checks
    log "Waiting for services to be healthy..."
    sleep 30

    # Run tests
    run_tests "$env"

    log_success "Deployment to $env environment completed successfully"
}

# Main execution
main() {
    local command=""
    local environment=""
    local service=""
    local follow="false"
    local force="false"
    local backup_file=""
    local scale_count=""
    local dry_run="false"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            start|stop|restart|status|logs|clean|backup|restore|test|deploy|scale|migrate|monitor)
                command="$1"
                shift
                ;;
            dev|development|staging|prod|production)
                environment=$(validate_environment "$1")
                shift
                ;;
            --service)
                service="$2"
                shift 2
                ;;
            --follow)
                follow="true"
                shift
                ;;
            --force)
                force="true"
                shift
                ;;
            --backup-file)
                backup_file="$2"
                shift 2
                ;;
            --scale-count)
                scale_count="$2"
                shift 2
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$command" ]]; then
        log_error "Command is required"
        show_help
        exit 1
    fi

    if [[ "$command" != "status" && -z "$environment" ]]; then
        log_error "Environment is required for $command"
        show_help
        exit 1
    fi

    # Execute command
    case "$command" in
        start)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would start $environment environment"
            else
                start_environment "$environment"
            fi
            ;;
        stop)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would stop $environment environment"
            else
                stop_environment "$environment"
            fi
            ;;
        restart)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would restart $environment environment"
            else
                restart_environment "$environment"
            fi
            ;;
        status)
            show_status "$environment"
            ;;
        logs)
            show_logs "$environment" "$follow" "$service"
            ;;
        clean)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would clean $environment environment"
            else
                clean_environment "$environment" "$force"
            fi
            ;;
        backup)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would create backup for $environment environment"
            else
                create_backup "$environment"
            fi
            ;;
        restore)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would restore $environment environment from $backup_file"
            else
                restore_backup "$environment" "$backup_file"
            fi
            ;;
        test)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would run tests against $environment environment"
            else
                run_tests "$environment" "$service"
            fi
            ;;
        deploy)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would deploy to $environment environment"
            else
                deploy_to_environment "$environment" "$force"
            fi
            ;;
        scale)
            if [[ "$dry_run" == "true" ]]; then
                log_info "DRY RUN: Would scale $service to $scale_count in $environment environment"
            else
                scale_services "$environment" "$service" "$scale_count"
            fi
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"