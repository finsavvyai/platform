.PHONY: build run test test-coverage test-e2e test-load test-integration test-connections test-gitlab-live test-github-enterprise lint fmt vet clean docker-build docker-run docker-stop owasp-audit sarif-export docker-push seed-demo release vulncheck flake flake-recent trace airgap-stage trace-query smoke all

# Build the application — both binaries.
# cmd/pipewarden     : public CLI (scan/dlp/trace/test-provider subcommands)
# cmd/pipewarden-server: hosted SaaS server (handlers/router/billing/etc.)
build:
	go build -o bin/pipewarden ./cmd/pipewarden
	go build -o bin/pipewarden-server ./cmd/pipewarden-server

# Run the application
run:
	go run ./cmd/pipewarden

version:
	go run ./cmd/pipewarden --version

# Run tests with race detector
test:
	go test -v -race -count=1 ./...

# Smoke test: build the server binary, boot it on a random free port,
# curl /health, tear down. Exits 0 only when /health returns ok and the
# database + vault are healthy. Useful for `git push` pre-flight and
# for CI gating any release tag.
smoke:
	@set -e; \
	bin/pipewarden-server --version >/dev/null 2>&1 || $(MAKE) build; \
	PORT=$$(python3 -c 'import socket;s=socket.socket();s.bind(("",0));print(s.getsockname()[1]);s.close()'); \
	echo "smoke: starting pipewarden-server on 127.0.0.1:$$PORT"; \
	PIPEWARDEN_SERVER_HOST=127.0.0.1 PIPEWARDEN_SERVER_PORT=$$PORT \
	  bin/pipewarden-server > /tmp/pipewarden-smoke.log 2>&1 & \
	PID=$$!; trap "kill $$PID 2>/dev/null || true" EXIT; \
	for i in 1 2 3 4 5 6 7 8 9 10; do \
	  sleep 0.3; \
	  if curl -fsS "http://127.0.0.1:$$PORT/health" -o /tmp/pipewarden-smoke.json 2>/dev/null; then \
	    cat /tmp/pipewarden-smoke.json; echo; \
	    if grep -q '"status"\s*:\s*"ok"' /tmp/pipewarden-smoke.json; then \
	      echo "smoke: PASS"; exit 0; \
	    else \
	      echo "smoke: /health returned non-ok"; exit 2; \
	    fi; \
	  fi; \
	done; \
	echo "smoke: timed out waiting for /health"; \
	tail -40 /tmp/pipewarden-smoke.log; \
	exit 3

# Run tests with coverage report
test-coverage:
	go test -v -coverprofile=coverage.out ./... && go tool cover -html=coverage.out

# Run E2E tests
test-e2e:
	go test -v ./tests/e2e/...

# Run load/benchmark tests
test-load:
	go test -bench=. -benchmem ./tests/load/...

# Run only integration tests against real APIs (requires credentials)
test-integration:
	go test -v -tags=integration ./...

# Run GitLab live connection tests (requires GITLAB_URL + GITLAB_TOKEN)
test-gitlab-live:
	GITLAB_URL=$$GITLAB_URL GITLAB_TOKEN=$$GITLAB_TOKEN go test -v -tags=integration ./cmd/testconnections/... -run TestGitLab

# Run GitHub Enterprise live tests (requires GITHUB_ENTERPRISE_URL + GITHUB_ENTERPRISE_TOKEN)
test-github-enterprise:
	GITHUB_ENTERPRISE_URL=$$GITHUB_ENTERPRISE_URL GITHUB_ENTERPRISE_TOKEN=$$GITHUB_ENTERPRISE_TOKEN go test -v -tags=integration ./cmd/testconnections/... -run TestGitHubEnterprise

# Test real connections (set GITHUB_TOKEN, GITLAB_TOKEN, BITBUCKET_USERNAME/BITBUCKET_APP_PASSWORD)
test-connections:
	go run cmd/testconnections/main.go

# Run linting
lint:
	golangci-lint run ./...

# Format code
fmt:
	gofmt -w .

# Run go vet
vet:
	go vet ./...

# Clean build artifacts
clean:
	rm -rf bin/ coverage.out

# Build Docker image
docker-build:
	docker build -t pipewarden .

# Start Docker Compose
docker-run:
	docker compose up -d

# Stop Docker Compose
docker-stop:
	docker compose down

# Run OWASP security audit tests
owasp-audit:
	go test -v -run TestOWASP ./internal/security/...

# Run SARIF export tests
sarif-export:
	go test -v -run TestSARIF ./internal/analysis/...

# Build + push to Docker Hub (requires DOCKER_USERNAME + DOCKER_PASSWORD env vars)
docker-push:
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		--push \
		-t $(DOCKER_USERNAME)/pipewarden:latest \
		-t $(DOCKER_USERNAME)/pipewarden:$(shell git rev-parse --short HEAD) \
		.

# Seed demo data into a running server (default: http://localhost:8080)
SERVER ?= http://localhost:8080
seed-demo:
	go run scripts/seed-demo.go scripts/seed-demo-data.go --server $(SERVER)

# Tag + push a release (requires VERSION, e.g. make release VERSION=v1.2.3)
release:
	@test -n "$(VERSION)" || (echo "Usage: make release VERSION=v1.2.3" && exit 1)
	git tag $(VERSION)
	git push origin $(VERSION)

# Run govulncheck against all packages
vulncheck:
	go run golang.org/x/vuln/cmd/govulncheck@latest ./...

# Detect flaky tests by stressing each test function in a package N times.
# Usage: make flake PKG=./internal/handlers N=50
FLAKE_PKG ?= ./...
FLAKE_N ?= 25
flake:
	@which flakestress >/dev/null 2>&1 || go install github.com/bradfitz/flakestress@latest
	@echo "flake-stressing $(FLAKE_PKG) with $(FLAKE_N) iterations..."
	@for i in $$(seq 1 $(FLAKE_N)); do \
		go test -count=1 -failfast $(FLAKE_PKG) > /tmp/flake-$$i.log 2>&1 || \
			{ echo "FAIL iteration $$i — see /tmp/flake-$$i.log"; tail -20 /tmp/flake-$$i.log; exit 1; }; \
	done
	@echo "passed $(FLAKE_N)/$(FLAKE_N) iterations"

# Stress-test only the test files changed in the last 30 days.
flake-recent:
	@recent=$$(git log --since="30 days ago" --name-only --pretty=format: -- '*_test.go' | sort -u | head -20); \
		for f in $$recent; do \
			pkg=$$(dirname $$f); \
			echo "=== flake-stressing $$pkg ==="; \
			go test -count=25 -failfast ./$$pkg || echo "FLAKE: $$pkg"; \
		done

# Collect a runtime/trace profile for 30 seconds of the hottest handler.
# View with: go tool trace /tmp/pipewarden.trace
trace:
	@echo "running pipewarden with PIPEWARDEN_TRACE=1 (Ctrl-C to stop and open trace)"
	PIPEWARDEN_TRACE=1 PIPEWARDEN_TRACE_PATH=/tmp/pipewarden.trace \
		PIPEWARDEN_VAULT_KEY=$$(openssl rand -hex 32) \
		go run ./cmd/pipewarden

# Stage llamafile binaries for the air-gap goreleaser variant. Fetches the
# pinned releases listed in scripts/airgap/llamafile-pins.txt and verifies
# their SHA256 against KnownLlamafileSHA256 in
# internal/clawpipe/llamafile_checksums.go (via the helper script). Skips
# cleanly if pins are not yet populated so a fresh checkout still builds.
airgap-stage:
	@bash scripts/airgap/stage-llamafile.sh dist/airgap

# Run a Perfetto trace_processor SQL query against the most recent
# pipewarden trace. Usage: make trace-query Q=scan_p95
TRACE_FILE ?= /tmp/pipewarden.trace
trace-query:
	@test -n "$(Q)" || (echo "Usage: make trace-query Q=<scan_p95|finding_fanout|gc_during_dlp>" && exit 1)
	@test -f $(TRACE_FILE) || (echo "trace file $(TRACE_FILE) not found; capture one first (PIPEWARDEN_TRACE=1)" && exit 1)
	@which trace_processor >/dev/null 2>&1 || (echo "trace_processor not installed — see docs/sre/trace-cookbook.md" && exit 1)
	trace_processor $(TRACE_FILE) -q scripts/perfetto/$(Q).sql

# Run lint, test, and build
all: lint test build
