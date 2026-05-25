.PHONY: help dev dev-down deploy worker render logs scale-standard scale-pro \
        screen batch seed-kv migrate test clean

RENDER_API   ?= https://api.render.com/v1
SERVICE_NAME ?= amliq-screening

help:        ## Show all commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Local development ─────────────────────────────────────────────────────────

dev:         ## Start full local stack (watchman + postgres + go)
	@echo "Starting local stack..."
	@cp -n .env.example .env 2>/dev/null || true
	docker compose up --build --watch

dev-down:    ## Stop local stack
	docker compose down

dev-logs:    ## Tail all service logs
	docker compose logs -f

dev-reset:   ## Wipe local DB and restart
	docker compose down -v
	docker compose up --build

# ── Deployment ────────────────────────────────────────────────────────────────

deploy:      ## Deploy everything (Worker + Render) — same as pushing to main
	@$(MAKE) worker
	@$(MAKE) render
	@echo "✓ Deployed"

worker:      ## Deploy Cloudflare Worker only
	cd worker && npx wrangler deploy --env production

worker-dev:  ## Deploy Worker to preview environment
	cd worker && npx wrangler deploy --env development

render:      ## Trigger Render deploy via API
	@test -n "$(RENDER_API_KEY)" || (echo "set RENDER_API_KEY" && exit 1)
	@test -n "$(RENDER_SERVICE_ID)" || (echo "set RENDER_SERVICE_ID" && exit 1)
	curl -s -X POST \
	  -H "Authorization: Bearer $(RENDER_API_KEY)" \
	  -H "Content-Type: application/json" \
	  "$(RENDER_API)/services/$(RENDER_SERVICE_ID)/deploys" | jq .

logs:        ## Stream live Render service logs
	@test -n "$(RENDER_API_KEY)" || (echo "set RENDER_API_KEY" && exit 1)
	@test -n "$(RENDER_SERVICE_ID)" || (echo "set RENDER_SERVICE_ID" && exit 1)
	curl -s \
	  -H "Authorization: Bearer $(RENDER_API_KEY)" \
	  "$(RENDER_API)/services/$(RENDER_SERVICE_ID)/logs?tail=true"

# ── Scaling ───────────────────────────────────────────────────────────────────
# Edit render.yaml plan field + push, or use these shortcuts

scale-standard: ## Scale Go service to Standard ($25/month — first customer)
	@echo "Updating render.yaml plan to standard..."
	@sed -i 's/plan: starter/plan: standard/g' render.yaml
	@echo "✓ render.yaml updated — commit and push to apply"

scale-pro:   ## Scale Go service to Pro ($80/month — growth stage)
	@echo "Updating render.yaml plan to pro..."
	@sed -i 's/plan: starter\|plan: standard/plan: pro/g' render.yaml
	@echo "✓ render.yaml updated — commit and push to apply"

scale-db:    ## Scale PostgreSQL to Standard ($20/month)
	@sed -i '/name: amliq-db/,/plan:/s/plan: starter/plan: standard/' render.yaml
	@echo "✓ DB plan updated in render.yaml — commit and push to apply"

# ── Migrations ────────────────────────────────────────────────────────────────

migrate:     ## Run DB migrations against local postgres
	@for f in migrations/*.sql; do \
	  echo "Running $$f..."; \
	  docker compose exec -T postgres psql -U amliq -d amliq < "$$f"; \
	done

# ── Testing the live service ──────────────────────────────────────────────────

screen:      ## Screen a name against the live service (NAME=... make screen)
	@test -n "$(NAME)" || (echo "Usage: NAME='Nicolas Maduro' make screen" && exit 1)
	curl -s -X POST $(or $(API_URL),http://localhost:8080)/screen \
	  -H "Content-Type: application/json" \
	  -d '{"name":"$(NAME)"}' | jq .

screen-ofac: ## Quick OFAC positive test (Maduro)
	curl -s -X POST $(or $(API_URL),http://localhost:8080)/screen \
	  -H "Content-Type: application/json" \
	  -d '{"name":"Nicolas Maduro","nationality":"VE"}' | jq .

screen-clean: ## Quick clean name test
	curl -s -X POST $(or $(API_URL),http://localhost:8080)/screen \
	  -H "Content-Type: application/json" \
	  -d '{"name":"John Smith","dob":"1985-03-15"}' | jq .

batch:       ## Run a batch screen from a JSON file (FILE=... make batch)
	@test -n "$(FILE)" || (echo "Usage: FILE=names.json make batch" && exit 1)
	curl -s -X POST $(or $(API_URL),http://localhost:8080)/screen/batch \
	  -H "Content-Type: application/json" \
	  -d @$(FILE) | jq .

# ── KV management ─────────────────────────────────────────────────────────────

kv-setup:    ## Create KV namespace and update wrangler.toml
	@echo "Creating KV namespaces..."
	@cd worker && npx wrangler kv namespace create SANCTIONS_KV
	@cd worker && npx wrangler kv namespace create SANCTIONS_KV --preview
	@echo "✓ Paste the IDs above into worker/wrangler.toml"

kv-stats:    ## Show KV key counts per prefix
	@cd worker && npx wrangler kv key list --namespace-id=$(KV_NS_ID) \
	  --prefix=exact | wc -l | xargs echo "exact: "
	@cd worker && npx wrangler kv key list --namespace-id=$(KV_NS_ID) \
	  --prefix=ph | wc -l | xargs echo "phonetic: "
	@cd worker && npx wrangler kv key list --namespace-id=$(KV_NS_ID) \
	  --prefix=neg | wc -l | xargs echo "negative cache: "

kv-flush-neg: ## Clear all negative cache entries (after list update)
	@echo "Flushing negative cache — this deletes all neg: KV keys"
	@cd worker && npx wrangler kv key list --namespace-id=$(KV_NS_ID) \
	  --prefix=neg | jq -r '.[].name' | \
	  xargs -I{} npx wrangler kv key delete {} --namespace-id=$(KV_NS_ID)

# ── CI/CD helpers ─────────────────────────────────────────────────────────────

test:        ## Run Go tests
	go test ./... -race -timeout 60s -v

lint:        ## Run golangci-lint
	golangci-lint run ./...

clean:       ## Remove build artefacts
	rm -rf bin/ worker/.wrangler worker/node_modules

# ── Bootstrap (first-time setup) ─────────────────────────────────────────────

bootstrap:   ## First-time setup: creates KV, R2, queue, prints next steps
	@echo ""
	@echo "=== amliq.finance bootstrap ==="
	@echo ""
	@cp -n .env.example .env && echo "✓ .env created from .env.example" || echo "  .env already exists"
	@echo ""
	@echo "Step 1: Log in to Cloudflare"
	@cd worker && npx wrangler login
	@echo ""
	@echo "Step 2: Create KV namespaces"
	@cd worker && npx wrangler kv namespace create SANCTIONS_KV
	@cd worker && npx wrangler kv namespace create SANCTIONS_KV --preview
	@echo ""
	@echo "Step 3: Create R2 bucket"
	@cd worker && npx wrangler r2 bucket create amliq-lists
	@echo ""
	@echo "Step 4: Create queues"
	@cd worker && npx wrangler queues create sanctions-ingest
	@cd worker && npx wrangler queues create sanctions-ingest-dlq
	@echo ""
	@echo "Step 5: Set Worker secrets"
	@read -p "Go service URL (e.g. https://amliq-screening.onrender.com): " url; \
	  cd worker && echo "$$url" | npx wrangler secret put GO_SERVICE_URL
	@read -p "Internal secret (random string): " secret; \
	  cd worker && echo "$$secret" | npx wrangler secret put INTERNAL_SECRET
	@echo ""
	@echo "Step 6: Update worker/wrangler.toml with the KV namespace IDs printed above"
	@echo ""
	@echo "Step 7: Deploy to Render"
	@echo "  → Push this repo to GitHub"
	@echo "  → Go to render.com → New → Blueprint → select your repo"
	@echo "  → Render reads render.yaml and creates all services automatically"
	@echo ""
	@echo "Step 8: Add GitHub secrets for CI/CD:"
	@echo "  CF_API_TOKEN, CF_ACCOUNT_ID, RENDER_API_KEY, RENDER_SERVICE_ID"
	@echo ""
	@echo "=== Done. Run 'make dev' to test locally. ==="
