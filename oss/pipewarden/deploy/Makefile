.PHONY: help build push up down logs clean compose-build compose-up compose-down pages-deploy tunnel-setup

DOCKER_REGISTRY ?= ghcr.io
DOCKER_IMAGE ?= pipewarden
DOCKER_TAG ?= latest
IMAGE_FULL ?= $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG)

help:
	@echo "PipeWarden Deployment"
	@echo "====================="
	@echo "build              - Build Docker image locally"
	@echo "push               - Push image to registry"
	@echo "up                 - Start containers (API + Cloudflare Tunnel)"
	@echo "down               - Stop containers"
	@echo "logs               - View container logs"
	@echo "clean              - Remove containers and volumes"
	@echo "pages-deploy       - Deploy marketing site to Cloudflare Pages"
	@echo "tunnel-setup       - One-time Cloudflare Tunnel setup instructions"
	@echo ""
	@echo "Environment variables:"
	@echo "  DOCKER_REGISTRY  - Container registry (default: ghcr.io)"
	@echo "  DOCKER_IMAGE     - Image name (default: pipewarden)"
	@echo "  DOCKER_TAG       - Image tag (default: latest)"

build:
	@echo "Building Docker image: $(IMAGE_FULL)"
	docker build -t $(IMAGE_FULL) -f ../Dockerfile ..

push: build
	@echo "Pushing image to registry..."
	docker push $(IMAGE_FULL)

compose-build:
	docker compose build

compose-up:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "Fill in PIPEWARDEN_DATABASE_URL, PIPEWARDEN_VAULT_KEY, CLOUDFLARE_TUNNEL_TOKEN then rerun."; \
		exit 1; \
	fi
	docker compose up -d
	@echo "PipeWarden starting. API: https://app.pipewarden.io (via Cloudflare Tunnel)"

compose-down:
	docker compose down

up: compose-up

down: compose-down

logs:
	docker compose logs -f pipewarden

clean:
	docker compose down -v

pages-deploy:
	@echo "Deploying marketing site to Cloudflare Pages..."
	wrangler pages deploy ../website/ --project-name pipewarden-website
	@echo "Site deployed. Add custom domain pipewarden.io in Cloudflare Pages dashboard."

tunnel-setup:
	@echo "Cloudflare Tunnel one-time setup:"
	@echo "  1. cloudflared tunnel login"
	@echo "  2. cloudflared tunnel create pipewarden"
	@echo "  3. cloudflared tunnel route dns pipewarden app.pipewarden.io"
	@echo "  4. cloudflared tunnel token <tunnel-id>  → paste into .env as CLOUDFLARE_TUNNEL_TOKEN"
	@echo "  5. Edit cloudflare/tunnel.yml — replace <YOUR_TUNNEL_ID>"
	@echo "  6. make up"

.PHONY: help build push up down logs clean compose-build compose-up compose-down pages-deploy tunnel-setup
