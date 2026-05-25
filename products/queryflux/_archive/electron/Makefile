# QueryFlux Desktop Makefile
# Provides convenient commands for building and testing the Electron app

.PHONY: help install dev build test clean dist docker release

# Default target
help:
	@echo "QueryFlux Desktop - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  install     Install dependencies"
	@echo "  dev         Start development server"
	@echo "  test        Run tests and linting"
	@echo ""
	@echo "Building:"
	@echo "  build       Build application"
	@echo "  dist        Create distributables"
	@echo "  dist:mac    Build macOS distributables"
	@echo "  dist:win    Build Windows distributables"
	@echo "  dist:linux  Build Linux distributables"
	@echo ""
	@echo "Docker:"
	@echo "  docker:build    Build with Docker"
	@echo "  docker:dev      Run development environment in Docker"
	@echo "  docker:test     Run tests in Docker"
	@echo ""
	@echo "Release:"
	@echo "  release:beta    Create beta release"
	@echo "  release:patch   Create patch release"
	@echo "  release:minor   Create minor release"
	@echo "  release:major   Create major release"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean       Clean build artifacts"
	@echo "  setup:certs Setup code signing certificates"

# Development
install:
	npm ci

dev:
	npm run dev

test:
	npm run typecheck && npm run lint

# Building
build:
	npm run build

dist:
	npm run build:prod

dist:mac:
	npm run build:prod:mac

dist:win:
	npm run build:prod:win

dist:linux:
	npm run build:prod:linux

# Docker
docker:build:
	docker-compose build electron-builder

docker:dev:
	docker-compose up electron-dev

docker:test:
	docker-compose up electron-test

# Release
release:beta:
	npm run release:beta

release:patch:
	npm run release:patch

release:minor:
	npm run release:minor

release:major:
	npm run release:major

# Maintenance
clean:
	npm run clean

setup:certs:
	npm run setup:certs

# Quick commands
quick-test: install test
quick-build: install build
quick-dist: install dist