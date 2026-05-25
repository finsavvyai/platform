.PHONY: help build test bench lint fmt docker-up docker-down clean install migrate

help:
	@echo "QuantumBeam Makefile"
	@echo "===================="
	@echo "make build       - Build the binary"
	@echo "make test        - Run unit tests"
	@echo "make bench       - Run benchmarks"
	@echo "make lint        - Run linters"
	@echo "make fmt         - Format code"
	@echo "make docker-up   - Start Docker Compose"
	@echo "make docker-down - Stop Docker Compose"
	@echo "make clean       - Clean build artifacts"
	@echo "make install     - Install dependencies"
	@echo "make migrate     - Run database migrations"

VERSION ?= $(shell git describe --tags --always --dirty)
BUILD_ID ?= $(shell git rev-parse --short HEAD)
LDFLAGS := -ldflags="-X main.Version=$(VERSION) -X main.Build=$(BUILD_ID)"

build:
	CGO_ENABLED=0 go build $(LDFLAGS) -o bin/quantumbeam ./cmd/server/main.go

test:
	go test -race -coverprofile=coverage.out -covermode=atomic ./...
	go tool cover -html=coverage.out -o coverage.html

bench:
	go test -bench=. -benchmem -benchtime=10s -run=^$$ ./tests/...

lint:
	golangci-lint run ./...
	go vet ./...

fmt:
	gofmt -s -w .
	go mod tidy

docker-up:
	docker-compose -f deploy/docker-compose.yml up -d

docker-down:
	docker-compose -f deploy/docker-compose.yml down

docker-logs:
	docker-compose -f deploy/docker-compose.yml logs -f quantumbeam

clean:
	rm -rf bin/ coverage.* *.prof
	go clean -cache -testcache

install:
	go mod download
	go mod verify

migrate:
	go run ./cmd/migrate/main.go up

.PHONY: docker-logs
