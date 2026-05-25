# QueryFlux Backend Makefile
# Provides convenient commands for building, testing, and deploying the Go backend

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOMOD=$(GOCMD) mod
CGO_ENABLED ?= 1

# Test parameters
UNIT_TEST_PATH=./tests/unit/...
INTEGRATION_TEST_PATH=./tests/integration/...
ALL_TEST_PATH=./...

# Build parameters
BINARY_NAME=queryflux-backend
VERSION ?= $(shell git describe --tags --always --dirty)
COMMIT_SHA ?= $(shell git rev-parse --short HEAD)
BUILD_TIME ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

.PHONY: help build test clean docker deploy helm-build helm-deploy install run dev security deps

all: test build

## Install dependencies
install:
	$(GOMOD) download
	$(GOMOD) verify
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install golang.org/x/vuln/cmd/govulncheck@latest

## Download and verify dependencies
deps:
	$(GOMOD) download
	$(GOMOD) verify
	$(GOMOD) tidy

## Run the server locally
run:
	$(GOCMD) run ./cmd/server

## Run in development mode
dev:
	GIN_MODE=debug LOG_LEVEL=debug $(GOCMD) run ./cmd/server

## Build the application
build:
	CGO_ENABLED=$(CGO_ENABLED) $(GOBUILD) -ldflags="-X main.version=$(VERSION) -X main.commit=$(COMMIT_SHA) -X main.buildTime=$(BUILD_TIME) -s -w" -o $(BINARY_NAME) ./cmd/server

## Build for production
build-prod:
	CGO_ENABLED=$(CGO_ENABLED) $(GOBUILD) -ldflags="-X main.version=$(VERSION) -X main.commit=$(COMMIT_SHA) -X main.buildTime=$(BUILD_TIME) -s -w" -o $(BINARY_NAME) ./cmd/server

## Build for all platforms
build-all:
	./scripts/build.sh -r

## Build for Linux
build-linux:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) -ldflags="-s -w" -o $(BINARY_NAME)-linux-amd64 ./cmd/server
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) -ldflags="-s -w" -o $(BINARY_NAME)-linux-arm64 ./cmd/server

## Build for macOS
build-darwin:
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) -ldflags="-s -w" -o $(BINARY_NAME)-darwin-amd64 ./cmd/server
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GOBUILD) -ldflags="-s -w" -o $(BINARY_NAME)-darwin-arm64 ./cmd/server

## Build for Windows
build-windows:
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) -ldflags="-s -w" -o $(BINARY_NAME)-windows-amd64.exe ./cmd/server

## Clean build files
clean:
	$(GOCLEAN)
	rm -rf bin/ dist/ coverage.html coverage.out

## Run all tests
test:
	$(GOTEST) -v -race $(ALL_TEST_PATH)

## Run unit tests only
test-unit:
	$(GOTEST) -v -race -short $(UNIT_TEST_PATH)

## Run integration tests only
test-integration:
	SKIP_INTEGRATION_TESTS=false $(GOTEST) -v -tags=integration $(INTEGRATION_TEST_PATH)

## Run tests with coverage
test-coverage:
	$(GOTEST) -v -race -coverprofile=coverage.out $(ALL_TEST_PATH)
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	$(GOCMD) tool cover -func=coverage.out

## Run linter
lint:
	golangci-lint run --timeout=5m

## Run security scan
security:
	govulncheck ./...

## Docker commands
docker-build:
	docker build -t queryflux/backend:$(VERSION) .
	docker tag queryflux/backend:$(VERSION) queryflux/backend:latest

docker-run:
	docker run -p 8080:8080 \
		-e DATABASE_URL=${DATABASE_URL} \
		-e REDIS_URL=${REDIS_URL} \
		-e JWT_SECRET=${JWT_SECRET} \
		queryflux/backend:latest

## Deployment scripts
deploy-staging:
	./scripts/deploy.sh -e staging -v $(VERSION)

deploy-production:
	./scripts/deploy.sh -e production -v $(VERSION)

## Release commands
release:
	./scripts/build.sh -r
	./scripts/deploy.sh -e production

## Show version information
version:
	@echo "Version: $(VERSION)"
	@echo "Commit: $(COMMIT_SHA)"
	@echo "Build Time: $(BUILD_TIME)"
	@echo "Go: $(shell go version)"

## CI/CD helpers
ci:
	make deps
	make lint
	make security
	make test
	make test-coverage
	make build-prod

## Show help
help:
	@echo 'QueryFlux Backend - Available Commands:'
	@echo ''
	@echo 'Development:'
	@echo '  install          Install dependencies'
	@echo '  deps             Download and verify dependencies'
	@echo '  run              Run the server locally'
	@echo '  dev              Run in development mode'
	@echo '  dev-setup        Set up development environment'
	@echo ''
	@echo 'Testing:'
	@echo '  test             Run all tests'
	@echo '  test-unit        Run unit tests'
	@echo '  test-integration Run integration tests'
	@echo '  test-coverage    Run tests with coverage'
	@echo '  lint             Run linter'
	@echo '  security         Run security scan'
	@echo ''
	@echo 'Building:'
	@echo '  build            Build for current platform'
	@echo '  build-prod       Build for production'
	@echo '  build-all        Build for all platforms'
	@echo '  build-linux      Build for Linux'
	@echo '  build-darwin     Build for macOS'
	@echo '  build-windows    Build for Windows'
	@echo '  clean            Clean build artifacts'
	@echo ''
	@echo 'Docker:'
	@echo '  docker-build     Build Docker image'
	@echo '  docker-run       Run Docker container'
	@echo '  docker-push      Push Docker image'
	@echo '  docker-clean     Clean Docker images'
	@echo ''
	@echo 'Deployment:'
	@echo '  deploy-staging   Deploy to staging'
	@echo '  deploy-production Deploy to production'
	@echo '  release          Create full release'
	@echo ''
	@echo 'Utilities:'
	@echo '  version          Show version information'
	@echo '  ci               Run CI/CD pipeline'
	@echo '  help             Show this help message'
