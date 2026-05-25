# SDLC Platform Gateway - Production Makefile
# This Makefile provides commands for building, testing, and deploying the gateway service

# Variables
VERSION ?= $(shell git describe --tags --always 2>/dev/null || echo "dev")
BUILD_TIME = $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
GIT_COMMIT = $(shell git rev-parse HEAD 2>/dev/null || echo "unknown")

# Docker variables
DOCKER_REGISTRY = ghcr.io/sdlc-ai/platform
IMAGE_NAME = gateway
IMAGE_TAG = $(VERSION)
FULL_IMAGE = $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Kubernetes variables
KUBE_NAMESPACE = sdlc-platform
KUBE_CONTEXT ?= $(shell kubectl config current-context)

# Go variables
GO = go
GOFLAGS = -v
LDFLAGS = -w -s -X main.version=$(VERSION) -X main.buildTime=$(BUILD_TIME) -X main.gitCommit=$(GIT_COMMIT)
GOCACHE_DIR ?= $(CURDIR)/.cache/go-build
PRODUCTION_CHECK_PACKAGES = ./cmd/server ./internal/infrastructure/config

.PHONY: help
help: ## Show this help message
	@echo "SDLC Platform Gateway - Build & Deployment"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development targets
.PHONY: dev
dev: ## Run the gateway in development mode
	$(GO) run ./cmd/server

.PHONY: fmt
fmt: ## Format Go code
	$(GO) fmt ./...
	$(GO)imports -w .

.PHONY: vet
vet: ## Run go vet
	$(GO) vet ./...

.PHONY: test
test: ## Run tests
	$(GO) test -race -coverprofile=coverage.out -covermode=atomic ./...

.PHONY: test-coverage
test-coverage: test ## Run tests with coverage report + portfolio threshold gate (>=90% line)
	$(GO) tool cover -html=coverage.out -o coverage.html
	@bash scripts/check-coverage.sh coverage.out 90.0

.PHONY: test-coverage-critical
test-coverage-critical: ## Enforce 100% coverage on critical-path packages (auth, audit, ratelimit, dlp, opa, billing)
	$(GO) test -race -coverprofile=coverage-critical.out -covermode=atomic \
	  ./internal/infrastructure/auth/... \
	  ./internal/infrastructure/repositories/audit.go \
	  ./internal/domain/services/rate_limiter.go \
	  ./internal/policy/...
	@bash scripts/check-coverage.sh coverage-critical.out 100.0

.PHONY: lint
lint: ## Run linters
	golangci-lint run ./...

.PHONY: security-scan
security-scan: ## Run gosec at HIGH severity (fail on any finding in source)
	@command -v gosec >/dev/null 2>&1 || \
	  go install github.com/securego/gosec/v2/cmd/gosec@latest
	gosec -severity high -confidence high ./cmd/... ./internal/... ./tests/...

# Build targets
.PHONY: build
build: ## Build the gateway binary
	$(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o bin/gateway-server ./cmd/server

.PHONY: build-linux
build-linux: ## Build the gateway binary for Linux
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o bin/gateway-server-linux ./cmd/server

.PHONY: production-check
production-check: ## Run focused production verification for the gateway server surface
	@mkdir -p $(GOCACHE_DIR) bin
	GOCACHE=$(GOCACHE_DIR) $(GO) test $(PRODUCTION_CHECK_PACKAGES)
	GOCACHE=$(GOCACHE_DIR) $(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o bin/gateway-server ./cmd/server

# SDK targets
.PHONY: sdk-tools
sdk-tools: ## Install the toolchain required to generate SDKs from the OpenAPI spec
	@command -v oapi-codegen >/dev/null 2>&1 || \
	  go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
	@command -v npx >/dev/null 2>&1 || (echo "Install Node.js 18+ (provides npx)" && exit 1)
	@command -v java >/dev/null 2>&1 || (echo "Install JDK 11+ for openapi-generator-cli" && exit 1)
	@echo "SDK tools available."

.PHONY: sdk-generate
sdk-generate: sdk-tools ## Regenerate types-only SDK clients from the OpenAPI spec (contract gate, not the published SDK)
	bash scripts/generate-sdk.sh all

.PHONY: sdk-validate
sdk-validate: sdk-tools ## Validate the merged OpenAPI spec without writing SDK output
	bash scripts/generate-sdk.sh validate

.PHONY: sdk-contract
sdk-contract: sdk-generate ## Run the SDK contract gate: regen + build the generated Go client
	cd internal/sdk-generated/go && $(GO) build ./...

# Docker targets
.PHONY: docker-build
docker-build: ## Build Docker image
	docker build \
		--build-arg VERSION=$(VERSION) \
		--build-arg BUILD_TIME=$(BUILD_TIME) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		-t $(FULL_IMAGE) \
		-f Dockerfile .

.PHONY: docker-push
docker-push: docker-build ## Build and push Docker image
	docker push $(FULL_IMAGE)

.PHONY: docker-build-dev
docker-build-dev: ## Build Docker image for development
	docker build \
		-t $(DOCKER_REGISTRY)/$(IMAGE_NAME):dev \
		-f Dockerfile.dev .

# Kubernetes targets
.PHONY: kube-apply
kube-apply: ## Apply Kubernetes manifests
	kubectl apply -f deploy/kubernetes/namespace.yaml
	kubectl apply -f deploy/kubernetes/configmap.yaml
	kubectl apply -f deploy/kubernetes/serviceaccount.yaml
	kubectl apply -f deploy/kubernetes/deployment.yaml
	kubectl apply -f deploy/kubernetes/service.yaml
	kubectl apply -f deploy/kubernetes/ingress.yaml

.PHONY: kube-delete
kube-delete: ## Delete Kubernetes resources
	kubectl delete -f deploy/kubernetes/ingress.yaml --ignore-not-found=true
	kubectl delete -f deploy/kubernetes/service.yaml --ignore-not-found=true
	kubectl delete -f deploy/kubernetes/deployment.yaml --ignore-not-found=true
	kubectl delete -f deploy/kubernetes/serviceaccount.yaml --ignore-not-found=true
	kubectl delete -f deploy/kubernetes/configmap.yaml --ignore-not-found=true

.PHONY: kube-logs
kube-logs: ## Show gateway logs
	kubectl logs -f -l app=gateway -n $(KUBE_NAMESPACE)

.PHONY: kube-status
kube-status: ## Show gateway status
	kubectl get all -n $(KUBE_NAMESPACE) -l app=gateway

.PHONY: kube-restart
kube-restart: ## Restart gateway deployment
	kubectl rollout restart deployment/gateway -n $(KUBE_NAMESPACE)

.PHONY: kube-rollback
kube-rollback: ## Rollback gateway deployment
	kubectl rollout undo deployment/gateway -n $(KUBE_NAMESPACE)

# Deployment targets
.PHONY: deploy
deploy: docker-push kube-apply ## Full deployment: build, push, and deploy to Kubernetes
	@echo "Deployed $(FULL_IMAGE) to $(KUBE_CONTEXT)"

.PHONY: deploy-monitoring
deploy-monitoring: ## Deploy monitoring rules
	kubectl apply -f deploy/monitoring/prometheus-rules.yaml
	kubectl apply -f deploy/monitoring/prometheus-recording-rules.yaml

.PHONY: deploy-secrets
deploy-secrets: ## Create secrets from environment variables (use only for dev)
	@echo "Creating secrets from environment..."
	@kubectl create secret generic gateway-secrets \
		--from-literal=db-user=$(DB_USER) \
		--from-literal=db-password=$(DB_PASSWORD) \
		--from-literal=redis-password=$(REDIS_PASSWORD) \
		--from-literal=jwt-secret=$(JWT_SECRET) \
		-n $(KUBE_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -

# Health check targets
.PHONY: health
health: ## Check gateway health endpoint
	@curl -f http://localhost:8080/health || echo "Gateway not responding on localhost:8080"

.PHONY: kube-health
kube-health: ## Check gateway health via port-forward
	@kubectl port-forward -n $(KUBE_NAMESPACE) svc/gateway 8080:8080 &
	@sleep 2
	@curl -f http://localhost:8080/health
	@pkill -f "port-forward"

# Utility targets
.PHONY: clean
clean: ## Clean build artifacts
	rm -rf bin/
	rm -f coverage.out coverage.html

.PHONY: version
version: ## Show version information
	@echo "Version: $(VERSION)"
	@echo "Build Time: $(BUILD_TIME)"
	@echo "Git Commit: $(GIT_COMMIT)"
	@echo "Image: $(FULL_IMAGE)"

.PHONY: info
info: ## Show deployment information
	@echo "Kubernetes Context: $(KUBE_CONTEXT)"
	@echo "Namespace: $(KUBE_NAMESPACE)"
	@echo "Docker Registry: $(DOCKER_REGISTRY)"
	@echo "Image: $(FULL_IMAGE)"
	@make version
