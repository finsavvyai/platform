.PHONY: build test test-cover lint clean dev-landing dev-dashboard dev-api \
       build-landing build-dashboard deploy install release help audit audit-live audit-enterprise

BINARY := pushci
BUILD_DIR := bin
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-s -w -X main.version=$(VERSION)"

PLATFORMS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64

build:
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY) ./cmd/pushci

test:
	go test ./...

test-cover:
	go test -cover ./...

lint:
	go vet ./...

clean:
	rm -rf $(BUILD_DIR)

dev-landing:
	cd web/landing && npm run dev

dev-dashboard:
	cd web/dashboard && npm run dev

dev-api:
	cd api && npx wrangler dev

build-landing:
	cd web/landing && npm run build

build-dashboard:
	cd web/dashboard && npm run build

deploy:
	./deploy-cloudflare.sh

install:
	go install $(LDFLAGS) ./cmd/pushci

release: clean
	@mkdir -p $(BUILD_DIR)
	@for platform in $(PLATFORMS); do \
		OS=$${platform%/*}; \
		ARCH=$${platform#*/}; \
		EXT=""; \
		if [ "$$OS" = "windows" ]; then EXT=".exe"; fi; \
		OUT=$(BUILD_DIR)/$(BINARY)-$$OS-$$ARCH$$EXT; \
		echo "Building $$OS/$$ARCH..."; \
		GOOS=$$OS GOARCH=$$ARCH go build $(LDFLAGS) -o $$OUT ./cmd/pushci; \
	done
	@echo "Release binaries in $(BUILD_DIR)/"

audit:
	@bash audit/run.sh

audit-live:
	@PUSHCI_LIVE=1 bash audit/run.sh

audit-enterprise:
	@bash audit/checks/enterprise.sh

help:
	@echo "PushCI Makefile Targets:"
	@echo "  build            Build the pushci binary"
	@echo "  test             Run all Go tests"
	@echo "  test-cover       Run tests with coverage"
	@echo "  lint             Run go vet"
	@echo "  clean            Remove bin/ directory"
	@echo "  dev-landing      Start landing page dev server"
	@echo "  dev-dashboard    Start dashboard dev server"
	@echo "  dev-api          Start API dev server (wrangler)"
	@echo "  build-landing    Build landing page for production"
	@echo "  build-dashboard  Build dashboard for production"
	@echo "  deploy           Deploy via deploy-cloudflare.sh"
	@echo "  install          Install pushci to GOPATH/bin"
	@echo "  release          Cross-compile for all platforms"
	@echo "  audit            Run promise-vs-reality audit harness (offline)"
	@echo "  audit-live       Same as 'audit' plus live-site network probes"
	@echo "  audit-enterprise Static inventory of enterprise capabilities"
	@echo "  help             Show this help message"
