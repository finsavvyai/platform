# Makefile for Integration Tests
.PHONY: test test-integration test-performance test-all setup clean help

# Default target
all: test

# Configuration
TEST_CONFIG ?= test_config.yaml
TEST_TIMEOUT ?= 30m
TEST_PARALLEL ?= false
TEST_VERBOSE ?= false
SKIP_DATABASE ?= false
SKIP_PERFORMANCE ?= false

# Docker configuration
DOCKER_COMPOSE ?= docker-compose.test.yml
DOCKER_IMAGE ?= quantumbeam:test

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Help target
help: ## Show this help message
	@echo "$(BLUE)QuantumBeam Integration Test Suite$(NC)"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Setup test environment
setup: ## Setup test environment and dependencies
	@echo "$(BLUE)Setting up test environment...$(NC)"
	@go mod download
	@go mod tidy
	@if [ ! -d "test_results" ]; then mkdir -p test_results; fi
	@echo "$(GREEN)✓ Test environment setup complete$(NC)"

# Start test dependencies (database, etc.)
start-deps: ## Start test dependencies using Docker
	@echo "$(BLUE)Starting test dependencies...$(NC)"
	@if [ -f "$(DOCKER_COMPOSE)" ]; then \
		docker-compose -f $(DOCKER_COMPOSE) up -d; \
		echo "$(GREEN)✓ Test dependencies started$(NC)"; \
	else \
		echo "$(YELLOW)Warning: No docker-compose file found, skipping Docker dependencies$(NC)"; \
	fi

# Stop test dependencies
stop-deps: ## Stop test dependencies
	@echo "$(BLUE)Stopping test dependencies...$(NC)"
	@if [ -f "$(DOCKER_COMPOSE)" ]; then \
		docker-compose -f $(DOCKER_COMPOSE) down; \
		echo "$(GREEN)✓ Test dependencies stopped$(NC)"; \
	fi

# Run integration tests
test-integration: ## Run integration tests only
	@echo "$(BLUE)Running integration tests...$(NC)"
	@go test -v -timeout $(TEST_TIMEOUT) \
		-tags=integration \
		./tests/integration/... \
		-config=$(TEST_CONFIG) \
		-parallel=$(TEST_PARALLEL) \
		-skip-db=$(SKIP_DATABASE) \
		-skip-perf=$(SKIP_PERFORMANCE) \
		-verbose=$(TEST_VERBOSE)
	@echo "$(GREEN)✓ Integration tests completed$(NC)"

# Run performance tests
test-performance: ## Run performance and load tests
	@echo "$(BLUE)Running performance tests...$(NC)"
	@go test -v -timeout 60m \
		-tags=integration,performance \
		-run="TestPerformance|TestLoad|Benchmark" \
		./tests/integration/... \
		-config=$(TEST_CONFIG) \
		-bench=. \
		-benchmem
	@echo "$(GREEN)✓ Performance tests completed$(NC)"

# Run security tests
test-security: ## Run security-focused tests
	@echo "$(BLUE)Running security tests...$(NC)"
	@go test -v -timeout 30m \
		-tags=integration,security \
		-run="TestAuthentication|TestAuthorization|TestErrorHandling" \
		./tests/integration/... \
		-config=$(TEST_CONFIG)
	@echo "$(GREEN)✓ Security tests completed$(NC)"

# Run all tests
test-all: setup start-deps ## Run all test suites (integration + performance)
	@echo "$(BLUE)Running complete test suite...$(NC)"
	@$(MAKE) test-integration
	@$(MAKE) test-performance
	@$(MAKE) test-security
	@echo "$(GREEN)✓ All tests completed successfully$(NC)"

# Quick test (skip performance and database tests)
test-quick: setup ## Run quick tests (skip performance and heavy database tests)
	@echo "$(BLUE)Running quick tests...$(NC)"
	@go test -v -timeout 15m \
		-tags=integration \
		./tests/integration/... \
		-skip-db=true \
		-skip-perf=true \
		-config=$(TEST_CONFIG)
	@echo "$(GREEN)✓ Quick tests completed$(NC)"

# Run tests with coverage
test-coverage: setup ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@go test -v -timeout $(TEST_TIMEOUT) \
		-tags=integration \
		-coverprofile=test_results/coverage.out \
		-covermode=atomic \
		./tests/integration/... \
		-config=$(TEST_CONFIG)
	@go tool cover -html=test_results/coverage.out -o test_results/coverage.html
	@echo "$(GREEN)✓ Coverage report generated: test_results/coverage.html$(NC)"

# Run tests in CI mode
test-ci: setup ## Run tests optimized for CI environments
	@echo "$(BLUE)Running tests in CI mode...$(NC)"
	@go test -v -timeout $(TEST_TIMEOUT) \
		-tags=integration \
		-json \
		-coverprofile=test_results/coverage.out \
		-covermode=atomic \
		./tests/integration/... \
		-config=$(TEST_CONFIG) \
		2>&1 | tee test_results/test_results.jsonl
	@echo "$(GREEN)✓ CI tests completed$(NC)"

# Run tests with race detection
test-race: setup ## Run tests with race detection enabled
	@echo "$(BLUE)Running tests with race detection...$(NC)"
	@go test -v -timeout $(TEST_TIMEOUT) \
		-tags=integration \
		-race \
		./tests/integration/... \
		-config=$(TEST_CONFIG)
	@echo "$(GREEN)✓ Race detection tests completed$(NC)"

# Test specific suite
test-auth: ## Run authentication tests only
	@echo "$(BLUE)Running authentication tests...$(NC)"
	@go test -v -timeout 30m \
		-tags=integration \
		-run="TestAuthentication|TestAuth" \
		./tests/integration/... \
		-config=$(TEST_CONFIG)

test-fraud: ## Run fraud detection tests only
	@echo "$(BLUE)Running fraud detection tests...$(NC)"
	@go test -v -timeout 30m \
		-tags=integration \
		-run="TestFraud" \
		./tests/integration/... \
		-config=$(TEST_CONFIG)

test-api: ## Run API management tests only
	@echo "$(BLUE)Running API management tests...$(NC)"
	@go test -v -timeout 30m \
		-tags=integration \
		-run="TestAPI|TestApi" \
		./tests/integration/... \
		-config=$(TEST_CONFIG)

# Test database migrations
test-migrations: ## Test database migrations
	@echo "$(BLUE)Testing database migrations...$(NC)"
	@go test -v -timeout 15m \
		-tags=integration,migration \
		-run="TestMigration" \
		./tests/integration/... \
		-config=$(TEST_CONFIG)

# Build test Docker image
build-test-image: ## Build Docker image for testing
	@echo "$(BLUE)Building test Docker image...$(NC)"
	@docker build -t $(DOCKER_IMAGE) -f Dockerfile.test .
	@echo "$(GREEN)✓ Test Docker image built$(NC)"

# Run tests in Docker
test-docker: build-test-image ## Run tests inside Docker container
	@echo "$(BLUE)Running tests in Docker...$(NC)"
	@docker run --rm \
		-v $(PWD)/test_results:/app/test_results \
		-e CONFIG=$(TEST_CONFIG) \
		$(DOCKER_IMAGE) \
		make test-all
	@echo "$(GREEN)✓ Docker tests completed$(NC)"

# Generate test reports
generate-reports: ## Generate test reports from previous test run
	@echo "$(BLUE)Generating test reports...$(NC)"
	@if [ -d "test_results" ]; then \
		go run ./tools/report-generator/main.go \
			-input=test_results/test_results.jsonl \
			-output=test_results/reports; \
		echo "$(GREEN)✓ Test reports generated$(NC)"; \
	else \
		echo "$(YELLOW)No test results found, run tests first$(NC)"; \
	fi

# Clean test artifacts
clean: ## Clean test artifacts and temporary files
	@echo "$(BLUE)Cleaning test artifacts...$(NC)"
	@rm -rf test_results/
	@rm -f coverage.out
	@rm -f test.log
	@go clean -testcache
	@echo "$(GREEN)✓ Test artifacts cleaned$(NC)"

# Clean everything including Docker
clean-all: clean ## Clean all artifacts including Docker
	@echo "$(BLUE)Cleaning all artifacts...$(NC)"
	@docker rmi -f $(DOCKER_IMAGE) 2>/dev/null || true
	@docker system prune -f
	@echo "$(GREEN)✓ All artifacts cleaned$(NC)"

# Lint test code
lint: ## Lint test code
	@echo "$(BLUE)Linting test code...$(NC)"
	@golangci-lint run ./tests/integration/...
	@echo "$(GREEN)✓ Linting completed$(NC)"

# Format test code
fmt: ## Format test code
	@echo "$(BLUE)Formatting test code...$(NC)"
	@go fmt ./tests/integration/...
	@echo "$(GREEN)✓ Code formatted$(NC)"

# Check for vulnerabilities
vet: ## Run go vet on test code
	@echo "$(BLUE)Running go vet...$(NC)"
	@go vet ./tests/integration/...
	@echo "$(GREEN)✓ Vet completed$(NC)"

# Run all quality checks
quality: fmt vet lint ## Run all code quality checks
	@echo "$(GREEN)✓ All quality checks passed$(NC)"

# Watch tests and run on changes
watch: ## Watch for changes and run tests automatically
	@echo "$(BLUE)Watching for changes...$(NC)"
	@fswatch -o ./tests/integration/ | xargs -n1 -I{} make test-quick

# Stress test
stress-test: ## Run stress tests
	@echo "$(BLUE)Running stress tests...$(NC)"
	@go test -v -timeout 120m \
		-tags=integration,stress \
		-run="TestStress|TestLoad" \
		./tests/integration/... \
		-config=$(TEST_CONFIG) \
		-stress=true
	@echo "$(GREEN)✓ Stress tests completed$(NC)"

# Memory leak test
memory-test: ## Run memory leak detection tests
	@echo "$(BLUE)Running memory leak tests...$(NC)"
	@go test -v -timeout 60m \
		-tags=integration,memory \
		-run="TestMemory" \
		./tests/integration/... \
		-config=$(TEST_CONFIG)
	@echo "$(GREEN)✓ Memory tests completed$(NC)"

# Validate test configuration
validate-config: ## Validate test configuration
	@echo "$(BLUE)Validating test configuration...$(NC)"
	@go run ./tools/config-validator/main.go \
		-config=$(TEST_CONFIG)
	@echo "$(GREEN)✓ Configuration validated$(NC)"

# Show test environment info
env-info: ## Show test environment information
	@echo "$(BLUE)Test Environment Information:$(NC)"
	@echo "Go Version: $(shell go version)"
	@echo "OS: $(shell uname -s)"
	@echo "Architecture: $(shell uname -m)"
	@echo "Working Directory: $(PWD)"
	@echo "Test Config: $(TEST_CONFIG)"
	@echo "Test Timeout: $(TEST_TIMEOUT)"
	@echo "Parallel Tests: $(TEST_PARALLEL)"
	@echo "Skip Database: $(SKIP_DATABASE)"
	@echo "Skip Performance: $(SKIP_PERFORMANCE)"

# Default test target
test: test-integration ## Run integration tests (default)

# Full test pipeline for CI/CD
pipeline: clean setup quality test-all generate-reports ## Complete CI/CD pipeline
	@echo "$(GREEN)✓ Complete pipeline executed successfully$(NC)"