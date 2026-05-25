#!/bin/bash
# Quick test script to verify service connectivity

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_test() {
    echo -e "${YELLOW}Testing${NC} $1..."
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
}

# Test database connections
test_postgres() {
    print_test "PostgreSQL connection"
    if docker exec quantumbeam-postgres-dev pg_isready -U postgres > /dev/null 2>&1; then
        print_success "PostgreSQL is ready"
    else
        print_fail "PostgreSQL is not ready"
    fi
}

test_redis() {
    print_test "Redis connection"
    if docker exec quantumbeam-redis-dev redis-cli ping | grep -q PONG; then
        print_success "Redis is ready"
    else
        print_fail "Redis is not ready"
    fi
}

test_influxdb() {
    print_test "InfluxDB connection"
    if curl -f http://localhost:8086/health > /dev/null 2>&1; then
        print_success "InfluxDB is ready"
    else
        print_fail "InfluxDB is not ready"
    fi
}

test_elasticsearch() {
    print_test "Elasticsearch connection"
    if curl -f http://localhost:9200/_cluster/health > /dev/null 2>&1; then
        print_success "Elasticsearch is ready"
    else
        print_fail "Elasticsearch is not ready"
    fi
}

# Test API endpoints
test_api_service() {
    print_test "API Service health endpoint"
    if curl -f http://localhost:8082/health > /dev/null 2>&1; then
        print_success "API Service is healthy"
    else
        print_fail "API Service is not responding"
    fi
}

test_quantum_service() {
    print_test "Quantum Service health endpoint"
    if curl -f http://localhost:8001/health > /dev/null 2>&1; then
        print_success "Quantum Service is healthy"
    else
        print_fail "Quantum Service is not responding"
    fi
}

test_ml_service() {
    print_test "ML Service health endpoint"
    if curl -f http://localhost:8002/health > /dev/null 2>&1; then
        print_success "ML Service is healthy"
    else
        print_fail "ML Service is not responding"
    fi
}

# Test GUI interfaces
test_gui_interfaces() {
    print_test "PgAdmin interface"
    if curl -f http://localhost:5050 > /dev/null 2>&1; then
        print_success "PgAdmin is accessible"
    else
        print_fail "PgAdmin is not accessible"
    fi

    print_test "Grafana interface"
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "Grafana is accessible"
    else
        print_fail "Grafana is not accessible"
    fi

    print_test "Kibana interface"
    if curl -f http://localhost:5601/api/status > /dev/null 2>&1; then
        print_success "Kibana is accessible"
    else
        print_fail "Kibana is not accessible"
    fi
}

# Run all tests
echo "========================================"
echo "🧪 QuantumBeam Connectivity Tests"
echo "========================================"
echo ""

test_postgres
test_redis
test_influxdb
test_elasticsearch
echo ""
test_api_service
test_quantum_service
test_ml_service
echo ""
test_gui_interfaces

echo ""
echo "========================================"
echo "✨ Testing completed!"
echo "========================================"
