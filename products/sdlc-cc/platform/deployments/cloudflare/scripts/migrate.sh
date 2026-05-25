#!/bin/bash

# Cloudflare D1 Migration Runner
# This script runs database migrations for Cloudflare D1 databases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
ENVIRONMENT=${1:-development}
DATABASE_NAME=${2:-sdlc-db}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 <development|staging|production> [database_name]"
    exit 1
fi

print_status "Running migrations for environment: $ENVIRONMENT"
print_status "Database: $DATABASE_NAME"
print_status "Migrations directory: $MIGRATIONS_DIR"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if we're authenticated with Cloudflare
if ! wrangler whoami &> /dev/null; then
    print_error "Not authenticated with Cloudflare. Please run: wrangler auth login"
    exit 1
fi

# Function to run migrations for a specific service
run_service_migrations() {
    local service=$1
    local service_migrations_dir="$MIGRATIONS_DIR/$service"

    if [[ ! -d "$service_migrations_dir" ]]; then
        print_warning "No migrations directory found for service: $service"
        return 0
    fi

    print_status "Running migrations for service: $service"

    # Get list of migration files sorted by name
    local migration_files=($(ls -1 "$service_migrations_dir"/*.sql 2>/dev/null | sort))

    if [[ ${#migration_files[@]} -eq 0 ]]; then
        print_warning "No migration files found for service: $service"
        return 0
    fi

    # Create migrations table if it doesn't exist
    print_status "Creating migrations table if needed..."
    wrangler d1 execute "$DATABASE_NAME" --env="$ENVIRONMENT" --command="
        CREATE TABLE IF NOT EXISTS schema_migrations (
            service TEXT NOT NULL,
            filename TEXT NOT NULL,
            executed_at INTEGER NOT NULL,
            checksum TEXT NOT NULL,
            PRIMARY KEY (service, filename)
        );
    " || {
        print_error "Failed to create migrations table"
        return 1
    }

    # Run each migration
    for migration_file in "${migration_files[@]}"; do
        local filename=$(basename "$migration_file")
        local checksum=$(sha256sum "$migration_file" | cut -d' ' -f1)

        print_status "Processing migration: $filename"

        # Check if migration has already been executed
        local already_executed=$(wrangler d1 execute "$DATABASE_NAME" --env="$ENVIRONMENT" --command="
            SELECT COUNT(*) as count FROM schema_migrations
            WHERE service = '$service' AND filename = '$filename' AND checksum = '$checksum';
        " --json | jq -r '.result[0].results[0].count')

        if [[ "$already_executed" == "1" ]]; then
            print_warning "Migration $filename already executed, skipping..."
            continue
        fi

        # Execute migration
        print_status "Executing migration: $filename"
        if wrangler d1 execute "$DATABASE_NAME" --env="$ENVIRONMENT" --file="$migration_file"; then
            print_success "Migration $filename executed successfully"

            # Record migration
            wrangler d1 execute "$DATABASE_NAME" --env="$ENVIRONMENT" --command="
                INSERT OR REPLACE INTO schema_migrations (service, filename, executed_at, checksum)
                VALUES ('$service', '$filename', $(date +%s), '$checksum');
            " || {
                print_error "Failed to record migration: $filename"
                return 1
            }
        else
            print_error "Failed to execute migration: $filename"
            return 1
        fi
    done

    print_success "All migrations completed for service: $service"
    return 0
}

# Main execution
main() {
    print_status "Starting D1 migration process..."

    # List of services to migrate
    local services=("tenants" "auth" "documents" "vector" "policies")

    local failed_services=()

    for service in "${services[@]}"; do
        if ! run_service_migrations "$service"; then
            failed_services+=("$service")
        fi
        echo "----------------------------------------"
    done

    # Summary
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        print_success "All migrations completed successfully!"

        # Show migration status
        print_status "Migration status:"
        wrangler d1 execute "$DATABASE_NAME" --env="$ENVIRONMENT" --command="
            SELECT service, COUNT(*) as migrations_count,
                   MAX(executed_at) as last_execution
            FROM schema_migrations
            GROUP BY service
            ORDER BY service;
        " --json | jq -r '.result[0].results[] | "- \(.service): \(.migrations_count) migrations, last: \(.last_execution)"'

    else
        print_error "Migrations failed for services: ${failed_services[*]}"
        print_error "Please check the error messages above and fix the issues"
        exit 1
    fi
}

# Check if database exists
check_database() {
    print_status "Checking if database exists: $DATABASE_NAME"

    if ! wrangler d1 info "$DATABASE_NAME" --env="$ENVIRONMENT" &> /dev/null; then
        print_warning "Database $DATABASE_NAME does not exist. Creating it..."
        wrangler d1 create "$DATABASE_NAME" --env="$ENVIRONMENT" || {
            print_error "Failed to create database: $DATABASE_NAME"
            exit 1
        }
        print_success "Database created successfully: $DATABASE_NAME"
    else
        print_success "Database exists: $DATABASE_NAME"
    fi
}

# Run the main function
check_database
main

print_success "Migration process completed!"
