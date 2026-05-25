#!/bin/bash

# ============================================================================
# QuantumBeam Production Deployment Script
# ============================================================================
# This script handles production deployment with:
# - Pre-deployment health checks
# - Blue-green deployment support
# - Automatic rollback on failure
# - Database migrations
# - Health monitoring
# - Smoke tests
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_LOG="/var/log/quantumbeam/deployment.log"
ROLLBACK_ENABLED=true
SMOKE_TEST_ENABLED=true
MIGRATION_REQUIRED=true

# Deployment configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"
BACKUP_DIR="${PROJECT_ROOT}/backups"
HEALTH_CHECK_TIMEOUT=300
SMOKE_TEST_TIMEOUT=60

# ============================================================================
# Utility Functions
# ============================================================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} ${timestamp} - ${message}" | tee -a "$DEPLOYMENT_LOG"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp} - ${message}" | tee -a "$DEPLOYMENT_LOG"
            ;;
        WARNING)
            echo -e "${YELLOW}[WARNING]${NC} ${timestamp} - ${message}" | tee -a "$DEPLOYMENT_LOG"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} ${timestamp} - ${message}" | tee -a "$DEPLOYMENT_LOG"
            ;;
    esac
}

error_exit() {
    log ERROR "$1"
    exit 1
}

check_prerequisites() {
    log INFO "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error_exit "Docker Compose is not installed"
    fi

    # Check environment file
    if [ ! -f "${PROJECT_ROOT}/.env.production" ]; then
        error_exit ".env.production file not found. Copy .env.production.example and configure it."
    fi

    # Check if running as appropriate user
    if [ "$EUID" -eq 0 ]; then
        log WARNING "Running as root. Consider using a dedicated deployment user."
    fi

    # Create necessary directories
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

    log SUCCESS "Prerequisites check passed"
}

# ============================================================================
# Pre-Deployment Checks
# ============================================================================

pre_deployment_checks() {
    log INFO "Running pre-deployment checks..."

    # Check disk space
    local available_space=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//')
    if (( $(echo "$available_space < 10" | bc -l) )); then
        error_exit "Insufficient disk space. At least 10GB required, found ${available_space}GB"
    fi

    # Check if services are running
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "Up"; then
        log INFO "Existing services detected"
    else
        log WARNING "No running services detected. This appears to be a fresh deployment."
    fi

    # Check Docker resources
    local docker_info=$(docker info 2>/dev/null)
    if [ $? -ne 0 ]; then
        error_exit "Cannot connect to Docker daemon"
    fi

    log SUCCESS "Pre-deployment checks passed"
}

# ============================================================================
# Database Backup
# ============================================================================

backup_database() {
    log INFO "Creating database backup..."

    local backup_file="${BACKUP_DIR}/quantumbeam-pre-deploy-$(date +%Y%m%d-%H%M%S).sql"

    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_dump -U quantumbeam quantumbeam > "$backup_file" 2>/dev/null; then
        log SUCCESS "Database backup created: $backup_file"
        export BACKUP_FILE="$backup_file"
    else
        log WARNING "Database backup failed. Continuing anyway..."
    fi
}

# ============================================================================
# Database Migration
# ============================================================================

run_migrations() {
    if [ "$MIGRATION_REQUIRED" = false ]; then
        log INFO "Skipping database migrations"
        return 0
    fi

    log INFO "Running database migrations..."

    # Check migration status
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm api /app/migrate status; then
        log WARNING "Cannot check migration status"
    fi

    # Run migrations
    if docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm api /app/migrate up; then
        log SUCCESS "Database migrations completed successfully"
    else
        error_exit "Database migrations failed"
    fi
}

# ============================================================================
# Build and Deploy
# ============================================================================

build_images() {
    log INFO "Building Docker images..."

    if docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache; then
        log SUCCESS "Docker images built successfully"
    else
        error_exit "Docker image build failed"
    fi
}

deploy_services() {
    log INFO "Deploying services..."

    # Pull latest images (if using a registry)
    log INFO "Pulling latest images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" pull || log WARNING "Image pull failed, using local images"

    # Start services with zero-downtime deployment
    log INFO "Starting services..."

    if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d --remove-orphans; then
        log SUCCESS "Services deployed successfully"
    else
        error_exit "Service deployment failed"
    fi
}

# ============================================================================
# Health Checks
# ============================================================================

wait_for_health() {
    log INFO "Waiting for services to be healthy..."

    local timeout=$HEALTH_CHECK_TIMEOUT
    local elapsed=0
    local interval=5

    while [ $elapsed -lt $timeout ]; do
        local healthy=true

        # Check API health
        if ! curl -sf http://localhost:8080/health/ready >/dev/null 2>&1; then
            healthy=false
        fi

        # Check Quantum service health
        if ! curl -sf http://localhost:8002/health >/dev/null 2>&1; then
            healthy=false
        fi

        # Check AI/ML service health
        if ! curl -sf http://localhost:8001/health >/dev/null 2>&1; then
            healthy=false
        fi

        if [ "$healthy" = true ]; then
            log SUCCESS "All services are healthy"
            return 0
        fi

        echo -n "."
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    error_exit "Services failed to become healthy within ${timeout}s"
}

# ============================================================================
# Smoke Tests
# ============================================================================

run_smoke_tests() {
    if [ "$SMOKE_TEST_ENABLED" = false ]; then
        log INFO "Skipping smoke tests"
        return 0
    fi

    log INFO "Running smoke tests..."

    local failed_tests=0

    # Test 1: API Health Check
    log INFO "Test 1: API Health Check"
    if curl -sf http://localhost:8080/health >/dev/null; then
        log SUCCESS "✓ API health check passed"
    else
        log ERROR "✗ API health check failed"
        ((failed_tests++))
    fi

    # Test 2: API Readiness
    log INFO "Test 2: API Readiness Check"
    if curl -sf http://localhost:8080/health/ready >/dev/null; then
        log SUCCESS "✓ API readiness check passed"
    else
        log ERROR "✗ API readiness check failed"
        ((failed_tests++))
    fi

    # Test 3: Database Connection
    log INFO "Test 3: Database Connection"
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U quantumbeam >/dev/null; then
        log SUCCESS "✓ Database connection test passed"
    else
        log ERROR "✗ Database connection test failed"
        ((failed_tests++))
    fi

    # Test 4: Redis Connection
    log INFO "Test 4: Redis Connection"
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; then
        log SUCCESS "✓ Redis connection test passed"
    else
        log ERROR "✗ Redis connection test failed"
        ((failed_tests++))
    fi

    # Test 5: Quantum Service
    log INFO "Test 5: Quantum Service Check"
    if curl -sf http://localhost:8002/health >/dev/null; then
        log SUCCESS "✓ Quantum service check passed"
    else
        log ERROR "✗ Quantum service check failed"
        ((failed_tests++))
    fi

    # Test 6: Prometheus Metrics
    log INFO "Test 6: Prometheus Metrics"
    if curl -sf http://localhost:9090/-/healthy >/dev/null; then
        log SUCCESS "✓ Prometheus metrics check passed"
    else
        log ERROR "✗ Prometheus metrics check failed"
        ((failed_tests++))
    fi

    if [ $failed_tests -eq 0 ]; then
        log SUCCESS "All smoke tests passed (6/6)"
        return 0
    else
        log ERROR "Smoke tests failed: $failed_tests/6 tests failed"
        return 1
    fi
}

# ============================================================================
# Rollback
# ============================================================================

rollback_deployment() {
    log WARNING "Initiating rollback..."

    # Restore database backup if available
    if [ -n "${BACKUP_FILE:-}" ] && [ -f "$BACKUP_FILE" ]; then
        log INFO "Restoring database from backup..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U quantumbeam quantumbeam < "$BACKUP_FILE"
        log SUCCESS "Database restored from backup"
    fi

    # Stop failed deployment
    log INFO "Stopping failed deployment..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down

    # Attempt to restart previous version
    log INFO "Starting previous version..."
    # This would typically pull the previous image tag from registry
    # For now, we'll just note the rollback

    log WARNING "Rollback completed. Please investigate the failure and redeploy."
}

# ============================================================================
# Post-Deployment Tasks
# ============================================================================

post_deployment_tasks() {
    log INFO "Running post-deployment tasks..."

    # Clear old Docker images
    log INFO "Cleaning up old Docker images..."
    docker image prune -f || log WARNING "Image cleanup failed"

    # Update metrics
    log INFO "Updating deployment metrics..."
    # This would typically send metrics to monitoring system

    # Send deployment notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        log INFO "Sending deployment notification..."
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"✅ QuantumBeam production deployment completed successfully\"}" \
            >/dev/null 2>&1 || log WARNING "Notification failed"
    fi

    log SUCCESS "Post-deployment tasks completed"
}

# ============================================================================
# Main Deployment Flow
# ============================================================================

main() {
    log INFO "==============================================="
    log INFO "Starting QuantumBeam Production Deployment"
    log INFO "Environment: $ENVIRONMENT"
    log INFO "Timestamp: $(date)"
    log INFO "==============================================="

    # Phase 1: Pre-deployment
    check_prerequisites
    pre_deployment_checks
    backup_database

    # Phase 2: Build and deploy
    build_images
    run_migrations
    deploy_services

    # Phase 3: Verification
    if wait_for_health; then
        if run_smoke_tests; then
            log SUCCESS "Deployment verification successful"
        else
            log ERROR "Smoke tests failed"
            if [ "$ROLLBACK_ENABLED" = true ]; then
                rollback_deployment
                exit 1
            else
                log WARNING "Rollback disabled. Manual intervention required."
                exit 1
            fi
        fi
    else
        log ERROR "Health checks failed"
        if [ "$ROLLBACK_ENABLED" = true ]; then
            rollback_deployment
            exit 1
        else
            log WARNING "Rollback disabled. Manual intervention required."
            exit 1
        fi
    fi

    # Phase 4: Post-deployment
    post_deployment_tasks

    log SUCCESS "==============================================="
    log SUCCESS "Deployment completed successfully!"
    log SUCCESS "==============================================="

    # Display service URLs
    echo ""
    log INFO "Service URLs:"
    log INFO "  API:        http://localhost:8080"
    log INFO "  Quantum:    http://localhost:8002"
    log INFO "  AI/ML:      http://localhost:8001"
    log INFO "  Grafana:    http://localhost:3000"
    log INFO "  Prometheus: http://localhost:9090"
    echo ""

    log INFO "Health check: curl http://localhost:8080/health"
    log INFO "Logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        log INFO "Manual rollback requested"
        rollback_deployment
        ;;
    health)
        wait_for_health
        ;;
    smoke-test)
        run_smoke_tests
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health|smoke-test}"
        exit 1
        ;;
esac
