#!/bin/bash
# Database Migration Script using golang-migrate
# Usage: ./migrate.sh [command] [args]
# Commands: up, down, version, force, create, goto

set -e

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-quantumbeam}
DB_SSL_MODE=${DB_SSL_MODE:-disable}

# Use PgBouncer if enabled
USE_PGBOUNCER=${USE_PGBOUNCER:-true}
if [ "$USE_PGBOUNCER" = "true" ]; then
    DB_PORT=${PGBOUNCER_PORT:-6432}
fi

# Database URL
DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSL_MODE}&x-migrations-table=schema_migrations"

# Migration files path
MIGRATIONS_PATH=${MIGRATIONS_PATH:-./migrations}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if migrate is installed
check_migrate() {
    if ! command -v migrate &> /dev/null; then
        print_error "golang-migrate is not installed"
        echo "Please install it using:"
        echo "  - macOS: brew install golang-migrate"
        echo "  - Linux: curl -L https://packagecloud.io/golang-migrate/migrate/gpgkey | sudo apt-key add -"
        echo "           echo 'deb https://packagecloud.io/golang-migrate/migrate/ubuntu/ $(lsb_release -cs) main' | sudo tee /etc/apt/sources.list.d/migrate.list"
        echo "           sudo apt-get update"
        echo "           sudo apt-get install migrate"
        exit 1
    fi
}

# Wait for database to be ready
wait_for_db() {
    print_status "Waiting for database to be ready..."

    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\l' &> /dev/null; then
            print_status "Database is ready"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done

    print_error "Database is not ready after ${max_attempts} attempts"
    exit 1
}

# Create migration directory if it doesn't exist
ensure_migration_dir() {
    if [ ! -d "$MIGRATIONS_PATH" ]; then
        print_status "Creating migrations directory: $MIGRATIONS_PATH"
        mkdir -p "$MIGRATIONS_PATH"
    fi
}

# Create a new migration
create_migration() {
    local name=$1
    if [ -z "$name" ]; then
        print_error "Migration name is required"
        echo "Usage: $0 create <migration_name>"
        exit 1
    fi

    ensure_migration_dir

    local timestamp=$(date +%Y%m%d%H%M%S)
    local filename="${timestamp}_${name}.sql"

    print_status "Creating migration: $filename"

    cat > "${MIGRATIONS_PATH}/${filename}" <<EOF
-- Migration: ${name}
-- Created: $(date)
-- Description: ${name}

-- +goose Up
-- SQL in this section is executed when the migration is applied.

-- Add your UP migration SQL here

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.

-- Add your DOWN migration SQL here
EOF

    print_status "Migration created: ${MIGRATIONS_PATH}/${filename}"
}

# Main migration commands
case "${1:-help}" in
    "up")
        check_migrate
        wait_for_db
        print_status "Running migrations UP..."
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" up
        print_status "All migrations applied successfully"
        ;;

    "down")
        check_migrate
        wait_for_db
        print_status "Running migrations DOWN (rolling back one migration)..."
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" down 1
        print_status "Migration rolled back successfully"
        ;;

    "version")
        check_migrate
        wait_for_db
        print_status "Getting current migration version..."
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" version
        ;;

    "force")
        check_migrate
        if [ -z "$2" ]; then
            print_error "Version number is required"
            echo "Usage: $0 force <version>"
            exit 1
        fi
        print_warning "Forcing migration version to $2"
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" force $2
        print_status "Migration version forced to $2"
        ;;

    "goto")
        check_migrate
        if [ -z "$2" ]; then
            print_error "Version number is required"
            echo "Usage: $0 goto <version>"
            exit 1
        fi
        wait_for_db
        print_status "Migrating to version $2..."
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" goto $2
        print_status "Migration completed"
        ;;

    "create")
        create_migration "$2"
        ;;

    "redo")
        check_migrate
        wait_for_db
        print_status "Rolling back last migration..."
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" down 1
        print_status "Re-applying migration..."
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" up 1
        print_status "Migration redone successfully"
        ;;

    "reset")
        check_migrate
        wait_for_db
        print_warning "This will rollback ALL migrations. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            print_status "Rolling back all migrations..."
            migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" down -1
            print_status "All migrations rolled back"
        else
            print_status "Reset cancelled"
        fi
        ;;

    "clean")
        check_migrate
        print_warning "This will drop ALL tables. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            print_status "Dropping all tables..."
            migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" drop
            print_status "All tables dropped"
        else
            print_status "Clean cancelled"
        fi
        ;;

    "seed")
        print_status "Running seed data..."
        if [ -f "./database/seeds/001_initial_seed_data.sql" ]; then
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ./database/seeds/001_initial_seed_data.sql
            print_status "Seed data applied successfully"
        else
            print_error "Seed file not found: ./database/seeds/001_initial_seed_data.sql"
        fi
        ;;

    "status")
        check_migrate
        wait_for_db
        print_status "Migration status:"
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" version
        print_status "Pending migrations:"
        migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" pending 2>/dev/null || print_status "No pending migrations"
        ;;

    "setup")
        print_status "Setting up migration environment..."

        # Check dependencies
        check_migrate

        # Create directories
        mkdir -p migrations
        mkdir -p logs

        # Create first migration if it doesn't exist
        if [ ! -f "$MIGRATIONS_PATH/000001_initial_schema.up.sql" ]; then
            print_status "Creating initial migration files..."

            # Create up migration
            cat > "${MIGRATIONS_PATH}/000001_initial_schema.up.sql" <<'EOF'
-- Initial schema for QuantumBeam.io
-- This file is auto-generated from database/schemas/001_initial_schema.sql

\i database/extensions/001_install_extensions.sql
\i database/schemas/001_initial_schema.sql
EOF

            # Create down migration
            cat > "${MIGRATIONS_PATH}/000001_initial_schema.down.sql" <<'EOF'
-- Drop all tables and extensions for QuantumBeam.io

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS analytics.transaction_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS transaction_stats CASCADE;
DROP VIEW IF EXISTS transaction_analytics CASCADE;
DROP VIEW IF EXISTS high_risk_transactions CASCADE;
DROP VIEW IF EXISTS active_transactions CASCADE;
DROP TABLE IF EXISTS quantum_models CASCADE;
DROP TABLE IF EXISTS fraud_rules CASCADE;
DROP TABLE IF EXISTS audit.audit_log CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop extensions
DROP EXTENSION IF EXISTS tablefunc CASCADE;
DROP EXTENSION IF EXISTS unaccent CASCADE;
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DROP EXTENSION IF EXISTS fuzzystrmatch CASCADE;
DROP EXTENSION IF EXISTS pg_partman CASCADE;
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_stat_statements CASCADE;
DROP EXTENSION IF EXISTS ltree CASCADE;
DROP EXTENSION IF EXISTS hstore CASCADE;
DROP EXTENSION IF EXISTS intarray CASCADE;
DROP EXTENSION IF EXISTS btree_gist CASCADE;
DROP EXTENSION IF EXISTS btree_gin CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
DROP EXTENSION IF EXISTS uuid-ossp CASCADE;
EOF

            print_status "Initial migration files created"
        fi

        # Copy existing schema files to migrations directory
        if [ -f "./database/schemas/001_initial_schema.sql" ] && [ ! -f "${MIGRATIONS_PATH}/000002_initial_schema.up.sql" ]; then
            print_status "Creating migration for existing schema..."
            cp ./database/schemas/001_initial_schema.sql "${MIGRATIONS_PATH}/000002_initial_schema.up.sql"
            # Create empty down migration for safety
            touch "${MIGRATIONS_PATH}/000002_initial_schema.down.sql"
        fi

        print_status "Migration environment setup complete"
        ;;

    "help"|*)
        echo "QuantumBeam.io Database Migration Tool"
        echo ""
        echo "Usage: $0 [command] [args]"
        echo ""
        echo "Commands:"
        echo "  up          Apply all pending migrations"
        echo "  down        Roll back the last migration"
        echo "  version     Display current migration version"
        echo "  force <v>   Set migration version (bypass validation)"
        echo "  goto <v>    Migrate to specific version"
        echo "  create <n>  Create a new migration with name <n>"
        echo "  redo        Roll back and re-apply the last migration"
        echo "  reset       Roll back all migrations (destructive)"
        echo "  clean       Drop all tables (destructive)"
        echo "  seed        Run seed data"
        echo "  status      Show migration status and pending migrations"
        echo "  setup       Initialize migration environment"
        echo "  help        Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  DB_HOST         Database host (default: localhost)"
        echo "  DB_PORT         Database port (default: 5432)"
        echo "  DB_USER         Database user (default: postgres)"
        echo "  DB_PASSWORD     Database password (default: postgres)"
        echo "  DB_NAME         Database name (default: quantumbeam)"
        echo "  DB_SSL_MODE     SSL mode (default: disable)"
        echo "  PGBOUNCER_PORT  PgBouncer port (default: 6432)"
        echo "  USE_PGBOUNCER   Use PgBouncer (default: true)"
        echo "  MIGRATIONS_PATH Migration files path (default: ./migrations)"
        echo ""
        echo "Examples:"
        echo "  $0 up                    # Apply all migrations"
        echo "  $0 create add_user_table # Create new migration"
        echo "  $0 down                  # Roll back last migration"
        echo "  $0 status                # Show status"
        ;;
esac
