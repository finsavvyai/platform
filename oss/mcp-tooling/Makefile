.PHONY: help setup dev dev-docker dev-services build test clean docker-build docker-up docker-down lint format

# Default target
help:
	@echo "MCPOverflow Development Commands"
	@echo "================================"
	@echo "setup          - Install all dependencies and initialize environment"
	@echo "dev            - Start development servers (without Docker)"
	@echo "dev-docker     - Start full development environment with Docker"
	@echo "dev-services   - Start only Docker services (databases, etc.)"
	@echo "build          - Build all projects"
	@echo "test           - Run all tests"
	@echo "clean          - Clean build artifacts and dependencies"
	@echo "docker-build   - Build Docker images"
	@echo "docker-up      - Start Docker services"
	@echo "docker-down    - Stop Docker services"
	@echo "lint           - Run linting"
	@echo "format         - Format code"

# Setup development environment
setup:
	@echo "Setting up MCPOverflow development environment..."
	npm install
	npm run build --workspace=@mcpoverflow/config
	cd services/api-service && go mod tidy
	cp .env.local .env
	@echo "Setup complete! Run 'make dev-services' to start databases"

# Development servers (without Docker)
dev:
	@echo "Starting development servers..."
	npm run dev

# Full development environment with Docker
dev-docker: docker-up
	@echo "Waiting for services to be ready..."
	sleep 10
	@echo "Starting application servers..."
	npm run dev

# Start only Docker services (databases, etc.)
dev-services:
	@echo "Starting Docker services..."
	docker-compose up -d
	@echo "Services started!"
	@echo "PostgreSQL: localhost:5432"
	@echo "Redis: localhost:6379"
	@echo "Neo4j: http://localhost:7474 (bolt://localhost:7687)"
	@echo "MinIO: http://localhost:9001"
	@echo "Qdrant: http://localhost:6333"
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3001 (admin/mcpoverflow_admin)"
	@echo "MailHog: http://localhost:8025"

# Build all projects
build:
	@echo "Building all projects..."
	npm run build
	cd services/api-service && go build -o bin/api-service ./cmd/main.go
	@echo "Build complete!"

# Run all tests
test:
	@echo "Running tests..."
	npm run test
	cd services/api-service && go test ./...

# Clean build artifacts and dependencies
clean:
	@echo "Cleaning up..."
	npm run clean
	cd services/api-service && rm -rf bin/
	docker-compose down -v
	docker system prune -f
	@echo "Clean complete!"

# Build Docker images
docker-build:
	@echo "Building Docker images..."
	docker-compose build
	@echo "Docker images built!"

# Start Docker services
docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Waiting for services to be healthy..."
	docker-compose ps

# Stop Docker services
docker-down:
	@echo "Stopping Docker services..."
	docker-compose -f docker-compose.dev.yml down
	docker-compose down
	@echo "Docker services stopped!"

# Run linting
lint:
	@echo "Running linting..."
	npm run lint
	cd services/api-service && go vet ./...
	cd services/api-service && go fmt ./...
	@echo "Linting complete!"

# Format code
format:
	@echo "Formatting code..."
	npm run format
	cd services/api-service && go fmt ./...
	@echo "Code formatted!"

# Install TinyGo (if not already installed)
install-tinygo:
	@echo "Installing TinyGo..."
	@if command -v tinygo >/dev/null 2>&1; then \
		echo "TinyGo is already installed: $$(tinygo version)"; \
	else \
		echo "Installing TinyGo..."; \
		./scripts/install-tinygo.sh; \
	fi

# Build WASM modules
build-wasm:
	@echo "Building WASM modules..."
	cd packages/wasm && npm run build

# Test WASM modules
test-wasm:
	@echo "Testing WASM modules..."
	cd packages/wasm && npm run test

# Validate TinyGo installation
validate-tinygo:
	@echo "Validating TinyGo installation..."
	@if command -v tinygo >/dev/null 2>&1; then \
		echo "✅ TinyGo found: $$(tinygo version)"; \
		tinygo version; \
	else \
		echo "❌ TinyGo not found. Run 'make install-tinygo'"; \
		exit 1; \
	fi

# Test TinyGo WASM compilation
test-tinygo-wasm:
	@echo "Testing TinyGo WASM compilation..."
	@if command -v tinygo >/dev/null 2>&1; then \
		mkdir -p test-wasm-output; \
		echo 'package main; import "unsafe"; func main() {}; //export test func test() uint32 { return 42 }' > test-wasm-output/test.go; \
		tinygo build -target=wasm -o test-wasm-output/test.wasm test-wasm-output/test.go && \
		echo "✅ TinyGo WASM compilation successful" || \
		(echo "❌ TinyGo WASM compilation failed" && exit 1); \
		rm -rf test-wasm-output; \
	else \
		echo "❌ TinyGo not found. Run 'make install-tinygo'"; \
		exit 1; \
	fi

# Generate API documentation
docs:
	@echo "Generating API documentation..."
	cd services/api-service && swag init -g cmd/main.go
	@echo "Documentation generated!"

# Database migrations
migrate-up:
	@echo "Running database migrations..."
	cd services/api-service && go run ./cmd/migrate/main.go up
	@echo "Migrations complete!"

migrate-down:
	@echo "Rolling back database migrations..."
	cd services/api-service && go run ./cmd/migrate/main.go down
	@echo "Migration rollback complete!"

# Seed database with test data
seed-db:
	@echo "Seeding database with test data..."
	cd services/api-service && go run ./cmd/seed/main.go
	@echo "Database seeded!"

# Check service health
health:
	@echo "Checking service health..."
	@echo "PostgreSQL: $$(curl -s http://localhost:5432/health || echo 'Down')"
	@echo "Redis: $$(redis-cli ping || echo 'Down')"
	@echo "Neo4j: $$(curl -s http://localhost:7474/ || echo 'Down')"
	@echo "Qdrant: $$(curl -s http://localhost:6333/health || echo 'Down')"
	@echo "API Service: $$(curl -s http://localhost:8080/health || echo 'Down')"