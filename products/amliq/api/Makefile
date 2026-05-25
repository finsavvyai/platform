.PHONY: help build test clean lint run-api run-worker run-mcp docker-build docker-up docker-down migrate seed reingest reingest-dry ci deploy install-hooks check build-saml-keygen build-sdlc-api

help:
	@echo "AEGIS AML - Build Commands"
	@echo ""
	@echo "Pipeline (no GitHub Actions needed):"
	@echo "  make install-hooks  Install git pre-commit + pre-push hooks"
	@echo "  make ci             Run full CI pipeline locally"
	@echo "  make deploy         Run CI + build + deploy"
	@echo "  make check          Quick pre-commit checks"
	@echo ""
	@echo "Build:  build / build-api / build-worker / build-mcp / build-saml-keygen"
	@echo "Test:   test / test-coverage / test-screening / test-domain / test-e2e"
	@echo "Lint:   lint / fmt"
	@echo "Run:    run-api / run-worker / run-mcp"
	@echo "Docker: docker-build / docker-up / docker-down / docker-logs"
	@echo "DB:     migrate / seed / deps / clean"
	@echo "Lists:  reingest / reingest-dry  (use ARGS='--list X --tenant Y')"

build: build-api build-worker build-mcp build-saml-keygen build-sdlc-api

build-api:
	@echo "Building API server..."
	go build -o bin/aegis-api ./cmd/api

build-worker:
	@echo "Building background worker..."
	go build -o bin/aegis-worker ./cmd/worker

build-mcp:
	@echo "Building MCP server..."
	go build -o bin/aegis-mcp ./cmd/mcp

build-saml-keygen:
	@echo "Building SAML keygen CLI..."
	go build -o bin/aegis-saml-keygen ./cmd/saml-keygen

build-sdlc-api:
	@echo "Building sdlc.cc gateway binary (separate SKU)..."
	go build -o bin/sdlc-api ./cmd/sdlc-api

test:
	@echo "Running tests..."
	go test -v ./...

test-coverage:
	@echo "Running tests with coverage..."
	go test -cover ./... | grep coverage

test-screening:
	@echo "Testing screening engine..."
	go test -v ./internal/screening/...

test-domain:
	@echo "Testing domain models..."
	go test -v ./internal/domain/...

lint:
	@echo "Running golangci-lint..."
	golangci-lint run

fmt:
	@echo "Formatting code..."
	go fmt ./...

test-e2e:
	@echo "Running E2E browser tests..."
	cd web && npx playwright test

clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	rm -f *.out

run-api:
	@echo "Starting API server on :8080..."
	PORT=8080 go run ./cmd/api/main.go

run-worker:
	@echo "Starting background worker..."
	go run ./cmd/worker/main.go

run-mcp:
	@echo "Starting MCP server (stdin/stdout)..."
	go run ./cmd/mcp/main.go

docker-build:
	@echo "Building Docker image..."
	docker build -t aegis-aml:latest .

deps:
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

docker-up:
	@echo "Starting Docker services..."
	docker-compose -f deploy/docker/docker-compose.yml up -d
	@echo "Services running: API (8080), Web (3000), DB (5432)"

docker-down:
	@echo "Stopping Docker services..."
	docker-compose -f deploy/docker/docker-compose.yml down

docker-logs:
	docker-compose -f deploy/docker/docker-compose.yml logs -f

migrate:
	@echo "Running migrations..."
	go run ./cmd/migrate

seed:
	@echo "Seeding database..."
	go run ./cmd/seed/main.go

reingest:
	@echo "Reingesting all enabled lists (rich field extraction)..."
	go run ./cmd/reingest $(ARGS)

reingest-dry:
	@echo "Dry-run reingest (parse only, no DB writes)..."
	go run ./cmd/reingest --dry-run $(ARGS)

install-hooks:
	@chmod +x scripts/install-hooks.sh
	@./scripts/install-hooks.sh

ci:
	@chmod +x scripts/ci.sh
	@./scripts/ci.sh

deploy:
	@chmod +x scripts/deploy-local.sh
	@./scripts/deploy-local.sh

check:
	@chmod +x scripts/pre-commit
	@./scripts/pre-commit
