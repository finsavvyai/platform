#!/bin/bash

# Integration Test Runner for Database Adapters
# This script sets up test databases and runs integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SKIP_SETUP=false
RUN_ALL=true
SPECIFIC_DB=""
CLEANUP=true
PARALLEL=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-setup)
      SKIP_SETUP=true
      shift
      ;;
    --no-cleanup)
      CLEANUP=false
      shift
      ;;
    --db)
      SPECIFIC_DB="$2"
      RUN_ALL=false
      shift 2
      ;;
    --sequential)
      PARALLEL=false
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-setup    Skip Docker setup"
      echo "  --no-cleanup    Don't clean up containers after tests"
      echo "  --db DB_NAME    Run tests for specific database only"
      echo "  --sequential    Run tests sequentially (not in parallel)"
      echo "  --help          Show this help message"
      echo ""
      echo "Available databases:"
      echo "  postgresql, mysql, mariadb, cockroachdb, mongodb, redis,"
      echo "  memcached, cassandra, couchdb, arangodb, influxdb, questdb,"
      echo "  timescaledb, neo4j, dynamodb, elasticsearch, sqlserver, oracle"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🚀 QueryFlux Database Adapter Integration Tests${NC}"
echo "=================================================="

# Function to check if Docker is running
check_docker() {
  if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to set up test databases
setup_databases() {
  echo -e "${YELLOW}🐳 Setting up test databases...${NC}"

  # Navigate to backend directory
  cd "$(dirname "$0")/../../.."

  # Start test databases
  if [ -f "docker-compose.test.yml" ]; then
    echo "Starting test databases with Docker Compose..."
    docker-compose -f docker-compose.test.yml up -d

    echo -e "${YELLOW}⏳ Waiting for databases to be ready...${NC}"
    sleep 30

    # Check if databases are healthy
    echo "Checking database health..."
    healthy_count=0
    total_count=0

    while IFS= read -r service; do
      if [ "$service" != "services:" ] && [ -n "$service" ]; then
        service_name=$(echo "$service" | cut -d':' -f1 | xargs)
        if [ "$service_name" != "version" ] && [ "$service_name" != "networks" ] && [ "$service_name" != "volumes" ]; then
          total_count=$((total_count + 1))
          if docker-compose -f docker-compose.test.yml ps "$service_name" | grep -q "Up (healthy)"; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            healthy_count=$((healthy_count + 1))
          else
            echo -e "${YELLOW}⚠️  $service_name is starting...${NC}"
          fi
        fi
      fi
    done < docker-compose.test.yml

    echo -e "${GREEN}📊 $healthy_count/$total_count databases are healthy${NC}"
  else
    echo -e "${RED}❌ docker-compose.test.yml not found${NC}"
    exit 1
  fi
}

# Function to set environment variables
setup_environment() {
  echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"

  # Set up test database connection URLs
  export POSTGRES_TEST_URL="postgres://test_user:test_password@localhost:5433/test_db?sslmode=disable"
  export MYSQL_TEST_URL="test_user:test_password@tcp(localhost:3307)/test_db"
  export MARIADB_TEST_URL="test_user:test_password@tcp(localhost:3308)/test_db"
  export COCKROACHDB_TEST_URL="postgres://root@localhost:26257/test_db?sslmode=disable"
  export MONGODB_TEST_URL="mongodb://test_user:test_password@localhost:27018/test_db"
  export REDIS_TEST_URL="redis://:test_password@localhost:6380/0"
  export MEMCACHED_TEST_URL="localhost:11212"
  export CASSANDRA_TEST_URL="cassandra://cassandra:cassandra@localhost:9043/test_db"
  export COUCHDB_TEST_URL="http://test_user:test_password@localhost:5985/test_db"
  export ARANGODB_TEST_URL="http://root:test_password@localhost:8530"
  export INFLUXDB_TEST_URL="http://localhost:8087"
  export QUESTDB_TEST_URL="postgres://test_user:test_password@localhost:8812/qdb"
  export TIMESCALEDB_TEST_URL="postgres://test_user:test_password@localhost:5434/test_db?sslmode=disable"
  export NEO4J_TEST_URL="bolt://neo4j:test_password@localhost:7688"
  export DYNAMODB_TEST_URL="http://localhost:8001"
  export ELASTICSEARCH_TEST_URL="http://localhost:9201"
  export SQLSERVER_TEST_URL="sqlserver://sa:TestPassword123!@localhost:1434?database=test_db"
  export ORACLE_TEST_URL="oracle://system:TestPassword123@localhost:1522/XE"

  echo -e "${GREEN}✅ Environment variables set${NC}"
}

# Function to run tests
run_tests() {
  echo -e "${YELLOW}🧪 Running integration tests...${NC}"

  # Navigate to backend directory
  cd "$(dirname "$0")/../../.."

  # Set Go test environment
  export CGO_ENABLED=1
  export GO111MODULE=on

  # Run tests
  if [ "$RUN_ALL" = true ]; then
    echo -e "${BLUE}📋 Running all adapter integration tests...${NC}"
    if [ "$PARALLEL" = true ]; then
      go test -v ./tests/integration/database/... -run "TestAllNewAdapters_Integration" -parallel 20
    else
      go test -v ./tests/integration/database/... -run "TestAllNewAdapters_Integration"
    fi
  else
    echo -e "${BLUE}📋 Running tests for $SPECIFIC_DB...${NC}"
    go test -v ./tests/integration/database/... -run "Test${SPECIFIC_DB^}Adapter_Integration"
  fi

  # Run factory tests
  echo -e "${BLUE}🏭 Running adapter factory tests...${NC}"
  go test -v ./tests/integration/database/... -run "TestAdapterFactory_NewAdapters"

  # Run compatibility tests
  echo -e "${BLUE}🔗 Running adapter compatibility tests...${NC}"
  go test -v ./tests/integration/database/... -run "TestAdapterCompatibility"

  echo -e "${GREEN}✅ All tests completed${NC}"
}

# Function to run benchmarks
run_benchmarks() {
  echo -e "${YELLOW}🏃‍♂️ Running performance benchmarks...${NC}"

  # Navigate to backend directory
  cd "$(dirname "$0")/../../.."

  # Run benchmarks
  go test -bench=. -benchmem ./tests/integration/database/... -run="^$" -count=3

  echo -e "${GREEN}✅ Benchmarks completed${NC}"
}

# Function to clean up
cleanup() {
  if [ "$CLEANUP" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning up test databases...${NC}"
    cd "$(dirname "$0")/../../.."
    docker-compose -f docker-compose.test.yml down -v
    echo -e "${GREEN}✅ Cleanup completed${NC}"
  else
    echo -e "${YELLOW}📋 Skipping cleanup. Databases are still running.${NC}"
    echo "To stop them later, run: docker-compose -f docker-compose.test.yml down -v"
  fi
}

# Function to show logs
show_logs() {
  echo -e "${YELLOW}📋 Showing database logs...${NC}"
  cd "$(dirname "$0")/../../.."
  docker-compose -f docker-compose.test.yml logs --tail=50
}

# Main execution
main() {
  # Check dependencies
  check_docker

  # Setup phase
  if [ "$SKIP_SETUP" = false ]; then
    setup_databases
    setup_environment
  fi

  # Wait a bit more for databases to be fully ready
  echo -e "${YELLOW}⏳ Giving databases extra time to initialize...${NC}"
  sleep 10

  # Run tests
  run_tests

  # Run benchmarks if requested
  if [[ "$*" == *"--bench"* ]]; then
    run_benchmarks
  fi

  # Show logs if there were failures
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Some tests failed. Showing logs...${NC}"
    show_logs
  fi

  # Cleanup
  cleanup

  echo -e "${GREEN}🎉 Integration test run completed!${NC}"
}

# Trap cleanup on script exit
trap cleanup EXIT

# Run main function
main "$@"