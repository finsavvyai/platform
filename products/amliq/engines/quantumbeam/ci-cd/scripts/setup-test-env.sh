#!/bin/bash

# QuantumBeam Test Environment Setup Script
# This script sets up the test environment for CI/CD pipelines

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[✓] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[!] $1${NC}"
}

error() {
    echo -e "${RED}[✗] $1${NC}"
}

# Check if required tools are installed
check_requirements() {
    log "Checking requirements..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    success "Docker is installed"

    # Check Go
    if ! command -v go &> /dev/null; then
        error "Go is not installed"
        exit 1
    fi
    success "Go is installed"

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        warning "kubectl is not installed (optional for local testing)"
    else
        success "kubectl is installed"
    fi

    # Check helm
    if ! command -v helm &> /dev/null; then
        warning "helm is not installed (optional for local testing)"
    else
        success "helm is installed"
    fi
}

# Create test directories
create_test_directories() {
    log "Creating test directories..."

    mkdir -p test/reports
    mkdir -p test/logs
    mkdir -p test/tmp
    mkdir -p test/coverage
    mkdir -p test/integration
    mkdir -p test/e2e

    success "Test directories created"
}

# Setup test database
setup_test_database() {
    log "Setting up test database..."

    # Check if PostgreSQL is running
    if ! docker ps | grep -q postgres-test; then
        log "Starting test PostgreSQL container..."
        docker run -d \
            --name postgres-test \
            -p 5433:5432 \
            -e POSTGRES_DB=quantumbeam_test \
            -e POSTGRES_USER=test \
            -e POSTGRES_PASSWORD=test \
            postgres:15-alpine

        # Wait for PostgreSQL to be ready
        log "Waiting for PostgreSQL to be ready..."
        for i in {1..30}; do
            if docker exec postgres-test pg_isready -U test -d quantumbeam_test > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        success "Test PostgreSQL is ready"
    else
        success "Test PostgreSQL is already running"
    fi

    # Check if Redis is running
    if ! docker ps | grep -q redis-test; then
        log "Starting test Redis container..."
        docker run -d \
            --name redis-test \
            -p 6380:6379 \
            redis:7-alpine

        # Wait for Redis to be ready
        log "Waiting for Redis to be ready..."
        for i in {1..10}; do
            if docker exec redis-test redis-cli ping > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        success "Test Redis is ready"
    else
        success "Test Redis is already running"
    fi
}

# Create test configuration
create_test_config() {
    log "Creating test configuration..."

    # Create test environment file
    cat > .env.test << EOF
# Test Environment Configuration
APP_ENV=test
APP_DEBUG=true
APP_PORT=8080
DB_HOST=localhost
DB_PORT=5433
DB_NAME=quantumbeam_test
DB_USER=test
DB_PASSWORD=test
DB_SSLMODE=disable
DB_POOL_SIZE=5
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5
DB_CONN_MAX_LIFETIME=5m

REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=
REDIS_DB=0

# JWT Configuration
JWT_SECRET=test-secret-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true
TRACING_SERVICE_NAME=quantumbeam-test
TRACING_SAMPLING_RATE=1.0

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
LOG_OUTPUT=stdout

# Security
CORS_ALLOWED_ORIGINS=*
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=*
CORS_ALLOW_CREDENTIALS=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=1m

# External Services
EXTERNAL_API_TIMEOUT=30s
EXTERNAL_API_RETRIES=3

# Test Configuration
TEST_DATABASE_URL=postgres://test:test@localhost:5433/quantumbeam_test?sslmode=disable
TEST_REDIS_URL=redis://localhost:6380/0
TEST_API_BASE_URL=http://localhost:8080
TEST_TIMEOUT=30s
EOF

    # Create test configuration file
    cat > test/config.yaml << EOF
test:
  database:
    host: localhost
    port: 5433
    name: quantumbeam_test
    user: test
    password: test
    ssl_mode: disable
    pool_size: 5
    max_open_conns: 25
    max_idle_conns: 5
    conn_max_lifetime: 5m

  redis:
    host: localhost
    port: 6380
    password: ""
    db: 0

  server:
    port: 8080
    debug: true
    cors:
      allowed_origins:
        - "*"
      allowed_methods:
        - GET
        - POST
        - PUT
        - DELETE
        - OPTIONS
      allowed_headers:
        - "*"
      allow_credentials: true

  logging:
    level: debug
    format: json
    output: stdout

  security:
    jwt_secret: test-secret-key-change-in-production
    jwt_expires_in: 1h
    jwt_refresh_expires_in: 7d
    rate_limit:
      enabled: true
      requests: 100
      window: 1m

  external:
    api_timeout: 30s
    api_retries: 3

  monitoring:
    enabled: true
    metrics_port: 9090
    tracing:
      enabled: true
      service_name: quantumbeam-test
      sampling_rate: 1.0
EOF

    success "Test configuration created"
}

# Download test dependencies
download_test_dependencies() {
    log "Downloading test dependencies..."

    # Download test data if needed
    if [ ! -f "test/data/sample_transactions.json" ]; then
        log "Downloading test data..."
        mkdir -p test/data
        # Create sample test data
        cat > test/data/sample_transactions.json << 'EOF'
[
  {
    "id": "test_tx_001",
    "amount": 100.50,
    "currency": "USD",
    "user_id": "test_user_001",
    "merchant_id": "test_merchant_001",
    "timestamp": "2023-01-01T00:00:00Z",
    "status": "completed",
    "risk_score": 0.15
  },
  {
    "id": "test_tx_002",
    "amount": 250.75,
    "currency": "USD",
    "user_id": "test_user_002",
    "merchant_id": "test_merchant_002",
    "timestamp": "2023-01-01T00:01:00Z",
    "status": "pending",
    "risk_score": 0.45
  }
]
EOF
    fi

    success "Test dependencies downloaded"
}

# Setup test fixtures
setup_test_fixtures() {
    log "Setting up test fixtures..."

    # Create test database fixtures
    cat > test/fixtures/database.sql << 'EOF'
-- Test Database Fixtures

-- Create test users
INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES
('test_user_001', 'test@example.com', 'hashed_password', 'Test User', 'user', NOW(), NOW()),
('test_user_002', 'admin@example.com', 'hashed_password', 'Admin User', 'admin', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test API keys
INSERT INTO api_keys (id, key_hash, user_id, plan_type, created_at, expires_at) VALUES
('test_key_001', 'hashed_key_001', 'test_user_001', 'pro', NOW(), NOW() + INTERVAL '30 days'),
('test_key_002', 'hashed_key_002', 'test_user_002', 'enterprise', NOW(), NOW() + INTERVAL '365 days')
ON CONFLICT (id) DO NOTHING;

-- Create test transactions
INSERT INTO transactions (id, user_id, merchant_id, amount, currency, status, risk_score, created_at) VALUES
('test_tx_001', 'test_user_001', 'test_merchant_001', 100.50, 'USD', 'completed', 0.15, NOW()),
('test_tx_002', 'test_user_002', 'test_merchant_002', 250.75, 'USD', 'pending', 0.45, NOW())
ON CONFLICT (id) DO NOTHING;
EOF

    # Create test environment setup script
    cat > test/setup_env.sh << 'EOF'
#!/bin/bash
# Test environment setup script

set -euo pipefail

# Load test environment
export $(grep -v '^#' .env.test | xargs)

# Wait for services to be ready
echo "Waiting for services to be ready..."

# Wait for PostgreSQL
until docker exec postgres-test pg_isready -U test -d quantumbeam_test > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 1
done

# Wait for Redis
until docker exec redis-test redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 1
done

echo "All services are ready!"
EOF

    chmod +x test/setup_env.sh

    success "Test fixtures created"
}

# Create test scripts
create_test_scripts() {
    log "Creating test scripts..."

    # Create test runner script
    cat > test/run_tests.sh << 'EOF'
#!/bin/bash
# Test runner script

set -euo pipefail

# Load test environment
source .env.test

# Parse arguments
TEST_TYPE=${1:-all}
RUN_BENCHMARK=${2:-false}

echo "Running tests with type: $TEST_TYPE"

# Run tests based on type
case $TEST_TYPE in
    unit)
        echo "Running unit tests..."
        go test -v -race -coverprofile=coverage.out ./...
        ;;
    integration)
        echo "Running integration tests..."
        go test -v -tags=integration ./test/integration/...
        ;;
    api)
        echo "Running API tests..."
        go test -v -tags=api ./test/api/...
        ;;
    e2e)
        echo "Running E2E tests..."
        go test -v -tags=e2e ./test/e2e/...
        ;;
    all)
        echo "Running all tests..."
        go test -v -race -coverprofile=coverage.out ./...
        go test -v -tags=integration ./test/integration/...
        go test -v -tags=api ./test/api/...
        ;;
    *)
        echo "Unknown test type: $TEST_TYPE"
        echo "Usage: $0 [unit|integration|api|e2e|all] [benchmark]"
        exit 1
        ;;
esac

# Run benchmark tests if requested
if [ "$RUN_BENCHMARK" = "true" ]; then
    echo "Running benchmark tests..."
    go test -bench=. -benchmem ./...
fi

echo "Tests completed!"
EOF

    # Create test cleanup script
    cat > test/cleanup.sh << 'EOF'
#!/bin/bash
# Test cleanup script

set -euo pipefail

echo "Cleaning up test environment..."

# Stop test containers
docker stop postgres-test 2>/dev/null || true
docker stop redis-test 2>/dev/null || true

# Remove test containers
docker rm postgres-test 2>/dev/null || true
docker rm redis-test 2>/dev/null || true

# Clean test files
rm -rf test/reports/*
rm -rf test/logs/*
rm -rf test/tmp/*
rm -f coverage.out
rm -f .env.test

echo "Test environment cleaned up!"
EOF

    chmod +x test/run_tests.sh
    chmod +x test/cleanup.sh

    success "Test scripts created"
}

# Verify test environment
verify_test_environment() {
    log "Verifying test environment..."

    # Source test environment
    source .env.test

    # Verify database connection
    if docker exec postgres-test pg_isready -U test -d quantumbeam_test > /dev/null 2>&1; then
        success "Database connection verified"
    else
        error "Database connection failed"
        exit 1
    fi

    # Verify Redis connection
    if docker exec redis-test redis-cli ping > /dev/null 2>&1; then
        success "Redis connection verified"
    else
        error "Redis connection failed"
        exit 1
    fi

    # Verify Go modules
    if go mod verify > /dev/null 2>&1; then
        success "Go modules verified"
    else
        error "Go modules verification failed"
        exit 1
    fi

    success "Test environment verification completed"
}

# Main execution
main() {
    log "Starting QuantumBeam test environment setup..."

    check_requirements
    create_test_directories
    setup_test_database
    create_test_config
    download_test_dependencies
    setup_test_fixtures
    create_test_scripts
    verify_test_environment

    log "Test environment setup completed successfully!"
    echo
    echo "🎉 Test environment is ready!"
    echo
    echo "Useful commands:"
    echo "  ./test/run_tests.sh [unit|integration|api|e2e|all] [benchmark]"
    echo "  ./test/cleanup.sh"
    echo "  source .env.test"
    echo
    echo "Environment variables:"
    echo "  DATABASE_URL=postgres://test:test@localhost:5433/quantumbeam_test?sslmode=disable"
    echo "  REDIS_URL=redis://localhost:6380/0"
    echo
}

# Execute main function
main "$@"