# QuantumBeam.io Database Makefile
# Simplifies database operations and migration management

.PHONY: help db-up db-down db-migrate db-reset db-seed db-status db-shell db-backup db-logs
.PHONY: test-db test-migration test-performance benchmark-db

# Default variables
COMPOSE_FILE = docker-compose.database.yml
DB_HOST = localhost
DB_PORT = 5432
PGBOUNCER_PORT = 6432
DB_USER = postgres
DB_PASSWORD = postgres
DB_NAME = quantumbeam
DB_TEST_NAME = quantumbeam_test
MIGRATIONS_PATH = ./migrations

# Colors
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m

# Help target
help: ## Show this help message
	@echo "$(BLUE)QuantumBeam.io Database Management$(NC)"
	@echo ""
	@echo "$(GREEN)Database Operations:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Database operations
db-up: ## Start database services (PostgreSQL, PgBouncer, Redis, etc.)
	@echo "$(GREEN)Starting database services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) up -d postgres pgbouncer redis
	@echo "$(BLUE)Waiting for services to be ready...$(NC)"
	@sleep 5
	@make db-status

db-down: ## Stop database services
	@echo "$(YELLOW)Stopping database services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)Database services stopped$(NC)"

db-restart: ## Restart database services
	@make db-down
	@sleep 2
	@make db-up

db-migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	./scripts/migrate.sh up

db-migrate-down: ## Rollback last migration
	@echo "$(YELLOW)Rolling back last migration...$(NC)"
	./scripts/migrate.sh down

db-migrate-create: ## Create a new migration (usage: make db-migrate-create NAME=migration_name)
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)Error: Migration name required$(NC)"; \
		echo "Usage: make db-migrate-create NAME=add_user_table"; \
		exit 1; \
	fi
	@echo "$(GREEN)Creating migration: $(NAME)$(NC)"
	./scripts/migrate.sh create $(NAME)

db-seed: ## Run database seed data
	@echo "$(GREEN)Running seed data...$(NC)"
	./scripts/migrate.sh seed

db-reset: ## Reset database (drop and recreate)
	@echo "$(RED)WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		echo "$(RED)Dropping all tables...$(NC)"; \
		./scripts/migrate.sh clean; \
		echo "$(GREEN)Running migrations...$(NC)"; \
		make db-migrate; \
		echo "$(GREEN)Running seed data...$(NC)"; \
		make db-seed; \
	else \
		echo ""; \
		echo "$(YELLOW)Operation cancelled$(NC)"; \
	fi

db-status: ## Show database and migration status
	@echo "$(BLUE)Database Services Status:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps postgres pgbouncer redis
	@echo ""
	@echo "$(BLUE)Migration Status:$(NC)"
	@./scripts/migrate.sh status || true

db-shell: ## Connect to database shell (psql)
	@echo "$(GREEN)Connecting to PostgreSQL...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME)

db-shell-pgbouncer: ## Connect to database through PgBouncer
	@echo "$(GREEN)Connecting to PostgreSQL via PgBouncer...$(NC)"
	@PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(PGBOUNCER_PORT) -U $(DB_USER) -d $(DB_NAME)

db-backup: ## Create database backup (usage: make db-backup NAME=backup_name)
	@if [ -z "$(NAME)" ]; then \
		NAME="quantumbeam-backup-$$(date +%Y%m%d-%H%M%S)"; \
	fi; \
	echo "$(GREEN)Creating backup: $$NAME.sql$(NC)"; \
	docker-compose -f $(COMPOSE_FILE) exec postgres pg_dump -U $(DB_USER) -d $(DB_NAME) > "./backups/$$NAME.sql"; \
	echo "$(GREEN)Backup saved to ./backups/$$NAME.sql$(NC)"

db-restore: ## Restore database from backup (usage: make db-restore FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: Backup file required$(NC)"; \
		echo "Usage: make db-restore FILE=backup.sql"; \
		exit 1; \
	fi; \
	if [ ! -f "$(FILE)" ]; then \
		echo "$(RED)Error: Backup file not found: $(FILE)$(NC)"; \
		exit 1; \
	fi; \
	echo "$(RED)WARNING: This will replace all data!$(NC)"; \
	read -p "Continue? (y/N) " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		echo "$(GREEN)Restoring from $(FILE)...$(NC)"; \
		docker-compose -f $(COMPOSE_FILE) exec -T postgres psql -U $(DB_USER) -d $(DB_NAME) < $(FILE); \
		echo "$(GREEN)Restore completed$(NC)"; \
	else \
		echo ""; \
		echo "$(YELLOW)Operation cancelled$(NC)"; \
	fi

db-logs: ## Show database logs
	@echo "$(BLUE)PostgreSQL logs:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) logs -f postgres

db-logs-pgbouncer: ## Show PgBouncer logs
	@echo "$(BLUE)PgBouncer logs:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) logs -f pgbouncer

# Partition management
partitions-create: ## Create new monthly partitions
	@echo "$(GREEN)Creating monthly partitions...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "SELECT create_monthly_partitions('transactions', 3);"

partitions-drop: ## Drop old partitions (older than 12 months)
	@echo "$(YELLOW)Dropping old partitions...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "SELECT drop_old_partitions('transactions', 12);"

partitions-list: ## List all partitions
	@echo "$(BLUE)Transaction partitions:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE tablename LIKE 'transactions_%' ORDER BY tablename DESC;"

# Maintenance
db-vacuum: ## Run VACUUM ANALYZE
	@echo "$(GREEN)Running VACUUM ANALYZE...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "VACUUM ANALYZE;"

db-analyze: ## Update table statistics
	@echo "$(GREEN)Updating statistics...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "ANALYZE;"

db-reindex: ## Reindex all tables
	@echo "$(GREEN)Reindexing tables...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "REINDEX DATABASE $(DB_NAME);"

# Testing
test-db: ## Run database tests
	@echo "$(GREEN)Running database tests...$(NC)"
	@go test -v ./internal/database/... -tags=database

test-migration: ## Test migration rollback and reapply
	@echo "$(GREEN)Testing migration rollback...$(NC)"
	@./scripts/migrate.sh down || true
	@echo "$(GREEN)Testing migration reapply...$(NC)"
	@./scripts/migrate.sh up
	@echo "$(GREEN)Migration test completed$(NC)"

test-connection: ## Test database connection
	@echo "$(GREEN)Testing connection to PostgreSQL...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres pg_isready -U $(DB_USER) -d $(DB_NAME)
	@echo "$(GREEN)Testing connection to PgBouncer...$(NC)"
	@PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(PGBOUNCER_PORT) -U $(DB_USER) -d $(DB_NAME) -c "SELECT 1 as test;" > /dev/null
	@echo "$(GREEN)All connections successful$(NC)"

test-performance: ## Run performance tests
	@echo "$(GREEN)Running performance tests...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "
	EXPLAIN ANALYZE
	SELECT t.*, u.email
	FROM transactions t
	JOIN users u ON t.user_id = u.id
	WHERE t.created_at >= CURRENT_DATE - INTERVAL '7 days'
	ORDER BY t.created_at DESC
	LIMIT 100;
	"

benchmark-db: ## Benchmark database performance
	@echo "$(GREEN)Running database benchmark...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres pgbench -h localhost -p 5432 -U $(DB_USER) -d $(DB_NAME) -i -s 10 || true
	@echo "$(GREEN)Running benchmark...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres pgbench -h localhost -p 5432 -U $(DB_USER) -d $(DB_NAME) -c 10 -j 2 -t 1000 || true

# Monitoring
monitor-connections: ## Show active connections
	@echo "$(BLUE)Active connections:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "
	SELECT
		state,
		COUNT(*) as connections,
		ROUND(AVG(EXTRACT(EPOCH FROM (now() - query_start)))) as avg_runtime_sec
	FROM pg_stat_activity
	WHERE datname = '$(DB_NAME)'
	GROUP BY state
	ORDER BY connections DESC;
	"

monitor-sizes: ## Show table sizes
	@echo "$(BLUE)Table sizes:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "
	SELECT
		schemaname,
		tablename,
		pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
		pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
		pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
	FROM pg_tables
	WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'partition_maintenance')
	ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
	"

monitor-queries: ## Show slow queries
	@echo "$(BLUE)Slow queries (pg_stat_statements):$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U $(DB_USER) -d $(DB_NAME) -c "
	SELECT
		query,
		calls,
		total_exec_time,
		mean_exec_time,
		rows
	FROM pg_stat_statements
	ORDER BY mean_exec_time DESC
	LIMIT 10;
	" || echo "Enable pg_stat_statements to track slow queries"

# Development shortcuts
dev-setup: ## Set up development environment
	@echo "$(GREEN)Setting up development environment...$(NC)"
	@mkdir -p backups logs
	@make db-up
	@sleep 10
	@make db-migrate
	@make db-seed
	@echo "$(GREEN)Development environment ready!$(NC)"

dev-reset: ## Reset development environment
	@make db-down
	@docker volume rm quantumbeam_postgres_data || true
	@make dev-setup

# Production helpers
prod-backup: ## Production backup (requires PROD_* env vars)
	@if [ -z "$(PROD_HOST)" ] || [ -z "$(PROD_PASSWORD)" ]; then \
		echo "$(RED)Error: Production environment variables required$(NC)"; \
		echo "Set PROD_HOST, PROD_PASSWORD, and PROD_DB_NAME"; \
		exit 1; \
	fi
	@echo "$(GREEN)Creating production backup...$(NC)"
	@PGPASSWORD=$(PROD_PASSWORD) pg_dump -h $(PROD_HOST) -U $(PROD_USER) -d $(PROD_DB_NAME) > "./backups/prod-backup-$$(date +%Y%m%d-%H%M%S).sql"
	@echo "$(GREEN)Production backup completed$(NC)"

# Health checks
health-check: ## Run comprehensive health check
	@echo "$(BLUE)Running health check...$(NC)"
	@echo "Checking PostgreSQL..."
	@docker-compose -f $(COMPOSE_FILE) exec postgres pg_isready -U $(DB_USER) -d $(DB_NAME) || (echo "$(RED)PostgreSQL not ready$(NC)" && exit 1)
	@echo "Checking PgBouncer..."
	@nc -z localhost $(PGBOUNCER_PORT) || (echo "$(RED)PgBouncer not responding$(NC)" && exit 1)
	@echo "Checking Redis..."
	@docker-compose -f $(COMPOSE_FILE) exec redis redis-cli ping || (echo "$(RED)Redis not responding$(NC)" && exit 1)
	@echo "$(GREEN)All services healthy$(NC)"

# Clean up
clean: ## Clean up database containers and volumes
	@echo "$(RED)WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		echo "$(RED)Removing containers and volumes...$(NC)"; \
		docker-compose -f $(COMPOSE_FILE) down -v; \
		docker system prune -f; \
		echo "$(GREEN)Cleanup completed$(NC)"; \
	else \
		echo ""; \
		echo "$(YELLOW)Operation cancelled$(NC)"; \
	fi

# Initialize
init: ## Initialize everything (first-time setup)
	@echo "$(GREEN)Initializing QuantumBeam database...$(NC)"
	@mkdir -p backups logs data/{postgres,redis,influxdb,elasticsearch,clickhouse,kafka,minio}
	@make db-up
	@sleep 15
	@./scripts/migrate.sh setup
	@make db-migrate
	@make db-seed
	@echo "$(GREEN)Initialization complete!$(NC)"
	@echo ""
	@echo "$(BLUE)Next steps:$(NC)"
	@echo "1. Run 'make db-shell' to connect to the database"
	@echo "2. Run 'make test-connection' to verify connections"
	@echo "3. Run 'make monitor-sizes' to see table sizes"
