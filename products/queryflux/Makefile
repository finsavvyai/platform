# QueryFlux Database Adapter Testing Makefile

.PHONY: help test test-integration test-performance test-docker test-all
.PHONY: start-databases stop-databases clean coverage docker-logs
.PHONY: postgres-test mysql-test mongodb-test redis-test

# Default target
help: ## Show this help message
	@echo "QueryFlux Database Adapter Testing"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

# Test targets
test: ## Run all tests with Docker containers
	@echo "Running all database adapter tests..."
	./tests/run-tests.sh

test-integration: ## Run integration tests only
	@echo "Running integration tests..."
	cd tests/integration && go test -v -tags=integration ./...

test-performance: ## Run performance tests only
	@echo "Running performance tests..."
	cd tests/integration && go test -v -tags=integration -run=TestAdapterPerformance ./...

test-docker: ## Run Docker-specific tests only
	@echo "Running Docker tests..."
	cd tests/integration && go test -v -tags=integration -run=TestDockerCompose ./...

test-all: ## Run all test suites
	@echo "Running all test suites..."
	./tests/run-tests.sh --skip-coverage

# Database container management
start-databases: ## Start all test database containers
	@echo "Starting test database containers..."
	docker-compose -f docker-compose.test.yml -p queryflux-test up -d
	@echo "Waiting for containers to be healthy..."
	sleep 30
	@echo "Containers started. Use 'make docker-logs' to check status."

stop-databases: ## Stop all test database containers
	@echo "Stopping test database containers..."
	docker-compose -f docker-compose.test.yml -p queryflux-test down -v
	@echo "Containers stopped."

restart-databases: stop-databases start-databases ## Restart database containers

# Individual database tests
postgres-test: ## Test PostgreSQL adapter only
	@echo "Testing PostgreSQL adapter..."
	cd tests/integration && go test -v -tags=integration -run=TestPostgreSQLAdapter ./...

mysql-test: ## Test MySQL adapter only
	@echo "Testing MySQL adapter..."
	cd tests/integration && go test -v -tags=integration -run=TestMySQLAdapter ./...

mongodb-test: ## Test MongoDB adapter only
	@echo "Testing MongoDB adapter..."
	cd tests/integration && go test -v -tags=integration -run=TestMongoDBAdapter ./...

redis-test: ## Test Redis adapter only
	@echo "Testing Redis adapter..."
	cd tests/integration && go test -v -tags=integration -run=TestRedisAdapter ./...

# Docker container management
docker-logs: ## Show logs for all database containers
	@echo "PostgreSQL logs:"
	docker logs --tail 20 queryflux-postgres-test 2>/dev/null || echo "PostgreSQL container not running"
	@echo ""
	@echo "MySQL logs:"
	docker logs --tail 20 queryflux-mysql-test 2>/dev/null || echo "MySQL container not running"
	@echo ""
	@echo "MongoDB logs:"
	docker logs --tail 20 queryflux-mongodb-test 2>/dev/null || echo "MongoDB container not running"
	@echo ""
	@echo "Redis logs:"
	docker logs --tail 20 queryflux-redis-test 2>/dev/null || echo "Redis container not running"

docker-ps: ## Show status of all database containers
	@echo "Database container status:"
	docker-compose -f docker-compose.test.yml -p queryflux-test ps

docker-clean: ## Clean up all Docker resources
	@echo "Cleaning up Docker resources..."
	docker-compose -f docker-compose.test.yml -p queryflux-test down -v --remove-orphans
	docker system prune -f
	@echo "Docker cleanup completed."

# Test coverage
coverage: ## Run tests with coverage report
	@echo "Running tests with coverage..."
	cd tests/integration && go test -v -tags=integration -coverprofile=coverage.out ./...
	@echo "Coverage report:"
	cd tests/integration && go tool cover -func=coverage.out

coverage-html: ## Generate HTML coverage report
	@echo "Generating HTML coverage report..."
	cd tests/integration && go test -v -tags=integration -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: tests/integration/coverage.html"

# Quick test targets (short mode)
quick-test: ## Run quick tests (skip Docker and performance)
	@echo "Running quick integration tests..."
	./tests/run-tests.sh --skip-docker --skip-performance --skip-coverage

# Development targets
dev-setup: ## Set up development environment
	@echo "Setting up development environment..."
	@echo "Installing Go dependencies..."
	go mod download
	go mod tidy
	@echo "Making test script executable..."
	chmod +x tests/run-tests.sh
	@echo "Development setup complete."

dev-test: ## Run tests in development mode
	@echo "Running tests in development mode..."
	./tests/run-tests.sh --skip-coverage

# CI/CD targets
ci-test: ## Run tests for CI/CD (minimal output)
	@echo "Running CI tests..."
	./tests/run-tests.sh --skip-performance --skip-coverage > test-results.txt 2>&1 || (cat test-results.txt && exit 1)

# Validation targets
validate-containers: ## Validate all database containers are running
	@echo "Validating database containers..."
	@./tests/scripts/validate-containers.sh

check-deps: ## Check for outdated dependencies
	@echo "Checking for outdated dependencies..."
	go list -u -m all

# Benchmarking
benchmark: ## Run performance benchmarks
	@echo "Running performance benchmarks..."
	cd tests/integration && go test -v -tags=integration -bench=. -benchmem ./...

# Database-specific quick tests
test-sql: postgres-test mysql-test mariadb-test ## Test all SQL databases
test-nosql: mongodb-test ## Test all NoSQL databases
test-cache: redis-test ## Test cache databases

# Full test matrix
test-matrix: ## Run complete test matrix
	@echo "Running complete test matrix..."
	@echo "1. Starting containers..."
	$(MAKE) start-databases
	@echo "2. Running SQL database tests..."
	$(MAKE) test-sql
	@echo "3. Running NoSQL database tests..."
	$(MAKE) test-nosql
	@echo "4. Running cache tests..."
	$(MAKE) test-cache
	@echo "5. Running Docker tests..."
	$(MAKE) test-docker
	@echo "6. Running performance tests..."
	$(MAKE) test-performance
	@echo "7. Generating coverage report..."
	$(MAKE) coverage
	@echo "8. Stopping containers..."
	$(MAKE) stop-databases
	@echo "Test matrix completed successfully!"

# Troubleshooting
debug-test: ## Run tests with debug output
	@echo "Running tests with debug output..."
	cd tests/integration && go test -v -tags=integration -count=1 ./...

race-test: ## Run tests with race detection
	@echo "Running tests with race detection..."
	cd tests/integration && go test -race -v -tags=integration ./...

# Memory profiling
profile-memory: ## Profile memory usage during tests
	@echo "Profiling memory usage..."
	cd tests/integration && go test -v -tags=integration -memprofile=mem.prof -run=TestAdapterPerformance ./...

# CPU profiling
profile-cpu: ## Profile CPU usage during tests
	@echo "Profiling CPU usage..."
	cd tests/integration && go test -v -tags=integration -cpuprofile=cpu.prof -run=TestAdapterPerformance ./...

# Clean targets
clean: ## Clean up test artifacts and temporary files
	@echo "Cleaning up test artifacts..."
	@rm -f tests/integration/coverage.out
	@rm -f tests/integration/coverage.html
	@rm -f tests/integration/cpu.prof
	@rm -f tests/integration/mem.prof
	@rm -f test-results.txt
	@echo "Cleanup completed."

clean-all: clean docker-clean ## Clean everything including Docker resources

# Help for specific databases
postgres-help: ## Show PostgreSQL testing help
	@echo "PostgreSQL Adapter Testing:"
	@echo "  Start:     docker-compose -f docker-compose.test.yml up -d queryflux-postgres-test"
	@echo "  Test:      make postgres-test"
	@echo "  Logs:      docker logs queryflux-postgres-test"
	@echo "  Connect:   docker exec -it queryflux-postgres-test psql -U testuser -d queryflux_test"

mongodb-help: ## Show MongoDB testing help
	@echo "MongoDB Adapter Testing:"
	@echo "  Start:     docker-compose -f docker-compose.test.yml up -d queryflux-mongodb-test"
	@echo "  Test:      make mongodb-test"
	@echo "  Logs:      docker logs queryflux-mongodb-test"
	@echo "  Connect:   docker exec -it queryflux-mongodb-test mongo -u testuser queryflux_test"

redis-help: ## Show Redis testing help
	@echo "Redis Adapter Testing:"
	@echo "  Start:     docker-compose -f docker-compose.test.yml up -d queryflux-redis-test"
	@echo "  Test:      make redis-test"
	@echo "  Logs:      docker logs queryflux-redis-test"
	@echo "  Connect:   docker exec -it queryflux-redis-test redis-cli"