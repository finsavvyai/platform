.PHONY: install install-dev install-all test test-unit test-integration test-compat \
        lint format check security docker-build docker-up docker-down \
        gateway master worker clean release ll-assert help

PYTHON   := python3
PIP      := pip3
IMAGE    := finsavvyai/finsavvyai
VERSION  := $(shell grep '^version' pyproject.toml | head -1 | cut -d'"' -f2)
PORT     := 8080

# ── Setup ─────────────────────────────────────────────────────────────────────

install:
	$(PIP) install -e .

install-dev:
	$(PIP) install -e ".[dev]"

install-cloud:
	$(PIP) install -e ".[cloud]"

install-local:
	$(PIP) install -e ".[local]"

install-all:
	$(PIP) install -e ".[all]"

# ── Run ───────────────────────────────────────────────────────────────────────

gateway:
	$(PYTHON) -m src.api.gateway --host 0.0.0.0 --port $(PORT)

master:
	$(PYTHON) -m src.core.start_master

worker:
	$(PYTHON) -m src.workers.worker_node

quickstart:
	finsavvyai quickstart

doctor:
	finsavvyai doctor

# ── Test ──────────────────────────────────────────────────────────────────────

test:
	pytest tests/ -v --tb=short --cov=src --cov-report=term-missing --cov-fail-under=40

test-unit:
	pytest tests/unit/ -v --tb=short --cov=src --cov-report=term-missing

test-integration:
	pytest tests/integration/ -v --tb=short -m integration

test-compat:
	pytest tests/integration/test_openai_compat.py -v --tb=short

test-production:
	pytest tests/production/ -v --tb=short

test-load:
	pytest tests/load/ -v --tb=short

ll-assert:
	$(PYTHON) scripts/ll_assert.py

# ── Code quality ──────────────────────────────────────────────────────────────

lint:
	flake8 src/ --max-line-length=120 --ignore=E501,W503

format:
	black src/ tests/ --line-length=100

format-check:
	black src/ tests/ --line-length=100 --check

check: format-check lint

# ── Security ──────────────────────────────────────────────────────────────────

security:
	pip-audit
	bandit -r src/ -ll

# ── Docker ────────────────────────────────────────────────────────────────────

docker-build:
	docker build -t $(IMAGE):$(VERSION) -t $(IMAGE):latest .

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-shell:
	docker compose exec gateway /bin/bash

# ── Release ───────────────────────────────────────────────────────────────────

build:
	$(PYTHON) -m build

release-check:
	twine check dist/*

tag:
	@echo "Tagging v$(VERSION)..."
	git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	git push origin "v$(VERSION)"

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf dist/ build/ *.egg-info/ .coverage coverage.xml htmlcov/ .pytest_cache/

# ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "FinSavvyAI v$(VERSION) — available make targets:"
	@echo ""
	@echo "  Setup:       install | install-dev | install-cloud | install-local | install-all"
	@echo "  Run:         gateway | master | worker | quickstart | doctor"
	@echo "  Test:        test | test-unit | test-integration | test-compat | test-load | ll-assert"
	@echo "  Quality:     lint | format | format-check | check | security"
	@echo "  Docker:      docker-build | docker-up | docker-down | docker-logs | docker-shell"
	@echo "  Release:     build | release-check | tag"
	@echo "  Cleanup:     clean"
	@echo ""
