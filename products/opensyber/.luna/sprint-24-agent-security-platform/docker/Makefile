.PHONY: help build dev prod down logs clean test shell-web shell-mock

# Default target
help:
	@echo "OpenSyber Docker Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-web      - Start only web application"
	@echo "  make dev-token    - Start only TokenForge web"
	@echo "  make dev-mock     - Start only mock API"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-web     - Run web tests"
	@echo "  make test-api     - Run API tests"
	@echo ""
	@echo "Building:"
	@echo "  make build        - Build all Docker images"
	@echo "  make build-web    - Build web image"
	@echo "  make build-mock   - Build mock API image"
	@echo ""
	@echo "Utilities:"
	@echo "  make up           - Start services"
	@echo "  make down         - Stop services"
	@echo "  make restart      - Restart services"
	@echo "  make logs         - View logs"
	@echo "  make clean        - Clean containers and volumes"
	@echo ""
	@echo "Shell Access:"
	@echo "  make shell-web    - Access web container shell"
	@echo "  make shell-mock   - Access mock API shell"

# Docker Compose files
COMPOSE_FILES := -f ../../.luna/sprint-24-agent-security-platform/docker/docker-compose.yml
PROJECT_NAME := opensyber

# Build targets
build: build-web build-mock

build-web:
	docker-compose $(COMPOSE_FILES) build web

build-mock:
	docker-compose $(COMPOSE_FILES) build mock-api

# Development targets
dev:
	docker-compose $(COMPOSE_FILES) up

dev-web:
	docker-compose $(COMPOSE_FILES) up web

dev-token:
	docker-compose $(COMPOSE_FILES) up tokenforge-web

dev-mock:
	docker-compose $(COMPOSE_FILES) up mock-api

# Production targets
prod:
	docker-compose $(COMPOSE_FILES) up -d

# Service control
up:
	docker-compose $(COMPOSE_FILES) up -d

down:
	docker-compose $(COMPOSE_FILES) down

restart:
	docker-compose $(COMPOSE_FILES) restart

logs:
	docker-compose $(COMPOSE_FILES) logs -f

logs-web:
	docker-compose $(COMPOSE_FILES) logs -f web

logs-mock:
	docker-compose $(COMPOSE_FILES) logs -f mock-api

# Testing targets
test:
	docker-compose $(COMPOSE_FILES) run --rm web pnpm test

test-web:
	docker-compose $(COMPOSE_FILES) run --rm web sh -c "cd apps/web && pnpm test"

test-api:
	docker-compose $(COMPOSE_FILES) run --rm web sh -c "cd apps/api && pnpm test"

test-e2e:
	docker-compose $(COMPOSE_FILES) run --rm web sh -c "cd apps/web && pnpm test:e2e"

# Shell access
shell-web:
	docker-compose $(COMPOSE_FILES) exec web /bin/sh

shell-mock:
	docker-compose $(COMPOSE_FILES) exec mock-api /bin/sh

# Cleanup targets
clean: down
	docker-compose $(COMPOSE_FILES) down -v
	docker system prune -f
	@echo "Cleaned up containers, volumes, and unused images"

clean-all:
	docker-compose $(COMPOSE_FILES) down -v --rmi all
	docker system prune -a -f
	@echo "Removed all containers, volumes, and images"

# Utilities
ps:
	docker-compose $(COMPOSE_FILES) ps

inspect:
	docker inspect $$(docker-compose $(COMPOSE_FILES) ps -q)

health:
	@echo "Checking service health..."
	@docker-compose $(COMPOSE_FILES) ps
	@echo ""
	@echo "Web App: http://localhost:3000"
	@echo "TokenForge: http://localhost:3001"
	@echo "Mock API: http://localhost:8787"

# Install express for mock API
setup-mock-api:
	@echo "Setting up mock API dependencies..."
	@mkdir -p ../../.luna/sprint-24-agent-security-platform/docker/mock-api
	@cd ../../.luna/sprint-24-agent-security-platform/docker && \
		npm init -y && \
		npm install express cors
	@cp mock-server.js ../../.luna/sprint-24-agent-security-platform/docker/mock-server.js
	@echo "Mock API setup complete!"
