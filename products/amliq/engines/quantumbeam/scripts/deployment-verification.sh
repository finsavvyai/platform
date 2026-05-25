#!/bin/bash

# QuantumBeam Production Deployment Verification Script
# This script validates that all components are properly deployed and configured

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Health check function
check_health() {
    local url=$1
    local service_name=$2
    local max_attempts=${3:-5}
    local attempt=1

    log "Checking health of $service_name at $url"

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" >/dev/null; then
            success "$service_name is healthy"
            return 0
        fi

        if [ $attempt -eq $max_attempts ]; then
            error "$service_name health check failed after $max_attempts attempts"
            return 1
        fi

        log "Attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
}

# Check Docker containers
check_docker_containers() {
    log "Checking Docker containers..."

    local containers=(
        "quantumbeam-api-prod"
        "quantumbeam-quantum-prod"
        "quantumbeam-ai-ml-prod"
        "quantumbeam-postgres-prod"
        "quantumbeam-redis-prod"
        "quantumbeam-nginx-prod"
        "quantumbeam-prometheus-prod"
        "quantumbeam-grafana-prod"
        "quantumbeam-alertmanager-prod"
    )

    local all_healthy=true

    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "^$container$"; then
            local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [[ "$status" == "healthy" || "$status" == "unknown" ]]; then
                success "Container $container is running"
            else
                error "Container $container is unhealthy (status: $status)"
                all_healthy=false
            fi
        else
            error "Container $container is not running"
            all_healthy=false
        fi
    done

    if $all_healthy; then
        success "All Docker containers are healthy"
        return 0
    else
        error "Some Docker containers are unhealthy"
        return 1
    fi
}

# Check service endpoints
check_service_endpoints() {
    log "Checking service endpoints..."

    local services=(
        "http://localhost:8080/health:QuantumBeam API"
        "http://localhost:8001/health:Quantum Service"
        "http://localhost:8002/health:AI/ML Service"
        "http://localhost:9090/-/healthy:Prometheus"
        "http://localhost:3000/api/health:Grafana"
        "http://localhost:9093/-/healthy:AlertManager"
        "http://localhost/health:Nginx"
    )

    local all_healthy=true

    for service in "${services[@]}"; do
        local url="${service%%:*}"
        local name="${service##*:}"

        if check_health "$url" "$name"; then
            success "$name endpoint is accessible"
        else
            error "$name endpoint is not accessible"
            all_healthy=false
        fi
    done

    if $all_healthy; then
        success "All service endpoints are accessible"
        return 0
    else
        error "Some service endpoints are not accessible"
        return 1
    fi
}

# Check API functionality
check_api_functionality() {
    log "Checking API functionality..."

    # Check API health endpoint
    local health_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/api/v1/health)
    if [ "$health_response" = "200" ]; then
        success "API health endpoint responding correctly"
    else
        error "API health endpoint returned HTTP $health_response"
        return 1
    fi

    # Check metrics endpoint
    local metrics_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/metrics)
    if [ "$metrics_response" = "200" ]; then
        success "API metrics endpoint responding correctly"
    else
        error "API metrics endpoint returned HTTP $metrics_response"
        return 1
    fi

    success "API functionality checks passed"
    return 0
}

# Check database connectivity
check_database_connectivity() {
    log "Checking database connectivity..."

    # Check PostgreSQL
    if docker exec quantumbeam-postgres-prod pg_isready -U quantumbeam -d quantumbeam >/dev/null 2>&1; then
        success "PostgreSQL is ready and accepting connections"
    else
        error "PostgreSQL is not ready"
        return 1
    fi

    # Check Redis
    if docker exec quantumbeam-redis-prod redis-cli --raw incr ping >/dev/null 2>&1; then
        success "Redis is responding"
    else
        error "Redis is not responding"
        return 1
    fi

    success "Database connectivity checks passed"
    return 0
}

# Check monitoring setup
check_monitoring() {
    log "Checking monitoring setup..."

    # Check Prometheus targets
    local prometheus_targets=$(curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.health=="up") | .labels.job' | sort | uniq)

    if echo "$prometheus_targets" | grep -q "quantumbeam-api"; then
        success "Prometheus is scraping API metrics"
    else
        warning "Prometheus may not be scraping API metrics"
    fi

    if echo "$prometheus_targets" | grep -q "prometheus"; then
        success "Prometheus is scraping itself"
    else
        warning "Prometheus may not be scraping itself"
    fi

    # Check Grafana datasources
    local grafana_datasources=$(curl -s -u admin:${GRAFANA_PASSWORD:-admin} http://localhost:3000/api/datasources | jq -r '.[] | .name' 2>/dev/null || echo "")

    if echo "$grafana_datasources" | grep -q "Prometheus"; then
        success "Grafana Prometheus datasource is configured"
    else
        warning "Grafana Prometheus datasource may not be configured"
    fi

    success "Monitoring setup checks completed"
    return 0
}

# Check SSL certificates
check_ssl_certificates() {
    log "Checking SSL certificates..."

    if [ -f "./ssl/cert.pem" ] && [ -f "./ssl/key.pem" ]; then
        success "SSL certificate files exist"

        # Check certificate validity
        if openssl x509 -checkend 86400 -noout -in ./ssl/cert.pem; then
            success "SSL certificate is valid for at least 24 hours"
        else
            warning "SSL certificate expires within 24 hours"
        fi
    else
        warning "SSL certificate files not found (HTTP only mode)"
    fi

    return 0
}

# Check configuration files
check_configuration() {
    log "Checking configuration files..."

    local config_files=(
        "config/nginx/nginx.conf"
        "config/nginx/conf.d/default.conf"
        "config/prometheus/prometheus.yml"
        "config/prometheus/rules/alerts.yml"
        "config/alertmanager/alertmanager.yml"
        "config/grafana/provisioning/datasources/prometheus.yml"
    )

    local all_valid=true

    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            success "Configuration file $config_file exists"
        else
            error "Configuration file $config_file is missing"
            all_valid=false
        fi
    done

    if $all_valid; then
        success "All configuration files are present"
        return 0
    else
        error "Some configuration files are missing"
        return 1
    fi
}

# Check resource usage
check_resource_usage() {
    log "Checking resource usage..."

    # Check Docker container resource usage
    local cpu_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | grep quantumbeam | awk '{sum += $2} END {print sum}' | sed 's/%//')
    local memory_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemPerc}}" | grep quantumbeam | awk '{sum += $2} END {print sum}' | sed 's/%//')

    if (( $(echo "$cpu_usage < 80" | bc -l) )); then
        success "CPU usage is acceptable (${cpu_usage}%)"
    else
        warning "High CPU usage detected (${cpu_usage}%)"
    fi

    if (( $(echo "$memory_usage < 85" | bc -l) )); then
        success "Memory usage is acceptable (${memory_usage}%)"
    else
        warning "High memory usage detected (${memory_usage}%)"
    fi

    return 0
}

# Run load test
run_load_test() {
    log "Running basic load test..."

    # Simple API load test
    local requests=100
    local concurrency=10

    if command_exists ab; then
        local result=$(ab -n $requests -c $concurrency http://localhost:8080/api/v1/health 2>/dev/null | grep "Requests per second" | awk '{print $4}')

        if [ -n "$result" ] && (( $(echo "$result > 50" | bc -l) )); then
            success "Load test passed (${result} requests/second)"
        else
            warning "Load test performance may be suboptimal"
        fi
    else
        warning "Apache Bench (ab) not available, skipping load test"
    fi

    return 0
}

# Main verification function
main() {
    log "Starting QuantumBeam Production Deployment Verification"

    # Check prerequisites
    if ! command_exists docker; then
        error "Docker is not installed"
        exit 1
    fi

    if ! command_exists curl; then
        error "curl is not installed"
        exit 1
    fi

    # Run all checks
    local checks=(
        "check_configuration:Configuration Files"
        "check_docker_containers:Docker Containers"
        "check_database_connectivity:Database Connectivity"
        "check_service_endpoints:Service Endpoints"
        "check_api_functionality:API Functionality"
        "check_monitoring:Monitoring Setup"
        "check_ssl_certificates:SSL Certificates"
        "check_resource_usage:Resource Usage"
        "run_load_test:Load Test"
    )

    local failed_checks=0

    for check in "${checks[@]}"; do
        local check_function="${check%%:*}"
        local check_name="${check##*:}"

        echo ""
        log "Running $check_name checks..."

        if $check_function; then
            success "$check_name checks passed"
        else
            error "$check_name checks failed"
            ((failed_checks++))
        fi
    done

    # Summary
    echo ""
    log "Deployment verification completed"

    if [ $failed_checks -eq 0 ]; then
        success "All checks passed! The deployment is ready for production."
        exit 0
    else
        error "$failed_checks check(s) failed. Please address the issues before going to production."
        exit 1
    fi
}

# Run main function
main "$@"